import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert,
  ActivityIndicator, Modal, TextInput, Animated, Easing, Dimensions, Platform,
  KeyboardAvoidingView, RefreshControl, StatusBar,
} from 'react-native';
import { supabase } from '../../utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';
import { decode } from 'base64-arraybuffer';
import { useTheme } from '../../theme/colors';
import { KaihLoadingScreen } from '../../components/KaihLoadingLogo';
import { clearUserCache } from '../../utils/userCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── LEAFLET MAP HTML ─────────────────────────────────────
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
      zoom: 16,
      zoomControl: false
    });
    window.map = map;

    L.tileLayer('https://{s}.google.com/vt/lyrs=m,traffic&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);

    var marker = L.marker([${lat}, ${lng}], { draggable: true }).addTo(map);
    window.marker = marker;

    function updatePos(newLat, newLng) {
      marker.setLatLng([newLat, newLng]);
      map.panTo([newLat, newLng]);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MARKER_POS', lat: newLat, lng: newLng }));
      }
    }

    map.on('click', function(e) {
      updatePos(e.latlng.lat, e.latlng.lng);
    });

    marker.on('dragend', function(e) {
      var position = marker.getLatLng();
      updatePos(position.lat, position.lng);
    });
  </script>
</body>
</html>
`;

// Helper format alamat lengkap
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

// ─── OPTIONS ──────────────────────────────────────────────
const OPTIONS: any = {
  gender: ['Laki-laki', 'Perempuan'],
  religion: ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'],
  suku: [
    'Jawa',
    'Batak Toba',
    'Batak Karo',
    'Batak Mandailing',
    'Batak Simalungun',
    'Batak Angkola',
    'Batak Pakpak',
    'Melayu',
    'Minang',
    'Nias',
    'Aceh',
    'Tionghoa',
    'Lainnya',
  ],
  jenjang: ['SMP Budi Utomo', 'SMK Budi Utomo'],
  jurusan: ['Manajemen Perkantoran', 'Akuntansi', 'Bisnis Digital', 'Teknik Komputer dan Jaringan (TKJ)', 'Teknik Sepeda Motor (TSM)'],
  kelasSMP: ['Kelas VII', 'Kelas VIII', 'Kelas IX'],
  kelasSMK: {
    'Manajemen Perkantoran': ['X Manajemen Perkantoran', 'XI Manajemen Perkantoran', 'XII Manajemen Perkantoran'],
    'Akuntansi': ['X Akuntansi', 'XI Akuntansi', 'XII Akuntansi'],
    'Bisnis Digital': ['X Bisnis Digital', 'XI Bisnis Digital', 'XII Bisnis Digital'],
    'Teknik Komputer dan Jaringan (TKJ)': ['X TKJ', 'XI TKJ', 'XII TKJ'],
    'Teknik Sepeda Motor (TSM)': ['X TSM', 'XI TSM', 'XII TSM'],
  },
  citaCita: ['Dokter', 'Polisi / TNI', 'Guru / Dosen', 'Pengusaha', 'Programmer / IT', 'Lainnya'],
  hobi: ['Membaca', 'Olahraga', 'Bermain Musik', 'Menggambar', 'Bermain Game', 'Lainnya'],
  bakat: ['Menyanyi', 'Menari', 'Melukis', 'Olahraga', 'Lainnya'],
  minat: ['Sains', 'Seni', 'Teknologi', 'Sosial', 'Lainnya'],
  ekskul: ['Futsal', 'Pramuka', 'Paskibra', 'PMR', 'Rohis', 'PIK-R', 'Lainnya'],
  golDarah: ['A', 'B', 'AB', 'O', 'Tidak Tahu'],
};

// ─── Section Info Row Component ──────────────────────────
const InfoRow = ({ icon, label, value, colors, onEdit }: { icon: string; label: string; value: string; colors: any; onEdit?: () => void }) => (
  <View style={[infoRowStyles.container, { borderBottomColor: colors.border }]}>
    <View style={infoRowStyles.left}>
      <View style={[infoRowStyles.iconBg, { backgroundColor: `${colors.primary}12` }]}>
        <Ionicons name={icon as any} size={15} color={colors.primary} />
      </View>
      <Text style={[infoRowStyles.label, { color: colors.textSecondary }]}>{label}</Text>
    </View>
    <View style={infoRowStyles.right}>
      <Text style={[infoRowStyles.value, { color: colors.text }]} numberOfLines={4}>{value || '-'}</Text>
      {onEdit && (
        <TouchableOpacity onPress={onEdit} style={infoRowStyles.editBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="create-outline" size={15} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const infoRowStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 0.5, paddingHorizontal: 2 },
  left: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  iconBg: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '500' },
  right: { flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  value: { fontSize: 12.5, fontWeight: '600', textAlign: 'right', flexShrink: 1, lineHeight: 18 },
  editBtn: { padding: 4 },
});

// ─── Section Card Component ──────────────────────────────
const SectionCard = ({ title, icon, iconColor, children, colors }: any) => (
  <View style={[sectionCardStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={sectionCardStyles.header}>
      <View style={[sectionCardStyles.headerIconBg, { backgroundColor: `${iconColor || colors.primary}14` }]}>
        <Ionicons name={icon} size={17} color={iconColor || colors.primary} />
      </View>
      <Text style={[sectionCardStyles.title, { color: colors.text }]}>{title}</Text>
    </View>
    {children}
  </View>
);

const sectionCardStyles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 14, borderRadius: 16, padding: 16, borderWidth: 0.5, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 10 },
  headerIconBg: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 15.5, fontWeight: '700', letterSpacing: 0.2 },
});

// ─── Edit Field Type ─────────────────────────────────────
type EditType = 'text' | 'select' | 'select-with-other';

interface EditField {
  key: string;
  label: string;
  value: string;
  table: 'user_profiles' | 'students' | 'notes';
  type?: EditType;
  options?: string[];
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad' | 'numeric';
}

// ═════════════════════════════════════════════════════════
// ─── MAIN PROFILE SCREEN ────────────────────────────────
// ═════════════════════════════════════════════════════════
export default function ProfileScreen() {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingHousePhoto, setUploadingHousePhoto] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  
  // Standard Edit State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editField, setEditField] = useState<EditField | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editOtherValue, setEditOtherValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Calendar Date Picker Modal State
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedYear, setSelectedYear] = useState(2010);
  const [selectedMonth, setSelectedMonth] = useState(7);
  const [selectedDay, setSelectedDay] = useState(21);
  const [savingDate, setSavingDate] = useState(false);

  // Address Option Modal State (Custom ActionSheet)
  const [addressOptionModalVisible, setAddressOptionModalVisible] = useState(false);

  // Map Location Picker State
  const [mapModalVisible, setMapModalVisible] = useState(false);
  const [mapCoord, setMapCoord] = useState<{ latitude: number; longitude: number }>({
    latitude: 3.6062, // Default Binjai / Medan
    longitude: 98.4842,
  });
  const [selectedAddressText, setSelectedAddressText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingMap, setSearchingMap] = useState(false);
  const [savingMapAddress, setSavingMapAddress] = useState(false);
  const mapWebViewRef = useRef<WebView>(null);

  // Entrance animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(30)).current;

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedOnce) {
        fetchProfile();
      }
    }, [hasLoadedOnce])
  );

  async function fetchProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          full_name,
          address,
          latitude,
          longitude,
          photo_url,
          gender,
          religion,
          birth_date,
          phone,
          students (
            id,
            nis,
            nisn,
            education_level,
            hobbies,
            aspiration,
            talents,
            interests,
            extracurriculars,
            blood_type,
            health_notes,
            notes,
            student_profiles_analysis (
              behavior_summary,
              talent_analysis,
              recommendations
            )
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfileData(data);

      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(contentTranslateY, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } catch (error) {
      console.log('Error fetching profile:', error);
    } finally {
      setLoading(false);
      setHasLoadedOnce(true);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchProfile();
  }

  // ─── Image Picker (Foto Profil Avatar) ─────────────────
  async function pickImage() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (result.canceled || !result.assets[0].base64) return;

      setUploading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Anda belum login');

      const base64FileData = result.assets[0].base64;
      const ext = result.assets[0].uri.substring(result.assets[0].uri.lastIndexOf('.') + 1);
      const filePath = `${user.id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64FileData), {
          contentType: `image/${ext}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ photo_url: publicUrl })
        .eq('id', profileData.id);

      if (updateError) throw updateError;

      setProfileData({ ...profileData, photo_url: publicUrl });
      Alert.alert('Sukses', 'Foto profil berhasil diperbarui!');
    } catch (error: any) {
      Alert.alert('Gagal Mengunggah', error.message || 'Terjadi kesalahan saat mengunggah foto.');
    } finally {
      setUploading(false);
    }
  }

  // ─── Image Picker (Foto Tampak Depan Rumah) ───────────
  async function pickHouseImage() {
    Alert.alert(
      'Foto Rumah',
      'Pilih sumber foto tampak depan rumah Anda:',
      [
        {
          text: '📷 Ambil Foto Kamera',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert('Izin Ditolak', 'Izin kamera diperlukan untuk mengambil foto rumah.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.6,
              base64: true,
            });
            if (!result.canceled && result.assets[0].base64) {
              uploadHousePhoto(result.assets[0].base64, result.assets[0].uri);
            }
          },
        },
        {
          text: '🖼️ Pilih dari Galeri',
          onPress: async () => {
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: true,
              aspect: [4, 3],
              quality: 0.6,
              base64: true,
            });
            if (!result.canceled && result.assets[0].base64) {
              uploadHousePhoto(result.assets[0].base64, result.assets[0].uri);
            }
          },
        },
        { text: 'Batal', style: 'cancel' },
      ]
    );
  }

  // ─── HELPER SANGAT AMAN UNTUK SIMPAN DATA STUDENTS ─────
  async function saveStudentData(updateFields: any) {
    if (!profileData || !profileData.id) throw new Error('Data profil tidak ditemukan. Silakan login kembali.');

    let studentId = profileData?.students?.id;
    if (!studentId) {
      const { data: existing } = await supabase
        .from('students')
        .select('id')
        .eq('profile_id', profileData.id)
        .maybeSingle();
      if (existing && existing.id) {
        studentId = existing.id;
      }
    }

    if (studentId) {
      const { data: updated, error } = await supabase
        .from('students')
        .update(updateFields)
        .eq('id', studentId)
        .select()
        .single();
      if (error) throw error;
      return updated;
    } else {
      const { data: inserted, error } = await supabase
        .from('students')
        .insert({
          profile_id: profileData.id,
          ...updateFields,
        })
        .select()
        .single();
      if (error) throw error;
      return inserted;
    }
  }

  async function uploadHousePhoto(base64FileData: string, uri: string) {
    try {
      setUploadingHousePhoto(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Anda belum login');

      const ext = uri.substring(uri.lastIndexOf('.') + 1) || 'jpg';
      const filePath = `house_photos/${user.id}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('public_assets')
        .upload(filePath, decode(base64FileData), {
          contentType: `image/${ext === 'png' ? 'png' : 'jpeg'}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('public_assets').getPublicUrl(filePath);

      const studentData = profileData.students || {};
      let notesObj: any = {};
      try { if (studentData.notes) notesObj = JSON.parse(studentData.notes); } catch (e) {}
      notesObj.house_photo_url = publicUrl;
      const notesStr = JSON.stringify(notesObj);

      const updatedStudent = await saveStudentData({ notes: notesStr });

      setProfileData({
        ...profileData,
        students: { ...studentData, ...updatedStudent, notes: notesStr },
      });
      Alert.alert('Sukses ✓', 'Foto rumah berhasil diunggah!');
    } catch (error: any) {
      Alert.alert('Gagal Mengunggah', error.message || 'Terjadi kesalahan saat mengunggah foto rumah.');
    } finally {
      setUploadingHousePhoto(false);
    }
  }

  // ─── Date Picker Modal Handlers ───────────────────────
  function openDatePickerModal() {
    if (profileData?.birth_date) {
      const parts = profileData.birth_date.split('-');
      if (parts.length === 3) {
        setSelectedYear(parseInt(parts[0]) || 2010);
        setSelectedMonth(parseInt(parts[1]) || 7);
        setSelectedDay(parseInt(parts[2]) || 21);
      }
    }
    setDatePickerVisible(true);
  }

  async function saveDateOfBirth() {
    try {
      setSavingDate(true);
      const formattedDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
      
      const { error } = await supabase
        .from('user_profiles')
        .update({ birth_date: formattedDate })
        .eq('id', profileData.id);

      if (error) throw error;

      setProfileData({ ...profileData, birth_date: formattedDate });
      setDatePickerVisible(false);
      Alert.alert('Berhasil ✓', 'Tanggal lahir berhasil diperbarui.');
    } catch (err: any) {
      Alert.alert('Gagal Menyimpan', err.message || 'Terjadi kesalahan.');
    } finally {
      setSavingDate(false);
    }
  }

  // ─── Standard Edit Handlers ───────────────────────────
  function openEditModal(field: EditField) {
    setEditField(field);
    
    if (field.type === 'select-with-other' || field.type === 'select') {
      const isInOptions = field.options?.includes(field.value);
      if (!isInOptions && field.value && field.value !== '-' && field.value !== '') {
        setEditValue('Lainnya');
        setEditOtherValue(field.value);
      } else {
        setEditValue(field.value === '-' ? '' : field.value);
        setEditOtherValue('');
      }
    } else {
      setEditValue(field.value === '-' ? '' : field.value);
      setEditOtherValue('');
    }
    
    setEditModalVisible(true);
  }

  async function saveEdit() {
    if (!editField || !profileData) return;
    setSaving(true);

    let finalValue = editValue;
    if (editField.type === 'select' || editField.type === 'select-with-other') {
      if (editValue === 'Lainnya' && editOtherValue.trim() !== '') {
        finalValue = editOtherValue.trim();
      }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Anda belum login');

      const studentData = profileData.students || {};

      if (editField.table === 'user_profiles') {
        let dbValue = finalValue.trim();
        if (editField.key === 'gender') {
          if (dbValue === 'Laki-laki') dbValue = 'L';
          if (dbValue === 'Perempuan') dbValue = 'P';
        }

        const { error } = await supabase
          .from('user_profiles')
          .update({ [editField.key]: dbValue })
          .eq('id', profileData.id);
        if (error) throw error;
        setProfileData({ ...profileData, [editField.key]: dbValue });
        
      } else if (editField.table === 'students') {
        if (editField.key === 'education_level') {
          const dbEnum = finalValue.includes('SMP') ? 'SMP' : (finalValue.includes('SD') ? 'SD' : 'SMA');
          
          let notesObj: any = {};
          try { if (studentData.notes) notesObj = JSON.parse(studentData.notes); } catch (e) {}
          notesObj.jenjang = finalValue.trim();
          notesObj.jurusan = '';
          notesObj.kelas = '';
          const notesStr = JSON.stringify(notesObj);
          
          const updatedStudent = await saveStudentData({ education_level: dbEnum, notes: notesStr });
          
          setProfileData({
            ...profileData,
            students: { ...studentData, ...updatedStudent, education_level: dbEnum, notes: notesStr },
          });
        } else {
          const updatedStudent = await saveStudentData({ [editField.key]: finalValue.trim() });
          setProfileData({
            ...profileData,
            students: { ...studentData, ...updatedStudent, [editField.key]: finalValue.trim() },
          });
        }
        
      } else if (editField.table === 'notes') {
        let notesObj: any = {};
        try { if (studentData.notes) notesObj = JSON.parse(studentData.notes); } catch (e) {}
        
        if (editField.key === 'jurusan') {
          notesObj.kelas = '';
        }
        
        notesObj[editField.key] = finalValue.trim();
        const notesStr = JSON.stringify(notesObj);

        const updatedStudent = await saveStudentData({ notes: notesStr });

        setProfileData({
          ...profileData,
          students: { ...studentData, ...updatedStudent, notes: notesStr },
        });
      }

      setEditModalVisible(false);
      Alert.alert('Berhasil ✓', `${editField.label} berhasil diperbarui.`);
    } catch (error: any) {
      Alert.alert('Gagal Menyimpan', error.message || 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  }

  // ─── ADDRESS EDIT CHOICE (CUSTOM ELEGANT ACTION SHEET) ─
  function handleEditAddressOptions() {
    setAddressOptionModalVisible(true);
  }

  // ─── MAP LOCATION PICKER HANDLERS ──────────────────────
  async function openMapModal() {
    let lat = profileData?.latitude || 3.6062;
    let lng = profileData?.longitude || 98.4842;

    setMapCoord({ latitude: lat, longitude: lng });
    setSelectedAddressText(profileData?.address || 'Mencari lokasi...');
    setMapModalVisible(true);

    if (!profileData?.latitude || !profileData?.longitude) {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
          setMapCoord({ latitude: lat, longitude: lng });
          
          let geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
          let addr = geocode.length > 0 ? formatFullAddress(geocode[0]) : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setSelectedAddressText(addr);
        }
      } catch (err) {
        console.log('Location fetch error:', err);
      }
    }
  }

  async function handleGoToMyLocation() {
    setSearchingMap(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Izin Ditolak', 'Akses lokasi diperlukan untuk menemukan posisi Anda.');
        setSearchingMap(false);
        return;
      }
      let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      setMapCoord({ latitude: lat, longitude: lng });
      mapWebViewRef.current?.injectJavaScript(`updatePos(${lat}, ${lng}); true;`);

      let geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      let addr = geocode.length > 0 ? formatFullAddress(geocode[0]) : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      setSelectedAddressText(addr);
    } catch (err) {
      Alert.alert('Error', 'Gagal mengambil posisi GPS saat ini.');
    } finally {
      setSearchingMap(false);
    }
  }

  async function handleSearchMapAddress() {
    if (!searchQuery.trim()) return;
    setSearchingMap(true);
    try {
      let results = await Location.geocodeAsync(searchQuery.trim());
      if (results && results.length > 0) {
        const { latitude, longitude } = results[0];
        setMapCoord({ latitude, longitude });
        mapWebViewRef.current?.injectJavaScript(`updatePos(${latitude}, ${longitude}); true;`);

        let geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        let detailAddr = geocode.length > 0 ? formatFullAddress(geocode[0]) : '';
        const searchInput = searchQuery.trim();

        let finalName = searchInput;
        if (detailAddr && !detailAddr.toLowerCase().includes(searchInput.toLowerCase())) {
          finalName = `${searchInput} (${detailAddr})`;
        } else if (detailAddr) {
          finalName = detailAddr;
        }

        setSelectedAddressText(finalName);
      } else {
        Alert.alert('Alamat Tidak Ditemukan', 'Coba ketik nama jalan, kota, atau tempat yang lebih spesifik.');
      }
    } catch {
      Alert.alert('Error', 'Gagal mencari lokasi.');
    } finally {
      setSearchingMap(false);
    }
  }

  async function saveMapAddress() {
    if (!selectedAddressText.trim()) {
      Alert.alert('Perhatian', 'Silakan pilih atau ketik alamat Anda.');
      return;
    }
    setSavingMapAddress(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Anda belum login');

      const { error } = await supabase
        .from('user_profiles')
        .update({
          address: selectedAddressText.trim(),
          latitude: mapCoord.latitude,
          longitude: mapCoord.longitude,
        })
        .eq('id', profileData.id);

      if (error) throw error;

      setProfileData({
        ...profileData,
        address: selectedAddressText.trim(),
        latitude: mapCoord.latitude,
        longitude: mapCoord.longitude,
      });

      setMapModalVisible(false);
      Alert.alert('Berhasil ✓', 'Alamat dan titik koordinat lokasi berhasil diperbarui.');
    } catch (error: any) {
      Alert.alert('Gagal Menyimpan', error.message || 'Terjadi kesalahan.');
    } finally {
      setSavingMapAddress(false);
    }
  }

  // Memoize Leaflet HTML Source
  const mapHtmlSource = useMemo(() => {
    return { html: getLeafletHtml(mapCoord.latitude, mapCoord.longitude) };
  }, []);

  // ─── Logout ───────────────────────────────────────────
  function handleLogout() {
    Alert.alert(
      'Keluar Akun',
      'Apakah Anda yakin ingin keluar dari akun ini?',
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Ya, Keluar',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              clearUserCache();
              await supabase.auth.signOut();
              await AsyncStorage.clear();
            } catch (e) {
              console.log('Logout notice:', e);
            } finally {
              clearUserCache();
              if (router.canGoBack()) {
                router.dismissAll();
              }
              router.replace('/login');
            }
          },
        },
      ]
    );
  }

  if (loading && !hasLoadedOnce) {
    return <KaihLoadingScreen message="Memuat profil..." backgroundColor={colors.background} />;
  }

  if (!profileData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 24 }}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textSecondary} />
        <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 15, textAlign: 'center' }}>Gagal memuat profil.</Text>
        <TouchableOpacity onPress={fetchProfile} style={{ marginTop: 16, backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Coba Lagi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ─── Data Preparation ─────────────────────────────────
  const studentData = profileData.students || {};
  const analysisData = studentData.student_profiles_analysis || null;
  let notesData: any = {};
  try { if (studentData.notes) notesData = JSON.parse(studentData.notes); } catch (e) {}

  const genderText = profileData.gender === 'L' ? 'Laki-laki' : profileData.gender === 'P' ? 'Perempuan' : profileData.gender || '-';
  const birthDateFormatted = profileData.birth_date
    ? new Date(profileData.birth_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';
    
  const jenjangText = notesData.jenjang || (studentData.education_level === 'SMA' ? 'SMK Budi Utomo' : studentData.education_level === 'SMP' ? 'SMP Budi Utomo' : studentData.education_level) || '-';
  const jurusanText = notesData.jurusan || '-';
  const kelasText = notesData.kelas || '-';
  const isSMK = jenjangText === 'SMK Budi Utomo';

  // Format Tampilan Alamat & Koordinat
  let addressDisplay = profileData.address || '-';
  if (profileData.address && profileData.latitude && profileData.longitude) {
    addressDisplay = `${profileData.address}\n📍 (${profileData.latitude.toFixed(5)}, ${profileData.longitude.toFixed(5)})`;
  }

  const getKelasOptions = () => {
    if (jenjangText === 'SMP Budi Utomo') return OPTIONS.kelasSMP;
    if (jenjangText === 'SMK Budi Utomo') {
      if (notesData.jurusan && OPTIONS.kelasSMK[notesData.jurusan]) {
        return OPTIONS.kelasSMK[notesData.jurusan];
      }
    }
    return [];
  };

  // Helper untuk edit
  const ed = (key: string, label: string, value: string, table: 'user_profiles' | 'students' | 'notes', opts?: Partial<EditField>) =>
    () => openEditModal({ key, label, value, table, type: 'text', ...opts });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}
      >
        {/* ═══ HEADER ═══ */}
        <Animated.View style={{ opacity: headerOpacity }}>
          <View style={styles.headerGradient}>
            <View style={[styles.decorCircle, { top: -30, right: -30, width: 120, height: 120, opacity: 0.08 }]} />
            <View style={[styles.decorCircle, { bottom: -20, left: -20, width: 80, height: 80, opacity: 0.06 }]} />
            
            {/* Avatar */}
            <TouchableOpacity style={styles.avatarWrapper} onPress={pickImage} disabled={uploading} activeOpacity={0.8}>
              <View style={styles.avatarBorder}>
                {profileData.photo_url ? (
                  <Image source={{ uri: profileData.photo_url }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitial}>
                      {(profileData.full_name || 'U').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              {uploading && (
                <View style={styles.uploadOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={13} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Nama & Badges */}
            <Text style={styles.headerName}>{profileData.full_name || 'Nama Siswa'}</Text>
            
            <View style={styles.badgesWrapper}>
              {jenjangText !== '-' && (
                <View style={styles.badge}>
                  <Ionicons name="school-outline" size={12} color="#fff" />
                  <Text style={styles.badgeText}>{jenjangText}</Text>
                </View>
              )}
              {isSMK && jurusanText !== '-' && (
                <View style={styles.badge}>
                  <Ionicons name="construct-outline" size={12} color="#fff" />
                  <Text style={styles.badgeText}>{jurusanText}</Text>
                </View>
              )}
              {kelasText !== '-' && (
                <View style={styles.badge}>
                  <Ionicons name="people-outline" size={12} color="#fff" />
                  <Text style={styles.badgeText}>{kelasText}</Text>
                </View>
              )}
            </View>

            {/* Quick stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{studentData.nisn || '-'}</Text>
                <Text style={styles.statLabel}>NISN</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{studentData.nis || '-'}</Text>
                <Text style={styles.statLabel}>NIS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{studentData.blood_type || '-'}</Text>
                <Text style={styles.statLabel}>Gol. Darah</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ═══ CONTENT SECTIONS ═══ */}
        <Animated.View style={{ transform: [{ translateY: contentTranslateY }], opacity: headerOpacity, paddingTop: 16 }}>

          {/* ─── BANNER KELENGKAPAN PROFIL (ONBOARDING REMINDER) ─── */}
          {(() => {
            const { isComplete: isComp, percent: pct, missing: mList } = (() => {
              if (!profileData) return { isComplete: false, percent: 0, missing: [] };
              const p = profileData;
              const s = profileData.students || {};
              let n: any = {};
              try { if (s.notes) n = JSON.parse(s.notes); } catch (e) {}

              const fields = [
                { name: 'Nama Lengkap', isFilled: Boolean(p.full_name?.trim()) },
                { name: 'No. Telepon', isFilled: Boolean(p.phone?.trim()) },
                { name: 'Alamat Lengkap', isFilled: Boolean(p.address?.trim()) },
                { name: 'NISN / NIS', isFilled: Boolean(s.nisn?.trim() || s.nis?.trim()) },
                { name: 'Jenjang Pendidikan', isFilled: Boolean(s.education_level?.trim()) },
                { name: 'Kelas', isFilled: Boolean(n.kelas?.trim()) },
              ];

              const filledCount = fields.filter(f => f.isFilled).length;
              const percent = Math.round((filledCount / fields.length) * 100);
              const missing = fields.filter(f => !f.isFilled).map(f => f.name);
              const isComplete = percent === 100;
              return { isComplete, percent, missing };
            })();

            if (!isComp) {
              return (
                <View style={styles.incompleteBannerCard}>
                  <View style={styles.incompleteBannerHeader}>
                    <View style={styles.incompleteBannerIconBg}>
                      <Ionicons name="warning-outline" size={20} color="#d97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.incompleteBannerTitle}>Status Profil: Belum Lengkap ({pct}%)</Text>
                      <Text style={styles.incompleteBannerSub}>
                        Wajib melengkapi seluruh data di bawah agar semua fitur aplikasi terbuka.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
                  </View>

                  <View style={styles.missingBadgeWrapper}>
                    <Text style={styles.missingBadgeTitle}>Kolom Wajib Belum Diisi:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                      {mList.map((mName: string, idx: number) => (
                        <View key={idx} style={styles.missingTag}>
                          <Ionicons name="alert-circle" size={12} color="#dc2626" />
                          <Text style={styles.missingTagText}>{mName}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              );
            }

            return (
              <View style={styles.completeBannerCard}>
                <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.completeBannerTitle}>Biodata Lengkap 100% ✓</Text>
                  <Text style={styles.completeBannerSub}>Seluruh fitur jurnal & laporan 7 KAIH telah aktif sepenuhnya.</Text>
                </View>
              </View>
            );
          })()}

          {/* ─── Identitas Pribadi ─── */}
          <SectionCard title="Identitas Pribadi" icon="person-outline" iconColor="#2563eb" colors={colors}>
            <InfoRow icon="male-female-outline" label="Jenis Kelamin" value={genderText} colors={colors}
              onEdit={ed('gender', 'Jenis Kelamin (L/P)', genderText, 'user_profiles', { type: 'select', options: OPTIONS.gender })} />
            <InfoRow icon="book-outline" label="Agama" value={profileData.religion || '-'} colors={colors}
              onEdit={ed('religion', 'Agama', profileData.religion || '', 'user_profiles', { type: 'select', options: OPTIONS.religion })} />
            <InfoRow icon="flag-outline" label="Suku / Etnis" value={notesData.suku || '-'} colors={colors}
              onEdit={ed('suku', 'Suku / Etnis', notesData.suku || '', 'notes', { type: 'select-with-other', options: OPTIONS.suku })} />
            <InfoRow icon="calendar-outline" label="Tanggal Lahir" value={birthDateFormatted} colors={colors}
              onEdit={openDatePickerModal} />
            <InfoRow icon="call-outline" label="No. Telepon" value={profileData.phone || '-'} colors={colors}
              onEdit={ed('phone', 'No. Telepon', profileData.phone || '', 'user_profiles', { keyboardType: 'phone-pad' })} />
            <InfoRow icon="location-outline" label="Alamat & Titik Koordinat" value={addressDisplay} colors={colors}
              onEdit={handleEditAddressOptions} />

            {/* CARD FOTO TAMPAK DEPAN RUMAH */}
            <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="home-outline" size={16} color={colors.primary} />
                  <Text style={{ fontSize: 13.5, fontWeight: '700', color: colors.text }}>Foto Tampak Depan Rumah</Text>
                </View>
                <TouchableOpacity onPress={pickHouseImage} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="camera-outline" size={15} color={colors.primary} />
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>
                    {notesData.house_photo_url ? 'Ganti Foto' : 'Unggah Foto'}
                  </Text>
                </TouchableOpacity>
              </View>

              {uploadingHousePhoto ? (
                <View style={styles.housePhotoLoading}>
                  <ActivityIndicator size="small" color="#2563eb" />
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 6 }}>Mengunggah foto rumah...</Text>
                </View>
              ) : notesData.house_photo_url ? (
                <TouchableOpacity onPress={pickHouseImage} activeOpacity={0.9} style={styles.housePhotoCard}>
                  <Image source={{ uri: notesData.house_photo_url }} style={styles.housePhotoImage} />
                  <View style={styles.housePhotoOverlay}>
                    <Ionicons name="camera" size={15} color="#ffffff" />
                    <Text style={styles.housePhotoOverlayText}>Ketuk untuk mengganti foto rumah</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={pickHouseImage} activeOpacity={0.8} style={[styles.housePhotoPlaceholder, { borderColor: colors.border, backgroundColor: `${colors.primary}05` }]}>
                  <Ionicons name="image-outline" size={32} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 6 }}>Belum Ada Foto Rumah</Text>
                  <Text style={{ fontSize: 11.5, color: colors.textSecondary, textAlign: 'center', marginTop: 2 }}>
                    Ketuk di sini untuk mengambil atau memilih foto tampak depan rumah siswa
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </SectionCard>

          {/* ─── Data Akademik ─── */}
          <SectionCard title="Data Akademik" icon="school-outline" iconColor="#8b5cf6" colors={colors}>
            <InfoRow icon="id-card-outline" label="NISN" value={studentData.nisn || '-'} colors={colors} 
              onEdit={ed('nisn', 'NISN', studentData.nisn || '', 'students', { keyboardType: 'numeric' })} />
            <InfoRow icon="card-outline" label="NIS" value={studentData.nis || '-'} colors={colors} 
              onEdit={ed('nis', 'NIS', studentData.nis || '', 'students', { keyboardType: 'numeric' })} />
            <InfoRow icon="layers-outline" label="Jenjang" value={jenjangText} colors={colors}
              onEdit={ed('education_level', 'Jenjang', jenjangText, 'students', { type: 'select', options: OPTIONS.jenjang })} />
            {isSMK && (
              <InfoRow icon="construct-outline" label="Jurusan" value={jurusanText} colors={colors}
                onEdit={ed('jurusan', 'Jurusan / Konsentrasi Keahlian', jurusanText, 'notes', { type: 'select', options: OPTIONS.jurusan })} />
            )}
            <InfoRow icon="people-outline" label="Kelas" value={kelasText} colors={colors}
              onEdit={() => {
                const opts = getKelasOptions();
                if (opts.length === 0) {
                  Alert.alert('Perhatian', isSMK ? 'Silakan pilih Jurusan terlebih dahulu.' : 'Silakan pilih Jenjang terlebih dahulu.');
                  return;
                }
                openEditModal({ key: 'kelas', label: 'Kelas', value: kelasText, table: 'notes', type: 'select', options: opts });
              }} />
          </SectionCard>

          {/* ─── Bakat & Minat ─── */}
          <SectionCard title="Bakat & Minat" icon="star-outline" iconColor="#f59e0b" colors={colors}>
            <InfoRow icon="rocket-outline" label="Cita-cita" value={studentData.aspiration || '-'} colors={colors}
              onEdit={ed('aspiration', 'Cita-cita', studentData.aspiration || '', 'students', { type: 'select-with-other', options: OPTIONS.citaCita })} />
            <InfoRow icon="heart-outline" label="Hobi" value={studentData.hobbies || '-'} colors={colors}
              onEdit={ed('hobbies', 'Hobi', studentData.hobbies || '', 'students', { type: 'select-with-other', options: OPTIONS.hobi })} />
            <InfoRow icon="diamond-outline" label="Bakat" value={studentData.talents || '-'} colors={colors}
              onEdit={ed('talents', 'Bakat / Keahlian', studentData.talents || '', 'students', { type: 'select-with-other', options: OPTIONS.bakat })} />
            <InfoRow icon="compass-outline" label="Minat" value={studentData.interests || '-'} colors={colors}
              onEdit={ed('interests', 'Minat', studentData.interests || '', 'students', { type: 'select-with-other', options: OPTIONS.minat })} />
            <InfoRow icon="trophy-outline" label="Ekstrakurikuler" value={studentData.extracurriculars || '-'} colors={colors}
              onEdit={ed('extracurriculars', 'Ekstrakurikuler', studentData.extracurriculars || '', 'students', { type: 'select-with-other', options: OPTIONS.ekskul })} />
          </SectionCard>

          {/* ─── Fisik & Kesehatan ─── */}
          <SectionCard title="Fisik & Kesehatan" icon="fitness-outline" iconColor="#10b981" colors={colors}>
            <InfoRow icon="water-outline" label="Golongan Darah" value={studentData.blood_type || '-'} colors={colors}
              onEdit={ed('blood_type', 'Golongan Darah', studentData.blood_type || '', 'students', { type: 'select', options: OPTIONS.golDarah })} />
            <InfoRow icon="medkit-outline" label="Catatan Kesehatan" value={studentData.health_notes || '-'} colors={colors}
              onEdit={ed('health_notes', 'Catatan Kesehatan', studentData.health_notes || '', 'students', { multiline: true })} />
          </SectionCard>

          {/* ─── Data Orang Tua ─── */}
          <SectionCard title="Data Orang Tua / Wali" icon="people-circle-outline" iconColor="#ec4899" colors={colors}>
            <InfoRow icon="person-outline" label="Nama Wali" value={notesData.name || '-'} colors={colors}
              onEdit={ed('name', 'Nama Orang Tua / Wali', notesData.name || '', 'notes')} />
            <InfoRow icon="call-outline" label="No. Telepon Wali" value={notesData.phone || '-'} colors={colors}
              onEdit={ed('phone', 'No. Telepon Wali', notesData.phone || '', 'notes', { keyboardType: 'phone-pad' })} />
            <InfoRow icon="briefcase-outline" label="Pekerjaan Wali" value={notesData.occupation || '-'} colors={colors}
              onEdit={ed('occupation', 'Pekerjaan Wali', notesData.occupation || '', 'notes')} />
          </SectionCard>

          {/* ─── Analisis & Evaluasi Guru ─── */}
          <SectionCard title="Analisis & Evaluasi Guru" icon="analytics-outline" iconColor="#6366f1" colors={colors}>
            {analysisData ? (
              <>
                <View style={[styles.analysisItem, { borderLeftColor: '#2563eb' }]}>
                  <View style={styles.analysisHeader}>
                    <Ionicons name="body-outline" size={15} color="#2563eb" />
                    <Text style={[styles.analysisTitle, { color: colors.text }]}>Ringkasan Perilaku</Text>
                  </View>
                  <Text style={[styles.analysisText, { color: colors.textSecondary }]}>
                    {analysisData.behavior_summary || 'Belum ada data.'}
                  </Text>
                </View>

                <View style={[styles.analysisItem, { borderLeftColor: '#f59e0b' }]}>
                  <View style={styles.analysisHeader}>
                    <Ionicons name="star-outline" size={15} color="#f59e0b" />
                    <Text style={[styles.analysisTitle, { color: colors.text }]}>Analisis Bakat</Text>
                  </View>
                  <Text style={[styles.analysisText, { color: colors.textSecondary }]}>
                    {analysisData.talent_analysis || 'Belum ada data.'}
                  </Text>
                </View>

                <View style={[styles.analysisItem, { borderLeftColor: '#8b5cf6', marginBottom: 0 }]}>
                  <View style={styles.analysisHeader}>
                    <Ionicons name="bulb-outline" size={15} color="#8b5cf6" />
                    <Text style={[styles.analysisTitle, { color: colors.text }]}>Rekomendasi</Text>
                  </View>
                  <Text style={[styles.analysisText, { color: colors.textSecondary }]}>
                    {analysisData.recommendations || 'Belum ada saran.'}
                  </Text>
                </View>
              </>
            ) : (
              <View style={[styles.emptyAnalysis, { backgroundColor: `${colors.primary}08` }]}>
                <Ionicons name="document-text-outline" size={32} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Belum ada analisis profil dari guru.</Text>
              </View>
            )}
          </SectionCard>

          {/* ─── Logout Button ─── */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
            <Text style={styles.logoutText}>Keluar Akun</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </Animated.View>
      </ScrollView>

      {/* ═══ ELEGANT ADDRESS EDIT OPTION MODAL (CUSTOM ACTION SHEET) ═══ */}
      <Modal visible={addressOptionModalVisible} transparent animationType="fade" onRequestClose={() => setAddressOptionModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, padding: 0 }]}>
            {/* Header */}
            <View style={styles.addressOptionHeader}>
              <View style={styles.addressOptionHeaderIcon}>
                <Ionicons name="home" size={20} color="#2563eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressOptionTitle}>Pengaturan Alamat Rumah</Text>
                <Text style={styles.addressOptionSubtitle}>Pilih cara menentukan lokasi rumah Anda</Text>
              </View>
              <TouchableOpacity onPress={() => setAddressOptionModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 18, gap: 12 }}>
              {/* OPTION 1: PETA INTERAKTIF (PRIMARY / DEFAULT RECOMMENDATION) */}
              <TouchableOpacity
                style={styles.primaryOptionCard}
                activeOpacity={0.85}
                onPress={() => {
                  setAddressOptionModalVisible(false);
                  openMapModal();
                }}
              >
                <View style={styles.recommendedBadge}>
                  <Ionicons name="star" size={10} color="#ffffff" />
                  <Text style={styles.recommendedBadgeText}>UTAMA & PRESISI</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={styles.primaryOptionIconBg}>
                    <Ionicons name="map" size={24} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.primaryOptionTitle}>Pilih dari Peta Interaktif</Text>
                    <Text style={styles.primaryOptionSub}>
                      Tentukan posisi titik koordinat GPS presisi di peta & dapatkan alamat otomatis.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#ffffff" />
                </View>
              </TouchableOpacity>

              {/* OPTION 2: KETIK MANUAL */}
              <TouchableOpacity
                style={[styles.secondaryOptionCard, { borderColor: colors.border, backgroundColor: colors.background }]}
                activeOpacity={0.7}
                onPress={() => {
                  setAddressOptionModalVisible(false);
                  openEditModal({
                    key: 'address',
                    label: 'Alamat Lengkap (No. Rumah, RT/RW, Kelurahan, dll)',
                    value: profileData.address || '',
                    table: 'user_profiles',
                    multiline: true,
                  });
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={[styles.secondaryOptionIconBg, { backgroundColor: `${colors.primary}12` }]}>
                    <Ionicons name="create-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.secondaryOptionTitle, { color: colors.text }]}>Ketik Alamat Manual</Text>
                    <Text style={[styles.secondaryOptionSub, { color: colors.textSecondary }]}>
                      Masukkan langsung rincian No. Rumah, Lingkungan, RT/RW, atau Kelurahan/Kecamatan.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </View>
              </TouchableOpacity>
            </View>

            {/* Footer Cancel */}
            <TouchableOpacity
              style={[styles.addressOptionCancelBtn, { borderTopColor: colors.border }]}
              onPress={() => setAddressOptionModalVisible(false)}
            >
              <Text style={[styles.addressOptionCancelText, { color: colors.textSecondary }]}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══ STANDARD EDIT MODAL ═══ */}
      <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, maxHeight: SCREEN_WIDTH > 400 ? '80%' : '90%' }]}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderIcon}>
                  <Ionicons name="create-outline" size={20} color="#2563eb" />
                </View>
                <Text style={styles.modalHeaderTitle}>Edit {editField?.label}</Text>
                <TouchableOpacity onPress={() => setEditModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Pilih atau masukkan {editField?.label}</Text>
                
                {/* SELECT / OPTIONS UI */}
                {(editField?.type === 'select' || editField?.type === 'select-with-other') && editField?.options ? (
                  <View style={styles.optionsWrapper}>
                    {editField.options.map((opt, idx) => {
                      const isSelected = editValue === opt || (opt === 'Laki-laki' && editValue === 'L') || (opt === 'Perempuan' && editValue === 'P');
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.optionItem, isSelected && { borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.05)' }]}
                          onPress={() => setEditValue(opt === 'Laki-laki' ? 'L' : opt === 'Perempuan' ? 'P' : opt)}
                        >
                          <Ionicons 
                            name={isSelected ? "radio-button-on" : "radio-button-off"} 
                            size={20} 
                            color={isSelected ? "#2563eb" : colors.textSecondary} 
                          />
                          <Text style={[styles.optionText, { color: isSelected ? '#2563eb' : colors.text }]}>{opt}</Text>
                        </TouchableOpacity>
                      )
                    })}
                    
                    {/* Input manual untuk "Lainnya" */}
                    {editValue === 'Lainnya' && (
                      <Animated.View style={styles.otherInputWrapper}>
                        <TextInput
                          style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                          value={editOtherValue}
                          onChangeText={setEditOtherValue}
                          placeholder={`Ketik ${editField?.label} manual...`}
                          placeholderTextColor={colors.textSecondary}
                          autoFocus
                        />
                      </Animated.View>
                    )}
                  </View>
                ) : (
                  /* TEXT INPUT UI */
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: colors.background,
                        color: colors.text,
                        borderColor: colors.border,
                        minHeight: editField?.multiline ? 100 : 48,
                        textAlignVertical: editField?.multiline ? 'top' : 'center',
                      },
                    ]}
                    value={editValue}
                    onChangeText={setEditValue}
                    placeholder={`Masukkan ${editField?.label || ''}`}
                    placeholderTextColor={colors.textSecondary}
                    multiline={editField?.multiline}
                    keyboardType={editField?.keyboardType || 'default'}
                    autoFocus
                  />
                )}
              </ScrollView>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtnCancel, { borderColor: colors.border }]}
                  onPress={() => setEditModalVisible(false)}
                  disabled={saving}
                >
                  <Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtnSave, { opacity: saving ? 0.6 : 1 }]}
                  onPress={saveEdit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={styles.modalBtnSaveText}>Simpan</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ CALENDAR DATE PICKER MODAL ═══ */}
      <Modal visible={datePickerVisible} transparent animationType="fade" onRequestClose={() => setDatePickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, padding: 0 }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="calendar" size={20} color="#2563eb" />
              </View>
              <Text style={styles.modalHeaderTitle}>Pilih Tanggal Lahir</Text>
              <TouchableOpacity onPress={() => setDatePickerVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
              {/* Active Selection Display */}
              <View style={{ backgroundColor: '#f0f5ff', padding: 14, borderRadius: 14, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#bfdbfe' }}>
                <Text style={{ fontSize: 12, color: '#2563eb', fontWeight: '700', textTransform: 'uppercase' }}>Tanggal Lahir Dipilih:</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#1e3a8a', marginTop: 2 }}>
                  {selectedDay} {['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][selectedMonth - 1]} {selectedYear}
                </Text>
              </View>

              {/* Year Selector */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Pilih Tahun Lahir:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
                {Array.from({ length: 35 }, (_, i) => 2025 - i).map((yr) => (
                  <TouchableOpacity
                    key={yr}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 10,
                      backgroundColor: selectedYear === yr ? '#2563eb' : (colors.background === '#000000' ? '#1e293b' : '#f1f5f9'),
                    }}
                    onPress={() => setSelectedYear(yr)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: selectedYear === yr ? '#fff' : colors.text }}>{yr}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Month Selector */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginVertical: 8 }}>Pilih Bulan Lahir:</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'].map((mName, mIdx) => (
                  <TouchableOpacity
                    key={mIdx}
                    style={{
                      width: '23%',
                      paddingVertical: 8,
                      borderRadius: 10,
                      alignItems: 'center',
                      backgroundColor: selectedMonth === mIdx + 1 ? '#2563eb' : (colors.background === '#000000' ? '#1e293b' : '#f1f5f9'),
                    }}
                    onPress={() => setSelectedMonth(mIdx + 1)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: selectedMonth === mIdx + 1 ? '#fff' : colors.text }}>{mName}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Day Selector */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 8 }}>Pilih Tanggal (Hari):</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {Array.from({ length: new Date(selectedYear, selectedMonth, 0).getDate() }, (_, i) => i + 1).map((dNum) => (
                  <TouchableOpacity
                    key={dNum}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: selectedDay === dNum ? '#2563eb' : (colors.background === '#000000' ? '#1e293b' : '#f1f5f9'),
                    }}
                    onPress={() => setSelectedDay(dNum)}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: selectedDay === dNum ? '#fff' : colors.text }}>{dNum}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtnCancel, { borderColor: colors.border }]}
                onPress={() => setDatePickerVisible(false)}
                disabled={savingDate}
              >
                <Text style={[styles.modalBtnCancelText, { color: colors.textSecondary }]}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnSave, { opacity: savingDate ? 0.6 : 1 }]}
                onPress={saveDateOfBirth}
                disabled={savingDate}
              >
                {savingDate ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={styles.modalBtnSaveText}>Simpan Tanggal Lahir</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ MAP LOCATION PICKER MODAL ═══ */}
      <Modal visible={mapModalVisible} animationType="slide" onRequestClose={() => setMapModalVisible(false)}>
        <View style={styles.mapModalContainer}>
          <StatusBar barStyle="dark-content" />

          {/* 1. Interactive Leaflet Map Background */}
          <WebView
            ref={mapWebViewRef}
            originWhitelist={['*']}
            source={mapHtmlSource}
            style={StyleSheet.absoluteFill}
            onMessage={async (event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'MARKER_POS' && data.lat && data.lng) {
                  setMapCoord({ latitude: data.lat, longitude: data.lng });
                  setSearchingMap(true);
                  try {
                    let geocode = await Location.reverseGeocodeAsync({ latitude: data.lat, longitude: data.lng });
                    let addr = geocode.length > 0 ? formatFullAddress(geocode[0]) : `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`;
                    setSelectedAddressText(addr);
                  } catch {
                    setSelectedAddressText(`${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`);
                  }
                  setSearchingMap(false);
                }
              } catch {}
            }}
          />

          {/* Top Bar Header */}
          <View style={styles.mapHeaderBar}>
            <TouchableOpacity style={styles.mapBackBtn} onPress={() => setMapModalVisible(false)}>
              <Ionicons name="close" size={22} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>Pilih Alamat di Peta</Text>
          </View>

          {/* Search Bar Input */}
          <View style={styles.mapSearchWrapper}>
            <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 6 }} />
            <TextInput
              style={styles.mapSearchInput}
              placeholder="Cari tempat / jalan / bangunan..."
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchMapAddress}
              returnKeyType="search"
            />
            {searchingMap ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <TouchableOpacity onPress={handleSearchMapAddress}>
                <Ionicons name="navigate-circle" size={24} color="#2563eb" />
              </TouchableOpacity>
            )}
          </View>

          {/* Floating My Location Button */}
          <TouchableOpacity style={styles.mapFloatingLocateBtn} onPress={handleGoToMyLocation} activeOpacity={0.8}>
            <Ionicons name="locate" size={22} color="#2563eb" />
          </TouchableOpacity>

          {/* Bottom Card Preview & Confirmation */}
          <View style={styles.mapBottomCard}>
            <View style={styles.mapDragHandle} />

            <View style={styles.mapAddressHeader}>
              <View style={styles.mapAddressIconBg}>
                <Ionicons name="location" size={20} color="#2563eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mapAddressTitle}>Alamat Terpilih (Dapat Diedit Manual)</Text>
                <View style={styles.coordBadge}>
                  <Ionicons name="navigate-outline" size={11} color="#2563eb" />
                  <Text style={styles.coordText}>
                    {mapCoord.latitude.toFixed(5)}, {mapCoord.longitude.toFixed(5)}
                  </Text>
                </View>
              </View>
            </View>

            <Text style={styles.mapInputHint}>
              ✏️ Anda dapat menambahkan No. Rumah, RT/RW, Lingkungan, atau Kelurahan pada kolom di bawah:
            </Text>

            <TextInput
              style={styles.mapAddressInput}
              value={selectedAddressText}
              onChangeText={setSelectedAddressText}
              multiline
              numberOfLines={3}
              placeholder="Tambahkan detail alamat (No. Rumah, RT/RW, Kelurahan, dll)..."
              placeholderTextColor="#94a3b8"
            />

            <TouchableOpacity
              style={[styles.mapSaveBtn, savingMapAddress && { opacity: 0.6 }]}
              onPress={saveMapAddress}
              disabled={savingMapAddress}
              activeOpacity={0.8}
            >
              {savingMapAddress ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.mapSaveBtnText}>Simpan Alamat Ini</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ═════════════════════════════════════════════════════════
// ─── STYLES ─────────────────────────────────────────────
// ═════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  headerGradient: {
    backgroundColor: '#2563eb',
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 10,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  avatarWrapper: {
    marginBottom: 14,
    position: 'relative',
  },
  avatarBorder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.55)',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#1d4ed8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  headerName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  badgesWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    width: '100%',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // Foto Rumah Styles
  housePhotoCard: {
    width: '100%',
    height: 170,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    marginTop: 4,
  },
  housePhotoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
  },
  housePhotoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  housePhotoOverlayText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  housePhotoPlaceholder: {
    width: '100%',
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  housePhotoLoading: {
    width: '100%',
    height: 130,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  analysisItem: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    marginBottom: 14,
    paddingVertical: 4,
  },
  analysisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  analysisTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  analysisText: {
    fontSize: 12.5,
    lineHeight: 20,
  },
  emptyAnalysis: {
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Standard Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  modalHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  optionsWrapper: {
    gap: 8,
    marginBottom: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  otherInputWrapper: {
    marginTop: 4,
  },
  modalInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalBtnCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalBtnSave: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalBtnSaveText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },

  // ── Address Option ActionSheet Styles ──
  addressOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  addressOptionHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressOptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  addressOptionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  primaryOptionCard: {
    backgroundColor: '#2563eb',
    borderRadius: 16,
    padding: 16,
    elevation: 4,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  recommendedBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  recommendedBadgeText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  primaryOptionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryOptionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 3,
  },
  primaryOptionSub: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 16,
  },
  secondaryOptionCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
  },
  secondaryOptionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryOptionTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  secondaryOptionSub: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  addressOptionCancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderTopWidth: 1,
  },
  addressOptionCancelText: {
    fontSize: 14.5,
    fontWeight: '600',
  },

  // ── Map Location Picker Modal Styles ──
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  mapHeaderBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 36,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    zIndex: 10,
  },
  mapBackBtn: {
    marginRight: 8,
  },
  mapHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  mapSearchWrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 86,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    zIndex: 10,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a',
    padding: 0,
  },
  mapFloatingLocateBtn: {
    position: 'absolute',
    bottom: 260,
    right: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 10,
  },
  mapBottomCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    zIndex: 10,
  },
  mapDragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginBottom: 10,
  },
  mapAddressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  mapAddressIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapAddressTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#0f172a',
  },
  coordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  coordText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2563eb',
  },
  mapInputHint: {
    fontSize: 11.5,
    color: '#64748b',
    marginBottom: 6,
    fontWeight: '500',
  },
  mapAddressInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#0f172a',
    marginBottom: 12,
    minHeight: 54,
    textAlignVertical: 'top',
  },
  mapSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  mapSaveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },

  // ONBOARDING BANNER STYLES
  incompleteBannerCard: {
    backgroundColor: '#fffbeb',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  incompleteBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  incompleteBannerIconBg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  incompleteBannerTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#92400e',
  },
  incompleteBannerSub: {
    fontSize: 12,
    color: '#b45309',
    marginTop: 2,
    lineHeight: 16,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#d97706',
    borderRadius: 4,
  },
  missingBadgeWrapper: {
    borderTopWidth: 0.5,
    borderTopColor: '#fde68a',
    paddingTop: 8,
  },
  missingBadgeTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 4,
  },
  missingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  missingTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },

  completeBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#bbf7d0',
    borderRadius: 18,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  completeBannerTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#15803d',
  },
  completeBannerSub: {
    fontSize: 12,
    color: '#166534',
    marginTop: 1,
  },
});
