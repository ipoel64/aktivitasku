import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/colors';
import kaihLogoAsset from '../../../assets/kaih_logo.png';
import { KaihLoadingScreen } from '../../components/KaihLoadingLogo';
import { getUserStudentProfile } from '../../utils/userCache';
import {
  parseAndDeduplicateActivities,
  compareByStartTime,
  getRealizationEligibility,
  getPresetSubActivityDefs,
  getBaseDescription,
} from '../../utils/kaihPlanUtils';

const KAIH_CATEGORIES = [
  { key: 'Bangun Pagi', label: 'Bangun Pagi', emoji: '☀️', color: '#0284c7', bgColor: '#e0f2fe' },
  { key: 'Beribadah', label: 'Beribadah', emoji: '🤲', color: '#16a34a', bgColor: '#dcfce7' },
  { key: 'Berolahraga', label: 'Berolahraga', emoji: '🏃', color: '#db2777', bgColor: '#fce7f3' },
  { key: 'Makan Sehat dan Bergizi', label: 'Makan Sehat', emoji: '🥗', color: '#d97706', bgColor: '#fef3c7' },
  { key: 'Gemar Belajar', label: 'Gemar Belajar', emoji: '📚', color: '#9333ea', bgColor: '#f3e8ff' },
  { key: 'Bermasyarakat', label: 'Bermasyarakat', emoji: '🤝', color: '#0284c7', bgColor: '#e0f2fe' },
  { key: 'Tidur Cepat', label: 'Tidur Cepat', emoji: '🌙', color: '#4f46e5', bgColor: '#e0e7ff' },
];

export interface SubActivityDef {
  label: string;
  icon: string;
  matchers: string[];
}

// KHUSUS KATEGORI BERIBADAH YANG DIBUAT RINCIAN DENGAN 7 TARGET KEGIATAN SHALAT & TILAWAH
export const BERIBADAH_SUB_ACTIVITIES: SubActivityDef[] = [
  { label: 'Shalat Tahajud', icon: '🌌', matchers: ['tahajud'] },
  { label: 'Shalat Subuh', icon: '🌅', matchers: ['subuh'] },
  { label: 'Shalat Zuhur', icon: '☀️', matchers: ['zuhur', 'dzuhur'] },
  { label: 'Shalat Ashar', icon: '🌤️', matchers: ['ashar', 'asar'] },
  { label: 'Shalat Maghrib', icon: '🌇', matchers: ['maghrib', 'magrib'] },
  { label: 'Shalat Isya', icon: '🌙', matchers: ['isya'] },
  { label: 'Tilawah Al-Qur\'an', icon: '📖', matchers: ['tilawah', 'qur\'an', 'quran', 'membaca al-qur\'an'] },
];

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const DAY_NAMES_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const DAY_COL_W_MONTH = 36;
const DAY_COL_W_WEEK = 38;
const CAT_COL_W = 110;

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getDayOfWeek(year: number, month: number, day: number): number {
  return new Date(year, month, day).getDay();
}

type ViewMode = 'month' | 'week' | 'day';

export default function RekapKAIHScreen() {
  const { colors, isDark } = useTheme();
  const now = new Date();

  // OPSI MINGGU SEBAGAI DEFAULT TAMPILAN DIAWAL
  const [viewMode, setViewMode] = useState<ViewMode>('week');

  // Date selection state
  const [currentDate, setCurrentDate] = useState(new Date());

  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const selectedYear = currentDate.getFullYear();
  const selectedMonth = currentDate.getMonth();
  const selectedDayNum = currentDate.getDate();

  const daysInMonth = getDaysInMonth(selectedYear, selectedMonth);

  // Flexible category matching helper
  const findMatchingCategoryKey = (titleOrCategory: string): string | null => {
    if (!titleOrCategory) return null;
    const str = titleOrCategory.trim();
    const exact = KAIH_CATEGORIES.find(c => c.key === str || c.label === str);
    if (exact) return exact.key;

    const lower = str.toLowerCase();
    const fuzzy = KAIH_CATEGORIES.find(
      c => c.key.toLowerCase().includes(lower) ||
           lower.includes(c.key.toLowerCase()) ||
           c.label.toLowerCase().includes(lower) ||
           lower.includes(c.label.toLowerCase())
    );
    return fuzzy ? fuzzy.key : null;
  };

  // Helper to parse date from activity
  const parseActivityDate = (act: any) => {
    if (act.activity_date) {
      const parts = act.activity_date.split('-');
      if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
    }
    return new Date(act.created_at);
  };

  // Calculate Week range (Monday to Sunday)
  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(diff));
  };

  const startOfWeek = getStartOfWeek(currentDate);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const weekDaysList = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  // Filter activities based on active ViewMode
  const filteredActivities = activities.filter(act => {
    const actDate = parseActivityDate(act);
    if (viewMode === 'month') {
      return actDate.getFullYear() === selectedYear && actDate.getMonth() === selectedMonth;
    }
    if (viewMode === 'week') {
      const actTime = new Date(actDate.getFullYear(), actDate.getMonth(), actDate.getDate()).getTime();
      const sTime = new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate()).getTime();
      const eTime = new Date(endOfWeek.getFullYear(), endOfWeek.getMonth(), endOfWeek.getDate()).getTime();
      return actTime >= sTime && actTime <= eTime;
    }
    // day mode
    return (
      actDate.getFullYear() === selectedYear &&
      actDate.getMonth() === selectedMonth &&
      actDate.getDate() === selectedDayNum
    );
  });

  // Build checklist matrix map [categoryKey][dateKey] = realized activity, and plannedMap for plans
  const checklistMap: Record<string, Map<string, any>> = {};
  const plannedMap: Record<string, Map<string, any>> = {};
  KAIH_CATEGORIES.forEach(c => {
    checklistMap[c.key] = new Map();
    plannedMap[c.key] = new Map();
  });

  filteredActivities.forEach(act => {
    const catKey = findMatchingCategoryKey(act.title);
    if (catKey && checklistMap[catKey]) {
      const actDate = parseActivityDate(act);
      const dateKey = `${actDate.getFullYear()}-${String(actDate.getMonth() + 1).padStart(2, '0')}-${String(actDate.getDate()).padStart(2, '0')}`;
      if (act.kaihStatus === 'RENCANA') {
        if (!plannedMap[catKey].has(dateKey)) {
          plannedMap[catKey].set(dateKey, act);
        }
      } else {
        if (!checklistMap[catKey].has(dateKey)) {
          checklistMap[catKey].set(dateKey, act);
        }
      }
    }
  });

  // Count total completed days & stats (only REALISASI counts as completed)
  let totalChecked = 0;
  KAIH_CATEGORIES.forEach(c => {
    totalChecked += checklistMap[c.key]?.size || 0;
  });

  const totalDaysInRange = viewMode === 'month' ? daysInMonth : viewMode === 'week' ? 7 : 1;
  const totalPossible = totalDaysInRange * 7;
  const avgPerDay = (totalChecked / totalDaysInRange).toFixed(1);

  const isCurrentMonth = now.getFullYear() === selectedYear && now.getMonth() === selectedMonth;
  const todayDate = now.getDate();

  async function fetchActivities(isRefreshing = false) {
    if (!isRefreshing && !hasLoadedOnce) setLoading(true);
    try {
      const userProfile = await getUserStudentProfile();
      if (!userProfile) {
        setLoading(false);
        setRefreshing(false);
        router.replace('/login');
        return;
      }

      let studentId = userProfile?.student?.id;

      if (!studentId && userProfile?.profile?.id) {
        const { data: stData } = await supabase
          .from('students')
          .select('id')
          .eq('profile_id', userProfile.profile.id)
          .maybeSingle();
        studentId = stData?.id;
      }

      let queryData: any[] = [];

      if (studentId) {
        const { data, error } = await supabase
          .from('activities')
          .select('*, evaluations(rating, comment)')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          queryData = data;
        }
      }

      if (queryData.length === 0 && userProfile?.profile?.id) {
        const { data: fbData } = await supabase
          .from('activities')
          .select('*, evaluations(rating, comment)')
          .order('created_at', { ascending: false });

        if (fbData && fbData.length > 0) {
          queryData = fbData;
        }
      }

      const parsed = parseAndDeduplicateActivities(queryData);
      parsed.sort(compareByStartTime);
      setActivities(parsed);
    } catch (err) {
      console.error('Fetch rekap error:', err);
    } finally {
      setHasLoadedOnce(true);
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchActivities(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchActivities(true);
    }, [])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    getUserStudentProfile(true).then(() => {
      fetchActivities(true);
    });
  }, []);

  // Navigation handlers
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    setCurrentDate(d);
  };

  const getNavTitle = () => {
    if (viewMode === 'month') {
      return `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    }
    if (viewMode === 'week') {
      const monDay = startOfWeek.getDate();
      const monMonth = MONTH_NAMES[startOfWeek.getMonth()].substring(0, 3);
      const sunDay = endOfWeek.getDate();
      const sunMonth = MONTH_NAMES[endOfWeek.getMonth()].substring(0, 3);
      return `${monDay} ${monMonth} - ${sunDay} ${sunMonth} ${endOfWeek.getFullYear()}`;
    }
    return currentDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading && !hasLoadedOnce) {
    return <KaihLoadingScreen message="Memuat Rekap 7 KAIH..." backgroundColor={colors.background} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Curved Header */}
      <View style={[styles.headerCurve, { backgroundColor: colors.primary, paddingTop: (StatusBar.currentHeight || 24) + 10 }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Image source={kaihLogoAsset} style={styles.headerLogo} resizeMode="contain" />
            <Text style={styles.headerTitle} numberOfLines={2}>
              Rekap 7 Kebiasaan Anak Indonesia Hebat
            </Text>
          </View>
        </View>

        {/* View Mode Segmented Control (Bulan | Minggu | Hari) */}
        <View style={styles.viewModeSelector}>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'month' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('month')}
          >
            <Ionicons name="calendar-outline" size={13} color={viewMode === 'month' ? colors.primary : '#fff'} style={{ marginRight: 4 }} />
            <Text style={[styles.viewModeText, viewMode === 'month' && styles.viewModeTextActive]}>Bulan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'week' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('week')}
          >
            <Ionicons name="calendar-number-outline" size={13} color={viewMode === 'week' ? colors.primary : '#fff'} style={{ marginRight: 4 }} />
            <Text style={[styles.viewModeText, viewMode === 'week' && styles.viewModeTextActive]}>Minggu</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === 'day' && styles.viewModeBtnActive]}
            onPress={() => setViewMode('day')}
          >
            <Ionicons name="today-outline" size={13} color={viewMode === 'day' ? colors.primary : '#fff'} style={{ marginRight: 4 }} />
            <Text style={[styles.viewModeText, viewMode === 'day' && styles.viewModeTextActive]}>Hari</Text>
          </TouchableOpacity>
        </View>

        {/* Date Navigator */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={handlePrev} style={styles.monthNavBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.monthNavCenter}>
            <Ionicons name="calendar" size={16} color="rgba(255,255,255,0.85)" style={{ marginRight: 6 }} />
            <Text style={styles.monthNavText}>{getNavTitle()}</Text>
          </View>
          <TouchableOpacity onPress={handleNext} style={styles.monthNavBtn}>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryValue, { color: colors.primary }]}>{totalChecked}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total Laporan</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryValue, { color: '#10b981' }]}>{avgPerDay}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Rata-rata/Hari</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryValue, { color: '#f59e0b' }]}>
              {totalPossible > 0 ? Math.round((totalChecked / totalPossible) * 100) : 0}%
            </Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Pencapaian</Text>
          </View>
        </View>

        {/* ----------------- MODE TABLE BULAN & MINGGU ----------------- */}
        {(viewMode === 'month' || viewMode === 'week') && (
          <View style={[styles.tableWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row' }}>
              {/* Sticky Left Column: Category Names */}
              <View style={[styles.stickyCol, { backgroundColor: colors.card, borderRightColor: colors.border }]}>
                <View style={[styles.cornerCell, { borderBottomColor: colors.border }]}>
                  <Ionicons name="grid" size={14} color={colors.primary} />
                  <Text style={[styles.cornerText, { color: colors.primary }]}>Kategori</Text>
                </View>
                {KAIH_CATEGORIES.map((cat, idx) => (
                  <View
                    key={cat.key}
                    style={[
                      styles.catCell,
                      { borderBottomColor: colors.border },
                      idx % 2 === 0 && { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' },
                    ]}
                  >
                    <View style={[styles.catEmojiBox, { backgroundColor: cat.bgColor }]}>
                      <Text style={styles.catEmoji}>{cat.emoji}</Text>
                    </View>
                    <Text style={[styles.catLabel, { color: colors.text }]} numberOfLines={1}>
                      {cat.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Scrollable Day Columns */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
                <View>
                  {/* Day header row */}
                  <View style={[styles.dayHeaderRow, { borderBottomColor: colors.border }]}>
                    {viewMode === 'month'
                      ? Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                          const dayOfWeek = getDayOfWeek(selectedYear, selectedMonth, day);
                          const isSunday = dayOfWeek === 0;
                          const isToday = isCurrentMonth && day === todayDate;

                          return (
                            <View
                              key={day}
                              style={[
                                styles.dayHeaderCell,
                                { width: DAY_COL_W_MONTH },
                                isToday && { backgroundColor: colors.primary },
                                isSunday && !isToday && { backgroundColor: '#fef2f2' },
                              ]}
                            >
                              <Text style={[
                                styles.dayHeaderWeekday,
                                { color: isToday ? '#fff' : isSunday ? '#ef4444' : colors.textSecondary }
                              ]}>
                                {DAY_NAMES_SHORT[dayOfWeek]}
                              </Text>
                              <Text style={[
                                styles.dayHeaderDayNum,
                                { color: isToday ? '#fff' : isSunday ? '#ef4444' : colors.text }
                              ]}>
                                {day}
                              </Text>
                            </View>
                          );
                        })
                      : weekDaysList.map(wDate => {
                          const dayOfWeek = wDate.getDay();
                          const isSunday = dayOfWeek === 0;
                          const isToday = wDate.toDateString() === now.toDateString();

                          return (
                            <View
                              key={wDate.toISOString()}
                              style={[
                                styles.dayHeaderCell,
                                { width: DAY_COL_W_WEEK },
                                isToday && { backgroundColor: colors.primary },
                                isSunday && !isToday && { backgroundColor: '#fef2f2' },
                              ]}
                            >
                              <Text style={[
                                styles.dayHeaderWeekday,
                                { color: isToday ? '#fff' : isSunday ? '#ef4444' : colors.textSecondary }
                              ]}>
                                {DAY_NAMES_SHORT[dayOfWeek]}
                              </Text>
                              <Text style={[
                                styles.dayHeaderDayNum,
                                { color: isToday ? '#fff' : isSunday ? '#ef4444' : colors.text }
                              ]}>
                                {wDate.getDate()}
                              </Text>
                            </View>
                          );
                        })}
                  </View>

                  {/* Category check rows */}
                  {KAIH_CATEGORIES.map((cat, idx) => (
                    <View
                      key={cat.key}
                      style={[
                        styles.checkRow,
                        { borderBottomColor: colors.border },
                        idx % 2 === 0 && { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' },
                      ]}
                    >
                      {viewMode === 'month'
                        ? Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                            const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                            const hasActivity = checklistMap[cat.key]?.has(dateKey);
                            const hasPlan = plannedMap[cat.key]?.has(dateKey);
                            const dayOfWeek = getDayOfWeek(selectedYear, selectedMonth, day);
                            const isSunday = dayOfWeek === 0;
                            const isToday = isCurrentMonth && day === todayDate;

                            return (
                              <View
                                key={day}
                                style={[
                                  styles.checkCell,
                                  { width: DAY_COL_W_MONTH },
                                  isSunday && !isToday && { backgroundColor: 'rgba(254,242,242,0.5)' },
                                  isToday && { backgroundColor: `${colors.primary}10` },
                                ]}
                              >
                                {hasActivity ? (
                                  <View style={[styles.checkMark, { backgroundColor: cat.color + '20' }]}>
                                    <Ionicons name="checkmark" size={14} color={cat.color} />
                                  </View>
                                ) : hasPlan ? (
                                  <View style={[styles.checkMark, { backgroundColor: '#fef3c7' }]}>
                                    <Ionicons name="time-outline" size={13} color="#d97706" />
                                  </View>
                                ) : (
                                  <View style={styles.emptyMark}>
                                    <View style={[styles.emptyDot, { backgroundColor: colors.border }]} />
                                  </View>
                                )}
                              </View>
                            );
                          })
                        : weekDaysList.map(wDate => {
                            const dateKey = `${wDate.getFullYear()}-${String(wDate.getMonth() + 1).padStart(2, '0')}-${String(wDate.getDate()).padStart(2, '0')}`;
                            const hasActivity = checklistMap[cat.key]?.has(dateKey);
                            const hasPlan = plannedMap[cat.key]?.has(dateKey);
                            const dayOfWeek = wDate.getDay();
                            const isSunday = dayOfWeek === 0;
                            const isToday = wDate.toDateString() === now.toDateString();

                            return (
                              <View
                                key={wDate.toISOString()}
                                style={[
                                  styles.checkCell,
                                  { width: DAY_COL_W_WEEK },
                                  isSunday && !isToday && { backgroundColor: 'rgba(254,242,242,0.5)' },
                                  isToday && { backgroundColor: `${colors.primary}10` },
                                ]}
                              >
                                {hasActivity ? (
                                  <View style={[styles.checkMark, { backgroundColor: cat.color + '20' }]}>
                                    <Ionicons name="checkmark" size={14} color={cat.color} />
                                  </View>
                                ) : hasPlan ? (
                                  <View style={[styles.checkMark, { backgroundColor: '#fef3c7' }]}>
                                    <Ionicons name="time-outline" size={13} color="#d97706" />
                                  </View>
                                ) : (
                                  <View style={styles.emptyMark}>
                                    <View style={[styles.emptyDot, { backgroundColor: colors.border }]} />
                                  </View>
                                )}
                              </View>
                            );
                          })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>
        )}

        {/* ----------------- MODE DETAIL HARIAN ----------------- */}
        {viewMode === 'day' && (
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <Text style={[styles.daySectionTitle, { color: colors.text }]}>
              📌 Checklist 7 KAIH ({currentDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })})
            </Text>

            {KAIH_CATEGORIES.map(cat => {
              const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDayNum).padStart(2, '0')}`;
              const act = checklistMap[cat.key]?.get(dateKey);
              const planAct = plannedMap[cat.key]?.get(dateKey);

              return (
                <View
                  key={cat.key}
                  style={[
                    styles.dailyCard,
                    { backgroundColor: colors.card, borderColor: act ? cat.color : planAct ? '#f59e0b' : colors.border },
                    (act || planAct) && { borderWidth: 1.5 },
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <View style={[styles.catEmojiBox, { backgroundColor: cat.bgColor, width: 36, height: 36, borderRadius: 10 }]}>
                      <Text style={{ fontSize: 18 }}>{cat.emoji}</Text>
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={[styles.dailyCatTitle, { color: colors.text }]}>{cat.label}</Text>
                      {act ? (
                        <Text style={[styles.dailyDescText, { color: colors.textSecondary }]} numberOfLines={1}>
                          {act.description || 'Sudah direalisasikan'}
                        </Text>
                      ) : planAct ? (
                        <Text style={[styles.dailyDescText, { color: '#d97706' }]} numberOfLines={1}>
                          📅 Rencana ({planAct.plannedTime}): {planAct.description}
                        </Text>
                      ) : (
                        <Text style={{ fontSize: 11, color: '#94a3b8' }}>Belum ada rencana / realisasi</Text>
                      )}
                    </View>
                  </View>

                  <View style={{ marginLeft: 8 }}>
                    {act ? (
                      <View style={[styles.dailyBadgeDone, { backgroundColor: `${cat.color}20` }]}>
                        <Ionicons name="checkmark-circle" size={16} color={cat.color} style={{ marginRight: 4 }} />
                        <Text style={[styles.dailyBadgeDoneText, { color: cat.color }]}>Selesai</Text>
                      </View>
                    ) : planAct ? (
                      (() => {
                        const eligibility = getRealizationEligibility(dateKey);
                        if (eligibility === 'too_old') {
                          return (
                            <View style={[styles.dailyBadgePending, { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' }]}>
                              <Ionicons name="lock-closed" size={12} color="#64748b" style={{ marginRight: 2 }} />
                              <Text style={{ fontSize: 10, color: '#64748b', fontWeight: 'bold' }}>Terkunci</Text>
                            </View>
                          );
                        }
                        return (
                          <TouchableOpacity
                            style={[styles.dailyBadgeDone, { backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a' }]}
                            onPress={() => router.push({ pathname: '/input', params: { mode: 'realize', planId: planAct.id } })}
                          >
                            <Ionicons name="checkbox-outline" size={15} color="#b45309" style={{ marginRight: 4 }} />
                            <Text style={[styles.dailyBadgeDoneText, { color: '#b45309' }]}>Ceklis</Text>
                          </TouchableOpacity>
                        );
                      })()
                    ) : (
                      <View style={styles.dailyBadgePending}>
                        <Text style={styles.dailyBadgePendingText}>Belum</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Legend */}
        {viewMode !== 'day' && (
          <View style={[styles.legendRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.legendItem}>
              <View style={[styles.checkMark, { backgroundColor: '#10b98120', width: 18, height: 18 }]}>
                <Ionicons name="checkmark" size={12} color="#10b981" />
              </View>
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Terealisasi</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.checkMark, { backgroundColor: '#fef3c7', width: 18, height: 18 }]}>
                <Ionicons name="time-outline" size={11} color="#d97706" />
              </View>
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Rencana</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.emptyMark, { width: 18, height: 18 }]}>
                <View style={[styles.emptyDot, { backgroundColor: colors.border }]} />
              </View>
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Belum</Text>
            </View>
          </View>
        )}

        {/* ----------------- RINGKASAN PER KEGIATAN ----------------- */}
        <View style={styles.catSummarySection}>
          <View style={{ marginBottom: 12 }}>
            <Text style={[styles.catSummaryTitle, { color: colors.text }]}>📊 Ringkasan Per Kegiatan</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
              Rincian butir kegiatan dijabarkan untuk seluruh pilar 7 KAIH ({viewMode === 'month' ? `Target 1 Bulan = ${daysInMonth}x per kegiatan` : viewMode === 'week' ? 'Target 1 Minggu = 7x per kegiatan' : 'Target 1 Hari = 1x per kegiatan'})
            </Text>
          </View>

          {KAIH_CATEGORIES.map(cat => {
            const periodDays = viewMode === 'month' ? daysInMonth : viewMode === 'week' ? 7 : 1;
            const isBeribadah = cat.key === 'Beribadah';
            const subDefs = isBeribadah ? BERIBADAH_SUB_ACTIVITIES : getPresetSubActivityDefs(cat.key);
            const hasMultipleSubs = subDefs && subDefs.length > 1;

            if (hasMultipleSubs) {
              // RINCIAN BUTIR KEGIATAN MULTI-CEKLIS (HANYA YANG SUDAH REALISASI)
              const catActs = filteredActivities.filter(a => a.kaihStatus !== 'RENCANA' && findMatchingCategoryKey(a.title) === cat.key);
              let totalCategoryDone = 0;

              const subStats = subDefs.map(sub => {
                let doneCount = 0;
                catActs.forEach(act => {
                  const descLower = (act.description || '').toLowerCase();
                  const titleLower = (act.title || '').toLowerCase();
                  const baseDesc = getBaseDescription(act.description || '').toLowerCase();
                  if (
                    sub.matchers.some(m => descLower.includes(m) || titleLower.includes(m) || baseDesc.includes(m) || m.includes(baseDesc))
                  ) {
                    doneCount++;
                  }
                });

                totalCategoryDone += doneCount;
                const subPct = periodDays > 0 ? Math.min(100, Math.round((doneCount / periodDays) * 100)) : 0;
                return { ...sub, doneCount, targetPerSub: periodDays, subPct };
              });

              const totalCategoryTarget = subDefs.length * periodDays;
              const categoryOverallPct = totalCategoryTarget > 0 ? Math.min(100, Math.round((totalCategoryDone / totalCategoryTarget) * 100)) : 0;

              return (
                <View key={cat.key} style={[styles.detailedCategoryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {/* Category Card Header */}
                  <View style={styles.detailedCategoryHeader}>
                    <View style={[styles.catEmojiBox, { backgroundColor: cat.bgColor, width: 32, height: 32, borderRadius: 10 }]}>
                      <Text style={{ fontSize: 16 }}>{cat.emoji}</Text>
                    </View>

                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.detailedCatTitleText, { color: colors.text }]}>{cat.label}</Text>
                      <Text style={{ fontSize: 10.5, color: colors.textSecondary }}>
                        {subDefs.length} Butir Rincian Kegiatan • Target: {totalCategoryTarget}x
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.detailedCatScoreText, { color: cat.color }]}>
                        {totalCategoryDone} / {totalCategoryTarget}
                      </Text>
                      <Text style={{ fontSize: 10, color: colors.textSecondary, fontWeight: '700' }}>
                        {categoryOverallPct}% Pencapaian
                      </Text>
                    </View>
                  </View>

                  {/* Sub-Activities Detailed Breakdown List */}
                  <View style={styles.subActivitiesWrapper}>
                    {subStats.map((subItem, sIdx) => (
                      <View key={sIdx} style={[styles.subActivityRowItem, sIdx < subStats.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                        <Text style={{ fontSize: 14, marginRight: 8 }}>{subItem.icon}</Text>
                        
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={[styles.subActivityLabel, { color: colors.text }]}>{subItem.label}</Text>
                          
                          {/* Progress Bar per Sub-Activity */}
                          <View style={[styles.subProgressBarBg, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                            <View style={[styles.subProgressBarFill, { width: `${subItem.subPct}%` as any, backgroundColor: cat.color }]} />
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={[styles.subActivityCountText, { color: subItem.doneCount > 0 ? cat.color : '#94a3b8' }]}>
                            {subItem.doneCount}/{subItem.targetPerSub} x
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            }

            // RINGKASAN STANDAR 1 BARIS UNTUK KATEGORI LAINNYA
            let count = 0;
            if (viewMode === 'month') {
              for (let d = 1; d <= daysInMonth; d++) {
                const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                if (checklistMap[cat.key]?.has(dateKey)) count++;
              }
            } else if (viewMode === 'week') {
              weekDaysList.forEach(wDate => {
                const dateKey = `${wDate.getFullYear()}-${String(wDate.getMonth() + 1).padStart(2, '0')}-${String(wDate.getDate()).padStart(2, '0')}`;
                if (checklistMap[cat.key]?.has(dateKey)) count++;
              });
            } else {
              const dateKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDayNum).padStart(2, '0')}`;
              if (checklistMap[cat.key]?.has(dateKey)) count = 1;
            }

            const pct = periodDays > 0 ? Math.round((count / periodDays) * 100) : 0;

            return (
              <View key={cat.key} style={[styles.catSummaryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[styles.catEmojiBox, { backgroundColor: cat.bgColor, width: 28, height: 28, borderRadius: 8 }]}>
                    <Text style={{ fontSize: 14 }}>{cat.emoji}</Text>
                  </View>
                  <Text style={[styles.catSummaryLabel, { color: colors.text }]}>{cat.label}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.catSummaryCount, { color: cat.color }]}>
                    {count}/{periodDays} {viewMode === 'day' ? 'kegiatan' : 'hari'}
                  </Text>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                    <View style={[styles.progressBarFill, { width: `${pct}%` as any, backgroundColor: cat.color }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerCurve: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
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
    marginBottom: 12,
  },
  headerLogo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
    color: '#ffffff',
    lineHeight: 18,
    flexShrink: 1,
  },
  viewModeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    padding: 3,
    marginBottom: 10,
  },
  viewModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 11,
  },
  viewModeBtnActive: {
    backgroundColor: '#ffffff',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  viewModeText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '600',
  },
  viewModeTextActive: {
    color: '#2563eb',
    fontWeight: 'bold',
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  monthNavBtn: {
    padding: 4,
  },
  monthNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthNavText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 2,
  },
  summaryLabel: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  tableWrapper: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  stickyCol: {
    width: CAT_COL_W,
    borderRightWidth: 1,
    zIndex: 10,
  },
  cornerCell: {
    height: 44,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
  },
  cornerText: {
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  catCell: {
    height: 42,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  catEmojiBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  catEmoji: {
    fontSize: 12,
  },
  catLabel: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  dayHeaderRow: {
    height: 44,
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  dayHeaderCell: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayHeaderWeekday: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  dayHeaderDayNum: {
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  checkRow: {
    height: 42,
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  checkCell: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyMark: {
    width: 22,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  daySectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  dailyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  dailyCatTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  dailyDescText: {
    fontSize: 11.5,
    marginTop: 1,
  },
  dailyBadgeDone: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  dailyBadgeDoneText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  dailyBadgePending: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  dailyBadgePendingText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '500',
  },

  // Detailed Activity Summary Styles
  catSummarySection: {
    marginHorizontal: 16,
    marginTop: 18,
  },
  catSummaryTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  catSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  catSummaryLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  catSummaryCount: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  progressBarBg: {
    width: 90,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  detailedCategoryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  detailedCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 8,
  },
  detailedCatTitleText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  detailedCatScoreText: {
    fontSize: 13,
    fontWeight: '800',
  },
  subActivitiesWrapper: {
    gap: 2,
  },
  subActivityRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  subActivityLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 3,
  },
  subProgressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  subProgressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  subActivityCountText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});
