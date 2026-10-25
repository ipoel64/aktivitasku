import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  StatusBar,
  Modal,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import kaihLogoAsset from '../../assets/kaih_logo.png';
import { KaihStatusModal, KaihLoadingScreen } from '../components/KaihLoadingLogo';
import { getUserStudentProfile } from '../utils/userCache';
import {
  KAIH_CATEGORIES_LIST,
  DEFAULT_CATEGORY_IMAGES,
  KAIH_CATEGORY_ICON_CONFIG,
  DEFAULT_KAIH_LOCAL_ASSETS,
  ActivityPreset,
  PRESET_ACTIVITIES_BY_CATEGORY,
  ParsedActivity,
  parseAndDeduplicateActivities,
  buildPlanDescription,
  buildRealizedDescription,
  getTodayAndTomorrowDates,
  matchKaihCategoryKey,
  getDayProgress,
  getRealizationWindow,
  getRealizationEligibility,
  getRealizationBlockedMessage,
  compareByStartTime,
  getBaseDescription,
} from '../utils/kaihPlanUtils';
import { syncKaihReminders } from '../utils/kaihReminders';

export {
  DEFAULT_CATEGORY_IMAGES,
  KAIH_CATEGORY_ICON_CONFIG,
  DEFAULT_KAIH_LOCAL_ASSETS,
  ActivityPreset,
  PRESET_ACTIVITIES_BY_CATEGORY,
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PlanSubItem {
  label: string;
  time: string; // HH:mm
}

interface CategoryPlanItemState {
  description: string;
  plannedTime: string; // HH:mm (jam kegiatan paling awal pada kategori ini)
  selectedSubItems?: PlanSubItem[]; // Ceklis rencana kegiatan (berlaku untuk SEMUA kategori)
}

// Titik koordinat cadangan bila GPS tidak tersedia (Binjai, Sumatera Utara)
const FALLBACK_COORD = { latitude: 3.6062, longitude: 98.4842 };

// Perayaan (konfeti) saat seluruh 7 KAIH hari ini selesai diceklis
const CONFETTI_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#3b82f6', '#a855f7', '#ec4899', '#facc15'];
const CONFETTI_COUNT = 36;

const formatFullAddress = (geoObj?: Location.LocationGeocodedAddress, fallbackStr?: string) => {
  if (!geoObj) return fallbackStr || 'Lokasi Dipilih';

  const placeName = (geoObj.name && geoObj.name !== geoObj.street && geoObj.name !== geoObj.subregion) ? geoObj.name : null;
  const streetName = geoObj.street || '';
  const districtName = geoObj.district || geoObj.subregion || '';
  const cityName = geoObj.city || '';

  const parts: string[] = [];
  if (placeName) parts.push(placeName);
  if (streetName) parts.push(streetName);
  if (districtName && districtName !== streetName) parts.push(districtName);
  if (cityName && cityName !== districtName) parts.push(cityName);

  const fullAddr = parts.join(', ').trim();
  return fullAddr || fallbackStr || 'Lokasi Dipilih';
};

const getLeafletHtml = (lat: number, lng: number) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
  <style>
    body, html, #map { height: 100%; margin: 0; padding: 0; background: #e2e8f0; }
    .leaflet-control-attribution { display: none !important; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [${lat}, ${lng}],
      zoom: 15,
      zoomControl: false,
      dragging: true,
      touchZoom: true
    });
    L.tileLayer('https://{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);
    var marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);
    function updatePos(newLat, newLng) {
      marker.setLatLng([newLat, newLng]);
      map.panTo([newLat, newLng]);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MARKER_POS', lat: newLat, lng: newLng }));
      }
    }
    map.on('click', function(e) { updatePos(e.latlng.lat, e.latlng.lng); });
    marker.on('dragend', function() {
      var pos = marker.getLatLng();
      updatePos(pos.lat, pos.lng);
    });
  </script>
</body>
</html>
`;

export default function InputActivityScreen() {
  const params = useLocalSearchParams<{ mode?: string; planId?: string }>();
  const { today, tomorrow, todayStr, tomorrowStr } = getTodayAndTomorrowDates();

  // Active Tab: 'realize' (Realisasi Hari Ini) | 'plan' (Buat Rencana Besok H-1)
  const [activeTab, setActiveTab] = useState<'realize' | 'plan'>(
    params.mode === 'plan' ? 'plan' : 'realize'
  );

  // Target Date for Planning: defaults to tomorrow (H+1), but allows today if today has 0 plans yet
  const [planTargetMode, setPlanTargetMode] = useState<'tomorrow' | 'today'>('tomorrow');
  const activePlanDateStr = planTargetMode === 'tomorrow' ? tomorrowStr : todayStr;
  const activePlanDateObj = planTargetMode === 'tomorrow' ? tomorrow : today;

  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [allActivities, setAllActivities] = useState<ParsedActivity[]>([]);

  // Plan Form State for all 7 KAIH categories (setiap kategori berupa ceklis kegiatan)
  const [planForm, setPlanForm] = useState<Record<string, CategoryPlanItemState>>(() => {
    const initial: Record<string, CategoryPlanItemState> = {};
    KAIH_CATEGORIES_LIST.forEach((cat) => {
      const presets = PRESET_ACTIVITIES_BY_CATEGORY[cat.key] || [];
      initial[cat.key] = {
        description: '',
        plannedTime: presets[0]?.defaultTime || '06:00',
        selectedSubItems: [],
      };
    });
    return initial;
  });

  // Input kegiatan tambahan (kustom) per kategori
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  // TimePicker state for Plan Form (mengedit jam kegiatan di dalam kategori)
  const [editingSubTarget, setEditingSubTarget] = useState<{ catKey: string; label: string; currentTime: string } | null>(null);
  const [editingTimeCatKey, setEditingTimeCatKey] = useState<string | null>(null);
  const [confirmPlanModalVisible, setConfirmPlanModalVisible] = useState<boolean>(false);

  // Realization Modal State (when checking off a planned item)
  const [realizeItem, setRealizeItem] = useState<ParsedActivity | null>(null);
  const [realizeModalVisible, setRealizeModalVisible] = useState<boolean>(false);
  // Waktu pelaksanaan dikosongkan secara default dan WAJIB diisi siswa
  const [realizeTime, setRealizeTime] = useState<Date | null>(null);
  const [realizeTimeError, setRealizeTimeError] = useState<boolean>(false);
  const [showRealizeTimePicker, setShowRealizeTimePicker] = useState<boolean>(false);
  const [realizeNote, setRealizeNote] = useState<string>('');
  const [realizeImageUri, setRealizeImageUri] = useState<string | null>(null);

  // Perayaan saat seluruh 7 KAIH pada suatu hari selesai diceklis
  const [celebrationVisible, setCelebrationVisible] = useState<boolean>(false);
  const [celebrationInfo, setCelebrationInfo] = useState<{ dateLabel: string; activityCount: number }>({
    dateLabel: '',
    activityCount: 0,
  });

  // Location & Map State
  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [markerCoord, setMarkerCoord] = useState<{ latitude: number; longitude: number }>(FALLBACK_COORD);
  const [searchingAddress, setSearchingAddress] = useState<boolean>(false);
  const [addressSearchQuery, setAddressSearchQuery] = useState<string>('');
  const webViewRef = useRef<WebView>(null);
  // Penanda permintaan deteksi GPS terbaru, agar hasil lama tidak menimpa hasil baru
  const gpsRequestIdRef = useRef<number>(0);

  // Fetch student activities
  const fetchActivitiesData = useCallback(async (showSpinner = false): Promise<ParsedActivity[]> => {
    if (showSpinner) setLoadingData(true);
    let result: ParsedActivity[] = [];
    try {
      const userProfile = await getUserStudentProfile();
      let studentId = userProfile?.student?.id;

      if (!studentId && userProfile?.profile?.id) {
        const { data: st } = await supabase
          .from('students')
          .select('id')
          .eq('profile_id', userProfile.profile.id)
          .maybeSingle();
        studentId = st?.id;
      }

      if (studentId) {
        const { data, error } = await supabase
          .from('activities')
          .select('*, evaluations(rating, comment)')
          .eq('student_id', studentId)
          .order('activity_time', { ascending: true });

        if (!error && data) {
          const deduplicated = parseAndDeduplicateActivities(data);
          result = deduplicated;
          setAllActivities(deduplicated);

          // Jadwalkan ulang alarm pengingat sesuai rencana terbaru (tidak menunggu hasilnya)
          syncKaihReminders(deduplicated);

          // If opened with a specific planId param, auto-open its realization modal
          if (params.planId) {
            const target = deduplicated.find(a => String(a.id) === String(params.planId));
            if (target && target.kaihStatus === 'RENCANA') {
              openRealizeModalForItem(target);
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching activities in input.tsx:', e);
    } finally {
      setLoadingData(false);
    }
    return result;
  }, [params.planId]);

  useEffect(() => {
    fetchActivitiesData(true);
  }, [fetchActivitiesData]);

  /**
   * Mendeteksi titik GPS perangkat saat ini (alamat + koordinat).
   * Dipakai saat halaman dibuka dan setiap kali ceklis realisasi baru dibuat,
   * sehingga lokasi selalu sesuai posisi siswa saat ini dan tidak membawa sisa data ceklis sebelumnya.
   */
  const detectCurrentLocation = useCallback(async (accuracy: Location.Accuracy = Location.Accuracy.Balanced) => {
    const requestId = ++gpsRequestIdRef.current;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (requestId !== gpsRequestIdRef.current) return;
      if (status !== 'granted') {
        setLocation(null);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy });
      if (requestId !== gpsRequestIdRef.current) return;

      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setMarkerCoord({ latitude: lat, longitude: lng });

      let locName = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
        if (geocode.length > 0) {
          locName = formatFullAddress(geocode[0], locName) || locName;
        }
      } catch {}
      if (requestId !== gpsRequestIdRef.current) return;
      setLocation({ lat, lng, name: locName });
    } catch {
      if (requestId === gpsRequestIdRef.current) setLocation(null);
    }
  }, []);

  // Auto-detect GPS Location in background
  useEffect(() => {
    detectCurrentLocation();
  }, [detectCurrentLocation]);

  // Aktivitas hari ini & kemarin (batas terakhir pengerjaan ceklis), urut dari jam mulai paling awal
  const { yesterdayStr } = getRealizationWindow();

  const todayActivities = allActivities
    .filter(a => a.activity_date === todayStr)
    .sort(compareByStartTime);

  const yesterdayActivities = allActivities
    .filter(a => a.activity_date === yesterdayStr)
    .sort(compareByStartTime);

  const yesterdayPendingCount = yesterdayActivities.filter(a => a.kaihStatus === 'RENCANA').length;
  const lockedPendingCount = allActivities.filter(
    a => a.kaihStatus === 'RENCANA' && getRealizationEligibility(a.activity_date) === 'too_old'
  ).length;

  const todayRealizedCount = todayActivities.filter(a => a.kaihStatus === 'REALISASI').length;
  const todayTotalCount = todayActivities.length;

  // Progres harian: sebuah kategori baru dianggap tuntas bila SEMUA kegiatannya sudah diceklis
  const todayProgress = useMemo(() => getDayProgress(allActivities, todayStr), [allActivities, todayStr]);
  const todayRealizedCategories = { size: todayProgress.completedCategoryCount };

  // Filter Tomorrow's Activities (Plans for Tomorrow)
  const tomorrowActivities = allActivities
    .filter(a => a.activity_date === tomorrowStr)
    .sort(compareByStartTime);

  const tomorrowPlannedCategories = new Set(
    tomorrowActivities.map(a => matchKaihCategoryKey(a.title)).filter(Boolean)
  );

  // Active target date's existing plans
  const existingPlansForTargetDate = allActivities
    .filter(a => a.activity_date === activePlanDateStr)
    .sort(compareByStartTime);

  const existingCategoriesForTargetDate = new Set(
    existingPlansForTargetDate.map(a => matchKaihCategoryKey(a.title)).filter(Boolean)
  );

  // Pre-populate planForm from existing plans when target date changes
  useEffect(() => {
    const nextForm: Record<string, CategoryPlanItemState> = {};
    KAIH_CATEGORIES_LIST.forEach((cat) => {
      const catItems = allActivities
        .filter(a => a.activity_date === activePlanDateStr && matchKaihCategoryKey(a.title) === cat.key)
        .sort(compareByStartTime);
      const presets = PRESET_ACTIVITIES_BY_CATEGORY[cat.key] || [];
      const fallbackTime = presets[0]?.defaultTime || '06:00';

      const subs: PlanSubItem[] = [];
      catItems.forEach(item => {
        const label = getBaseDescription(item.description);
        if (label && !subs.some(s => s.label.toLowerCase() === label.toLowerCase())) {
          subs.push({ label, time: item.plannedTime || fallbackTime });
        }
      });

      nextForm[cat.key] = {
        description: subs.map(s => s.label).join('; '),
        plannedTime: subs[0]?.time || fallbackTime,
        selectedSubItems: subs,
      };
    });
    setPlanForm(nextForm);
  }, [activePlanDateStr, allActivities]);

  // Auto-fill all 7 categories with standard 7 KAIH schedule
  const handleAutoFillStandardPlan = () => {
    const filled: Record<string, CategoryPlanItemState> = {};
    KAIH_CATEGORIES_LIST.forEach((cat) => {
      const presets = PRESET_ACTIVITIES_BY_CATEGORY[cat.key] || [];
      // Beribadah: seluruh jadwal ibadah. Kategori lain: kegiatan standar pertama (bisa ditambah manual)
      const chosen = cat.key === 'Beribadah' ? presets : presets.slice(0, 1);
      const subs: PlanSubItem[] = chosen.length > 0
        ? chosen.map(p => ({ label: p.label, time: p.defaultTime }))
        : [{ label: `Melaksanakan ${cat.name}`, time: '06:00' }];
      subs.sort((a, b) => a.time.localeCompare(b.time));
      filled[cat.key] = {
        description: subs.map(s => s.label).join('; '),
        plannedTime: subs[0]?.time || '06:00',
        selectedSubItems: subs,
      };
    });
    setPlanForm(filled);
  };

  // Menyimpan daftar kegiatan (ceklis) suatu kategori sekaligus menyelaraskan field turunannya
  const applyCategorySubs = (catKey: string, subs: PlanSubItem[]) => {
    const presets = PRESET_ACTIVITIES_BY_CATEGORY[catKey] || [];
    const sorted = [...subs].sort((a, b) => a.time.localeCompare(b.time));
    setPlanForm(prev => ({
      ...prev,
      [catKey]: {
        ...prev[catKey],
        selectedSubItems: sorted,
        plannedTime: sorted[0]?.time || presets[0]?.defaultTime || '06:00',
        description: sorted.map(s => s.label).join('; '),
      },
    }));
  };

  // Centang / hapus centang salah satu kegiatan preset pada kategori mana pun
  const togglePresetSubItem = (catKey: string, preset: ActivityPreset) => {
    const currentSubs = planForm[catKey]?.selectedSubItems || [];
    const exists = currentSubs.some(s => s.label === preset.label);
    applyCategorySubs(
      catKey,
      exists
        ? currentSubs.filter(s => s.label !== preset.label)
        : [...currentSubs, { label: preset.label, time: preset.defaultTime }]
    );
  };

  const selectAllPresetsForCategory = (catKey: string) => {
    const presets = PRESET_ACTIVITIES_BY_CATEGORY[catKey] || [];
    const currentSubs = planForm[catKey]?.selectedSubItems || [];
    const customOnly = currentSubs.filter(s => !presets.some(p => p.label === s.label));
    applyCategorySubs(catKey, [
      ...presets.map(p => {
        const existing = currentSubs.find(s => s.label === p.label);
        return { label: p.label, time: existing?.time || p.defaultTime };
      }),
      ...customOnly,
    ]);
  };

  const removeSubItem = (catKey: string, label: string) => {
    const currentSubs = planForm[catKey]?.selectedSubItems || [];
    applyCategorySubs(catKey, currentSubs.filter(s => s.label !== label));
  };

  const addCustomSubItem = (catKey: string) => {
    const text = (customInputs[catKey] || '').trim();
    if (!text) return;
    const currentSubs = planForm[catKey]?.selectedSubItems || [];
    if (currentSubs.some(s => s.label.toLowerCase() === text.toLowerCase())) {
      Alert.alert('Sudah Ada', 'Kegiatan tersebut sudah ada di dalam daftar rencana kategori ini.');
      return;
    }
    const presets = PRESET_ACTIVITIES_BY_CATEGORY[catKey] || [];
    applyCategorySubs(catKey, [...currentSubs, { label: text, time: presets[0]?.defaultTime || '06:00' }]);
    setCustomInputs(prev => ({ ...prev, [catKey]: '' }));
  };

  const setSubItemTime = (catKey: string, label: string, time: string) => {
    const currentSubs = planForm[catKey]?.selectedSubItems || [];
    applyCategorySubs(catKey, currentSubs.map(s => (s.label === label ? { ...s, time } : s)));
  };

  // Kategori dianggap terisi bila minimal ada satu kegiatan yang diceklis
  const isCategoryFilled = (catKey: string) => {
    const item = planForm[catKey];
    if (!item) return false;
    return (item.selectedSubItems && item.selectedSubItems.length > 0) || item.description.trim().length > 0;
  };

  // Count how many of the 7 categories are filled in the form
  const filledCategoryKeys = KAIH_CATEGORIES_LIST.filter(cat => isCategoryFilled(cat.key));

  const isAll7CategoriesFilled = filledCategoryKeys.length === 7;

  // Validate and open Confirmation Modal for saving the 7 KAIH Plan
  const handleValidateAndOpenConfirmPlan = () => {
    if (!isAll7CategoriesFilled) {
      const missingNames = KAIH_CATEGORIES_LIST.filter(cat => !filledCategoryKeys.some(f => f.key === cat.key))
        .map(c => `• ${c.icon} ${c.name}`)
        .join('\n');

      Alert.alert(
        'Rencana 7 KAIH Belum Lengkap',
        `Siswa wajib merencanakan seluruh 7 kategori KAIH sekaligus terlebih dahulu.\n\nKategori yang belum diisi (${7 - filledCategoryKeys.length}):\n${missingNames}`,
        [
          { text: 'Isi Manual', style: 'cancel' },
          { text: '✨ Isi Otomatis Standar', onPress: handleAutoFillStandardPlan },
        ]
      );
      return;
    }

    setConfirmPlanModalVisible(true);
  };

  // Save the 7 KAIH Plan to Supabase
  const handleSave7KaihPlan = async () => {
    setConfirmPlanModalVisible(false);
    setSubmitting(true);

    try {
      const userProfile = await getUserStudentProfile();
      let studentId = userProfile?.student?.id;

      if (!studentId && userProfile?.profile?.id) {
        const { data: st } = await supabase
          .from('students')
          .select('id')
          .eq('profile_id', userProfile.profile.id)
          .maybeSingle();
        studentId = st?.id;
      }

      if (!studentId) {
        throw new Error('Data profil siswa tidak ditemukan.');
      }

      // Build rows to insert/update for the target date
      // First, check which categories already have REALISASI on that date so we don't overwrite realized items
      const existingForDate = allActivities.filter(a => a.activity_date === activePlanDateStr);
      const existingPlanIdsToDelete = existingForDate
        .filter(a => a.kaihStatus === 'RENCANA')
        .map(a => a.id);

      if (existingPlanIdsToDelete.length > 0) {
        await supabase.from('activities').delete().in('id', existingPlanIdsToDelete);
      }

      const rowsToInsert: any[] = [];

      for (const cat of KAIH_CATEGORIES_LIST) {
        const formItem = planForm[cat.key];
        if (!formItem) continue;

        // Setiap kategori disimpan per kegiatan yang diceklis (satu baris rencana per kegiatan)
        const subs: PlanSubItem[] = formItem.selectedSubItems && formItem.selectedSubItems.length > 0
          ? formItem.selectedSubItems
          : formItem.description.trim()
            ? [{ label: formItem.description.trim(), time: formItem.plannedTime || '06:00' }]
            : [];

        for (const sub of subs) {
          const alreadyRealized = existingForDate.some(
            ex =>
              ex.kaihStatus === 'REALISASI' &&
              matchKaihCategoryKey(ex.title) === cat.key &&
              getBaseDescription(ex.description).toLowerCase() === sub.label.toLowerCase()
          );
          if (!alreadyRealized) {
            const timeHHMM = (sub.time || '06:00').slice(0, 5);
            rowsToInsert.push({
              student_id: studentId,
              title: cat.key,
              description: buildPlanDescription(sub.label, timeHHMM),
              photo_url: 'PLAN_PENDING',
              activity_date: activePlanDateStr,
              activity_time: `${timeHHMM}:00`,
              location_name: 'Rencana Terjadwal',
            });
          }
        }
      }

      if (rowsToInsert.length > 0) {
        const { error } = await supabase.from('activities').insert(rowsToInsert);
        if (error) throw error;
      }

      getUserStudentProfile(true);
      await fetchActivitiesData(false);

      setTimeout(() => {
        setSubmitting(false);
        if (planTargetMode === 'today') {
          setActiveTab('realize');
          Alert.alert(
            '✅ Rencana Hari Ini Tersimpan!',
            'Seluruh 7 KAIH berhasil direncanakan. Sekarang Anda dapat melakukan Ceklis Realisasi sesuai kegiatan yang dikerjakan hari ini.'
          );
        } else {
          Alert.alert(
            '✅ Rencana Besok Berhasil Disimpan!',
            'Seluruh 7 KAIH untuk esok hari telah terjadwal. Besok Anda tinggal melakukan Ceklis Realisasi sesuai daftar rencana ini!',
            [
              { text: 'Lihat Beranda', onPress: () => router.replace('/(tabs)') },
              { text: 'Tetap di Sini', style: 'cancel' },
            ]
          );
        }
      }, 900);
    } catch (err: any) {
      setSubmitting(false);
      Alert.alert('Gagal Menyimpan Rencana', err.message || 'Terjadi kesalahan jaringan.');
    }
  };

  // Open Realization Modal for a specific planned item
  const openRealizeModalForItem = (item: ParsedActivity) => {
    // Batas pengerjaan: hanya hari ini & kemarin. Rencana yang lebih lama / belum tiba tidak bisa diceklis.
    const eligibility = getRealizationEligibility(item.activity_date);
    if (eligibility !== 'ok') {
      Alert.alert(
        eligibility === 'too_old' ? '🔒 Ceklis Sudah Terkunci' : '⏳ Belum Waktunya',
        getRealizationBlockedMessage(eligibility)
      );
      return;
    }

    // Setiap ceklis baru dimulai dari keadaan bersih: tidak ada sisa data ceklis sebelumnya
    setRealizeItem(item);
    setRealizeTime(null); // waktu pelaksanaan kosong & wajib diisi
    setRealizeTimeError(false);
    setShowRealizeTimePicker(false);
    setRealizeNote('');
    setRealizeImageUri(null);
    setAddressSearchQuery('');
    setLocation(null); // alamat & titik GPS dikosongkan, lalu diisi ulang sesuai posisi saat ini
    setRealizeModalVisible(true);
    detectCurrentLocation();
  };

  const takePhotoForRealize = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Ditolak', 'Izin kamera diperlukan untuk mengambil foto bukti.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0].uri) {
      setRealizeImageUri(result.assets[0].uri);
    }
  };

  const pickImageForRealize = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0].uri) {
      setRealizeImageUri(result.assets[0].uri);
    }
  };

  const handleRefreshMyLocation = async () => {
    setSearchingAddress(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Akses lokasi diperlukan untuk mencatat posisi realisasi.');
        return;
      }
      setAddressSearchQuery('');
      setLocation(null);
      await detectCurrentLocation(Location.Accuracy.High);
    } catch {
      Alert.alert('Info', 'Gagal memperbarui lokasi GPS. Coba lagi atau pilih lokasi di peta.');
    } finally {
      setSearchingAddress(false);
    }
  };

  const handleSearchAddress = async () => {
    if (!addressSearchQuery.trim()) return;
    gpsRequestIdRef.current++; // pilihan manual siswa tidak boleh ditimpa hasil deteksi GPS otomatis
    setSearchingAddress(true);
    try {
      let results = await Location.geocodeAsync(addressSearchQuery.trim());
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        setMarkerCoord({ latitude, longitude });
        webViewRef.current?.injectJavaScript(`updatePos(${latitude}, ${longitude}); true;`);

        let geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        let detailAddr = geocode.length > 0 ? formatFullAddress(geocode[0]) : '';
        const searchInput = addressSearchQuery.trim();
        let finalName = searchInput;
        if (detailAddr && !detailAddr.toLowerCase().includes(searchInput.toLowerCase())) {
          finalName = `${searchInput} (${detailAddr})`;
        } else if (detailAddr) {
          finalName = detailAddr;
        }
        setLocation({ lat: latitude, lng: longitude, name: finalName });
      } else {
        Alert.alert('Alamat Tidak Ditemukan', 'Coba ketik nama tempat atau jalan yang lebih spesifik.');
      }
    } catch {
      Alert.alert('Error', 'Gagal mencari lokasi.');
    } finally {
      setSearchingAddress(false);
    }
  };

  // Submit Realization (Checklist completion) for the selected planned item
  const handleConfirmRealization = async () => {
    if (!realizeItem) return;

    // 1. Batas pengerjaan ceklis (hari ini & kemarin saja)
    const eligibility = getRealizationEligibility(realizeItem.activity_date);
    if (eligibility !== 'ok') {
      setRealizeModalVisible(false);
      Alert.alert(
        eligibility === 'too_old' ? '🔒 Ceklis Sudah Terkunci' : '⏳ Belum Waktunya',
        getRealizationBlockedMessage(eligibility)
      );
      return;
    }

    // 2. Waktu pelaksanaan wajib diisi
    if (!realizeTime) {
      setRealizeTimeError(true);
      Alert.alert(
        'Waktu Pelaksanaan Wajib Diisi',
        'Silakan pilih jam pelaksanaan kegiatan yang sebenarnya terlebih dahulu sebelum menyimpan ceklis.'
      );
      return;
    }

    // 3. Lokasi GPS: lanjutkan hanya jika siswa memilih menyimpan tanpa lokasi
    if (!location) {
      Alert.alert(
        'Lokasi Belum Terdeteksi',
        'Titik GPS belum terdeteksi. Tekan "Perbarui GPS" atau pilih lokasi di peta agar lokasi pelaksanaan tercatat.',
        [
          { text: 'Kembali', style: 'cancel' },
          { text: 'Simpan Tanpa Lokasi', onPress: () => submitRealization(realizeTime) },
        ]
      );
      return;
    }

    await submitRealization(realizeTime);
  };

  const submitRealization = async (chosenTime: Date) => {
    if (!realizeItem) return;
    setRealizeModalVisible(false);
    setSubmitting(true);

    try {
      const userProfile = await getUserStudentProfile();
      let photoUrl = 'KAIH_LOGO';

      if (realizeImageUri && userProfile?.user?.id) {
        const fileExt = realizeImageUri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `activity_photos/${userProfile.user.id}/${Date.now()}.${fileExt}`;
        const base64 = await FileSystem.readAsStringAsync(realizeImageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { error: uploadError } = await supabase.storage
          .from('public_assets')
          .upload(fileName, decode(base64), {
            contentType: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('public_assets')
          .getPublicUrl(fileName);
        photoUrl = publicUrlData.publicUrl;
      }

      const pad = (n: number) => (n < 10 ? '0' + n : String(n));
      const actualTimeStr = `${pad(chosenTime.getHours())}:${pad(chosenTime.getMinutes())}:00`;

      const updatedDescription = buildRealizedDescription(
        realizeItem.description,
        realizeItem.plannedTime,
        String(realizeItem.id),
        realizeNote
      );

      const updatePayload = {
        activity_time: actualTimeStr,
        description: updatedDescription,
        photo_url: photoUrl,
        latitude: location?.lat || null,
        longitude: location?.lng || null,
        location_name: location?.name || 'Lokasi Realisasi Siswa',
      };

      // 1. Try UPDATE in-place first
      const { data: updatedRows, error: updateErr } = await supabase
        .from('activities')
        .update(updatePayload)
        .eq('id', realizeItem.id)
        .select();

      // 2. Automatic INSERT fallback if UPDATE is restricted by RLS
      if (updateErr || !updatedRows || updatedRows.length === 0) {
        const { error: insertErr } = await supabase.from('activities').insert({
          student_id: realizeItem.student_id,
          title: realizeItem.title,
          activity_date: realizeItem.activity_date,
          ...updatePayload,
        });
        if (insertErr) throw insertErr;
      }

      getUserStudentProfile(true);
      const freshActivities = await fetchActivitiesData(false);

      // Jika seluruh 7 KAIH pada hari kegiatan ini sudah tuntas diceklis, tampilkan perayaan
      const dayProgress = getDayProgress(freshActivities, realizeItem.activity_date);

      setTimeout(() => {
        setSubmitting(false);
        if (dayProgress.isAllDone) {
          const dp = String(realizeItem.activity_date).split('-');
          const doneDate = new Date(Number(dp[0]), Number(dp[1]) - 1, Number(dp[2]));
          setCelebrationInfo({
            dateLabel: doneDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }),
            activityCount: dayProgress.done,
          });
          setCelebrationVisible(true);
        }
      }, 800);
    } catch (err: any) {
      setSubmitting(false);
      Alert.alert('Gagal Menyimpan Realisasi', err.message || 'Terjadi kesalahan saat menyimpan realisasi.');
    }
  };

  // Tutup perayaan lalu otomatis menuju halaman rencana 7 KAIH untuk besok
  const handleCelebrationContinue = useCallback(() => {
    setCelebrationVisible(false);
    setPlanTargetMode('tomorrow');
    setActiveTab('plan');
  }, []);

  const formatFullDateIndo = (d: Date) =>
    d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  // Kartu ceklis satu kegiatan (dipakai oleh daftar "Hari Ini" dan "Kemarin")
  const renderChecklistItem = (item: ParsedActivity) => {
    const catKey = matchKaihCategoryKey(item.title) || 'Bangun Pagi';
    const catDef = KAIH_CATEGORIES_LIST.find(c => c.key === catKey) || KAIH_CATEGORIES_LIST[0];
    const isDone = item.kaihStatus === 'REALISASI';

    return (
      <View
        key={item.id}
        style={[
          styles.checklistItemCard,
          isDone
            ? { borderColor: '#86efac', backgroundColor: '#f0fdf4' }
            : { borderColor: '#e2e8f0', backgroundColor: '#ffffff' },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {/* Left Checkbox / Status Icon */}
          <TouchableOpacity
            disabled={isDone || getRealizationEligibility(item.activity_date) === 'too_old'}
            onPress={() => openRealizeModalForItem(item)}
            style={[
              styles.checkboxSquare,
              isDone
                ? { backgroundColor: '#16a34a', borderColor: '#16a34a' }
                : { backgroundColor: '#f8fafc', borderColor: catDef.color },
            ]}
          >
            {isDone ? (
              <Ionicons name="checkmark" size={18} color="#ffffff" />
            ) : (
              <Text style={{ fontSize: 14 }}>{catDef.icon}</Text>
            )}
          </TouchableOpacity>

          {/* Center Content */}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
              <View style={[styles.catBadgeSmall, { backgroundColor: catDef.bgColor }]}>
                <Text style={[styles.catBadgeSmallText, { color: catDef.color }]}>
                  {catDef.icon} {catDef.name}
                </Text>
              </View>

              <View style={styles.timePlanBadge}>
                <Ionicons name="time-outline" size={11} color="#475569" style={{ marginRight: 2 }} />
                <Text style={styles.timePlanBadgeText}>Rencana: {item.plannedTime}</Text>
              </View>

              {Boolean(isDone && item.realizedTime) ? (
                <View style={styles.timeRealizedBadge}>
                  <Ionicons name="checkmark-circle" size={11} color="#15803d" style={{ marginRight: 2 }} />
                  <Text style={styles.timeRealizedBadgeText}>Realisasi: {item.realizedTime}</Text>
                </View>
              ) : null}
            </View>

            <Text
              style={[
                styles.checklistDescText,
                isDone && { color: '#166534' },
              ]}
            >
              {item.description}
            </Text>

            {Boolean(isDone && item.location_name && item.location_name !== 'Rencana Terjadwal') ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <Ionicons name="location" size={11} color="#16a34a" style={{ marginRight: 3 }} />
                <Text style={{ fontSize: 10.5, color: '#475569', flex: 1 }} numberOfLines={1}>
                  {item.location_name}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Right Action Button or Done Badge */}
          <View style={{ marginLeft: 8, justifyContent: 'center' }}>
            {isDone ? (
              <View style={styles.donePillBadge}>
                <Ionicons name="checkmark-done" size={14} color="#15803d" />
                <Text style={styles.donePillText}>Selesai</Text>
              </View>
            ) : getRealizationEligibility(item.activity_date) === 'too_old' ? (
              <View style={styles.lockedPillBadge}>
                <Ionicons name="lock-closed" size={12} color="#64748b" style={{ marginRight: 3 }} />
                <Text style={styles.lockedPillText}>Terkunci</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.realizeBtn, { backgroundColor: catDef.color }]}
                onPress={() => openRealizeModalForItem(item)}
                activeOpacity={0.85}
              >
                <Ionicons name="checkbox-outline" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.realizeBtnText}>Ceklis</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loadingData) {
    return <KaihLoadingScreen message="Memuat Rencana & Realisasi 7 KAIH..." backgroundColor="#f8fafc" />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1d4ed8" />

      {/* Header Utama */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/(tabs)');
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
          </TouchableOpacity>
          <Image source={kaihLogoAsset} style={styles.headerLogo} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Perencanaan & Realisasi 7 KAIH</Text>
            <Text style={styles.headerSubtitle}>Rencanakan dahulu 7 KAIH, realisasikan esok harinya</Text>
          </View>
        </View>

        {/* 2 Tab Utama: Realisasi Hari Ini vs Buat Rencana Besok */}
        <View style={styles.segmentedTabWrapper}>
          <TouchableOpacity
            style={[styles.segmentedTabBtn, activeTab === 'realize' && styles.segmentedTabBtnActive]}
            onPress={() => setActiveTab('realize')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="checkbox"
              size={15}
              color={activeTab === 'realize' ? '#1d4ed8' : '#e0f2fe'}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.segmentedTabText, activeTab === 'realize' && styles.segmentedTabTextActive]}>
              Realisasi Hari Ini
            </Text>
            <View style={[styles.tabCountBadge, activeTab === 'realize' ? { backgroundColor: '#dbeafe' } : { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={[styles.tabCountBadgeText, { color: activeTab === 'realize' ? '#1d4ed8' : '#fff' }]}>
                {todayRealizedCategories.size}/7
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.segmentedTabBtn, activeTab === 'plan' && styles.segmentedTabBtnActive]}
            onPress={() => setActiveTab('plan')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="calendar"
              size={15}
              color={activeTab === 'plan' ? '#1d4ed8' : '#e0f2fe'}
              style={{ marginRight: 5 }}
            />
            <Text style={[styles.segmentedTabText, activeTab === 'plan' && styles.segmentedTabTextActive]}>
              Rencana Besok
            </Text>
            <View style={[styles.tabCountBadge, activeTab === 'plan' ? { backgroundColor: '#dcfce7' } : { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={[styles.tabCountBadgeText, { color: activeTab === 'plan' ? '#15803d' : '#fff' }]}>
                {tomorrowPlannedCategories.size >= 7 ? '✓ 7/7' : `${tomorrowPlannedCategories.size}/7`}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ==================== TAB 1: REALISASI HARI INI (CHECKLIST KEGIATAN) ==================== */}
      {activeTab === 'realize' && (
        <ScrollView style={styles.bodyScroll} contentContainerStyle={{ padding: 16, paddingBottom: 110 }}>
          {/* Info Banner Hari Ini & Progress Realisasi */}
          <View style={styles.progressSummaryCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={styles.iconCircleBlue}>
                  <Ionicons name="today" size={18} color="#2563eb" />
                </View>
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.cardSectionTitle}>Checklist Realisasi Hari Ini</Text>
                  <Text style={styles.cardSectionSub}>{formatFullDateIndo(today)}</Text>
                </View>
              </View>
              <View style={styles.scorePillBadge}>
                <Text style={styles.scorePillText}>
                  {todayRealizedCount}/{todayTotalCount || 7} Selesai
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${todayTotalCount > 0 ? Math.min(100, Math.round((todayRealizedCount / todayTotalCount) * 100)) : 0}%` as any,
                  },
                ]}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '600' }}>
                🎯 {todayRealizedCategories.size} dari 7 Kategori KAIH Terealisasi
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="location" size={12} color="#ef4444" style={{ marginRight: 3 }} />
                <Text style={{ fontSize: 11, color: '#475569', maxWidth: 160 }} numberOfLines={1}>
                  {location?.name || 'Mendeteksi GPS...'}
                </Text>
              </View>
            </View>

            {/* Progres per kategori: kategori tuntas bila semua kegiatannya sudah diceklis */}
            {todayTotalCount > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {KAIH_CATEGORIES_LIST.filter(c => (todayProgress.categories[c.key]?.total || 0) > 0).map(c => {
                  const cp = todayProgress.categories[c.key];
                  return (
                    <View
                      key={c.key}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 10,
                        borderWidth: 1,
                        backgroundColor: cp.complete ? '#dcfce7' : c.bgColor,
                        borderColor: cp.complete ? '#86efac' : c.color + '55',
                      }}
                    >
                      <Text style={{ fontSize: 11, marginRight: 3 }}>{c.icon}</Text>
                      <Text style={{ fontSize: 10.5, fontWeight: 'bold', color: cp.complete ? '#15803d' : c.color }}>
                        {cp.done}/{cp.total}{cp.complete ? ' ✓' : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Status Rencana Besok Reminder Card */}
          <TouchableOpacity
            style={[
              styles.tomorrowReminderBanner,
              tomorrowPlannedCategories.size >= 7
                ? { backgroundColor: '#f0fdf4', borderColor: '#86efac' }
                : { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
            ]}
            activeOpacity={0.85}
            onPress={() => {
              setPlanTargetMode('tomorrow');
              setActiveTab('plan');
            }}
          >
            <Ionicons
              name={tomorrowPlannedCategories.size >= 7 ? 'checkmark-done-circle' : 'calendar-outline'}
              size={22}
              color={tomorrowPlannedCategories.size >= 7 ? '#16a34a' : '#d97706'}
              style={{ marginRight: 10 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12.5, fontWeight: 'bold', color: tomorrowPlannedCategories.size >= 7 ? '#15803d' : '#b45309' }}>
                {tomorrowPlannedCategories.size >= 7
                  ? '✅ Rencana 7 KAIH Untuk Besok Sudah Siap!'
                  : '📅 Jangan Lupa Buat Rencana 7 KAIH Untuk Besok!'}
              </Text>
              <Text style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>
                {tomorrowPlannedCategories.size >= 7
                  ? `${tomorrowActivities.length} kegiatan telah dijadwalkan untuk ${formatFullDateIndo(tomorrow)}.`
                  : 'Klik di sini untuk menyusun 7 rencana kegiatan KAIH yang akan dikerjakan besok.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748b" />
          </TouchableOpacity>

          {/* Jika Belum Ada Rencana Untuk Hari Ini */}
          {todayActivities.length === 0 ? (
            <View style={styles.emptyPlanBox}>
              <View style={styles.emptyPlanIconCircle}>
                <Ionicons name="clipboard-outline" size={38} color="#2563eb" />
              </View>
              <Text style={styles.emptyPlanTitle}>Belum Ada Rencana Untuk Hari Ini</Text>
              <Text style={styles.emptyPlanDesc}>
                Sesuai alur 7 KAIH, siswa merencanakan seluruh 7 kategori KAIH terlebih dahulu, lalu melakukan ceklis realisasi sesuai daftar rencana tersebut.
              </Text>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => {
                  setPlanTargetMode('tomorrow');
                  setActiveTab('plan');
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="calendar" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.primaryActionBtnText}>Buat Rencana 7 KAIH Untuk Besok (H+1)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryActionBtn}
                onPress={() => {
                  setPlanTargetMode('today');
                  setActiveTab('plan');
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="flash-outline" size={16} color="#2563eb" style={{ marginRight: 6 }} />
                <Text style={styles.secondaryActionBtnText}>Susun Rencana Untuk Hari Ini (Mulai Sekarang)</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Daftar Checklist Rencana Hari Ini (urut dari jam mulai paling awal) */
            <View style={{ marginTop: 6 }}>
              <Text style={styles.sectionHeaderLabel}>
                📋 DAFTAR RENCANA KEGIATAN HARI INI ({todayActivities.length} KEGIATAN) • URUT JAM MULAI
              </Text>

              {todayActivities.map((item) => renderChecklistItem(item))}
            </View>
          )}

          {/* Kemarin: batas terakhir pengerjaan ceklis */}
          {yesterdayPendingCount > 0 && (
            <View style={{ marginTop: 14 }}>
              <View style={styles.lastChanceBanner}>
                <Ionicons name="hourglass-outline" size={18} color="#b45309" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#92400e' }}>
                    ⏳ Kemarin — Kesempatan Terakhir Ceklis ({yesterdayPendingCount} belum)
                  </Text>
                  <Text style={{ fontSize: 11, color: '#78350f', marginTop: 1 }}>
                    Setelah hari ini berakhir, kegiatan kemarin akan terkunci dan tidak bisa diceklis lagi.
                  </Text>
                </View>
              </View>

              {yesterdayActivities.map((item) => renderChecklistItem(item))}
            </View>
          )}

          {/* Info kegiatan lama yang sudah terkunci */}
          {lockedPendingCount > 0 && (
            <View style={styles.lockedInfoBox}>
              <Ionicons name="lock-closed" size={14} color="#64748b" style={{ marginRight: 6 }} />
              <Text style={{ fontSize: 11, color: '#64748b', flex: 1 }}>
                {lockedPendingCount} kegiatan lama yang belum diceklis sudah terkunci karena melewati batas 2 hari (hari ini & kemarin).
              </Text>
            </View>
          )}
        </ScrollView>
      )}

      {/* ==================== TAB 2: BUAT RENCANA BESOK (SELURUH 7 KAIH) ==================== */}
      {activeTab === 'plan' && (
        <ScrollView style={styles.bodyScroll} contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
          {/* Pilihan Target Tanggal Rencana (Besok H+1 vs Hari Ini jika Hari Ini Kosong) */}
          <View style={styles.planHeaderCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planHeaderTitle}>
                  📅 Penyusunan Rencana 7 KAIH
                </Text>
                <Text style={styles.planHeaderDate}>
                  Target Pelaksanaan: {formatFullDateIndo(activePlanDateObj)}
                </Text>
              </View>
              <View
                style={[
                  styles.completenessBadge,
                  isAll7CategoriesFilled
                    ? { backgroundColor: '#dcfce7', borderColor: '#86efac' }
                    : { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
                ]}
              >
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: 'bold',
                    color: isAll7CategoriesFilled ? '#15803d' : '#b45309',
                  }}
                >
                  {filledCategoryKeys.length}/7 Kategori
                </Text>
              </View>
            </View>

            {/* Toggle Besok (H+1) vs Hari Ini */}
            <View style={styles.targetDateToggleRow}>
              <TouchableOpacity
                style={[
                  styles.targetDateBtn,
                  planTargetMode === 'tomorrow' && styles.targetDateBtnActive,
                ]}
                onPress={() => setPlanTargetMode('tomorrow')}
              >
                <Ionicons
                  name="calendar"
                  size={13}
                  color={planTargetMode === 'tomorrow' ? '#ffffff' : '#475569'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.targetDateBtnText,
                    planTargetMode === 'tomorrow' && { color: '#ffffff' },
                  ]}
                >
                  Untuk Besok (H+1)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.targetDateBtn,
                  planTargetMode === 'today' && styles.targetDateBtnActive,
                ]}
                onPress={() => setPlanTargetMode('today')}
              >
                <Ionicons
                  name="today"
                  size={13}
                  color={planTargetMode === 'today' ? '#ffffff' : '#475569'}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.targetDateBtnText,
                    planTargetMode === 'today' && { color: '#ffffff' },
                  ]}
                >
                  Untuk Hari Ini
                </Text>
              </TouchableOpacity>
            </View>

            {/* Quick Auto-Fill Button */}
            <TouchableOpacity
              style={styles.autoFillBannerBtn}
              onPress={handleAutoFillStandardPlan}
              activeOpacity={0.8}
            >
              <Ionicons name="sparkles" size={15} color="#2563eb" style={{ marginRight: 6 }} />
              <Text style={styles.autoFillBannerText}>
                ✨ Isi Otomatis Rencana Standar 7 KAIH (1-Klik Lengkap)
              </Text>
            </TouchableOpacity>

            {existingCategoriesForTargetDate.size >= 7 && (
              <View style={styles.alreadySavedInfoBox}>
                <Ionicons name="checkmark-circle" size={16} color="#16a34a" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 11.5, color: '#166534', flex: 1, fontWeight: '600' }}>
                  Rencana 7 KAIH untuk tanggal ini sudah tersimpan ({existingPlansForTargetDate.length} kegiatan). Anda tetap dapat mengubah & menyimpan ulang di bawah ini.
                </Text>
              </View>
            )}
          </View>

          {/* Daftar Form 7 Kategori KAIH (Wajib Seluruhnya) */}
          {KAIH_CATEGORIES_LIST.map((cat, index) => {
            const catState = planForm[cat.key] || { description: '', plannedTime: '06:00', selectedSubItems: [] };
            const presets = PRESET_ACTIVITIES_BY_CATEGORY[cat.key] || [];
            const selectedSubs = catState.selectedSubItems || [];
            const isFilled = isCategoryFilled(cat.key);

            return (
              <View
                key={cat.key}
                style={[
                  styles.categoryPlanCard,
                  isFilled ? { borderColor: cat.color + '80' } : { borderColor: '#cbd5e1' },
                ]}
              >
                {/* Header Kategori */}
                <View style={styles.categoryPlanHeader}>
                  <View style={[styles.catIconBox, { backgroundColor: cat.bgColor }]}>
                    <Text style={{ fontSize: 18 }}>{cat.icon}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.categoryPlanTitle}>
                      {index + 1}. {cat.name}
                    </Text>
                    <Text style={{ fontSize: 11, color: isFilled ? '#16a34a' : '#ef4444', fontWeight: '600' }}>
                      {isFilled ? `✅ ${selectedSubs.length || 1} kegiatan dipilih` : '⚠️ Wajib diisi'}
                    </Text>
                  </View>

                  {presets.length > 1 && (
                    <TouchableOpacity
                      style={[styles.selectAllBtn, { borderColor: cat.color + '55', backgroundColor: cat.bgColor }]}
                      onPress={() => selectAllPresetsForCategory(cat.key)}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="checkbox" size={13} color={cat.color} style={{ marginRight: 3 }} />
                      <Text style={[styles.selectAllBtnText, { color: cat.color }]}>Pilih Semua</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Pilihan Preset Kegiatan (Checklist Mode untuk Seluruh 7 Kategori) */}
                <View style={{ marginTop: 8 }}>
                  <Text style={styles.presetSectionLabel}>
                    Pilih Kegiatan yang Direncanakan (Bisa Ceklis Lebih dari 1):
                  </Text>

                  {presets.map((preset, pIdx) => {
                    const isSubSelected = selectedSubs.some(s => s.label === preset.label);
                    const currentSub = selectedSubs.find(s => s.label === preset.label);
                    const activeTime = currentSub?.time || preset.defaultTime;

                    return (
                      <View
                        key={pIdx}
                        style={[
                          styles.presetChipRow,
                          isSubSelected && { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
                        ]}
                      >
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                          onPress={() => togglePresetSubItem(cat.key, preset)}
                          activeOpacity={0.8}
                        >
                          <Ionicons
                            name={isSubSelected ? 'checkbox' : 'square-outline'}
                            size={20}
                            color={isSubSelected ? '#16a34a' : '#94a3b8'}
                            style={{ marginRight: 10 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.presetChipText, isSubSelected && { color: '#14532d', fontWeight: '700' }]}>
                              {preset.label}
                            </Text>
                            <Text style={{ fontSize: 10.5, color: isSubSelected ? '#15803d' : '#64748b', marginTop: 1 }}>
                              ⏰ Rekomendasi: {preset.timeRange} WIB
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* Jam Selector jika item dipilih */}
                        {isSubSelected && (
                          <TouchableOpacity
                            style={styles.subItemTimeBtn}
                            onPress={() => {
                              setEditingSubTarget({ catKey: cat.key, label: preset.label, currentTime: activeTime });
                            }}
                          >
                            <Ionicons name="time-outline" size={12} color="#16a34a" style={{ marginRight: 2 }} />
                            <Text style={styles.subItemTimeText}>{activeTime}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}

                  {/* Kegiatan Tambahan Kustom oleh Siswa */}
                  {selectedSubs
                    .filter(s => !presets.some(p => p.label === s.label))
                    .map((customSub, cIdx) => (
                      <View
                        key={`custom-${cIdx}`}
                        style={[styles.presetChipRow, { backgroundColor: '#eff6ff', borderColor: '#3b82f6' }]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                          <Ionicons name="checkbox" size={20} color="#2563eb" style={{ marginRight: 10 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.presetChipText, { color: '#1e3a8a', fontWeight: '700' }]}>
                              {customSub.label}
                            </Text>
                            <Text style={{ fontSize: 10.5, color: '#2563eb', marginTop: 1 }}>
                              ✨ Kegiatan Tambahan Anda
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={styles.subItemTimeBtn}
                          onPress={() => {
                            setEditingSubTarget({ catKey: cat.key, label: customSub.label, currentTime: customSub.time });
                          }}
                        >
                          <Ionicons name="time-outline" size={12} color="#2563eb" style={{ marginRight: 2 }} />
                          <Text style={[styles.subItemTimeText, { color: '#2563eb' }]}>{customSub.time}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.removeSubBtn}
                          onPress={() => removeSubItem(cat.key, customSub.label)}
                        >
                          <Ionicons name="close-circle" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}

                  {/* Input Tambah Kegiatan Kustom */}
                  <View style={styles.addCustomRow}>
                    <TextInput
                      style={styles.addCustomInput}
                      placeholder={`+ Tambah kegiatan ${cat.name} lainnya...`}
                      placeholderTextColor="#94a3b8"
                      value={customInputs[cat.key] || ''}
                      onChangeText={(txt) => setCustomInputs(prev => ({ ...prev, [cat.key]: txt }))}
                      onSubmitEditing={() => addCustomSubItem(cat.key)}
                    />
                    <TouchableOpacity
                      style={[
                        styles.addCustomBtn,
                        !(customInputs[cat.key] || '').trim() && { opacity: 0.5 },
                      ]}
                      onPress={() => addCustomSubItem(cat.key)}
                      disabled={!(customInputs[cat.key] || '').trim()}
                    >
                      <Ionicons name="add" size={18} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}

          {/* Tombol Simpan Paket Rencana 7 KAIH */}
          <TouchableOpacity
            style={[
              styles.savePlanButton,
              !isAll7CategoriesFilled && { backgroundColor: '#64748b' },
            ]}
            onPress={handleValidateAndOpenConfirmPlan}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark-done-circle" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.savePlanButtonText}>
              {isAll7CategoriesFilled
                ? `Simpan Rencana 7 KAIH (${planTargetMode === 'tomorrow' ? 'Untuk Besok' : 'Hari Ini'})`
                : `Lengkapi ${7 - filledCategoryKeys.length} Kategori Lagi (${filledCategoryKeys.length}/7)`}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* TimePicker untuk Edit Jam Rencana */}
      {Boolean(editingTimeCatKey) ? (
        <DateTimePicker
          value={(() => {
            const d = new Date();
            const t = planForm[editingTimeCatKey!]?.plannedTime || '06:00';
            const parts = t.split(':');
            d.setHours(parseInt(parts[0] || '6', 10), parseInt(parts[1] || '0', 10), 0);
            return d;
          })()}
          mode="time"
          display="default"
          onChange={(_, selectedDate) => {
            const targetKey = editingTimeCatKey;
            setEditingTimeCatKey(null);
            if (selectedDate && targetKey) {
              const hh = String(selectedDate.getHours()).padStart(2, '0');
              const mm = String(selectedDate.getMinutes()).padStart(2, '0');
              setPlanForm(prev => ({
                ...prev,
                [targetKey]: { ...prev[targetKey], plannedTime: `${hh}:${mm}` },
              }));
            }
          }}
        />
      ) : null}

      {/* TimePicker untuk Edit Jam Butir Kegiatan Spesifik */}
      {Boolean(editingSubTarget) && (
        <DateTimePicker
          value={(() => {
            const d = new Date();
            const t = editingSubTarget?.currentTime || '06:00';
            const parts = t.split(':');
            d.setHours(parseInt(parts[0] || '6', 10), parseInt(parts[1] || '0', 10), 0);
            return d;
          })()}
          mode="time"
          display="default"
          onChange={(_, selectedDate) => {
            const target = editingSubTarget;
            setEditingSubTarget(null);
            if (selectedDate && target) {
              const hh = String(selectedDate.getHours()).padStart(2, '0');
              const mm = String(selectedDate.getMinutes()).padStart(2, '0');
              setSubItemTime(target.catKey, target.label, `${hh}:${mm}`);
            }
          }}
        />
      )}

      {/* ==================== MODAL KONFIRMASI SIMPAN RENCANA 7 KAIH ==================== */}
      <Modal
        visible={confirmPlanModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmPlanModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <View style={{ alignItems: 'center', marginBottom: 10 }}>
              <Ionicons name="calendar-sharp" size={44} color="#2563eb" />
              <Text style={styles.confirmModalTitle}>Konfirmasi Rencana 7 KAIH</Text>
              <Text style={styles.confirmModalSubtitle}>
                Target Pelaksanaan: {formatFullDateIndo(activePlanDateObj)}
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 300, width: '100%' }}>
              {KAIH_CATEGORIES_LIST.map((cat) => {
                const item = planForm[cat.key];
                const descDisplay =
                  cat.key === 'Beribadah' && item?.selectedSubItems && item.selectedSubItems.length > 0
                    ? item.selectedSubItems.map(s => `• [${s.time}] ${s.label}`).join('\n')
                    : `[${item?.plannedTime || '06:00'}] ${item?.description || '-'}`;

                return (
                  <View key={cat.key} style={styles.confirmSummaryItem}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: cat.color }}>
                      {cat.icon} {cat.name}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: '#334155', marginTop: 2 }}>
                      {descDisplay}
                    </Text>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setConfirmPlanModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>Periksa Lagi</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleSave7KaihPlan}
              >
                <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 5 }} />
                <Text style={styles.modalConfirmBtnText}>Ya, Simpan Rencana</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL CEKLIS REALISASI KEGIATAN ==================== */}
      <Modal
        visible={realizeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRealizeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmModalCard, { maxHeight: SCREEN_HEIGHT * 0.88 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="checkbox" size={22} color="#16a34a" style={{ marginRight: 6 }} />
                <Text style={[styles.confirmModalTitle, { fontSize: 16 }]}>Ceklis Realisasi Kegiatan</Text>
              </View>
              <TouchableOpacity onPress={() => setRealizeModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {Boolean(realizeItem) ? (
              <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                {/* Info Rencana yang Direalisasikan */}
                <View style={styles.realizePlanInfoBox}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#0284c7', textTransform: 'uppercase' }}>
                    📌 Rencana Kegiatan ({realizeItem!.title})
                  </Text>
                  <Text style={{ fontSize: 13.5, fontWeight: 'bold', color: '#0f172a', marginTop: 3 }}>
                    {realizeItem!.description}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                    ⏰ Dijadwalkan Pukul: <Text style={{ fontWeight: 'bold', color: '#334155' }}>{realizeItem!.plannedTime} WIB</Text>
                  </Text>
                </View>

                {/* Waktu Realisasi */}
                <Text style={styles.fieldLabel}>
                  Waktu Pelaksanaan (Realisasi) <Text style={{ color: '#ef4444' }}>*Wajib Diisi</Text>
                </Text>
                <TouchableOpacity
                  style={[
                    styles.timePickerBox,
                    realizeTimeError && !realizeTime && { borderColor: '#ef4444', backgroundColor: '#fef2f2' },
                  ]}
                  onPress={() => setShowRealizeTimePicker(true)}
                >
                  <Ionicons
                    name="time"
                    size={18}
                    color={realizeTime ? '#2563eb' : (realizeTimeError ? '#ef4444' : '#64748b')}
                    style={{ marginRight: 8 }}
                  />
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: realizeTime ? 'bold' : 'normal',
                      color: realizeTime ? '#1e293b' : (realizeTimeError ? '#b91c1c' : '#94a3b8'),
                      flex: 1,
                    }}
                  >
                    {realizeTime
                      ? `${realizeTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
                      : 'Pilih Jam Pelaksanaan (Wajib diisi)'}
                  </Text>
                  <Text style={{ fontSize: 11, color: realizeTime ? '#2563eb' : '#dc2626', fontWeight: 'bold' }}>
                    {realizeTime ? 'Ubah Jam' : 'Pilih Jam'}
                  </Text>
                </TouchableOpacity>
                {realizeTimeError && !realizeTime && (
                  <Text style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>
                    ⚠️ Jam pelaksanaan wajib diisi sebelum mengonfirmasi ceklis.
                  </Text>
                )}

                {showRealizeTimePicker && (
                  <DateTimePicker
                    value={realizeTime || new Date()}
                    mode="time"
                    display="default"
                    onChange={(_, selectedDate) => {
                      setShowRealizeTimePicker(false);
                      if (selectedDate) {
                        setRealizeTime(selectedDate);
                        setRealizeTimeError(false);
                      }
                    }}
                  />
                )}

                {/* Foto Bukti Kegiatan (Opsional) */}
                <Text style={styles.fieldLabel}>Foto Bukti Kegiatan (Opsional)</Text>
                {realizeImageUri ? (
                  <View style={styles.photoPreviewWrapper}>
                    <Image source={{ uri: realizeImageUri }} style={styles.photoPreviewImage} />
                    <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setRealizeImageUri(null)}>
                      <Ionicons name="close" size={14} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.photoActionsRow}>
                    <TouchableOpacity style={styles.photoActionButton} onPress={takePhotoForRealize}>
                      <Ionicons name="camera-outline" size={16} color="#2563eb" style={{ marginRight: 6 }} />
                      <Text style={styles.photoActionText}>Buka Kamera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.photoActionButton} onPress={pickImageForRealize}>
                      <Ionicons name="images-outline" size={16} color="#2563eb" style={{ marginRight: 6 }} />
                      <Text style={styles.photoActionText}>Dari Galeri</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Catatan Tambahan (Opsional) */}
                <Text style={styles.fieldLabel}>Catatan Pelaksanaan Tambahan (Opsional)</Text>
                <TextInput
                  style={styles.planCustomInput}
                  placeholder="Contoh: Dilaksanakan tepat waktu..."
                  placeholderTextColor="#94a3b8"
                  value={realizeNote}
                  onChangeText={setRealizeNote}
                />

                {/* Lokasi GPS Realisasi + Mini Map */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 4 }}>
                  <Text style={[styles.fieldLabel, { marginTop: 0, marginBottom: 0 }]}>Lokasi Pelaksanaan (GPS)</Text>
                  <TouchableOpacity onPress={handleRefreshMyLocation} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="locate" size={14} color="#2563eb" style={{ marginRight: 3 }} />
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#2563eb' }}>Perbarui GPS</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.miniMapSearchRow}>
                  <TextInput
                    style={{ flex: 1, fontSize: 11.5, color: '#0f172a', paddingVertical: 4 }}
                    placeholder="Cari nama tempat / alamat..."
                    placeholderTextColor="#94a3b8"
                    value={addressSearchQuery}
                    onChangeText={setAddressSearchQuery}
                    onSubmitEditing={handleSearchAddress}
                  />
                  {searchingAddress ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <TouchableOpacity onPress={handleSearchAddress}>
                      <Ionicons name="search" size={18} color="#2563eb" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.miniMapContainer}>
                  <WebView
                    ref={webViewRef}
                    originWhitelist={['*']}
                    source={{ html: getLeafletHtml(markerCoord.latitude, markerCoord.longitude) }}
                    style={{ flex: 1 }}
                    onMessage={async (event) => {
                      try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.type === 'MARKER_POS' && data.lat && data.lng) {
                          setMarkerCoord({ latitude: data.lat, longitude: data.lng });
                          let geocode = await Location.reverseGeocodeAsync({ latitude: data.lat, longitude: data.lng });
                          let locName = geocode.length > 0
                            ? formatFullAddress(geocode[0], `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`)
                            : `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`;
                          setLocation({ lat: data.lat, lng: data.lng, name: locName });
                        }
                      } catch {}
                    }}
                  />
                </View>

                <View style={styles.selectedLocationBox}>
                  <Ionicons name="location" size={14} color="#ef4444" style={{ marginRight: 5 }} />
                  <Text style={{ fontSize: 11.5, color: '#334155', flex: 1 }} numberOfLines={2}>
                    {location?.name || 'Menentukan lokasi GPS...'}
                  </Text>
                </View>

                {/* Tombol Simpan Realisasi */}
                <TouchableOpacity
                  style={styles.confirmRealizeSubmitBtn}
                  onPress={handleConfirmRealization}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-done-circle" size={20} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.confirmRealizeSubmitText}>Konfirmasi & Ceklis Selesai</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ==================== MODAL PERAYAAN: 7 KAIH LENGKAP TERCAPAI ==================== */}
      <Modal
        visible={celebrationVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCelebrationContinue}
      >
        <View style={styles.celebrationOverlay}>
          <View style={styles.celebrationCard}>
            <View style={styles.celebrationBadgeCircle}>
              <Text style={{ fontSize: 44 }}>🏆</Text>
            </View>

            <View style={styles.confettiRow}>
              <Text style={styles.confettiText}>🎉</Text>
              <Text style={styles.confettiText}>✨</Text>
              <Text style={styles.confettiText}>🌟</Text>
              <Text style={styles.confettiText}>🎊</Text>
              <Text style={styles.confettiText}>✨</Text>
              <Text style={styles.confettiText}>🎉</Text>
            </View>

            <Text style={styles.celebrationTitle}>LUAR BIASA! 7 KAIH TUNTAS!</Text>
            <Text style={styles.celebrationSubtitle}>
              Selamat! Kamu telah menyelesaikan seluruh 7 pilar Karakter Anak Indonesia Hebat hari ini dengan penuh disiplin dan tanggung jawab!
            </Text>

            <View style={styles.celebrationStatsBox}>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.celebrationStatValue}>{celebrationInfo.activityCount}</Text>
                <Text style={styles.celebrationStatLabel}>Kegiatan Selesai</Text>
              </View>
              <View style={styles.celebrationStatDivider} />
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.celebrationStatValue}>7 / 7</Text>
                <Text style={styles.celebrationStatLabel}>Pilar KAIH</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.celebrationStatValue}>100%</Text>
                <Text style={styles.celebrationStatLabel}>Pencapaian</Text>
              </View>
            </View>

            {/* 7 Pilar Badges */}
            <View style={styles.celebrationIconsRow}>
              {KAIH_CATEGORIES_LIST.map(c => (
                <View key={c.key} style={[styles.celebrationMiniIconBadge, { backgroundColor: c.bgColor }]}>
                  <Text style={{ fontSize: 13 }}>{c.icon}</Text>
                  <Ionicons name="checkmark-circle" size={11} color="#16a34a" style={styles.celebrationCheckIcon} />
                </View>
              ))}
            </View>

            <Text style={styles.celebrationDateBanner}>
              📅 {celebrationInfo.dateLabel || 'Hari Ini'}
            </Text>

            {/* Action: Langsung Buat Rencana Besok */}
            <TouchableOpacity
              style={styles.celebrationActionBtn}
              onPress={handleCelebrationContinue}
              activeOpacity={0.85}
            >
              <Text style={styles.celebrationActionBtnText}>
                Lanjut Buat Rencana Besok (H+1) ➡️
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.celebrationCloseBtn}
              onPress={() => setCelebrationVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.celebrationCloseBtnText}>Tutup & Lihat Ringkasan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Flash Loading Modal */}
      <KaihStatusModal visible={submitting} message="" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  headerContainer: {
    backgroundColor: '#1d4ed8',
    paddingTop: (StatusBar.currentHeight || 24) + 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerLogo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ffffff',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#bfdbfe',
    marginTop: 1,
  },
  segmentedTabWrapper: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
    borderRadius: 14,
    padding: 4,
    gap: 6,
  },
  segmentedTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  segmentedTabBtnActive: {
    backgroundColor: '#ffffff',
    elevation: 2,
  },
  segmentedTabText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#e0f2fe',
  },
  segmentedTabTextActive: {
    color: '#1d4ed8',
  },
  tabCountBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  tabCountBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  bodyScroll: {
    flex: 1,
  },
  progressSummaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    elevation: 2,
  },
  iconCircleBlue: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  cardSectionSub: {
    fontSize: 11.5,
    color: '#64748b',
    marginTop: 1,
  },
  scorePillBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  scorePillText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#15803d',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#16a34a',
    borderRadius: 4,
  },
  tomorrowReminderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  emptyPlanBox: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  emptyPlanIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyPlanTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
  },
  emptyPlanDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
    lineHeight: 18,
  },
  primaryActionBtn: {
    width: '100%',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  secondaryActionBtn: {
    width: '100%',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 11,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryActionBtnText: {
    color: '#2563eb',
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  sectionHeaderLabel: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  checklistItemCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.2,
    elevation: 1,
  },
  checkboxSquare: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  catBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catBadgeSmallText: {
    fontSize: 10.5,
    fontWeight: 'bold',
  },
  timePlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timePlanBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  timeRealizedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  timeRealizedBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#15803d',
  },
  checklistDescText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    lineHeight: 18,
  },
  donePillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  donePillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#15803d',
    marginLeft: 3,
  },
  realizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    elevation: 2,
  },
  realizeBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: 'bold',
  },
  planHeaderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
    elevation: 2,
  },
  planHeaderTitle: {
    fontSize: 14.5,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  planHeaderDate: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
    marginTop: 2,
  },
  completenessBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  targetDateToggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  targetDateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  targetDateBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  targetDateBtnText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#475569',
  },
  autoFillBannerBtn: {
    marginTop: 10,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  autoFillBannerText: {
    fontSize: 11.5,
    fontWeight: 'bold',
    color: '#1d4ed8',
  },
  alreadySavedInfoBox: {
    marginTop: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  categoryPlanCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    elevation: 1,
  },
  categoryPlanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  catIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryPlanTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  planTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  planTimeBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  presetSectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  presetChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    marginBottom: 6,
  },
  presetChipText: {
    fontSize: 12,
    color: '#334155',
    lineHeight: 16,
  },
  planCustomInput: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0f172a',
  },
  savePlanButton: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 6,
    elevation: 4,
  },
  savePlanButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  confirmModalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    elevation: 12,
  },
  confirmModalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 4,
  },
  confirmModalSubtitle: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
    marginTop: 2,
  },
  confirmSummaryItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#64748b',
  },
  modalConfirmBtn: {
    flex: 1.3,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  realizePlanInfoBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 8,
    marginBottom: 4,
  },
  timePickerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  photoActionButton: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  photoPreviewWrapper: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  photoPreviewImage: {
    width: '100%',
    height: 110,
    borderRadius: 12,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniMapSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  miniMapContainer: {
    height: 125,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  selectedLocationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  confirmRealizeSubmitBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 4,
    elevation: 3,
  },
  confirmRealizeSubmitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Tambahan Styles untuk Fitur Baru (Multi-checklist, Locked Items, Perayaan 7 KAIH)
  selectAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectAllBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  subItemTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginLeft: 6,
  },
  subItemTimeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#15803d',
  },
  removeSubBtn: {
    padding: 4,
    marginLeft: 4,
  },
  addCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  addCustomInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0f172a',
  },
  addCustomBtn: {
    backgroundColor: '#2563eb',
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockedPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lockedPillText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#64748b',
  },
  lastChanceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  lockedInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  celebrationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    borderWidth: 2,
    borderColor: '#fef08a',
  },
  celebrationBadgeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef3c7',
    borderWidth: 3,
    borderColor: '#facc15',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -48,
    elevation: 6,
  },
  confettiRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  confettiText: {
    fontSize: 18,
  },
  celebrationTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  celebrationSubtitle: {
    fontSize: 12.5,
    color: '#475569',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  celebrationStatsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 14,
    width: '100%',
    justifyContent: 'space-around',
  },
  celebrationStatValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0284c7',
  },
  celebrationStatLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '600',
  },
  celebrationStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#cbd5e1',
  },
  celebrationIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  celebrationMiniIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  celebrationCheckIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#ffffff',
    borderRadius: 6,
  },
  celebrationDateBanner: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 12,
  },
  celebrationActionBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
    marginTop: 16,
    elevation: 4,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  celebrationActionBtnText: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  celebrationCloseBtn: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  celebrationCloseBtnText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
});