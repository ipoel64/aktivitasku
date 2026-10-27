import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Shield,
  RefreshCw,
  Users,
  ShieldCheck,
  BarChart3,
  LayoutGrid,
  Trash2,
  Moon,
  Sun,
  ArrowRight,
  X,
  CheckCircle2,
  Smartphone,
  GraduationCap,
  Building2,
  Award,
  HelpCircle,
} from 'lucide-react';

interface KaihSlide {
  id: number;
  title: string;
  habit: string;
  image: string;
  quote: string;
}

const KAIH_GALLERY: KaihSlide[] = [
  {
    id: 1,
    title: 'Gemar Belajar & Kolaborasi Kelas',
    habit: 'Kebiasaan 5: Gemar Belajar',
    image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1400&q=80',
    quote: 'Data akurat, evaluasi tepat, membentuk generasi Indonesia hebat yang berkarakter.',
  },
  {
    id: 2,
    title: 'Bangun Pagi & Semangat Disiplin Sekolah',
    habit: 'Kebiasaan 1: Bangun Pagi',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=80',
    quote: 'Kedisiplinan dimulai sejak pagi hari untuk meraih cita-cita masa depan yang gemilang.',
  },
  {
    id: 3,
    title: 'Berolahraga & Kesehatan Fisik Siswa',
    habit: 'Kebiasaan 3: Berolahraga',
    image: 'https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=1400&q=80',
    quote: 'Di dalam tubuh yang sehat terdapat jiwa dan pikiran yang tangguh serta berprestasi.',
  },
  {
    id: 4,
    title: 'Makan Sehat, Bergizi & Beribadah',
    habit: 'Kebiasaan 2 & 4: Beribadah & Sehat',
    image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1400&q=80',
    quote: 'Keseimbangan spiritual, akhlak mulia, dan gizi seimbang menjadi fondasi siswa unggul.',
  },
  {
    id: 5,
    title: 'Bermasyarakat & Gotong Royong Positif',
    habit: 'Kebiasaan 6 & 7: Bermasyarakat & Tidur Cepat',
    image: 'https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=1400&q=80',
    quote: 'Kolaborasi hangat antara guru, siswa, dan orang tua demi pendidikan berdaya saing.',
  },
];

function generateCaptchaCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaCode, setCaptchaCode] = useState(() => generateCaptchaCode());
  const [captchaInput, setCaptchaInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [showAppsModal, setShowAppsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const refreshCaptcha = useCallback(() => {
    setCaptchaCode(generateCaptchaCode());
    setCaptchaInput('');
  }, []);

  // Auto-rotate hero background every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % KAIH_GALLERY.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleClearCache = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach((name) => caches.delete(name));
        });
      }
      refreshCaptcha();
      setError(null);
      setToastMsg('Cache browser & sesi lokal berhasil dibersihkan!');
      setTimeout(() => setToastMsg(null), 4000);
    } catch {
      setToastMsg('Cache berhasil direset.');
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (captchaInput.trim().toLowerCase() !== captchaCode.toLowerCase()) {
      setError('Kode Keamanan (Captcha) tidak sesuai. Silakan ketik ulang 4 karakter yang tampil.');
      refreshCaptcha();
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = email.trim();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError) throw signInError;

      if (data.user) {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, is_active')
          .eq('id', data.user.id)
          .single();

        if (userError) throw userError;

        if (userData?.is_active === false) {
          await supabase.auth.signOut();
          setError('Akun Anda sedang dinonaktifkan oleh Administrator. Silakan hubungi Admin Sekolah.');
          refreshCaptcha();
          return;
        }

        const allowedRoles = ['admin', 'guru', 'kepsek', 'yayasan'];
        if (!allowedRoles.includes(userData?.role)) {
          await supabase.auth.signOut();
          setError('Akun Siswa digunakan pada Aplikasi Mobile AKTIVITASKU. Portal Web ini khusus untuk Admin, Guru, Kepala Sekolah, dan Yayasan.');
          refreshCaptcha();
        }
      }
    } catch (err: any) {
      const msg = err?.message === 'Invalid login credentials'
        ? 'Email atau Password yang Anda masukkan salah. Pastikan akun sudah terdaftar oleh Admin.'
        : err?.message || 'Gagal masuk ke sistem.';
      setError(msg);
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const currentSlide = KAIH_GALLERY[activeSlideIndex];

  return (
    <div className={`min-h-screen w-full flex flex-col lg:flex-row overflow-x-hidden select-none ${darkMode ? 'bg-slate-950 text-slate-100' : 'bg-[#F1F5F9] text-slate-800'}`}>
      {/* LEFT HERO SECTION (Matches sdmpkh.kemensos.go.id layout) */}
      <div className="relative lg:w-[56%] xl:w-[57%] min-h-[420px] lg:min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 overflow-hidden">
        {/* Background Image with Smooth Transition */}
        {KAIH_GALLERY.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
              idx === activeSlideIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
            style={{ backgroundImage: `url("${slide.image}")` }}
          />
        ))}

        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/65 to-slate-900/35 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/30 pointer-events-none" />

        {/* Top Bar inside Hero: Habit Pill & Dark Mode Button */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-200 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {currentSlide.habit}
          </div>

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-800 px-4 py-2 rounded-full shadow-lg text-xs font-bold transition-all cursor-pointer"
          >
            {darkMode ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                Mode Terang
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-slate-700" />
                Mode Gelap
              </>
            )}
          </button>
        </div>

        {/* Center-Left Welcome Glass Card + 3 Feature Badges */}
        <div className="relative z-10 my-8 lg:my-auto max-w-xl">
          <div className="bg-slate-900/75 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-8 shadow-2xl">
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-white tracking-tight leading-tight flex items-center gap-2.5 flex-wrap">
              <span>Selamat Datang di AKTIVITASKU</span>
              <span className="inline-block animate-bounce">👋</span>
            </h1>
            <p className="mt-3.5 text-sm sm:text-[15px] text-slate-200/95 leading-relaxed font-normal">
              Perguruan Budi Utomo — Sistem Informasi Pemantauan & Evaluasi Gerakan{' '}
              <strong className="text-amber-300 font-semibold">7 Kebiasaan Anak Indonesia Hebat (7 KAIH)</strong>,
              Absensi Terpadu, dan Pemetaan Karakter Siswa.
            </p>
          </div>

          {/* 3 Feature Pills (Matches Reference Icons & Text Layout) */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-900/75 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shrink-0 shadow-md">
                <Users className="w-5 h-5 text-sky-300" />
              </div>
              <div className="text-xs sm:text-[13px] font-semibold text-white leading-snug drop-shadow">
                Data Siswa & Kelas
                <br />
                Terintegrasi
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-900/75 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shrink-0 shadow-md">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
              </div>
              <div className="text-xs sm:text-[13px] font-semibold text-white leading-snug drop-shadow">
                Mendukung Karakter
                <br />7 KAIH Siswa
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-900/75 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shrink-0 shadow-md">
                <BarChart3 className="w-5 h-5 text-amber-300" />
              </div>
              <div className="text-xs sm:text-[13px] font-semibold text-white leading-snug drop-shadow">
                Transparan
                <br />
                dan Akuntabel
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Quote Glass Box */}
        <div className="relative z-10 max-w-md">
          <div className="bg-slate-900/75 backdrop-blur-md border border-white/15 rounded-2xl px-5 py-3.5 shadow-xl">
            <p className="text-xs sm:text-[13px] italic text-slate-200 leading-relaxed">
              "{currentSlide.quote}"
            </p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-amber-300/90 font-semibold">
              <span>— {currentSlide.title}</span>
              <div className="flex gap-1.5">
                {KAIH_GALLERY.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSlideIndex(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === activeSlideIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/40 hover:bg-white/70'
                    }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CENTER-RIGHT LOGIN FORM SECTION */}
      <div className={`flex-1 flex items-center justify-center p-5 sm:p-8 lg:p-10 ${darkMode ? 'bg-slate-900' : 'bg-[#F1F5F9]'}`}>
        <div
          className={`w-full max-w-[430px] rounded-[28px] p-6 sm:p-8 shadow-xl border transition-colors ${
            darkMode
              ? 'bg-slate-800/95 border-slate-700 text-slate-100 shadow-slate-950/50'
              : 'bg-white border-slate-100 text-slate-800 shadow-slate-200/80'
          }`}
        >
          {/* Logo & Application Header (Matches Reference e-SDM Header) */}
          <div className="flex items-center gap-3.5 mb-6">
            <div className="flex items-center gap-2 shrink-0">
              <img
                src="/kaih_logo.png"
                alt="Logo Gerakan 7 KAIH"
                className="w-12 h-12 object-contain rounded-full bg-white p-0.5 shadow-sm border border-slate-100"
              />
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col items-center justify-center text-white shadow-sm border-2 border-amber-400">
                <GraduationCap className="w-5 h-5 text-amber-300" />
                <span className="text-[7px] font-black tracking-tighter leading-none mt-0.5">YASPEN</span>
              </div>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-extrabold text-[#2563EB] dark:text-blue-400 tracking-tight leading-none">
                AKTIVITASKU
              </h2>
              <p className={`text-[11px] mt-1 leading-snug font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Sistem Pemantauan 7 KAIH & Evaluasi Siswa
                <br />
                Perguruan Budi Utomo
              </p>
            </div>
          </div>

          {/* Alerts / Toast */}
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300 font-medium leading-relaxed">
              {error}
            </div>
          )}

          {toastMsg && (
            <div className="mb-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-3 text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{toastMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email / Username Field */}
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${darkMode ? 'text-blue-300' : 'text-[#1E3A8A]'}`}>
                Email / Username <span className="text-red-500">*</span>
              </label>
              <div
                className={`flex items-center rounded-xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
                  darkMode ? 'bg-slate-700/70 border-slate-600' : 'bg-[#EEF4FF] border-slate-200/90'
                }`}
              >
                <div
                  className={`w-11 h-11 flex items-center justify-center border-r shrink-0 ${
                    darkMode ? 'bg-slate-800 border-slate-600 text-slate-300' : 'bg-white border-slate-200/80 text-slate-500'
                  }`}
                >
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contoh: guru1@budiutomo.com"
                  className={`w-full px-3.5 py-2.5 text-sm font-medium bg-transparent focus:outline-none select-text ${
                    darkMode ? 'text-white placeholder-slate-400' : 'text-slate-800 placeholder-slate-400'
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${darkMode ? 'text-blue-300' : 'text-[#1E3A8A]'}`}>
                Password <span className="text-red-500">*</span>
              </label>
              <div
                className={`flex items-center rounded-xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
                  darkMode ? 'bg-slate-700/70 border-slate-600' : 'bg-[#EEF4FF] border-slate-200/90'
                }`}
              >
                <div
                  className={`w-11 h-11 flex items-center justify-center border-r shrink-0 ${
                    darkMode ? 'bg-slate-800 border-slate-600 text-slate-300' : 'bg-white border-slate-200/80 text-slate-500'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={`w-full px-3.5 py-2.5 text-sm font-medium bg-transparent focus:outline-none select-text ${
                    darkMode ? 'text-white placeholder-slate-400' : 'text-slate-800 placeholder-slate-400'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`w-11 h-11 flex items-center justify-center border-l shrink-0 cursor-pointer transition-colors ${
                    darkMode
                      ? 'bg-slate-800 border-slate-600 text-blue-400 hover:text-blue-300'
                      : 'bg-white border-slate-200/80 text-blue-600 hover:bg-slate-50'
                  }`}
                  title={showPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Kode Keamanan (Captcha) Field */}
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${darkMode ? 'text-blue-300' : 'text-[#1E3A8A]'}`}>
                Kode Keamanan <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div
                  className={`flex-1 flex items-center rounded-xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
                    darkMode ? 'bg-slate-700/70 border-slate-600' : 'bg-white border-slate-200'
                  }`}
                >
                  <div className={`pl-3 pr-2 py-2.5 ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="huruf/angka"
                    className={`w-full pr-3 py-2.5 text-sm font-semibold tracking-wider bg-transparent focus:outline-none select-text ${
                      darkMode ? 'text-white placeholder-slate-400' : 'text-slate-800 placeholder-slate-400'
                    }`}
                  />
                </div>

                {/* Stylized Captcha Visual Box */}
                <div
                  className="relative h-11 px-4 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-100 via-purple-100 to-blue-100 flex items-center justify-center overflow-hidden shrink-0 shadow-inner"
                  style={{ minWidth: '108px' }}
                  title="Kode Keamanan Visual"
                >
                  {/* Decorative noise lines */}
                  <svg className="absolute inset-0 w-full h-full opacity-45 pointer-events-none" viewBox="0 0 110 44">
                    <path d="M5 10 Q 35 35, 65 12 T 105 30" stroke="#6366f1" strokeWidth="1.5" fill="none" />
                    <path d="M8 34 Q 45 8, 75 30 T 102 10" stroke="#9333ea" strokeWidth="1.2" fill="none" />
                    <circle cx="25" cy="15" r="2" fill="#4f46e5" />
                    <circle cx="55" cy="32" r="2.5" fill="#7e22ce" />
                    <circle cx="85" cy="18" r="2" fill="#2563eb" />
                  </svg>
                  <div className="relative z-10 flex items-center gap-1 font-mono text-lg font-black tracking-widest text-indigo-950">
                    {captchaCode.split('').map((char, i) => (
                      <span
                        key={i}
                        style={{
                          transform: `rotate(${i % 2 === 0 ? -8 : 9}deg) translateY(${i % 2 === 0 ? -1 : 1}px)`,
                          display: 'inline-block',
                        }}
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Refresh Captcha Button */}
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    darkMode
                      ? 'bg-slate-800 border-slate-600 text-blue-400 hover:bg-slate-700'
                      : 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50'
                  }`}
                  title="Acak Ulang Kode Keamanan"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <p className={`mt-1.5 text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Huruf kecil dan angka saja, persis 4 karakter, tanpa spasi.
              </p>
            </div>

            {/* Links Row: Lupa Password & Info Akun */}
            <div className="flex items-center justify-center gap-2 pt-1 text-xs font-semibold text-[#2563EB] dark:text-blue-400">
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="hover:underline cursor-pointer"
              >
                Lupa Password?
              </button>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="hover:underline cursor-pointer"
              >
                Panduan Akun Sekolah
              </button>
            </div>

            {/* Primary Submit Button: Masuk -> */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 rounded-xl bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <span>Memverifikasi Akun...</span>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Secondary Button: Aplikasi & Layanan Terkait */}
            <button
              type="button"
              onClick={() => setShowAppsModal(true)}
              className={`w-full py-3 px-4 rounded-xl border font-bold text-xs sm:text-[13px] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                darkMode
                  ? 'border-blue-500/40 text-blue-300 hover:bg-blue-950/40'
                  : 'border-blue-200 text-[#2563EB] hover:bg-blue-50/70'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Aplikasi & Layanan Terkait</span>
            </button>

            {/* Green Button: Hapus Cache Browser */}
            <button
              type="button"
              onClick={handleClearCache}
              className="w-full py-3 px-4 rounded-xl bg-[#16A34A] hover:bg-green-700 active:bg-green-800 text-white font-bold text-xs sm:text-[13px] shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus Cache Browser</span>
            </button>
          </form>
        </div>
      </div>

      {/* FAR-RIGHT PHOTO STRIP (Matches vertical photo strip on the right edge of reference) */}
      <div className="hidden lg:flex lg:w-[96px] xl:w-[118px] h-screen flex-col gap-1.5 p-1.5 bg-white/80 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shrink-0">
        {KAIH_GALLERY.map((slide, idx) => {
          const isActive = idx === activeSlideIndex;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveSlideIndex(idx)}
              className={`relative flex-1 w-full rounded-lg overflow-hidden group cursor-pointer transition-all ${
                isActive ? 'ring-2 ring-blue-600 shadow-md' : 'opacity-80 hover:opacity-100'
              }`}
              title={`${slide.habit} — ${slide.title}`}
            >
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
              <div
                className={`absolute inset-0 transition-colors ${
                  isActive ? 'bg-blue-900/10' : 'bg-slate-950/25 group-hover:bg-slate-950/10'
                }`}
              />
              <div className="absolute bottom-1 left-1 right-1 bg-slate-950/75 backdrop-blur-xs text-[9px] text-white font-semibold px-1.5 py-0.5 rounded truncate">
                {idx + 1}. {slide.habit.replace(/Kebiasaan [^:]+:\s*/, '')}
              </div>
            </button>
          );
        })}
      </div>

      {/* MODAL: APLIKASI & LAYANAN TERKAIT */}
      {showAppsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <img src="/kaih_logo.png" alt="7 KAIH" className="w-10 h-10 object-contain" />
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Ekosistem Aplikasi AKTIVITASKU & 7 KAIH
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Layanan Terintegrasi Yayasan Pendidikan Budi Utomo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAppsModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
              <div className="p-4 rounded-2xl border border-blue-100 bg-blue-50/50 dark:bg-slate-700/50 dark:border-slate-600">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-2.5">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Aplikasi Mobile Siswa (7 KAIH)
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Input rencana & realisasi 7 kebiasaan harian siswa dilengkapi foto geotagging dan jadwal ibadah.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 dark:bg-slate-700/50 dark:border-slate-600">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-2.5">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Portal Guru & Wali Kelas
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Pemantauan siswa sesuai kelas ajar, penilaian aktivitas 7 KAIH, absensi, cetak PDF biodata & peta sebaran.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-amber-100 bg-amber-50/50 dark:bg-slate-700/50 dark:border-slate-600">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-2.5">
                  <Award className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Dashboard Kepala Sekolah & Yayasan
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Analitik eksekutif capaian karakter siswa lintas angkatan, rekap kehadiran, dan evaluasi mutu sekolah.
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-purple-100 bg-purple-50/50 dark:bg-slate-700/50 dark:border-slate-600">
                <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-2.5">
                  <Building2 className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Panel Kontrol Super Admin
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  Manajemen akun terpusat (input satuan & impor CSV/Excel) serta pembagian kelas mengajar guru.
                </p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAppsModal(false)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LUPA PASSWORD / PANDUAN AKUN */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Informasi Akses & Reset Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p>
                Sistem <strong>AKTIVITASKU & 7 KAIH Perguruan Budi Utomo</strong> dikelola secara terpusat oleh{' '}
                <strong>Administrator Sekolah</strong> demi keamanan data akademik.
              </p>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-700/60 border border-slate-200/80 dark:border-slate-600 space-y-1.5">
                <p className="font-bold text-slate-800 dark:text-white">Ketentuan Login Pengguna:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong>Guru / Wali Kelas:</strong> Login menggunakan akun yang dibuat oleh Admin untuk memantau siswa sesuai kelas yang diampu.
                  </li>
                  <li>
                    <strong>Kepala Sekolah & Yayasan:</strong> Login menggunakan akun resmi pimpinan yang diterbitkan Admin.
                  </li>
                  <li>
                    <strong>Lupa Password / Kendala Akun:</strong> Silakan hubungi Operator / Admin IT Perguruan Budi Utomo untuk melakukan reset password.
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
