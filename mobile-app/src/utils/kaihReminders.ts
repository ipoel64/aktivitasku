import { Platform } from 'react-native';
import {
  ParsedActivity,
  KAIH_CATEGORIES_LIST,
  matchKaihCategoryKey,
  getRealizationWindow,
} from './kaihPlanUtils';

/**
 * Pengingat (alarm / notifikasi lokal) untuk ceklis realisasi 7 KAIH.
 *
 * Setiap kegiatan berstatus RENCANA dijadwalkan sebuah notifikasi tepat pada jam rencananya,
 * supaya siswa tidak lupa mengisi ceklis realisasi. Notifikasi dijadwalkan di HP (lokal),
 * sehingga tetap berbunyi walaupun aplikasi sedang ditutup atau HP tidak memiliki internet.
 *
 * Semua fungsi di sini aman dipanggil di mana saja: jika modul native `expo-notifications`
 * tidak tersedia (misalnya APK versi lama / web), fungsi diam-diam tidak melakukan apa-apa.
 */

export const REMINDER_CHANNEL_ID = 'kaih-reminders';
const MAX_SCHEDULED_REMINDERS = 40; // batas aman jumlah alarm terjadwal di Android

function getNotifications(): any | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return null;
  }
}

/**
 * Mengatur cara notifikasi tampil saat aplikasi sedang terbuka (banner + suara).
 */
export function configureReminderNotificationHandler() {
  const N = getNotifications();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {}
}

async function ensureAndroidChannel(N: any) {
  if (Platform.OS !== 'android') return;
  try {
    await N.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Pengingat Ceklis 7 KAIH',
      description: 'Alarm pengingat saat tiba waktu kegiatan 7 KAIH yang sudah direncanakan',
      importance: N.AndroidImportance?.MAX ?? 5,
      vibrationPattern: [0, 400, 250, 400],
      lightColor: '#2563EB',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
      lockscreenVisibility: N.AndroidNotificationVisibility?.PUBLIC ?? 1,
    });
  } catch {}
}

/**
 * Memastikan izin notifikasi sudah diberikan (meminta izin bila belum).
 */
export async function ensureReminderPermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  try {
    await ensureAndroidChannel(N);
    const current = await N.getPermissionsAsync();
    if (current?.granted) return true;
    if (current?.canAskAgain === false) return false;
    const requested = await N.requestPermissionsAsync();
    return Boolean(requested?.granted);
  } catch {
    return false;
  }
}

function buildPlannedDate(activityDate: string, plannedTime: string): Date | null {
  const dp = String(activityDate || '').split('-');
  const tp = String(plannedTime || '').split(':');
  if (dp.length !== 3 || tp.length < 2) return null;
  const d = new Date(
    Number(dp[0]),
    Number(dp[1]) - 1,
    Number(dp[2]),
    Number(tp[0]),
    Number(tp[1]),
    0,
    0
  );
  return isNaN(d.getTime()) ? null : d;
}

// Antrian agar sinkronisasi yang dipanggil beruntun tidak saling bertabrakan / menggandakan alarm
let syncQueue: Promise<any> = Promise.resolve();

async function runSync(activities: ParsedActivity[]): Promise<number> {
  const N = getNotifications();
  if (!N) return 0;

  try {
    const granted = await ensureReminderPermission();
    await N.cancelAllScheduledNotificationsAsync();
    if (!granted) return 0;

    const now = Date.now();
    const { todayStr } = getRealizationWindow();

    const upcoming = (activities || [])
      .filter((a) => a.kaihStatus === 'RENCANA' && a.activity_date && a.activity_date >= todayStr)
      .map((a) => ({ act: a, when: buildPlannedDate(a.activity_date, a.plannedTime) }))
      .filter((x) => x.when && x.when.getTime() > now + 5000)
      .sort((x, y) => (x.when as Date).getTime() - (y.when as Date).getTime())
      .slice(0, MAX_SCHEDULED_REMINDERS);

    let scheduled = 0;
    for (const { act, when } of upcoming) {
      const catKey = matchKaihCategoryKey(act.title);
      const cat = KAIH_CATEGORIES_LIST.find((c) => c.key === catKey);
      const catName = cat?.name || act.title || 'Kegiatan';
      const icon = cat?.icon || '⏰';
      const timeLabel = String(act.plannedTime || '').slice(0, 5);

      try {
        await N.scheduleNotificationAsync({
          content: {
            title: `${icon} Waktunya ${catName}!`,
            body: `${act.description} (${timeLabel} WIB). Jangan lupa isi ceklis realisasinya ya.`,
            sound: 'default',
            priority: N.AndroidNotificationPriority?.MAX ?? 'max',
            data: { planId: String(act.id), activityDate: act.activity_date },
          },
          trigger: {
            type: N.SchedulableTriggerInputTypes?.DATE ?? 'date',
            date: when as Date,
            channelId: REMINDER_CHANNEL_ID,
          },
        });
        scheduled += 1;
      } catch {}
    }
    return scheduled;
  } catch {
    return 0;
  }
}

/**
 * Menjadwalkan ulang seluruh pengingat berdasarkan daftar aktivitas terbaru.
 * Kegiatan yang sudah diceklis (REALISASI) otomatis tidak lagi diingatkan.
 */
export function syncKaihReminders(activities: ParsedActivity[]): Promise<number> {
  syncQueue = syncQueue.then(() => runSync(activities)).catch(() => 0);
  return syncQueue;
}

/**
 * Menghapus semua pengingat terjadwal (misalnya saat siswa keluar akun).
 */
export async function cancelAllKaihReminders() {
  const N = getNotifications();
  if (!N) return;
  try {
    await N.cancelAllScheduledNotificationsAsync();
  } catch {}
}

/**
 * Mendengarkan ketukan pada notifikasi pengingat. `onOpen` menerima planId kegiatan terkait.
 * Mengembalikan fungsi untuk berhenti mendengarkan.
 */
export function listenReminderTaps(onOpen: (planId?: string) => void): () => void {
  const N = getNotifications();
  if (!N) return () => {};

  const handledIds = new Set<string>();
  const handle = (response: any) => {
    try {
      const id = String(response?.notification?.request?.identifier || '');
      if (id && handledIds.has(id)) return;
      if (id) handledIds.add(id);
      const data = response?.notification?.request?.content?.data || {};
      onOpen(data.planId ? String(data.planId) : undefined);
    } catch {}
  };

  try {
    // Kasus aplikasi baru terbuka karena notifikasi diketuk (aplikasi sebelumnya tertutup)
    if (typeof N.getLastNotificationResponseAsync === 'function') {
      N.getLastNotificationResponseAsync()
        .then((resp: any) => {
          if (resp) handle(resp);
        })
        .catch(() => {});
    }
    const sub = N.addNotificationResponseReceivedListener(handle);
    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  } catch {
    return () => {};
  }
}
