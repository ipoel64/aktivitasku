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
  Moon,
  Sun,
  ArrowRight,
  GraduationCap,
  HelpCircle,
  X,
} from 'lucide-react';
import {
  loadLandingConfig,
  DEFAULT_LANDING_CONFIG,
} from '../utils/appConfig';
import type {
  LandingPageConfig,
  KaihSlideConfig,
} from '../utils/appConfig';

function generateCaptchaCode(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function Login() {
  const [config, setConfig] = useState<LandingPageConfig>(DEFAULT_LANDING_CONFIG);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaCode, setCaptchaCode] = useState(() => generateCaptchaCode());
  const [captchaInput, setCaptchaInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Load landing configuration dynamically from Supabase
  useEffect(() => {
    loadLandingConfig().then((cfg) => {
      setConfig(cfg);
    });
  }, []);

  const slides: KaihSlideConfig[] =
    config.slides && config.slides.length > 0
      ? [...config.slides].sort((a, b) => a.order - b.order)
      : DEFAULT_LANDING_CONFIG.slides;

  const refreshCaptcha = useCallback(() => {
    setCaptchaCode(generateCaptchaCode());
    setCaptchaInput('');
  }, []);

  // Auto-rotate hero background every 8 seconds
  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % slides.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [slides.length]);

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

  const currentSlide = slides[activeSlideIndex] || slides[0] || DEFAULT_LANDING_CONFIG.slides[0];

  return (
    <div
      className={`min-h-screen w-full flex flex-col lg:flex-row overflow-x-hidden select-none ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-800'
      }`}
    >
      {/* LEFT HERO SECTION (Dynamic 7 KAIH Gallery with Glassmorphism Overlay) */}
      <div className="relative lg:w-[56%] xl:w-[57%] min-h-[440px] lg:min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 overflow-hidden">
        {/* Background Images with Smooth Crossfade */}
        {slides.map((slide, idx) => (
          <div
            key={slide.id || idx}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
              idx === activeSlideIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
            style={{ backgroundImage: `url("${slide.image}")` }}
          />
        ))}

        {/* Dark Gradient Overlay for Maximum Readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/70 to-slate-900/40 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-slate-950/30 pointer-events-none" />

        {/* Top Bar inside Hero: Habit Pill & Dark Mode Button */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-200 px-3.5 py-1.5 rounded-full text-xs font-semibold tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {currentSlide.habit}
          </div>

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="inline-flex items-center gap-2 bg-white/95 hover:bg-white text-slate-800 px-4 py-2 rounded-full shadow-lg text-xs font-bold transition-all cursor-pointer"
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
              <span>{config.heroTitle}</span>
            </h1>
            <p className="mt-3.5 text-sm sm:text-[15px] text-slate-200/95 leading-relaxed font-normal">
              {config.heroSubtitle}
            </p>
          </div>

          {/* 3 Feature Pills */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-900/75 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shrink-0 shadow-md">
                <Users className="w-5 h-5 text-sky-300" />
              </div>
              <div className="text-xs sm:text-[13px] font-semibold text-white leading-snug drop-shadow">
                {config.feature1}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-900/75 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shrink-0 shadow-md">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
              </div>
              <div className="text-xs sm:text-[13px] font-semibold text-white leading-snug drop-shadow">
                {config.feature2}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-slate-900/75 backdrop-blur-md border border-white/15 flex items-center justify-center text-white shrink-0 shadow-md">
                <BarChart3 className="w-5 h-5 text-amber-300" />
              </div>
              <div className="text-xs sm:text-[13px] font-semibold text-white leading-snug drop-shadow">
                {config.feature3}
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
                {slides.map((s, idx) => (
                  <button
                    key={s.id || idx}
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

      {/* CENTER-RIGHT LOGIN FORM SECTION (Clean Pure White, Zero Grey Canvas) */}
      <div
        className={`flex-1 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 min-h-screen ${
          darkMode ? 'bg-slate-900' : 'bg-white'
        }`}
      >
        <div className="w-full max-w-[420px]">
          {/* Logo & Application Header */}
          <div className="flex items-center gap-3.5 mb-7">
            <div className="flex items-center gap-2.5 shrink-0">
              <img
                src={config.logoKaihUrl || '/kaih_logo.png'}
                alt="Logo 7 KAIH"
                className="w-13 h-13 object-contain rounded-full bg-white p-0.5 shadow-sm border border-slate-100"
              />
              {config.logoYaspenUrl ? (
                <img
                  src={config.logoYaspenUrl}
                  alt="Logo Yayasan Budi Utomo"
                  className="w-12 h-12 object-contain rounded-full bg-white p-0.5 shadow-sm border border-slate-100"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col items-center justify-center text-white shadow-sm border-2 border-amber-400">
                  <GraduationCap className="w-5 h-5 text-amber-300" />
                  <span className="text-[7.5px] font-black tracking-tighter leading-none mt-0.5">YASPEN</span>
                </div>
              )}
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

          {/* Alerts */}
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300 font-medium leading-relaxed">
              {error}
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
                  darkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#EEF4FF] border-slate-200/90'
                }`}
              >
                <div
                  className={`w-11 h-11 flex items-center justify-center border-r shrink-0 ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200/80 text-slate-500'
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
                  darkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#EEF4FF] border-slate-200/90'
                }`}
              >
                <div
                  className={`w-11 h-11 flex items-center justify-center border-r shrink-0 ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200/80 text-slate-500'
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
                      ? 'bg-slate-800 border-slate-700 text-blue-400 hover:text-blue-300'
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
                    darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
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
                      ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
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
          </form>
        </div>
      </div>

      {/* FAR-RIGHT PHOTO STRIP (Matches vertical photo strip on the right edge) */}
      <div
        className={`hidden lg:flex lg:w-[96px] xl:w-[118px] h-screen flex-col gap-1.5 p-1.5 border-l shrink-0 ${
          darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        {slides.map((slide, idx) => {
          const isActive = idx === activeSlideIndex;
          return (
            <button
              key={slide.id || idx}
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
                <X className="w-5 h-5" />
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
