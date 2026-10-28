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
      className={`min-h-screen w-full flex flex-col lg:flex-row overflow-x-hidden select-none transition-colors duration-300 ${
        darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* ================= LEFT HERO SECTION (Ultra Glossy 7 KAIH Glassmorphism) ================= */}
      <div className="relative lg:w-[56%] xl:w-[57%] min-h-[460px] lg:min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-12 overflow-hidden">
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

        {/* Cinematic Gradient Overlays with Specular Tint */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/60 to-slate-900/30 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-slate-950/30 pointer-events-none" />

        {/* Ambient Glossy Glow Blobs on Hero */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/3 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Bar inside Hero: Glossy Habit Pill & Glossy Dark Mode Button */}
        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 bg-emerald-500/25 hover:bg-emerald-500/35 backdrop-blur-2xl border border-emerald-300/40 text-emerald-100 px-4 py-2 rounded-full text-xs font-bold tracking-wide shadow-[0_8px_25px_rgba(16,185,129,0.3)] ring-1 ring-white/20 transition-all">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#6ee7b7] animate-pulse" />
            <span>{currentSlide.habit}</span>
          </div>

          <button
            type="button"
            onClick={() => setDarkMode(!darkMode)}
            className="inline-flex items-center gap-2 bg-white/25 hover:bg-white/40 active:bg-white/50 backdrop-blur-2xl border border-white/40 text-white px-4 py-2 rounded-full shadow-[0_8px_25px_rgba(0,0,0,0.3)] ring-1 ring-white/30 text-xs font-bold transition-all cursor-pointer"
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

        {/* Center-Left Welcome Card (Ultra Glossy Glass with Specular Sheen) */}
        <div className="relative z-10 my-8 lg:my-auto max-w-xl">
          <div className="relative overflow-hidden bg-slate-950/40 backdrop-blur-2xl border border-white/30 rounded-[28px] p-7 sm:p-9 shadow-[0_25px_60px_-10px_rgba(0,0,0,0.65)] ring-1 ring-white/20">
            {/* Specular glossy highlight along top edge */}
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/25 via-white/5 to-transparent pointer-events-none" />

            <h1 className="relative text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-white tracking-tight leading-tight flex items-center gap-2.5 flex-wrap drop-shadow-md">
              <span>{config.heroTitle}</span>
            </h1>
            <p className="relative mt-3.5 text-sm sm:text-[15px] text-slate-100/95 leading-relaxed font-normal drop-shadow-sm">
              {config.heroSubtitle}
            </p>
          </div>

          {/* 3 Glossy Feature Cards */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="relative overflow-hidden bg-slate-950/40 hover:bg-slate-950/55 backdrop-blur-2xl border border-white/25 rounded-2xl p-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/15 transition-all hover:scale-[1.02] flex items-center gap-3">
              <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-xl border border-white/30 flex items-center justify-center text-white shrink-0 shadow-inner">
                <Users className="w-5 h-5 text-sky-300" />
              </div>
              <div className="text-xs sm:text-[13px] font-bold text-white leading-snug drop-shadow-sm">
                {config.feature1}
              </div>
            </div>

            <div className="relative overflow-hidden bg-slate-950/40 hover:bg-slate-950/55 backdrop-blur-2xl border border-white/25 rounded-2xl p-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/15 transition-all hover:scale-[1.02] flex items-center gap-3">
              <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-xl border border-white/30 flex items-center justify-center text-white shrink-0 shadow-inner">
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
              </div>
              <div className="text-xs sm:text-[13px] font-bold text-white leading-snug drop-shadow-sm">
                {config.feature2}
              </div>
            </div>

            <div className="relative overflow-hidden bg-slate-950/40 hover:bg-slate-950/55 backdrop-blur-2xl border border-white/25 rounded-2xl p-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/15 transition-all hover:scale-[1.02] flex items-center gap-3">
              <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
              <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-xl border border-white/30 flex items-center justify-center text-white shrink-0 shadow-inner">
                <BarChart3 className="w-5 h-5 text-amber-300" />
              </div>
              <div className="text-xs sm:text-[13px] font-bold text-white leading-snug drop-shadow-sm">
                {config.feature3}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Quote Glossy Box */}
        <div className="relative z-10 max-w-md">
          <div className="relative overflow-hidden bg-slate-950/40 backdrop-blur-2xl border border-white/25 rounded-2xl px-6 py-4 shadow-[0_15px_35px_rgba(0,0,0,0.45)] ring-1 ring-white/15">
            <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
            <p className="relative text-xs sm:text-[13px] italic text-slate-100 leading-relaxed drop-shadow-sm">
              "{currentSlide.quote}"
            </p>
            <div className="relative mt-2.5 flex items-center justify-between text-[11px] text-amber-300 font-bold">
              <span>— {currentSlide.title}</span>
              <div className="flex gap-1.5 items-center">
                {slides.map((s, idx) => (
                  <button
                    key={s.id || idx}
                    type="button"
                    onClick={() => setActiveSlideIndex(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === activeSlideIndex
                        ? 'w-6 bg-amber-400 shadow-[0_0_10px_#fbbf24]'
                        : 'w-1.5 bg-white/40 hover:bg-white/80'
                    }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= CENTER-RIGHT LOGIN SECTION ================= */}
      <div
        className={`relative flex-1 flex flex-col justify-center items-center p-5 sm:p-8 lg:p-10 min-h-screen transition-colors duration-300 ${
          darkMode
            ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
            : 'bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20'
        }`}
      >
        {/* Soft Ambient Light Glows behind the Glass Card to emphasize true glossy transparency */}
        <div className="absolute top-1/4 right-10 w-80 h-80 bg-blue-500/10 dark:bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-10 w-80 h-80 bg-purple-500/10 dark:bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* KOTAK TRANSPARAN DENGAN SUDUT TUMPUL (PRO-GLOSSY GLASS CARD) */}
        <div
          className={`relative z-10 w-full max-w-[430px] rounded-[32px] sm:rounded-[36px] p-7 sm:p-9 transition-all overflow-hidden ${
            darkMode
              ? 'bg-slate-900/75 backdrop-blur-2xl border border-white/15 shadow-[0_30px_70px_-15px_rgba(0,0,0,0.7)] ring-1 ring-white/10'
              : 'bg-white/80 backdrop-blur-2xl border border-white/90 shadow-[0_25px_65px_-12px_rgba(37,99,235,0.14),0_10px_30px_-5px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/5'
          }`}
        >
          {/* Specular Glossy Sheen Highlight on Top Edge */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/60 dark:from-white/10 to-transparent pointer-events-none rounded-t-[32px] sm:rounded-t-[36px]" />

          {/* Logo & Application Header inside Transparent Card */}
          <div className="relative flex items-center gap-3.5 mb-7">
            <div className="flex items-center gap-2.5 shrink-0">
              <img
                src={config.logoKaihUrl || '/kaih_logo.png'}
                alt="Logo 7 KAIH"
                className="w-13 h-13 object-contain rounded-full bg-white/90 backdrop-blur-sm p-0.5 shadow-sm border border-slate-100 dark:border-slate-700"
              />
              {config.logoYaspenUrl ? (
                <img
                  src={config.logoYaspenUrl}
                  alt="Logo Yayasan Budi Utomo"
                  className="w-12 h-12 object-contain rounded-full bg-white/90 backdrop-blur-sm p-0.5 shadow-sm border border-slate-100 dark:border-slate-700"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex flex-col items-center justify-center text-white shadow-md border-2 border-amber-400">
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
            <div className="relative mb-5 rounded-2xl bg-red-50/90 dark:bg-red-950/70 backdrop-blur-sm border border-red-200 dark:border-red-800/80 p-3.5 text-xs text-red-700 dark:text-red-300 font-medium leading-relaxed shadow-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="relative space-y-4">
            {/* Email / Username Field */}
            <div>
              <label className={`block text-xs font-bold mb-1.5 ${darkMode ? 'text-blue-300' : 'text-[#1E3A8A]'}`}>
                Email / Username <span className="text-red-500">*</span>
              </label>
              <div
                className={`flex items-center rounded-2xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
                  darkMode
                    ? 'bg-slate-800/80 border-slate-700/80 focus-within:bg-slate-800'
                    : 'bg-[#EEF4FF]/75 border-slate-200/90 focus-within:bg-white shadow-inner'
                }`}
              >
                <div
                  className={`w-11 h-11 flex items-center justify-center border-r shrink-0 ${
                    darkMode
                      ? 'bg-slate-800/90 border-slate-700 text-slate-300'
                      : 'bg-white/80 border-slate-200/80 text-slate-500'
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
                className={`flex items-center rounded-2xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
                  darkMode
                    ? 'bg-slate-800/80 border-slate-700/80 focus-within:bg-slate-800'
                    : 'bg-[#EEF4FF]/75 border-slate-200/90 focus-within:bg-white shadow-inner'
                }`}
              >
                <div
                  className={`w-11 h-11 flex items-center justify-center border-r shrink-0 ${
                    darkMode
                      ? 'bg-slate-800/90 border-slate-700 text-slate-300'
                      : 'bg-white/80 border-slate-200/80 text-slate-500'
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
                      ? 'bg-slate-800/90 border-slate-700 text-blue-400 hover:text-blue-300'
                      : 'bg-white/80 border-slate-200/80 text-blue-600 hover:bg-slate-50'
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
                  className={`flex-1 flex items-center rounded-2xl border overflow-hidden transition-all focus-within:ring-2 focus-within:ring-blue-500 ${
                    darkMode ? 'bg-slate-800/80 border-slate-700' : 'bg-white/90 border-slate-200 shadow-inner'
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
                  className="relative h-11 px-4 rounded-2xl border border-indigo-200/80 bg-gradient-to-r from-indigo-100/80 via-purple-100/80 to-blue-100/80 backdrop-blur-sm flex items-center justify-center overflow-hidden shrink-0 shadow-inner"
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
                  className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                    darkMode
                      ? 'bg-slate-800 border-slate-700 text-blue-400 hover:bg-slate-700'
                      : 'bg-white/90 border-blue-200 text-blue-600 hover:bg-blue-50 shadow-xs'
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
              className="w-full py-3.5 px-4 rounded-2xl bg-[#2563EB] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60 hover:scale-[1.01]"
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

      {/* ================= FAR-RIGHT PHOTO STRIP ================= */}
      <div
        className={`hidden lg:flex lg:w-[98px] xl:w-[120px] h-screen flex-col gap-1.5 p-2 border-l shrink-0 transition-colors ${
          darkMode
            ? 'bg-slate-900/60 backdrop-blur-2xl border-white/10'
            : 'bg-white/70 backdrop-blur-2xl border-slate-200/80'
        }`}
      >
        {slides.map((slide, idx) => {
          const isActive = idx === activeSlideIndex;
          return (
            <button
              key={slide.id || idx}
              type="button"
              onClick={() => setActiveSlideIndex(idx)}
              className={`relative flex-1 w-full rounded-2xl overflow-hidden group cursor-pointer transition-all ${
                isActive
                  ? 'ring-2 ring-blue-600 shadow-lg scale-[1.02]'
                  : 'opacity-80 hover:opacity-100 ring-1 ring-white/30'
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
              <div className="absolute bottom-1 left-1 right-1 bg-slate-950/75 backdrop-blur-md border border-white/15 text-[9px] text-white font-bold px-1.5 py-0.5 rounded-lg truncate">
                {idx + 1}. {slide.habit.replace(/Kebiasaan [^:]+:\s*/, '')}
              </div>
            </button>
          );
        })}
      </div>

      {/* MODAL: LUPA PASSWORD / PANDUAN AKUN */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4">
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
