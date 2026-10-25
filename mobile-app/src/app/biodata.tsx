import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../utils/supabase';
import * as Location from 'expo-location';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function BiodataScreen() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  
  // A: Identitas
  const [fullName, setFullName] = useState('');
  const [nisn, setNisn] = useState('');
  const [nis, setNis] = useState('');
  const [gender, setGender] = useState('L');
  const [religion, setReligion] = useState('Islam');
  const [birthDate, setBirthDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [phone, setPhone] = useState('');

  // B: Akademik
  const [educationLevel, setEducationLevel] = useState('SMA');
  const [classId, setClassId] = useState('');
  const [aspiration, setAspiration] = useState('');
  const [classList, setClassList] = useState<any[]>([]);

  // C: Bakat & Minat
  const [talents, setTalents] = useState('');
  const [hobbies, setHobbies] = useState('');
  const [interests, setInterests] = useState('');
  const [extracurriculars, setExtracurriculars] = useState('');

  // D: Fisik & Alamat
  const [bloodType, setBloodType] = useState('O');
  const [healthNotes, setHealthNotes] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // E: Data Orang Tua
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentOccupation, setParentOccupation] = useState('');

  useEffect(() => {
    checkExistingProfile();
    fetchClasses();
  }, []);

  async function fetchClasses() {
    const { data, error } = await supabase.from('classes').select('*').order('name');
    if (data && data.length > 0) {
      setClassList(data);
      const firstClass = data.find((c: any) => c.level === educationLevel);
      if (firstClass) setClassId(firstClass.id);
    } else {
      // Gunakan data sementara jika tabel kelas di database masih kosong
      const mockClasses = [
        { id: '11111111-1111-1111-1111-111111111111', name: '6A', level: 'SD' },
        { id: '22222222-2222-2222-2222-222222222222', name: '7A', level: 'SMP' },
        { id: '33333333-3333-3333-3333-333333333333', name: '8B', level: 'SMP' },
        { id: '44444444-4444-4444-4444-444444444444', name: '10-MIPA', level: 'SMA' },
        { id: '55555555-5555-5555-5555-555555555555', name: '10-IPS', level: 'SMA' },
      ];
      setClassList(mockClasses);
      const firstClass = mockClasses.find(c => c.level === educationLevel);
      if (firstClass) setClassId(firstClass.id);
    }
  }

  // Update otomatis Pilihan Kelas saat Jenjang Pendidikan berubah
  useEffect(() => {
    if (classList.length > 0) {
      const firstClass = classList.find(c => c.level === educationLevel);
      if (firstClass) setClassId(firstClass.id);
    }
  }, [educationLevel]);

  async function checkExistingProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setChecking(false);
        router.replace('/');
        return;
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
        
      if (profile) {
        const { data: student } = await supabase
          .from('students')
          .select('*')
          .eq('profile_id', profile.id)
          .single();
          
        if (student) {
          router.replace('/(tabs)');
          return;
        }
      }
    } catch (error) {
      console.log('Error checking profile:', error);
    } finally {
      setChecking(false);
    }
  }

  async function getLocation() {
    setIsGettingLocation(true);
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Izin Ditolak', 'Izin lokasi dibutuhkan untuk presensi & profil siswa.');
      setIsGettingLocation(false);
      return false;
    }
    try {
      let loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      return true;
    } catch(err) {
      Alert.alert('Gagal Peta', 'Tidak dapat mengambil GPS');
      return false;
    } finally {
      setIsGettingLocation(false);
    }
  }

  async function saveBiodata() {
    if (!fullName || !nisn || !address || !phone || !classId) {
      Alert.alert('Error', 'Harap isi semua kolom wajib!');
      return;
    }
    
    if (!location) {
      Alert.alert('Error', 'Harap tekan tombol Deteksi Lokasi GPS Anda!');
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      // 1. Profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          full_name: fullName,
          gender: gender,
          religion: religion,
          birth_date: birthDate.toISOString().split('T')[0],
          phone: phone,
          address: address,
          latitude: location.latitude,
          longitude: location.longitude,
        }, { onConflict: 'user_id' })
        .select()
        .single();
        
      if (profileError) throw profileError;

      // 2. Student
      const parentData = JSON.stringify({
        name: parentName,
        phone: parentPhone,
        occupation: parentOccupation
      });

      const { error: studentError } = await supabase
        .from('students')
        .upsert({
          profile_id: profileData.id,
          nisn: nisn,
          nis: nis,
          education_level: educationLevel,
          class_id: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555'].includes(classId) ? null : classId,
          aspiration: aspiration,
          talents: talents,
          hobbies: hobbies,
          interests: interests,
          extracurriculars: extracurriculars,
          blood_type: bloodType,
          health_notes: healthNotes,
          notes: parentData // Simpan JSON parent disini
        }, { onConflict: 'profile_id' });
        
      if (studentError) throw studentError;

      Alert.alert('Sukses', 'Biodata berhasil disimpan!', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') }
      ]);
    } catch (error: any) {
      Alert.alert('Gagal Menyimpan', error.message);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.title}>Biodata Siswa</Text>
      <Text style={styles.subtitle}>Harap lengkapi semua data dengan benar.</Text>

      {/* Bagian A */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bagian A: Identitas Pribadi</Text>
        
        <Text style={styles.label}>Nama Lengkap *</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />

        <Text style={styles.label}>NISN (10 Digit) *</Text>
        <TextInput style={styles.input} value={nisn} onChangeText={setNisn} keyboardType="numeric" />

        <Text style={styles.label}>NIS</Text>
        <TextInput style={styles.input} value={nis} onChangeText={setNis} keyboardType="numeric" />

        <Text style={styles.label}>Jenis Kelamin *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={gender}
            onValueChange={(val) => setGender(val)}
            style={styles.picker}
            dropdownIconColor="#899391"
          >
            <Picker.Item label="Laki-laki" value="L" />
            <Picker.Item label="Perempuan" value="P" />
          </Picker>
        </View>

        <Text style={styles.label}>Agama</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={religion}
            onValueChange={(val) => setReligion(val)}
            style={styles.picker}
            dropdownIconColor="#899391"
          >
            <Picker.Item label="Islam" value="Islam" />
            <Picker.Item label="Kristen" value="Kristen" />
            <Picker.Item label="Katolik" value="Katolik" />
            <Picker.Item label="Hindu" value="Hindu" />
            <Picker.Item label="Buddha" value="Buddha" />
            <Picker.Item label="Konghucu" value="Konghucu" />
          </Picker>
        </View>

        <Text style={styles.label}>Tanggal Lahir</Text>
        <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
          <Text style={{color: 'white'}}>{birthDate.toLocaleDateString('id-ID')}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            value={birthDate}
            mode="date"
            display="default"
            onChange={(e, date) => {
              setShowDatePicker(false);
              if (date) setBirthDate(date);
            }}
          />
        )}

        <Text style={styles.label}>Nomor HP / WhatsApp *</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </View>

      {/* Bagian B */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bagian B: Data Akademik</Text>
        
        <Text style={styles.label}>Jenjang Pendidikan *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={educationLevel}
            onValueChange={(val) => setEducationLevel(val)}
            style={styles.picker}
            dropdownIconColor="#899391"
          >
            <Picker.Item label="SD" value="SD" />
            <Picker.Item label="SMP" value="SMP" />
            <Picker.Item label="SMA" value="SMA" />
          </Picker>
        </View>

        <Text style={styles.label}>Pilih Kelas *</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={classId}
            onValueChange={(val) => setClassId(val)}
            style={styles.picker}
            dropdownIconColor="#899391"
          >
            {classList.filter(c => c.level === educationLevel).map(c => (
              <Picker.Item key={c.id} label={c.name} value={c.id} />
            ))}
          </Picker>
        </View>

        <Text style={styles.label}>Cita-cita</Text>
        <TextInput style={styles.input} value={aspiration} onChangeText={setAspiration} />
      </View>

      {/* Bagian C */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bagian C: Bakat & Minat</Text>
        
        <Text style={styles.label}>Bakat / Keahlian</Text>
        <TextInput style={styles.input} value={talents} onChangeText={setTalents} placeholder="Cth: Menggambar, Menyanyi" placeholderTextColor="#555" />

        <Text style={styles.label}>Hobi</Text>
        <TextInput style={styles.input} value={hobbies} onChangeText={setHobbies} />

        <Text style={styles.label}>Ketertarikan (Interests)</Text>
        <TextInput style={styles.input} value={interests} onChangeText={setInterests} />

        <Text style={styles.label}>Ekstrakurikuler yang Diikuti</Text>
        <TextInput style={styles.input} value={extracurriculars} onChangeText={setExtracurriculars} placeholder="Cth: Pramuka, PMR" placeholderTextColor="#555" />
      </View>

      {/* Bagian D */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bagian D: Data Fisik & Alamat</Text>
        
        <Text style={styles.label}>Golongan Darah</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={bloodType}
            onValueChange={(val) => setBloodType(val)}
            style={styles.picker}
            dropdownIconColor="#899391"
          >
            <Picker.Item label="A" value="A" />
            <Picker.Item label="B" value="B" />
            <Picker.Item label="AB" value="AB" />
            <Picker.Item label="O" value="O" />
          </Picker>
        </View>

        <Text style={styles.label}>Riwayat Penyakit (Opsional)</Text>
        <TextInput style={styles.input} value={healthNotes} onChangeText={setHealthNotes} multiline />

        <Text style={styles.label}>Alamat Lengkap *</Text>
        <TextInput style={[styles.input, {height: 80}]} value={address} onChangeText={setAddress} multiline />

        <Text style={styles.label}>Titik Koordinat Rumah *</Text>
        <TouchableOpacity style={styles.gpsBtn} onPress={getLocation} disabled={isGettingLocation}>
          {isGettingLocation ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.gpsText}>
              {location ? `✅ Tersimpan (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})` : '📍 Deteksi Lokasi Saya'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Bagian E */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bagian E: Data Orang Tua / Wali</Text>
        
        <Text style={styles.label}>Nama Ayah/Ibu/Wali</Text>
        <TextInput style={styles.input} value={parentName} onChangeText={setParentName} />

        <Text style={styles.label}>Nomor HP Orang Tua</Text>
        <TextInput style={styles.input} value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" />

        <Text style={styles.label}>Pekerjaan</Text>
        <TextInput style={styles.input} value={parentOccupation} onChangeText={setParentOccupation} />
      </View>

      <TouchableOpacity style={styles.submitBtn} onPress={saveBiodata} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Simpan & Lanjutkan</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1413',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f1413',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#6bd8cb',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#899391',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#1b2120',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#3d4947',
  },
  cardTitle: {
    color: '#6bd8cb',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3d4947',
    paddingBottom: 8,
  },
  label: {
    color: '#dee4e1',
    fontSize: 13,
    marginBottom: 6,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#0f1413',
    borderWidth: 1,
    borderColor: '#3d4947',
    borderRadius: 8,
    padding: 12,
    color: 'white',
    marginBottom: 16,
  },
  pickerContainer: {
    backgroundColor: '#0f1413',
    borderWidth: 1,
    borderColor: '#3d4947',
    borderRadius: 8,
    marginBottom: 16,
  },
  picker: {
    color: 'white',
    height: 50,
  },
  dateBtn: {
    backgroundColor: '#0f1413',
    borderWidth: 1,
    borderColor: '#3d4947',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  gpsBtn: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  gpsText: {
    color: 'white',
    fontWeight: 'bold',
  },
  submitBtn: {
    backgroundColor: '#0d9488',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  submitText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  }
});
