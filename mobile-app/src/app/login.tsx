import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import kaihLogoAsset from '../../assets/kaih_logo.png';
import budiUtomoLogoAsset from '../../assets/budi_utomo_logo.png';
import { getUserStudentProfile, isProfileComplete, clearUserCache } from '../utils/userCache';

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Register State
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Gmail Verification Modal State
  const [regSuccessModalVisible, setRegSuccessModalVisible] = useState(false);

  // ─── LOGIN HANDLER ────────────────────────────────────
  async function signIn() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Perhatian', 'Silakan isi Email dan Password terlebih dahulu.');
      return;
    }

    setLoading(true);
    try {
      clearUserCache();
      const cleanEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (error) {
        setLoading(false);
        if (error.message.toLowerCase().includes('email not confirmed')) {
          Alert.alert(
            'Email Belum Diverifikasi ✉️',
            'Akun Anda belum diverifikasi. Silakan buka inbox Gmail Anda dan klik tautan konfirmasi pendaftaran terlebih dahulu.'
          );
        } else if (error.message.toLowerCase().includes('invalid login credentials')) {
          Alert.alert('Gagal Login ❌', 'Email atau kata sandi yang Anda masukkan salah. Silakan periksa kembali.');
        } else {
          Alert.alert('Gagal Login', error.message || 'Email atau password salah.');
        }
        return;
      }

      if (!data.user) {
        setLoading(false);
        Alert.alert('Gagal Login', 'Pengguna tidak ditemukan.');
        return;
      }

      // 1. Pastikan record user_profiles ada di database
      let userProfile = await getUserStudentProfile(true);
      if (!userProfile?.profile) {
        const fullName = data.user.user_metadata?.full_name || cleanEmail.split('@')[0];
        const { data: newProf } = await supabase
          .from('user_profiles')
          .upsert({ user_id: data.user.id, full_name: fullName }, { onConflict: 'user_id' })
          .select()
          .single();

        if (newProf) {
          await supabase.from('students').insert({ profile_id: newProf.id });
          userProfile = await getUserStudentProfile(true);
        }
      }

      // 2. Cek kelengkapan biodata
      const complete = isProfileComplete(userProfile);
      setLoading(false);

      if (!complete) {
        Alert.alert(
          'Lengkapi Biodata Siswa 📝',
          'Selamat datang! Karena akun Anda baru/belum lengkap, Anda akan diarahkan ke menu Akun untuk melengkapi biodata terlebih dahulu.',
          [
            {
              text: 'OK, Lengkapi Sekarang',
              onPress: () => router.replace('/(tabs)/profile'),
            },
          ]
        );
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setLoading(false);
      Alert.alert('Error Login', err.message || 'Terjadi kesalahan saat login.');
    }
  }

  // ─── REGISTER HANDLER (WITH GMAIL VERIFICATION) ────────
  async function signUp() {
    if (!regFullName.trim()) {
      Alert.alert('Perhatian', 'Silakan isi Nama Lengkap Siswa.');
      return;
    }
    if (!regEmail.trim()) {
      Alert.alert('Perhatian', 'Silakan isi Alamat Email (Gmail).');
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      Alert.alert('Perhatian', 'Password minimal 6 karakter.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      Alert.alert('Perhatian', 'Konfirmasi password tidak cocok.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
        options: {
          data: { full_name: regFullName.trim() },
          emailRedirectTo: 'mobileapp://login',
        },
      });

      if (error) {
        Alert.alert('Gagal Pendaftaran', error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Create initial user_profile record
        const { data: profData, error: profError } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: data.user.id,
            full_name: regFullName.trim(),
          }, { onConflict: 'user_id' })
          .select()
          .single();

        if (profData) {
          // Create initial empty student record linked to profile
          await supabase.from('students').insert({
            profile_id: profData.id,
          });
        }
      }

      // Show Gmail verification modal notice
      setRegSuccessModalVisible(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Terjadi kesalahan saat pendaftaran.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#f3f6fc" />

      {/* Watermark Soft Logo Background */}
      <Image
        source={require('../../assets/logo.jpg')}
        style={styles.watermarkBg}
        resizeMode="contain"
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/')}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#1e293b" />
          <Text style={styles.backBtnText}>Kembali ke Beranda</Text>
        </TouchableOpacity>

        {/* Logos Header */}
        <View style={styles.logoHeader}>
          <View style={styles.logoBadge}>
            <Image source={budiUtomoLogoAsset} style={styles.logoImg} resizeMode="contain" />
          </View>
          <View style={styles.logoBadge}>
            <Image source={kaihLogoAsset} style={styles.logoImg} resizeMode="contain" />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>Portal Siswa 7 KAIH</Text>
        <Text style={styles.subtitle}>
          Aplikasi Pemantauan Karakter Siswa Yayasan Budi Utomo
        </Text>

        {/* MODE SWITCHER TAB (MASUK | DAFTAR AKUN BARU) */}
        <View style={styles.modeTabContainer}>
          <TouchableOpacity
            style={[styles.modeTabBtn, mode === 'login' && styles.modeTabBtnActive]}
            onPress={() => setMode('login')}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={18} color={mode === 'login' ? '#2563eb' : '#64748b'} />
            <Text style={[styles.modeTabText, mode === 'login' && styles.modeTabTextActive]}>Masuk (Login)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeTabBtn, mode === 'register' && styles.modeTabBtnActive]}
            onPress={() => setMode('register')}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={18} color={mode === 'register' ? '#2563eb' : '#64748b'} />
            <Text style={[styles.modeTabText, mode === 'register' && styles.modeTabTextActive]}>Daftar Akun Baru</Text>
          </TouchableOpacity>
        </View>

        {/* FORM CARD */}
        <View style={styles.card}>
          {mode === 'login' ? (
            /* ═══ FORM LOGIN ═══ */
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Alamat Email (Gmail)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    onChangeText={setEmail}
                    value={email}
                    placeholder="nama@gmail.com"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Kata Sandi (Password)</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    onChangeText={setPassword}
                    value={password}
                    secureTextEntry={!showPassword}
                    placeholder="Masukkan kata sandi..."
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.button, loading && { opacity: 0.7 }]}
                onPress={signIn}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons name="log-in-outline" size={22} color="#ffffff" />
                    <Text style={styles.buttonText}>Masuk ke Akun</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            /* ═══ FORM REGISTER ═══ */
            <>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nama Lengkap Siswa *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    onChangeText={setRegFullName}
                    value={regFullName}
                    placeholder="Nama lengkap sesuai biodata..."
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Gmail Siswa *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    onChangeText={setRegEmail}
                    value={regEmail}
                    placeholder="contoh@gmail.com"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Kata Sandi (Min 6 Karakter) *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    onChangeText={setRegPassword}
                    value={regPassword}
                    secureTextEntry={!showPassword}
                    placeholder="Buat kata sandi..."
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Konfirmasi Kata Sandi *</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    onChangeText={setRegConfirmPassword}
                    value={regConfirmPassword}
                    secureTextEntry={!showRegConfirmPassword}
                    placeholder="Ulangi kata sandi..."
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowRegConfirmPassword(!showRegConfirmPassword)} style={styles.eyeBtn}>
                    <Ionicons name={showRegConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.buttonRegister, loading && { opacity: 0.7 }]}
                onPress={signUp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={20} color="#ffffff" />
                    <Text style={styles.buttonText}>Daftarkan Akun Siswa Baru</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.footerNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#2563eb" />
          <Text style={styles.footerNoteText}>
            Aplikasi Resmi Yayasan Budi Utomo • Monitoring Karakter 7 KAIH
          </Text>
        </View>
      </ScrollView>

      {/* ═══ MODAL VERIFIKASI GMAIL SUKSES ═══ */}
      <Modal visible={regSuccessModalVisible} transparent animationType="fade" onRequestClose={() => setRegSuccessModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderIconBg}>
              <Ionicons name="mail-unread" size={32} color="#2563eb" />
            </View>

            <Text style={styles.modalTitle}>🎉 Pendaftaran Berhasil!</Text>
            <Text style={styles.modalSub}>Langkah Terakhir: Verifikasi Email</Text>

            <View style={styles.modalBodyCard}>
              <Ionicons name="information-circle-outline" size={20} color="#2563eb" style={{ marginBottom: 6 }} />
              <Text style={styles.modalBodyText}>
                Tautan verifikasi akun telah dikirimkan ke email Gmail Anda:{'\n'}
                <Text style={{ fontWeight: '800', color: '#2563eb' }}>{regEmail}</Text>
                {'\n\n'}
                Silakan buka aplikasi <Text style={{ fontWeight: '700' }}>Gmail</Text> Anda dan klik tautan konfirmasi pendaftaran sebelum melakukan login.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.modalBtnOk}
              onPress={() => {
                setRegSuccessModalVisible(false);
                setEmail(regEmail);
                setMode('login');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#ffffff" />
              <Text style={styles.modalBtnOkText}>Saya Sudah Verifikasi / Lanjut Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f6fc',
  },
  watermarkBg: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    width: '80%',
    height: 320,
    opacity: 0.05,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 40,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    marginBottom: 24,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  logoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  logoBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logoImg: {
    width: 38,
    height: 38,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13.5,
    color: '#64748b',
    lineHeight: 19,
    marginBottom: 20,
  },
  modeTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 11,
    gap: 6,
  },
  modeTabBtnActive: {
    backgroundColor: '#ffffff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  modeTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  modeTabTextActive: {
    color: '#2563eb',
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 22,
    elevation: 4,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14.5,
    color: '#0f172a',
  },
  eyeBtn: {
    padding: 6,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    elevation: 3,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  buttonRegister: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
    elevation: 3,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 28,
  },
  footerNoteText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  modalHeaderIconBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2563eb',
    marginTop: 2,
    marginBottom: 16,
  },
  modalBodyCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    marginBottom: 20,
  },
  modalBodyText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    textAlign: 'center',
  },
  modalBtnOk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    elevation: 4,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  modalBtnOkText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
