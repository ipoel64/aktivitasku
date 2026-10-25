import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  StatusBar,
  Modal,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import kaihLogoAsset from '../../assets/kaih_logo.png';
import budiUtomoLogoAsset from '../../assets/budi_utomo_logo.png';
import landingStudentsFullAsset from '../../assets/landing_students_full.png';
import { KaihLoadingScreen } from '../components/KaihLoadingLogo';
import { getUserStudentProfile, isProfileComplete } from '../utils/userCache';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LandingPageScreen() {
  const [loading, setLoading] = useState(true);
  const [siswaModalVisible, setSiswaModalVisible] = useState(false);
  const [parentModalVisible, setParentModalVisible] = useState(false);

  // Entrance & Floating Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    let isMounted = true;
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
        triggerEntranceAnimation();
      }
    }, 3500);

    // Cek secara validasi penuh apakah pengguna masih terautentikasi di Supabase Auth
    supabase.auth.getUser().then(async ({ data }: any) => {
      clearTimeout(safetyTimeout);
      if (!isMounted) return;
      const user = data?.user;
      if (user) {
        try {
          const userProfile = await getUserStudentProfile(true);
          if (!isMounted) return;
          setTimeout(() => {
            if (!isMounted) return;
            try {
              if (isProfileComplete(userProfile)) {
                router.replace('/(tabs)');
              } else {
                router.replace('/(tabs)/profile');
              }
            } catch (navErr) {
              console.error('Auto navigation error:', navErr);
              if (isMounted) {
                setLoading(false);
                triggerEntranceAnimation();
              }
            }
          }, 150);
        } catch (profileErr) {
          console.error('Profile fetch error:', profileErr);
          if (isMounted) {
            setLoading(false);
            triggerEntranceAnimation();
          }
        }
      } else {
        setLoading(false);
        triggerEntranceAnimation();
      }
    }).catch((err) => {
      console.warn('Initial auth check warning:', err);
      clearTimeout(safetyTimeout);
      if (isMounted) {
        setLoading(false);
        triggerEntranceAnimation();
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
    };
  }, []);

  const triggerEntranceAnimation = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  };

  if (loading) {
    return <KaihLoadingScreen message="Memuat aplikasi..." backgroundColor="#f8fafc" />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" translucent={false} />

      {/* Background Watermark Transparent Soft Logo */}
      <Image
        source={require('../../assets/logo.jpg')}
        style={styles.watermarkBg}
        resizeMode="contain"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          
          {/* ═══ 1. COMPACT ELEGANT HEADER ═══ */}
          <View style={styles.compactHeader}>
            <View style={styles.logoGroup}>
              <View style={styles.logoBadgeSmall}>
                <Image source={budiUtomoLogoAsset} style={styles.logoImgSmall} resizeMode="contain" />
              </View>
              <View style={styles.logoBadgeSmall}>
                <Image source={kaihLogoAsset} style={styles.logoImgSmall} resizeMode="contain" />
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.compactTitle}>AKTIVITAS.KU</Text>
              <View style={styles.compactSubtitleBadge}>
                <Ionicons name="sparkles" size={10} color="#2563eb" style={{ marginRight: 4 }} />
                <Text style={styles.compactSubtitleText} numberOfLines={1} adjustsFontSizeToFit>
                  7 KAIH • Yayasan Pendidikan Budi Utomo
                </Text>
              </View>
            </View>
          </View>

          {/* ═══ 2. FULL HERO POSTER SHOWCASE CARD ═══ */}
          <View style={styles.heroPosterCard}>
            <Image
              source={landingStudentsFullAsset}
              style={styles.heroPosterImage}
              resizeMode="cover"
            />
          </View>

          {/* ═══ 3. BRIEF WELCOME CARD ═══ */}
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>Selamat Datang!</Text>
            <Text style={styles.welcomeSub}>
              Aplikasi pemantauan kebiasaan positif 7 KAIH untuk membentuk karakter siswa yang mandiri, jujur, dan berakhlak mulia.
            </Text>
          </View>

          {/* ═══ 4. SIDE-BY-SIDE COMPACT LOGIN BUTTONS ═══ */}
          <Text style={styles.sectionLabel}>Pilih Akses Masuk</Text>

          <View style={styles.sideBySideRow}>
            {/* BUTTON SISWA */}
            <TouchableOpacity
              style={styles.btnSiswaCompact}
              activeOpacity={0.88}
              onPress={() => setSiswaModalVisible(true)}
            >
              <View style={styles.btnIconBgSiswa}>
                <Ionicons name="school" size={22} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.btnTitleSiswa}>Login Siswa</Text>
                <Text style={styles.btnSubSiswa}>Jurnal 7 KAIH</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>

            {/* BUTTON ORANG TUA */}
            <TouchableOpacity
              style={styles.btnParentCompact}
              activeOpacity={0.88}
              onPress={() => setParentModalVisible(true)}
            >
              <View style={styles.btnIconBgParent}>
                <Ionicons name="people" size={22} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.btnTitleParent}>Login Ortu</Text>
                <Text style={styles.btnSubParent}>Portal Wali</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          {/* ═══ 5. FOOTER INFO ═══ */}
          <View style={styles.footerInfo}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#64748b" />
            <Text style={styles.footerInfoText}>
              Platform Resmi Karakter 7 KAIH • SMP & SMK Budi Utomo
            </Text>
          </View>

        </Animated.View>
      </ScrollView>

      {/* ═══ MODAL 1: KONFIRMASI SISWA (PESAN KOMITMEN) ═══ */}
      <Modal visible={siswaModalVisible} transparent animationType="fade" onRequestClose={() => setSiswaModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.siswaModalHeader}>
              <View style={styles.siswaHeaderIconBg}>
                <Ionicons name="shield-checkmark" size={24} color="#2563eb" />
              </View>
              <Text style={styles.siswaModalTitle}>Pernyataan Kejujuran</Text>
              <Text style={styles.siswaModalSub}>Komitmen Pengisian 7 KAIH</Text>
            </View>

            {/* Modal Body Message */}
            <View style={styles.modalBody}>
              <View style={styles.quoteCard}>
                <Ionicons name="sparkles-outline" size={18} color="#2563eb" style={{ marginBottom: 6 }} />
                <Text style={styles.quoteText}>
                  "Mohon mengisi aktivitas 7 KAIH ini dengan jujur dan apa adanya sesuai kegiatan yang sebenarnya. Pengisian tidak mempengaruhi nilai akademik disekolah, melainkan berfungsi sebagai sarana kerja sama antara sekolah dan orang tua untuk membentuk karakter positif anak"
                </Text>
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionsStacked}>
              <TouchableOpacity
                style={styles.btnConfirmSiswaFull}
                onPress={() => {
                  setSiswaModalVisible(false);
                  router.push('/login');
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.btnConfirmText}>Saya Mengerti & Lanjutkan</Text>
                <Ionicons name="arrow-forward" size={16} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnCancelFull}
                onPress={() => setSiswaModalVisible(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.btnCancelText}>Batal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ═══ MODAL 2: NOTIFIKASI ORANG TUA (DALAM PROSES) ═══ */}
      <Modal visible={parentModalVisible} transparent animationType="fade" onRequestClose={() => setParentModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Modal Header */}
            <View style={styles.parentModalHeader}>
              <View style={styles.parentHeaderIconBg}>
                <Ionicons name="construct" size={24} color="#d97706" />
              </View>
              <Text style={styles.parentModalTitle}>Informasi Akses</Text>
              <Text style={styles.parentModalSub}>Login Orang Tua</Text>
            </View>

            {/* Modal Body Message */}
            <View style={styles.modalBody}>
              <View style={styles.parentNoticeCard}>
                <Ionicons name="time-outline" size={32} color="#d97706" style={{ marginBottom: 10 }} />
                <Text style={styles.parentNoticeText}>
                  Maaf, saat ini khusus login sebagai orang tua masih dalam proses.
                </Text>
                <Text style={styles.parentNoticeSubtext}>
                  Fitur pemantauan portal orang tua sedang dikembangkan untuk memberikan pengalaman terbaik.
                </Text>
              </View>
            </View>

            {/* Modal Action */}
            <View style={styles.modalActionsSingle}>
              <TouchableOpacity
                style={styles.btnParentOk}
                onPress={() => setParentModalVisible(false)}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
                <Text style={styles.btnConfirmText}>Mengerti & Kembali</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  watermarkBg: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    width: '80%',
    height: 320,
    opacity: 0.04,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 28,
  },

  // 1. Compact Header
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  logoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logoBadgeSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
  },
  logoImgSmall: {
    width: 26,
    height: 26,
  },
  compactTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 1,
  },
  compactSubtitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactSubtitleText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2563eb',
    flexShrink: 1,
  },

  // 2. Full Hero Poster Image Card
  heroPosterCard: {
    width: '100%',
    aspectRatio: 1.04,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
    elevation: 5,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  heroPosterImage: {
    width: '100%',
    height: '100%',
  },

  // 3. Welcome Card
  welcomeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    elevation: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  welcomeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  welcomeSub: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
  },

  // 4. Side by Side Buttons
  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 8,
    marginLeft: 2,
  },
  sideBySideRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  btnSiswaCompact: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 3,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  btnIconBgSiswa: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnTitleSiswa: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  btnSubSiswa: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },

  btnParentCompact: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    elevation: 3,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  btnIconBgParent: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnTitleParent: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  btnSubParent: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
  },

  // 5. Footer
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  footerInfoText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  siswaModalHeader: {
    backgroundColor: '#f0f5ff',
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  siswaHeaderIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  siswaModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  siswaModalSub: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '700',
    marginTop: 2,
  },
  modalBody: {
    padding: 20,
  },
  quoteCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 14,
  },
  quoteText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '500',
    textAlign: 'justify',
  },
  modalActionsStacked: {
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  btnConfirmSiswaFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563eb',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    elevation: 4,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  btnCancelFull: {
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#64748b',
  },
  btnConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },

  parentModalHeader: {
    backgroundColor: '#fffbeb',
    paddingVertical: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7',
  },
  parentHeaderIconBg: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 3,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  parentModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },
  parentModalSub: {
    fontSize: 12,
    color: '#d97706',
    fontWeight: '700',
    marginTop: 2,
  },
  parentNoticeCard: {
    backgroundColor: '#fffbe8',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  parentNoticeText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#b45309',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 20,
  },
  parentNoticeSubtext: {
    fontSize: 12,
    color: '#78350f',
    textAlign: 'center',
    lineHeight: 17,
  },
  modalActionsSingle: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  btnParentOk: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#d97706',
    paddingVertical: 13,
    borderRadius: 14,
    elevation: 4,
    shadowColor: '#d97706',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
});
