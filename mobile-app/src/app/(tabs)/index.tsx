import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  RefreshControl,
  StatusBar,
  Modal,
  Animated,
  Easing
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/colors';
import kaihLogoAsset from '../../../assets/kaih_logo.png';
import { WebView } from 'react-native-webview';
import { KaihLoadingScreen } from '../../components/KaihLoadingLogo';
import { getUserStudentProfile, isProfileComplete } from '../../utils/userCache';
import {
  KAIH_CATEGORY_ICON_CONFIG,
  DEFAULT_CATEGORY_IMAGES,
  DEFAULT_KAIH_LOCAL_ASSETS,
  parseAndDeduplicateActivities,
  getTodayAndTomorrowDates,
  matchKaihCategoryKey,
  compareByStartTime,
  getDayProgress,
  getRealizationEligibility,
} from '../../utils/kaihPlanUtils';

const formatItemDateTime = (item: any) => {
  if (!item) return { timeStr: '00:00', fullDateHeader: '', fullDateLong: '' };

  let year: number, month: number, day: number;
  let hours: number = 0, minutes: number = 0;

  if (item.activity_date) {
    const parts = item.activity_date.split('-');
    year = Number(parts[0]);
    month = Number(parts[1]) - 1;
    day = Number(parts[2]);
  } else {
    const d = new Date(item.created_at);
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
  }

  if (item.activity_time) {
    const tParts = item.activity_time.split(':');
    hours = Number(tParts[0]);
    minutes = Number(tParts[1]);
  } else {
    const d = new Date(item.created_at);
    hours = d.getHours();
    minutes = d.getMinutes();
  }

  const localDate = new Date(year, month, day, hours, minutes);
  const pad = (n: number) => (n < 10 ? '0' + n : n);
  const timeStr = `${pad(hours)}:${pad(minutes)}`;
  const dayName = localDate.toLocaleDateString('id-ID', { weekday: 'long' });
  const dateShort = localDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const fullDateHeader = `${dayName}, ${dateShort}`;
  const fullDateLong = `${localDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • ${timeStr} WIB`;

  return { timeStr, fullDateHeader, fullDateLong };
};

const FloatingStatusBadge = React.memo(({ status }: { status: { label: string; color: string } }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [floatAnim]);

  return (
    <Animated.View style={[
      styles.statusBadgeWrapped, 
      { 
        backgroundColor: 'rgba(255,255,255,0.95)', 
        borderColor: status.color + '60',
        transform: [{ translateY: floatAnim }]
      }
    ]}>
      <Text style={[styles.statusBadgeTextWrapped, { color: status.color }]}>
        {status.label}
      </Text>
    </Animated.View>
  );
});

const KaihMarqueeTicker = React.memo(() => {
  const { isDark } = useTheme();
  const scrollX = useRef(new Animated.Value(0)).current;
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    if (contentWidth <= 0) return;
    scrollX.setValue(0);
    const anim = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -contentWidth,
        duration: 18000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [contentWidth]);

  const habits = [
    { text: '7 Kebiasaan Anak Indonesia Hebat (KAIH)', isHeader: true, color: isDark ? '#fef08a' : '#1e3a8a' },
    { text: 'Bangun Pagi', color: isDark ? '#38bdf8' : '#0284c7', icon: '☀️' },
    { text: 'Beribadah', color: isDark ? '#4ade80' : '#16a34a', icon: '🤲' },
    { text: 'Berolahraga', color: isDark ? '#f472b6' : '#db2777', icon: '🏃' },
    { text: 'Makan Sehat dan Bergizi', color: isDark ? '#fb923c' : '#d97706', icon: '🥗' },
    { text: 'Gemar Belajar', color: isDark ? '#c084fc' : '#9333ea', icon: '📚' },
    { text: 'Bermasyarakat', color: isDark ? '#38bdf8' : '#0284c7', icon: '🤝' },
    { text: 'Tidur Cepat', color: isDark ? '#fef08a' : '#0284c7', icon: '🌙' },
  ];

  const renderSingleLoop = (keyPrefix: string) => (
    <View key={keyPrefix} style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Image
        source={kaihLogoAsset}
        style={{ width: 18, height: 18, borderRadius: 9, marginRight: 6, backgroundColor: '#ffffff' }}
        resizeMode="contain"
      />
      {habits.map((item, idx) => (
        <View key={`${keyPrefix}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14 }}>
          {idx > 0 && <Text style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)', marginRight: 14, fontWeight: 'bold', fontSize: 10 }}>•</Text>}
          <Text style={{
            color: item.color,
            fontSize: 11.5,
            fontWeight: 'bold',
            letterSpacing: 0.3,
          }}>
            {item.icon ? `${item.icon} ${item.text}` : item.text}
          </Text>
        </View>
      ))}
      <Text style={{ color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)', marginRight: 16, fontWeight: 'bold', fontSize: 10 }}>✦</Text>
    </View>
  );

  return (
    <View style={{
      paddingVertical: 4,
      paddingHorizontal: 8,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : '#e0f2fe',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#bae6fd',
      marginTop: 0,
      marginBottom: 4,
      elevation: 2,
      shadowColor: '#0284c7',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    }}>
      <View style={{ flexDirection: 'row', width: 9999 }}>
        <Animated.View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            transform: [{ translateX: scrollX }],
          }}
        >
          <View onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}>
            {renderSingleLoop('group-1')}
          </View>
          {renderSingleLoop('group-2')}
          {renderSingleLoop('group-3')}
        </Animated.View>
      </View>
    </View>
  );
});

export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendanceStatus, setAttendanceStatus] = useState({ label: 'Belum Absen', color: '#9ca3af' });
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Filter States
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filterType, setFilterType] = useState<'category' | 'rating' | 'date' | null>(null);

  // Modals & Animations
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [attendanceModalVisible, setAttendanceModalVisible] = useState(false);
  const [attendanceDetail, setAttendanceDetail] = useState<any | null>(null);

  // Floating animation for attendance status badge
  const floatAnim = useRef(new Animated.Value(0)).current;

  const startFloating = useCallback(() => {
    floatAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -7,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [floatAnim]);

  useEffect(() => {
    startFloating();
  }, [startFloating]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
      startFloating();
      fetchData(hasLoadedOnce);
    }, [startFloating, hasLoadedOnce])
  );

  async function fetchData(silent = false) {
    if (!silent) {
      setLoading(true);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      const userProfile = await getUserStudentProfile();
      if (!userProfile || !userProfile.user) {
        setLoading(false);
        return;
      }

      if (!isProfileComplete(userProfile)) {
        router.replace('/(tabs)/profile');
        return;
      }

      if (userProfile.profile) {
        setProfile(userProfile.profile);
      }

      if (userProfile.student) {
        const studentData = userProfile.student;
        const { data: actData, error: actError } = await supabase
          .from('activities')
          .select('*, evaluations(rating, comment)')
          .eq('student_id', studentData.id)
          .order('created_at', { ascending: false });

        if (actError) {
          console.error("Error fetching activities:", actError);
        }

        if (actData) {
          const parsedData = parseAndDeduplicateActivities(actData);
          const sortedData = [...parsedData].sort((a, b) => {
            try {
              const dateA = a.activity_date || (a.created_at ? String(a.created_at).split('T')[0] : '1970-01-01');
              const dateB = b.activity_date || (b.created_at ? String(b.created_at).split('T')[0] : '1970-01-01');
              
              if (dateA !== dateB) {
                return dateB.localeCompare(dateA); 
              }
              
              // Urutkan kegiatan berdasarkan jam mulai dari awal (dini hari) ke akhir (malam)
              return compareByStartTime(a, b);
            } catch (e) {
              return 0;
            }
          });
          
          setActivities(sortedData);
        }

        const parseAttendanceStatus = (rawStatus?: string, notes?: string) => {
          let st = (rawStatus || '').toLowerCase();
          if (notes && notes.includes('[STATUS:Terlambat]')) st = 'terlambat';
          else if (notes && notes.includes('[STATUS:Tepat Waktu]')) st = 'tepat waktu';
          else if (notes && notes.includes('[STATUS:Izin]')) st = 'izin';
          else if (notes && notes.includes('[STATUS:Sakit]')) st = 'sakit';
          else if (notes && notes.includes('[STATUS:Alpha]')) st = 'alpha';

          if (st === 'hadir' || st === 'tepat waktu' || st === 'tepat_waktu') {
            return { label: 'Tepat Waktu', color: '#34d399' };
          }
          if (st === 'terlambat') {
            return { label: 'Terlambat', color: '#fbbf24' };
          }
          if (st === 'izin') {
            return { label: 'Izin', color: '#60a5fa' };
          }
          if (st === 'sakit') {
            return { label: 'Sakit', color: '#c084fc' };
          }
          if (st === 'alpha') {
            return { label: 'Alpha', color: '#f87171' };
          }
          return { label: 'Belum Absen', color: '#94a3b8' };
        };

        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        const { data: attData } = await supabase
          .from('attendance')
          .select('id, status, notes, attendance_date, created_at, period_number, subject')
          .eq('student_id', studentData.id)
          .eq('attendance_date', todayStr)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (attData) {
          setAttendanceStatus(parseAttendanceStatus(attData.status, attData.notes));
          setAttendanceDetail(attData);
        } else {
          setAttendanceStatus({ label: 'Belum Absen', color: '#94a3b8' });
          setAttendanceDetail(null);
        }
      }
    } catch (err) {
      console.error('fetchData error in index.tsx:', err);
    } finally {
      setHasLoadedOnce(true);
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getUserStudentProfile(true).then(() => {
      fetchData(true);
    });
  }, []);

  if (loading && !hasLoadedOnce) {
    return <KaihLoadingScreen message="Memuat 7 KAIH..." backgroundColor={colors.background} />;
  }

  const menuItems = [
    { id: '1', title: 'Izin', icon: 'document-text', color: '#3b82f6' },
    { id: '2', title: 'Pelanggaran', icon: 'alert-circle', color: '#ef4444' },
    { id: '3', title: 'Sanksi', icon: 'shield-checkmark', color: '#10b981' },
    { id: '4', title: 'Id Card', icon: 'id-card', color: '#8b5cf6' },
    { id: '5', title: 'Rekap 7 KAIH', icon: 'calendar', color: '#f59e0b' },
    { id: '6', title: 'Rekap E-KBM', icon: 'book', color: '#0ea5e9' },
    { id: '7', title: 'Recognition', icon: 'scan', color: '#14b8a6' },
    { id: '8', title: 'Informasi', icon: 'megaphone', color: '#f43f5e' },
    { id: '9', title: 'Profile', icon: 'person', color: '#6366f1' },
  ];

  const currentDate = new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const getAbsenTimeDisplay = () => {
    if (attendanceDetail && attendanceDetail.attendance_date) {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      
      // Jika ada data absen resmi untuk HARI INI, tampilkan jam masuknya
      if (attendanceDetail.attendance_date === todayStr) {
        const rawNotes = attendanceDetail.notes || '';
        const jamMatch = rawNotes.match(/\[JAM:(\d{2}:\d{2})\]/);
        if (jamMatch) return jamMatch[1] + ' WIB';
        if (attendanceDetail.created_at) {
          return new Date(attendanceDetail.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
        }
      }
    }
    // Jika belum ada data absen hari ini, tampilkan jam real-time HP sekarang!
    return currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      {/* Header Bergelombang (Curved Header) */}
      <View style={[styles.headerCurve, { backgroundColor: colors.primary, paddingTop: (StatusBar.currentHeight || 24) + 10, zIndex: 30, elevation: 10 }]}>
        <View style={[styles.profileSection, { marginTop: 2, marginBottom: 10 }]}>
          <View style={styles.profileInfo}>
            <Text style={styles.greetingText}>
              Hai, <Text style={styles.nameTextInline}>{profile?.full_name || 'Budi'}</Text> 👋
            </Text>
            <View style={[styles.badgeContainer, { marginTop: 3 }]}>
              <Text style={styles.badgeText}>Kelas X • SMA Budi Utomo</Text>
            </View>
          </View>
          <View style={styles.avatarContainer}>
            {profile?.photo_url ? (
              <Image source={{ uri: profile.photo_url }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person-circle" size={44} color="#fff" />
            )}
          </View>
        </View>

        {/* Kartu Pembungkus Tanggal, Waktu, & Status */}
        <View style={{ position: 'relative', marginTop: 10 }}>
          {/* Badge 'Kehadiran di Sekolah' di Sudut Kiri Atas Kartu (Warna Latar Sama Seperti Kartu) */}
          <View style={{
            position: 'absolute',
            top: -11,
            left: 14,
            backgroundColor: 'rgba(255, 255, 255, 0.22)',
            borderColor: 'rgba(255, 255, 255, 0.45)',
            borderWidth: 1.5,
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 2,
            flexDirection: 'row',
            alignItems: 'center',
            zIndex: 10,
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.15,
            shadowRadius: 3,
          }}>
            <Ionicons name="school" size={12} color="#ffffff" style={{ marginRight: 4 }} />
            <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.4 }}>
              Kehadiran di Sekolah
            </Text>
          </View>

          <View style={[styles.timeSection, { paddingTop: 16 }]}>
            {/* 1. Ikon Kalender Realistis (Red Header + White Body) */}
            <View style={styles.timeBlockCol}>
              <View style={styles.realCalendarContainer}>
                <View style={styles.realCalendarTopBar} />
                <View style={styles.realCalendarBody}>
                  <View style={styles.realCalendarGrid}>
                    <View style={styles.realDot} />
                    <View style={styles.realDot} />
                    <View style={styles.realDot} />
                    <View style={styles.realDot} />
                  </View>
                </View>
              </View>
              <Text style={styles.timeValueText}>{currentDate}</Text>
            </View>

            {/* 2. Ikon Jam Realistis (Waktu / Jam Masuk Absen) */}
            <View style={styles.timeBlockCol}>
              <View style={styles.realClockContainer}>
                <Ionicons name="time" size={20} color="#0ea5e9" />
              </View>
              <Text style={styles.timeValueText}>
                {getAbsenTimeDisplay()}
              </Text>
            </View>

            {/* 3. Ikon Status Realistis (Dapat Diklik Untuk Pop-up Detail) */}
            <TouchableOpacity 
              style={styles.timeBlockCol}
              activeOpacity={0.7}
              onPress={() => setAttendanceModalVisible(true)}
            >
              <View style={styles.realChecklistContainer}>
                <View style={styles.checklistRow}>
                  <Ionicons name="checkmark-sharp" size={9} color={attendanceStatus.color} />
                  <View style={styles.checkLine} />
                </View>
                <View style={styles.checklistRow}>
                  <Ionicons name="checkmark-sharp" size={9} color={attendanceStatus.color} />
                  <View style={styles.checkLine} />
                </View>
                <View style={styles.checklistRow}>
                  <Ionicons name="checkmark-sharp" size={9} color={attendanceStatus.color} />
                  <View style={styles.checkLineShort} />
                </View>
              </View>

              {/* Teks Status Dibungkus Pill Badge ber-Animasi Melayang Kontinu */}
              <FloatingStatusBadge status={attendanceStatus} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Area Filter diposisikan memotong di lengkungan header biru */}
        <View style={{ marginTop: 10, marginBottom: -26, zIndex: 30, elevation: 10 }}>
          <View style={[styles.attendanceCard, { backgroundColor: colors.card, paddingVertical: 10, paddingHorizontal: 6, marginBottom: 0, borderWidth: 1, borderColor: colors.border, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }]}>
            <View style={styles.filterRowContainer}>
              <TouchableOpacity 
                style={[styles.filterBtnCompact, { backgroundColor: filterDate ? colors.primary : (isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9') }]}
                onPress={() => { setFilterType('date'); setFilterModalVisible(true); }}
              >
                <Ionicons name="calendar-outline" size={12} color={filterDate ? '#fff' : colors.primary} style={{ marginRight: 3 }} />
                <Text style={[styles.filterTextCompact, { color: filterDate ? '#fff' : colors.primary }]}>
                  {filterDate || 'Tanggal'}
                </Text>
                <Ionicons name="chevron-down" size={12} color={filterDate ? '#fff' : colors.primary} style={{ marginLeft: 2 }} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.filterBtnCompact, { backgroundColor: filterCategory ? colors.primary : (isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9') }]}
                onPress={() => { setFilterType('category'); setFilterModalVisible(true); }}
              >
                <Ionicons name="list-outline" size={12} color={filterCategory ? '#fff' : colors.primary} style={{ marginRight: 3 }} />
                <Text style={[styles.filterTextCompact, { color: filterCategory ? '#fff' : colors.primary }]}>
                  {filterCategory || 'Aktivitas'}
                </Text>
                <Ionicons name="chevron-down" size={12} color={filterCategory ? '#fff' : colors.primary} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.filterBtnCompact, { backgroundColor: filterRating !== null ? colors.primary : (isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9') }]}
                onPress={() => { setFilterType('rating'); setFilterModalVisible(true); }}
              >
                <Ionicons name="star-outline" size={12} color={filterRating !== null ? '#fff' : colors.primary} style={{ marginRight: 3 }} />
                <Text style={[styles.filterTextCompact, { color: filterRating !== null ? '#fff' : colors.primary }]}>
                  {filterRating !== null ? `${filterRating} ★` : 'Bintang'}
                </Text>
                <Ionicons name="chevron-down" size={12} color={filterRating !== null ? '#fff' : colors.primary} style={{ marginLeft: 2 }} />
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.filterResetIconBtnCompact, { backgroundColor: (filterCategory || filterRating !== null || filterDate !== null) ? colors.danger + '20' : (isDark ? 'rgba(255,255,255,0.1)' : '#f1f5f9') }]}
                onPress={() => { setFilterCategory(null); setFilterRating(null); setFilterDate(null); }}
              >
                <Ionicons name="refresh-outline" size={14} color={(filterCategory || filterRating !== null || filterDate !== null) ? colors.danger : colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Kalimat Berjalan (Ticker Marquee) 7 KAIH Rapat di bawah Filter Bar dengan Soft Card Background */}
      <View style={{ paddingHorizontal: 20, paddingTop: 32, paddingBottom: 4, zIndex: 20, backgroundColor: colors.background }}>
        <KaihMarqueeTicker />
      </View>

      {/* Background Watermark Fixed Soft Brand Logo Yayasan */}
      <Image 
        source={require('../../../assets/logo.jpg')} 
        style={styles.watermarkBg} 
        resizeMode="contain" 
      />

      <ScrollView 
        style={[styles.scrollContent, { marginTop: 0, paddingTop: 2 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Kartu Ringkasan Rencana & Realisasi 7 KAIH */}
        {(() => {
          const { todayStr, tomorrowStr } = getTodayAndTomorrowDates();
          const todayProgress = getDayProgress(activities, todayStr);
          const tomorrowActs = activities.filter(a => a.activity_date === tomorrowStr);
          const tomorrowCats = new Set(tomorrowActs.map(a => matchKaihCategoryKey(a.title)).filter(Boolean));
          const pctToday = todayProgress.total > 0 ? Math.min(100, Math.round((todayProgress.done / todayProgress.total) * 100)) : 0;

          return (
            <View style={{
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.90)' : '#ffffff',
              borderRadius: 16,
              padding: 12,
              marginTop: 8,
              marginBottom: 4,
              borderWidth: 1,
              borderColor: isDark ? 'rgba(255,255,255,0.12)' : '#dbeafe',
              elevation: 2,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Ionicons name="checkbox" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12.5, fontWeight: 'bold', color: colors.text }}>
                    Realisasi 7 KAIH Hari Ini
                  </Text>
                </View>
                <Text style={{ fontSize: 11.5, fontWeight: 'bold', color: todayProgress.isAllDone ? '#15803d' : '#16a34a' }}>
                  {todayProgress.done}/{todayProgress.total || 7} Selesai ({todayProgress.completedCategoryCount}/7 KAIH{todayProgress.isAllDone ? ' ✓' : ''})
                </Text>
              </View>

              <View style={{ height: 6, backgroundColor: isDark ? '#334155' : '#e2e8f0', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                <View style={{ height: '100%', width: `${pctToday}%` as any, backgroundColor: '#16a34a', borderRadius: 3 }} />
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: '#2563eb',
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => router.push({ pathname: '/input', params: { mode: 'realize' } })}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkbox-outline" size={14} color="#ffffff" style={{ marginRight: 5 }} />
                  <Text style={{ fontSize: 11.5, fontWeight: 'bold', color: '#ffffff' }}>
                    Ceklis Realisasi
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: tomorrowCats.size >= 7 ? '#dcfce7' : '#fef3c7',
                    borderWidth: 1,
                    borderColor: tomorrowCats.size >= 7 ? '#86efac' : '#fde68a',
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={() => router.push({ pathname: '/input', params: { mode: 'plan' } })}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={tomorrowCats.size >= 7 ? 'checkmark-done-circle' : 'calendar'}
                    size={14}
                    color={tomorrowCats.size >= 7 ? '#15803d' : '#b45309'}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={{ fontSize: 11.5, fontWeight: 'bold', color: tomorrowCats.size >= 7 ? '#15803d' : '#b45309' }}>
                    {tomorrowCats.size >= 7 ? 'Rencana Besok ✓' : `Rencana Besok (${tomorrowCats.size}/7)`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* Daftar Aktivitas Timeline */}
        <View style={styles.timelineContainer}>
          {activities
            .filter((item) => {
              if (filterCategory && (item.category !== filterCategory && item.title !== filterCategory)) return false;
              if (filterDate) {
                const itemDate = new Date(item.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
                if (itemDate !== filterDate) return false;
              }
              if (filterRating !== null) {
                let r = null;
                if (item.evaluations) {
                  if (Array.isArray(item.evaluations) && item.evaluations.length > 0) r = item.evaluations[0].rating;
                  else if (!Array.isArray(item.evaluations) && typeof item.evaluations === 'object') r = item.evaluations.rating;
                }
                let st = 0;
                if (r !== null && r !== undefined) {
                  const numR = Number(r);
                  st = numR > 5 ? Math.round(numR / 20) : numR;
                }
                if (st !== filterRating) return false;
              }
              return true;
            })
            .map((item, index, filteredList) => {
              let rating = null;
              let comment = null;

              if (item.evaluations) {
                if (Array.isArray(item.evaluations) && item.evaluations.length > 0) {
                  rating = item.evaluations[0].rating;
                  comment = item.evaluations[0].comment;
                } else if (!Array.isArray(item.evaluations) && typeof item.evaluations === 'object') {
                  rating = item.evaluations.rating;
                  comment = item.evaluations.comment;
                }
              }

              let stars = 0;
              if (rating !== null && rating !== undefined) {
                const numRating = Number(rating);
                stars = numRating > 5 ? Math.round(numRating / 20) : numRating;
              }
              const isRated = rating !== null && rating !== undefined;
              const isPlanOnly = item.kaihStatus === 'RENCANA';
              const { todayStr } = getTodayAndTomorrowDates();
              const isTodayPlan = isPlanOnly && item.activity_date === todayStr;

              // Format Hari, Tanggal, & Jam berdasarkan activity_date & activity_time asli
              const { timeStr, fullDateHeader } = formatItemDateTime(item);

              // Cek apakah tanggal ini berbeda dengan item sebelumnya (Group 1x tampil per hari)
              let showDateHeader = true;
              if (index > 0) {
                const prevItem = filteredList[index - 1];
                const { fullDateHeader: prevHeader } = formatItemDateTime(prevItem);
                if (prevHeader === fullDateHeader) {
                  showDateHeader = false;
                }
              }

              // Cek apakah item ini adalah item terakhir dalam grup tanggalnya
              let isLastInGroup = true;
              if (index < filteredList.length - 1) {
                const nextItem = filteredList[index + 1];
                const { fullDateHeader: nextHeader } = formatItemDateTime(nextItem);
                if (nextHeader === fullDateHeader) {
                  isLastInGroup = false;
                }
              }

              return (
                <View key={item.id}>
                  {/* Header Grup Tanggal (Tampil 1x jika di hari yang sama) */}
                  {showDateHeader && (
                    <View style={styles.dateGroupHeaderRow}>
                      <View style={styles.dateGroupHeaderBadge}>
                        <Ionicons name="calendar-outline" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={[styles.dateGroupHeaderText, { color: colors.primary }]}>{fullDateHeader}</Text>
                      </View>
                      <View style={styles.dateGroupDividerLine} />
                    </View>
                  )}

                  <View style={styles.timelineRow}>
                    {/* Bagian Kiri: Jam yang Dibungkus & Garis Waktu */}
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timeBadgeContainer, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#e0f2fe' }]}>
                        <Ionicons name="time-outline" size={11} color={colors.primary} style={{ marginRight: 2 }} />
                        <Text style={[styles.timeBadgeText, { color: colors.primary }]}>
                          {timeStr}
                        </Text>
                      </View>
                      <View style={[styles.timelineDot, isPlanOnly && { backgroundColor: '#f59e0b' }]} />
                      {!isLastInGroup && <View style={styles.timelineLine} />}
                    </View>

                    {/* Bagian Kanan: Kartu Tipis */}
                    <View style={styles.timelineRight}>
                    <TouchableOpacity 
                      activeOpacity={0.9}
                      style={[
                        styles.activityCard,
                        {
                          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.70)' : 'rgba(255, 255, 255, 0.70)',
                          borderLeftColor: isPlanOnly ? '#f59e0b' : isRated ? colors.success : '#10b981',
                        },
                      ]}
                      onPress={() => setSelectedActivity(item)}
                    >
                      {/* Judul, Status Badge, Deskripsi & Foto Thumbnail di Atas */}
                      <View style={[styles.activityBodyRow, (isRated || isTodayPlan) && { marginBottom: 6 }]}>
                        <View style={styles.activityTextCol}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginBottom: 2 }}>
                            <Text style={[styles.activityTitle, { color: colors.text, marginBottom: 0 }]} numberOfLines={1}>{item.title}</Text>
                            <View style={{
                              backgroundColor: isPlanOnly ? '#fef3c7' : '#dcfce7',
                              paddingHorizontal: 6,
                              paddingVertical: 1.5,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: isPlanOnly ? '#fde68a' : '#86efac',
                            }}>
                              <Text style={{ fontSize: 9, fontWeight: 'bold', color: isPlanOnly ? '#b45309' : '#15803d' }}>
                                {isPlanOnly ? '📅 Rencana' : '✅ Terealisasi'}
                              </Text>
                            </View>
                          </View>
                          {Boolean(item.description) ? (
                            <Text style={[styles.activityDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                              {item.description}
                            </Text>
                          ) : null}
                        </View>
                        {(() => {
                          const catName = item.title || item.category || 'Bangun Pagi';
                          const isUserUploadedPhoto = item.photo_url && 
                                                      item.photo_url !== 'KAIH_LOGO' && 
                                                      item.photo_url !== 'PLAN_PENDING' &&
                                                      !item.photo_url.includes('default_kaih') &&
                                                      !item.photo_url.includes('unsplash.com') &&
                                                      (item.photo_url.startsWith('http') || item.photo_url.startsWith('file'));
                          const displayPhoto = isUserUploadedPhoto 
                            ? item.photo_url 
                            : (DEFAULT_CATEGORY_IMAGES[catName] || DEFAULT_CATEGORY_IMAGES['Bangun Pagi']);
                          return (
                            <TouchableOpacity onPress={() => setPreviewImage(displayPhoto)}>
                              <Image source={{ uri: displayPhoto }} style={styles.activityThumbnail} resizeMode="cover" />
                            </TouchableOpacity>
                          );
                        })()}
                      </View>

                      {/* Tombol Cepat Ceklis Realisasi untuk Rencana */}
                      {isPlanOnly && (
                        (() => {
                          const eligibility = getRealizationEligibility(item.activity_date);
                          if (eligibility === 'too_old') {
                            return (
                              <View style={{
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                                borderWidth: 1,
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1',
                                borderRadius: 8,
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                flexDirection: 'row',
                                alignItems: 'center',
                                marginTop: 4,
                              }}>
                                <Ionicons name="lock-closed" size={12} color="#64748b" style={{ marginRight: 4 }} />
                                <Text style={{ fontSize: 10.5, fontWeight: 'bold', color: '#64748b' }}>
                                  Ceklis Terkunci (Melewati batas 2 hari)
                                </Text>
                              </View>
                            );
                          }
                          if (eligibility === 'ok') {
                            const isToday = item.activity_date === todayStr;
                            return (
                              <TouchableOpacity
                                style={{
                                  backgroundColor: isToday ? '#eff6ff' : '#fffbeb',
                                  borderWidth: 1,
                                  borderColor: isToday ? '#93c5fd' : '#fcd34d',
                                  borderRadius: 8,
                                  paddingVertical: 5,
                                  paddingHorizontal: 8,
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  marginTop: 4,
                                }}
                                onPress={() => router.push({ pathname: '/input', params: { mode: 'realize', planId: item.id } })}
                              >
                                <Ionicons name="checkbox" size={13} color={isToday ? '#2563eb' : '#d97706'} style={{ marginRight: 4 }} />
                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: isToday ? '#2563eb' : '#b45309' }}>
                                  {isToday ? 'Ceklis Realisasi Sekarang' : 'Ceklis Realisasi (Kemarin)'}
                                </Text>
                              </TouchableOpacity>
                            );
                          }
                          return null;
                        })()
                      )}

                      {/* Baris Komentar & Bintang (Hanya muncul jika sudah ada penilaian / komentar dari guru) */}
                      {isRated ? (
                        <View style={[styles.commentRowBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                          <View style={[styles.ratingBadgeInline, { backgroundColor: '#f59e0b20' }]}>
                            <Text style={[styles.ratingTextInline, { color: '#f59e0b' }]}>{stars > 0 ? stars : '-'}</Text>
                            <Ionicons name="star" size={10} color="#f59e0b" style={{ marginLeft: 2 }} />
                          </View>
                          
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={[styles.commentTextSingle, { color: colors.success }]}>
                              {comment ? `"${comment}"` : 'Sudah dinilai oleh guru'}
                            </Text>
                          </ScrollView>
                        </View>
                      ) : null}

                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {activities.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>Belum ada aktivitas yang dicatat.</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 1. Modal Preview Foto Fullscreen */}
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.modalOverlayDark}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {Boolean(previewImage) ? (
            <Image source={{ uri: previewImage! }} style={styles.previewImageFull} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>

      {/* 2. Modal Detail Aktivitas Pop-up */}
      <Modal visible={!!selectedActivity} transparent animationType="slide" onRequestClose={() => setSelectedActivity(null)}>
        <View style={styles.modalOverlayDark}>
          <View style={[styles.detailCardModal, { backgroundColor: colors.card }]}>
            <View style={styles.detailHeaderModal}>
              <Text style={[styles.detailTitleModal, { color: colors.text }]}>{selectedActivity?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedActivity(null)}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={{ maxHeight: 450 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={[styles.detailCategoryTag, { color: colors.primary }]}>{selectedActivity?.category || 'Aktivitas'}</Text>
                <View style={{
                  backgroundColor: selectedActivity?.kaihStatus === 'RENCANA' ? '#fef3c7' : '#dcfce7',
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 6,
                }}>
                  <Text style={{
                    fontSize: 10.5,
                    fontWeight: 'bold',
                    color: selectedActivity?.kaihStatus === 'RENCANA' ? '#b45309' : '#15803d',
                  }}>
                    {selectedActivity?.kaihStatus === 'RENCANA' ? '📅 Masih Rencana (Belum Ceklis)' : '✅ Sudah Direalisasikan'}
                  </Text>
                </View>
              </View>

              <Text style={[styles.detailDateModal, { color: colors.textSecondary }]}>
                📅 {selectedActivity && formatItemDateTime(selectedActivity).fullDateLong}
              </Text>

              {selectedActivity?.kaihStatus === 'RENCANA' && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#16a34a',
                    paddingVertical: 10,
                    borderRadius: 10,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginVertical: 8,
                  }}
                  onPress={() => {
                    const itemId = selectedActivity.id;
                    setSelectedActivity(null);
                    router.push({ pathname: '/input', params: { mode: 'realize', planId: itemId } });
                  }}
                >
                  <Ionicons name="checkbox-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#ffffff', fontSize: 12.5, fontWeight: 'bold' }}>
                    Ceklis Realisasi Kegiatan Ini
                  </Text>
                </TouchableOpacity>
              )}

              {/* Row Berdampingan: Foto Bukti (Kiri) & Mini Maps View (Kanan) */}
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
                {/* Kolom Kiri: Foto Bukti */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 4 }}>
                    Foto Bukti:
                  </Text>
                  {(() => {
                    const catName = selectedActivity?.title || selectedActivity?.category || 'Bangun Pagi';
                    const isUserUploadedPhoto = selectedActivity?.photo_url && 
                                                selectedActivity?.photo_url !== 'KAIH_LOGO' && 
                                                !selectedActivity?.photo_url.includes('default_kaih') &&
                                                !selectedActivity?.photo_url.includes('unsplash.com') &&
                                                (selectedActivity?.photo_url.startsWith('http') || selectedActivity?.photo_url.startsWith('file'));
                    const displayPhoto = isUserUploadedPhoto 
                      ? selectedActivity.photo_url 
                      : (DEFAULT_CATEGORY_IMAGES[catName] || DEFAULT_CATEGORY_IMAGES['Bangun Pagi']);
                    return (
                      <TouchableOpacity onPress={() => setPreviewImage(displayPhoto)} activeOpacity={0.8}>
                        <Image source={{ uri: displayPhoto }} style={{ width: '100%', height: 110, borderRadius: 10 }} resizeMode="cover" />
                        <Text style={{ fontSize: 9.5, color: colors.primary, textAlign: 'center', marginTop: 2 }}>Perbesar 🔍</Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>

                {/* Kolom Kanan: Mini Maps View */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: colors.textSecondary, marginBottom: 4 }}>
                    Peta Lokasi:
                  </Text>
                  {selectedActivity?.latitude && selectedActivity?.longitude ? (
                    <View style={{ borderRadius: 10, overflow: 'hidden', height: 110, borderWidth: 1, borderColor: colors.border }}>
                      <WebView
                        originWhitelist={['*']}
                        source={{
                          html: `
                            <!DOCTYPE html>
                            <html>
                            <head>
                              <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                              <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                              <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                              <style>
                                body, html { margin:0; padding:0; height:100%; width:100%; background:#f1f5f9; }
                                #map { height:100%; width:100%; }
                                .leaflet-control-attribution { display: none !important; }
                              </style>
                            </head>
                            <body>
                              <div id="map"></div>
                              <script>
                                var lat = ${selectedActivity.latitude};
                                var lng = ${selectedActivity.longitude};
                                var map = L.map('map', { zoomControl: false, dragging: true }).setView([lat, lng], 15);
                                L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                                  maxZoom: 20,
                                  subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
                                }).addTo(map);
                                var customIcon = L.divIcon({
                                  className: 'custom-pin',
                                  html: '<div style="background-color:#2563eb;width:20px;height:20px;border-radius:10px;border:2.5px solid white;box-shadow:0 2px 5px rgba(0,0,0,0.35);"></div>',
                                  iconSize: [20, 20],
                                  iconAnchor: [10, 10]
                                });
                                L.marker([lat, lng], { icon: customIcon }).addTo(map);
                              </script>
                            </body>
                            </html>
                          `
                        }}
                        scrollEnabled={false}
                        style={{ height: 110, width: '100%' }}
                      />
                    </View>
                  ) : (
                    <View style={{ width: '100%', height: 110, borderRadius: 10, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f1f5f9', borderWidth: 1, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="map-outline" size={24} color={colors.textSecondary} />
                      <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 4 }}>Tanpa Peta</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Teks Alamat Ringkas */}
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#f8fafc', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
                <Ionicons name="location" size={14} color="#ef4444" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 11.5, color: colors.text, fontWeight: '500', flex: 1 }} numberOfLines={2}>
                  {selectedActivity?.location_name || (selectedActivity?.latitude && selectedActivity?.longitude ? `${selectedActivity.latitude.toFixed(5)}, ${selectedActivity.longitude.toFixed(5)}` : 'Lokasi tidak tercatat')}
                </Text>
              </View>

              <Text style={{ fontSize: 12, fontWeight: 'bold', color: colors.text, marginTop: 4, marginBottom: 2 }}>Deskripsi:</Text>
              <Text style={[styles.detailDescModal, { color: colors.textSecondary, marginBottom: 10 }]}>{selectedActivity?.description || 'Tidak ada deskripsi'}</Text>

              {/* Detail Penilaian Guru (Hanya muncul jika sudah dinilai / dikomentari oleh guru) */}
              {(() => {
                let r = null;
                let c = null;
                if (selectedActivity?.evaluations) {
                  if (Array.isArray(selectedActivity.evaluations) && selectedActivity.evaluations.length > 0) {
                    r = selectedActivity.evaluations[0].rating;
                    c = selectedActivity.evaluations[0].comment;
                  } else if (!Array.isArray(selectedActivity.evaluations) && typeof selectedActivity.evaluations === 'object') {
                    r = selectedActivity.evaluations.rating;
                    c = selectedActivity.evaluations.comment;
                  }
                }
                const isRated = (r !== null && r !== undefined) || (c !== null && c !== undefined && c.trim() !== '');
                if (!isRated) return null;

                let st = 0;
                if (r !== null && r !== undefined) {
                  const numR = Number(r);
                  st = numR > 5 ? Math.round(numR / 20) : numR;
                }

                return (
                  <View style={[styles.detailEvalBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.text, marginBottom: 6 }}>Hasil Penilaian Guru:</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 13, color: colors.text, marginRight: 6 }}>Rating:</Text>
                      <View style={[styles.ratingBadgeInline, { backgroundColor: '#f59e0b20' }]}>
                        <Text style={[styles.ratingTextInline, { color: '#f59e0b' }]}>{st > 0 ? st : '-'}</Text>
                        <Ionicons name="star" size={12} color="#f59e0b" style={{ marginLeft: 2 }} />
                      </View>
                    </View>
                    {Boolean(c) ? (
                      <Text style={{ fontSize: 13, fontStyle: 'italic', color: colors.success }}>
                        Catatan Guru: "{c}"
                      </Text>
                    ) : null}
                  </View>
                );
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 3. Modal Detail Kehadiran Siswa Pop-up */}
      <Modal visible={attendanceModalVisible} transparent animationType="slide" onRequestClose={() => setAttendanceModalVisible(false)}>
        <View style={styles.modalOverlayDark}>
          <View style={[styles.detailCardModal, { backgroundColor: colors.card }]}>
            {/* Header Modal */}
            <View style={styles.detailHeaderModal}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="clipboard" size={20} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.detailTitleModal, { color: colors.text }]}>Detail Kehadiran Siswa</Text>
              </View>
              <TouchableOpacity onPress={() => setAttendanceModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Badge Status Kehadiran Utama */}
            <View style={{ alignItems: 'center', marginVertical: 14 }}>
              <View style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: attendanceStatus.color + '20',
                borderWidth: 1.5,
                borderColor: attendanceStatus.color,
                flexDirection: 'row',
                alignItems: 'center'
              }}>
                <Ionicons name="checkmark-circle" size={20} color={attendanceStatus.color} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: attendanceStatus.color }}>
                  {attendanceStatus.label}
                </Text>
              </View>
            </View>

            {/* Detail Informasi Absensi */}
            {(() => {
              const rawNotes = attendanceDetail?.notes || '';
              // Extract [JAM:HH:MM] from notes if present
              const jamMatch = rawNotes.match(/\[JAM:(\d{2}:\d{2})\]/);
              const jamFromNotes = jamMatch ? jamMatch[1] + ' WIB' : null;
              // Clean notes: remove [JAM:...] and [STATUS:...] tags
              const cleanNotes = rawNotes
                .replace(/\[JAM:[^\]]+\]\s*/g, '')
                .replace(/\[STATUS:[^\]]+\]\s*/g, '')
                .trim();
              // Waktu: prioritas dari [JAM:...] di notes, fallback ke created_at
              const waktuDisplay = jamFromNotes 
                || (attendanceDetail?.created_at 
                  ? new Date(attendanceDetail.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' 
                  : currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB');

              return (
                <View style={[styles.detailEvalBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', gap: 10 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Tanggal Absen:</Text>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.text }}>
                      {attendanceDetail?.attendance_date ? new Date(attendanceDetail.attendance_date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : currentDate}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Waktu Input Guru:</Text>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.text }}>
                      {waktuDisplay}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>Siswa:</Text>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: colors.text }}>
                      {profile?.full_name || 'Budi'}
                    </Text>
                  </View>

                  <View style={{ marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Catatan / Alasan Guru:</Text>
                    <View style={{ padding: 10, borderRadius: 8, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#ffffff', borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontSize: 13, fontStyle: 'italic', color: colors.text }}>
                        {cleanNotes || 'Tidak ada catatan tambahan dari guru.'}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* 3. Modal Option Filter */}
      <Modal visible={filterModalVisible} transparent animationType="fade" onRequestClose={() => setFilterModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlayDark} activeOpacity={1} onPress={() => setFilterModalVisible(false)}>
          <View style={[styles.filterOptionsContainer, { backgroundColor: colors.card }]}>
            <Text style={[styles.filterModalTitle, { color: colors.text }]}>
              {filterType === 'date' ? 'Pilih Tanggal' : filterType === 'category' ? 'Pilih Jenis Aktivitas' : 'Pilih Penilaian Bintang'}
            </Text>
            
            {filterType === 'date' && (
              <ScrollView style={{ maxHeight: 250 }}>
                <TouchableOpacity style={styles.filterOptionItem} onPress={() => { setFilterDate(null); setFilterModalVisible(false); }}>
                  <Text style={[styles.filterOptionText, !filterDate && { color: colors.primary, fontWeight: 'bold' }]}>Semua Tanggal</Text>
                </TouchableOpacity>
                {Array.from(new Set(activities.map(a => new Date(a.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })).filter(Boolean))).map((dateStr: any) => (
                  <TouchableOpacity key={dateStr} style={styles.filterOptionItem} onPress={() => { setFilterDate(dateStr); setFilterModalVisible(false); }}>
                    <Text style={[styles.filterOptionText, filterDate === dateStr && { color: colors.primary, fontWeight: 'bold' }]}>{dateStr}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {filterType === 'category' && (
              <ScrollView style={{ maxHeight: 250 }}>
                <TouchableOpacity style={styles.filterOptionItem} onPress={() => { setFilterCategory(null); setFilterModalVisible(false); }}>
                  <Text style={[styles.filterOptionText, !filterCategory && { color: colors.primary, fontWeight: 'bold' }]}>Semua Aktivitas</Text>
                </TouchableOpacity>
                {Array.from(new Set(activities.map(a => a.category || a.title).filter(Boolean))).map((cat: any) => (
                  <TouchableOpacity key={cat} style={styles.filterOptionItem} onPress={() => { setFilterCategory(cat); setFilterModalVisible(false); }}>
                    <Text style={[styles.filterOptionText, filterCategory === cat && { color: colors.primary, fontWeight: 'bold' }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {filterType === 'rating' && (
              <View>
                <TouchableOpacity style={styles.filterOptionItem} onPress={() => { setFilterRating(null); setFilterModalVisible(false); }}>
                  <Text style={[styles.filterOptionText, filterRating === null && { color: colors.primary, fontWeight: 'bold' }]}>Semua Bintang</Text>
                </TouchableOpacity>
                {[5, 4, 3, 2, 1].map((star) => (
                  <TouchableOpacity key={star} style={styles.filterOptionItem} onPress={() => { setFilterRating(star); setFilterModalVisible(false); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={[styles.filterOptionText, filterRating === star && { color: colors.primary, fontWeight: 'bold' }]}>{star} Bintang </Text>
                      <Ionicons name="star" size={14} color="#f59e0b" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  watermarkBg: {
    position: 'absolute',
    width: 320,
    height: 320,
    top: 270,
    left: '50%',
    marginLeft: -160,
    opacity: 0.05,
    zIndex: 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCurve: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 4,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    zIndex: 30,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerIcons: {
    flexDirection: 'row',
  },
  iconSpaced: {
    marginRight: 16,
  },
  profileSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileInfo: {
    flex: 1,
  },
  greetingText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  nameTextInline: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  badgeContainer: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10.5,
    fontWeight: '600',
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  timeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  realCalendarContainer: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    overflow: 'hidden',
    marginBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  realCalendarTopBar: {
    height: 8,
    backgroundColor: '#f87171',
  },
  realCalendarBody: {
    flex: 1,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  realCalendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 14,
    justifyContent: 'space-between',
    gap: 2,
  },
  realDot: {
    width: 4,
    height: 4,
    borderRadius: 1,
    backgroundColor: '#94a3b8',
  },
  realClockContainer: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  realChecklistContainer: {
    width: 24,
    height: 28,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    padding: 2.5,
    justifyContent: 'space-around',
    marginBottom: 6,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  checklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkLine: {
    height: 2.5,
    flex: 1,
    backgroundColor: '#94a3b8',
    borderRadius: 1,
    marginLeft: 2,
  },
  checkLineShort: {
    height: 2.5,
    width: '50%',
    backgroundColor: '#cbd5e1',
    borderRadius: 1,
    marginLeft: 2,
  },
  timeBlockCol: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  statusBadgeWrapped: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  statusBadgeTextWrapped: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  timeValueText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  filterRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
  },
  filterBtnCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  filterTextCompact: {
    fontSize: 11,
    fontWeight: '600',
  },
  filterResetIconBtnCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  scrollContent: {
    flex: 1,
    marginTop: -20,
    paddingHorizontal: 16,
  },
  attendanceCard: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  attendanceTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  attendanceButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attBtn: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    elevation: 2,
  },
  attBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attBtnTextContainer: {
    marginLeft: 8,
  },
  attBtnTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  attBtnSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  menuGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    borderRadius: 20,
    padding: 16,
    paddingTop: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  menuItem: {
    width: '30%',
    alignItems: 'center',
    marginBottom: 24,
  },
  menuIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  menuItemText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)'
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 10,
  },
  dateGroupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  dateGroupHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  dateGroupHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  dateGroupDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginLeft: 8,
  },
  timelineContainer: {
    marginTop: 8,
    position: 'relative',
    minHeight: 350,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  timelineLeft: {
    width: 65,
    alignItems: 'center',
    marginRight: 8,
  },
  timeBadgeContainer: {
    flexDirection: 'row',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#ffffff',
    marginTop: 2,
    marginBottom: 2,
    zIndex: 2,
  },
  timelineLine: {
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderLeftColor: '#3b82f6',
    position: 'absolute',
    top: 36,
    bottom: -12,
    zIndex: 1,
  },
  timelineRight: {
    flex: 1,
  },
  activityCard: {
    borderRadius: 12,
    paddingTop: 8,
    paddingBottom: 7,
    paddingHorizontal: 10,
    marginBottom: 8,
    borderLeftWidth: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  ratingText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  activityBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  activityDescContainer: {
    flex: 1,
    marginRight: 10,
  },
  activityDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  activityThumbnail: {
    width: 42,
    height: 42,
    borderRadius: 8,
  },
  commentBox: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 8,
    alignItems: 'flex-start',
  },
  commentText: {
    flex: 1,
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '500',
    lineHeight: 16,
  },
  timelineSubDateText: {
    fontSize: 9,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 2,
  },
  activityBodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  activityTextCol: {
    flex: 1,
    marginRight: 8,
  },
  commentRowBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  ratingBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingTextInline: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  commentTextSingle: {
    fontSize: 11,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  modalOverlayDark: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  previewImageFull: {
    width: '100%',
    height: '80%',
  },
  detailCardModal: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    elevation: 5,
  },
  detailHeaderModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTitleModal: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    marginRight: 8,
  },
  detailCategoryTag: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  detailDateModal: {
    fontSize: 12,
    marginBottom: 12,
  },
  detailModalImage: {
    width: '100%',
    height: 180,
    borderRadius: 12,
  },
  detailDescModal: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  detailEvalBox: {
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  filterOptionsContainer: {
    width: '85%',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  filterModalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  filterOptionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  filterOptionText: {
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    padding: 30,
    marginTop: 20,
  },
  emptyStateText: {
    marginTop: 12,
    textAlign: 'center',
  }
});
