import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { configureReminderNotificationHandler, listenReminderTaps } from '../utils/kaihReminders';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const msg = String(event?.reason?.message || event?.reason || '');
    if (msg.includes('timeout exceeded') || msg.includes('fontfaceobserver')) {
      event.preventDefault();
      console.warn('Suppressed non-fatal font timeout:', msg);
    }
  });
}

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
        Terjadi Kendala Tampilan
      </Text>
      <Text style={{ color: '#cbd5e1', fontSize: 13, textAlign: 'center', marginBottom: 20 }}>
        {error?.message || 'Error tidak diketahui'}
      </Text>
      <TouchableOpacity
        onPress={retry}
        style={{ backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Coba Lagi</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function RootLayout() {
  // Pengingat ceklis: atur tampilan notifikasi & buka layar ceklis saat notifikasi diketuk
  useEffect(() => {
    configureReminderNotificationHandler();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const stopListening = listenReminderTaps((planId) => {
      // Jeda singkat agar proses pengecekan login di layar awal selesai lebih dulu
      const t = setTimeout(() => {
        try {
          router.push({
            pathname: '/input',
            params: planId ? { mode: 'realize', planId } : { mode: 'realize' },
          });
        } catch {}
      }, 1200);
      timers.push(t);
    });
    return () => {
      stopListening();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0f1413' },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="biodata" options={{ headerShown: false }} />
      <Stack.Screen name="input" options={{ headerShown: false }} />
    </Stack>
  );
}
