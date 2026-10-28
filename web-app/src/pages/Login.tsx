import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Shield,
  RefreshCw,
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
    <div className={`relative min-h-screen w-full flex flex-col lg:flex-row overflow-hidden select-none ${darkMode ? 'text-slate-100' : 'text-slate-800'}`}>
      {/* ================= FULLSCREEN BACKGROUND IMAGES WITH SMOOTH KEN BURNS ZOOM IN / ZOOM OUT (Requirement 2 & 3) ================= */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        {slides.map((slide, idx) => {
          const isActive = idx === activeSlideIndex;
          const isEven = idx % 2 === 0;
          return (
            <div
              key={slide.id || idx}
              className={`absolute inset-0 w-full h-full bg-cover bg-center ${
                isActive ? 'opacity-100 z-1' : 'opacity-0 z-0'
              }`}
              style={{
                backgroundImage: `url("${slide.image}")`,
                transform: isActive
                  ? isEven
                    ? 'scale(1.10)'
                    : 'scale(1.02)'
                  : isEven
                  ? 'scale(1.01)'
                  : 'scale(1.10)',
                transitionProperty: 'opacity, transform',
                transitionDuration: '2200ms, 8500ms',
                transitionTimingFunction: 'ease-in-out, cubic-bezier(0.25, 1, 0.5, 1)',
              }}
            />
          );
        })}

        {/* Global Cinematic Vignette & Gradient Overlay (Allows background to be seen everywhere, including behind the login box) */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-slate-950/25 to-slate-950/50 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/20 pointer-events-none" />
        <div className="absolute inset-0 bg-radial from-transparent via-slate-950/15 to-slate-950/40 pointer-events-none" />
      </div>

      {/* ================= TOP-RIGHT: MODE GELAP / TERANG (GESER KE KIRI AGAR TIDAK MENABRAK FOTO STRIP) ================= */}
      <div className="absolute top-4 right-5 sm:right-8 lg:right-32 xl:right-36 z-30 pointer-events-auto">
        <button
          type="button"
          onClick={() => setDarkMode(!darkMode)}
          className="inline-flex items-center gap-1.5 bg-slate-950/40 hover:bg-slate-950/60 active:bg-slate-950/80 backdrop-blur-xl border border-white/20 text-white px-4 py-1.5 rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.3)] ring-1 ring-white/10 text-xs font-bold transition-all cursor-pointer"
        >
          {darkMode ? (
            <>
              <Sun className="w-3.5 h-3.5 text-amber-300" />
              <span>Mode Terang</span>
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 text-sky-200" />
              <span>Mode Gelap</span>
            </>
          )}
        </button>
      </div>

      {/* ================= LEFT SECTION: 7 KAIH, HERO CARD & BOTTOM QUOTE (SEJAJAR & SANGAT TRANSPARAN) ================= */}
      <div className="relative z-20 lg:w-[48%] xl:w-[50%] flex flex-col justify-between px-5 sm:px-8 lg:pl-10 lg:pr-4 py-5 lg:py-7 min-h-[460px] lg:min-h-screen pointer-events-auto">
        {/* Top Part: 7 KAIH Pill and Selamat Datang Card right below it */}
        <div className="space-y-4 max-w-lg">
          {/* 7 KAIH Indicator Pill (Top Left) */}
          <div className="inline-flex items-center gap-2 bg-slate-950/40 hover:bg-slate-950/55 backdrop-blur-xl border border-white/20 text-white px-4 py-1.5 rounded-full text-xs font-bold tracking-wide shadow-[0_4px_16px_rgba(0,0,0,0.3)] ring-1 ring-white/10 transition-all">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
            <span className="text-emerald-300 font-extrabold">7 KAIH</span>
            <span className="text-white/40">•</span>
            <span className="text-slate-100 font-medium truncate max-w-[200px] sm:max-w-xs">{currentSlide.habit}</span>
          </div>

          {/* Selamat Datang di AKTIVITASKU Card (Sejajar di bawah 7 KAIH, Sangat Transparan Glossy) */}
          <div className="relative overflow-hidden bg-slate-950/20 sm:bg-slate-950/25 backdrop-blur-md border border-white/20 rounded-3xl p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.3)] ring-1 ring-white/10 transition-all">
            {/* Top Gloss Highlight */}
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none rounded-t-3xl" />

            <div className="relative space-y-3">
              {/* Badge Identitas */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold text-emerald-300">
                <span>Perguruan Budi Utomo Binjai</span>
                <span>•</span>
                <span className="text-amber-300 font-semibold">Gerakan Karakter Siswa</span>
              </div>

              {/* Title & Subtitle */}
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight drop-shadow-md">
                {config.heroTitle}
              </h1>
              <p className="text-xs sm:text-[13px] text-slate-200/95 leading-relaxed font-normal drop-shadow-sm">
                {config.heroSubtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Part: Kalimat Kutipan & Pagination Dots (Pojok Kiri Bawah, Sejajar dengan 7 KAIH di Atasnya, Sangat Transparan) */}
        <div className="pt-6 lg:pt-0 max-w-lg">
          <div className="relative overflow-hidden bg-slate-950/25 backdrop-blur-md border border-white/20 rounded-2xl p-4 sm:p-5 shadow-[0_15px_40px_rgba(0,0,0,0.3)] ring-1 ring-white/10 space-y-2">
            {/* Specular Highlight */}
            <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/15 to-transparent pointer-events-none rounded-t-2xl" />

            <p className="relative text-xs sm:text-[13px] italic text-amber-200 leading-snug drop-shadow-sm font-medium">
              "{currentSlide.quote}"
            </p>
            <div className="relative flex items-center justify-between text-[11px] text-white/90 pt-1 border-t border-white/10">
              <span className="font-bold text-emerald-300 truncate pr-2">— {currentSlide.title}</span>
              <div className="flex gap-1.5 items-center shrink-0">
                {slides.map((s, idx) => (
                  <button
                    key={s.id || idx}
                    type="button"
                    onClick={() => setActiveSlideIndex(idx)}
                    className={`h-2 rounded-full transition-all cursor-pointer ${
                      idx === activeSlideIndex
                        ? 'w-6 bg-amber-400 shadow-[0_0_10px_#fbbf24]'
                        : 'w-2 bg-white/35 hover:bg-white/80'
                    }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= CENTER-RIGHT LOGIN SECTION (TRANSPARAN DENGAN SUDUT TUMPUL - PRO GLOSSY GLASS) ================= */}
      <div className="relative z-10 flex-1 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 min-h-screen pointer-events-auto">
        <div
          className={`relative z-10 w-full max-w-[420px] rounded-[30px] sm:rounded-[34px] p-6 sm:p-8 transition-all overflow-hidden ${
            darkMode
              ? 'bg-slate-950/40 backdrop-blur-xl border border-white/20 shadow-[0_30px_70px_rgba(0,0,0,0.7)] ring-1 ring-white/15'
              : 'bg-white/30 backdrop-blur-xl border border-white/50 shadow-[0_30px_70px_rgba(0,0,0,0.35)] ring-1 ring-white/30'
          }`}
        >
          {/* Specular Glossy Sheen Highlight on Top Edge */}
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/40 dark:from-white/15 to-transparent pointer-events-none rounded-t-[30px] sm:rounded-t-[34px]" />

          {/* Logo & Application Header inside Transparent Card */}
          <div className="relative flex items-center gap-3.5 mb-6">
            <div className="flex items-center gap-2.5 shrink-0">
              <img
                src={config.logoKaihUrl || '/kaih_logo.png'}
                alt="Logo 7 KAIH"
                className="w-12 h-12 object-contain rounded-full bg-white/80 backdrop-blur-sm p-0.5 shadow-sm border border-white/60 dark:border-slate-700"
              />
              {config.logoYaspenUrl ? (
                <img
                  src={config.logoYaspenUrl}
                  alt="Logo Yayasan Budi Utomo"
                  className="w-11 h-11 object-contain rounded-full bg-white/80 backdrop-blur-sm p-0.5 shadow-sm border border-white/60 dark:border-slate-700"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col items-center justify-center text-white shadow-md border-2 border-amber-400">
                  <GraduationCap className="w-5 h-5 text-amber-300" />
                  <span className="text-[7px] font-black tracking-tighter leading-none mt-0.5">YASPEN</span>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-extrabold text-[#2563EB] dark:text-blue-400 tracking-tight leading-none drop-shadow-xs">
                AKTIVITASKU
              </h2>
              <p className={`text-[11px] mt-1 leading-snug font-bold ${darkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                Sistem Pemantauan 7 KAIH & Evaluasi Siswa
                <br />
                Perguruan Budi Utomo
              </p>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="relative mb-4 rounded-xl bg-red-500/20 backdrop-blur-md border border-red-400/40 p-3 text-xs text-red-100 font-bold leading-relaxed shadow-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="relative space-y-4">
            {/* Email / Username Field */}
            <div>
              <label className={`block text-xs font-black mb-1.5 ${darkMode ? 'text-blue-200' : 'text-slate-900'}`}>
                Email / Username <span className="text-red-500">*</span>
              </label>
              <div
                className={`flex items-center rounded-xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
                  darkMode
                    ? 'bg-slate-900/60 border-white/20 focus-within:bg-slate-900/90'
                    : 'bg-white/45 border-white/60 focus-within:bg-white/80 shadow-xs'
                }`}
              >
                <div
                  className={`w-10 h-10 flex items-center justify-center border-r shrink-0 ${
                    darkMode
                      ? 'bg-slate-800/60 border-white/10 text-slate-300'
                      : 'bg-white/50 border-white/50 text-slate-700'
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
                  className={`w-full px-3 py-2.5 text-xs sm:text-sm font-bold bg-transparent focus:outline-none select-text ${
                    darkMode ? 'text-white placeholder-slate-400' : 'text-slate-900 placeholder-slate-500'
                  }`}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className={`block text-xs font-black mb-1.5 ${darkMode ? 'text-blue-200' : 'text-slate-900'}`}>
                Password <span className="text-red-500">*</span>
              </label>
              <div
                className={`flex items-center rounded-xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
                  darkMode
                    ? 'bg-slate-900/60 border-white/20 focus-within:bg-slate-900/90'
                    : 'bg-white/45 border-white/60 focus-within:bg-white/80 shadow-xs'
                }`}
              >
                <div
                  className={`w-10 h-10 flex items-center justify-center border-r shrink-0 ${
                    darkMode
                      ? 'bg-slate-800/60 border-white/10 text-slate-300'
                      : 'bg-white/50 border-white/50 text-slate-700'
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
                  className={`w-full px-3 py-2.5 text-xs sm:text-sm font-bold bg-transparent focus:outline-none select-text ${
                    darkMode ? 'text-white placeholder-slate-400' : 'text-slate-900 placeholder-slate-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`w-10 h-10 flex items-center justify-center border-l shrink-0 cursor-pointer transition-colors ${
                    darkMode
                      ? 'bg-slate-800/60 border-white/10 text-blue-400 hover:text-blue-300'
                      : 'bg-white/50 border-white/50 text-blue-700 hover:bg-white/70'
                  }`}
                  title={showPassword ? 'Sembunyikan Password' : 'Tampilkan Password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Kode Keamanan (Captcha) Field */}
            <div>
              <label className={`block text-xs font-black mb-1.5 ${darkMode ? 'text-blue-200' : 'text-slate-900'}`}>
                Kode Keamanan <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div
                  className={`flex-1 flex items-center rounded-xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
                    darkMode ? 'bg-slate-900/60 border-white/20' : 'bg-white/50 border-white/60 shadow-xs'
                  }`}
                >
                  <div className={`pl-2.5 pr-1.5 py-2 ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                    <Shield className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="huruf/angka"
                    className={`w-full pr-2.5 py-2 text-xs sm:text-sm font-black tracking-wider bg-transparent focus:outline-none select-text ${
                      darkMode ? 'text-white placeholder-slate-400' : 'text-slate-900 placeholder-slate-500'
                    }`}
                  />
                </div>

                {/* Stylized Captcha Visual Box */}
                <div
                  className="relative h-10 px-3.5 rounded-xl border border-white/40 bg-gradient-to-r from-white/50 via-purple-100/40 to-blue-100/50 backdrop-blur-md flex items-center justify-center overflow-hidden shrink-0 shadow-xs"
                  style={{ minWidth: '100px' }}
                  title="Kode Keamanan Visual"
                >
                  <svg className="absolute inset-0 w-full h-full opacity-45 pointer-events-none" viewBox="0 0 110 44">
                    <path d="M5 10 Q 35 35, 65 12 T 105 30" stroke="#6366f1" strokeWidth="1.5" fill="none" />
                    <path d="M8 34 Q 45 8, 75 30 T 102 10" stroke="#9333ea" strokeWidth="1.2" fill="none" />
                    <circle cx="25" cy="15" r="2" fill="#4f46e5" />
                    <circle cx="55" cy="32" r="2.5" fill="#7e22ce" />
                    <circle cx="85" cy="18" r="2" fill="#2563eb" />
                  </svg>
                  <div className="relative z-10 flex items-center gap-1 font-mono text-base font-black tracking-widest text-indigo-950">
                    {captchaCode.split('').map((char, i) => (
                      <span
                        key={i}
                        style={{
                          transform: `rotate(${i % 2 === 0 ? -7 : 8}deg) translateY(${i % 2 === 0 ? -1 : 1}px)`,
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
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    darkMode
                      ? 'bg-slate-800/80 border-white/10 text-blue-400 hover:bg-slate-700'
                      : 'bg-white/60 border-white/60 text-blue-700 hover:bg-white/80 shadow-xs'
                  }`}
                  title="Acak Ulang Kode Keamanan"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className={`mt-1 text-[10px] font-semibold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                Huruf kecil dan angka saja, persis 4 karakter, tanpa spasi.
              </p>
            </div>

            {/* Links Row: Lupa Password & Info Akun */}
            <div className="flex items-center justify-center gap-2 pt-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">
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
              className="w-full py-3 px-4 rounded-xl bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 hover:scale-[1.01]"
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

      {/* ================= FAR-RIGHT PHOTO STRIP (FROSTED GLASS STRIP - Requirement 3) ================= */}
      <div className="hidden lg:flex lg:w-[94px] xl:w-[110px] h-screen flex-col gap-1.5 p-1.5 bg-slate-950/40 backdrop-blur-2xl border-l border-white/15 shrink-0 z-10">
        {slides.map((slide, idx) => {
          const isActive = idx === activeSlideIndex;
          return (
            <button
              key={slide.id || idx}
              type="button"
              onClick={() => setActiveSlideIndex(idx)}
              className={`relative flex-1 w-full rounded-xl overflow-hidden group cursor-pointer transition-all ${
                isActive
                  ? 'ring-2 ring-blue-500 shadow-lg scale-[1.02]'
                  : 'opacity-75 hover:opacity-100 ring-1 ring-white/25'
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
                  isActive ? 'bg-blue-900/10' : 'bg-slate-950/30 group-hover:bg-slate-950/10'
                }`}
              />
              <div className="absolute bottom-1 left-1 right-1 bg-slate-950/75 backdrop-blur-md border border-white/15 text-[9px] text-white font-bold px-1 py-0.5 rounded-md truncate">
                {idx + 1}. {slide.habit.replace(/Kebiasaan [^:]+:\s*/, '')}
              </div>
            </button>
          );
        })}
      </div>

      {/* MODAL: LUPA PASSWORD / PANDUAN AKUN */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-2xl rounded-3xl max-w-md w-full p-6 shadow-2xl border border-white/40 dark:border-white/15">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 flex items-center justify-center">
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
              <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-700/60 border border-slate-200/80 dark:border-slate-600 space-y-1.5">
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
