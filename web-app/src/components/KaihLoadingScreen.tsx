import React from 'react';

interface KaihLoadingScreenProps {
  message?: string;
  subMessage?: string;
}

export const KaihLoadingScreen: React.FC<KaihLoadingScreenProps> = ({
  message = 'Memuat Sesi Portal 7 KAIH...',
  subMessage = 'Sinkronisasi data aktivitas & absensi siswa',
}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF7F2] font-sans p-4 select-none animate-in fade-in duration-300">
      {/* Logo Container with Ambient Glow & Animated Rings */}
      <div className="relative flex items-center justify-center mb-6">
        {/* Ambient Pulsing Glow */}
        <div className="absolute w-32 h-32 rounded-full bg-emerald-500/15 blur-xl animate-pulse pointer-events-none" />
        <div className="absolute w-28 h-28 rounded-full bg-amber-500/15 blur-lg animate-pulse delay-150 pointer-events-none" />

        {/* Rotating Dual-Tone Spinner Ring */}
        <div className="absolute w-28 h-28 rounded-full border-3 border-transparent border-t-emerald-600 border-r-teal-500 border-b-amber-500 animate-spin" />

        {/* Glossy Clay Logo Card */}
        <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl bg-white p-3 shadow-xl border border-white/80 flex items-center justify-center transform hover:scale-105 transition-transform duration-300">
          <img
            src="/kaih_logo.png"
            alt="Logo 7 KAIH"
            className="w-full h-full object-contain filter drop-shadow-sm"
          />
        </div>
      </div>

      {/* Typography & Status Indicator */}
      <div className="text-center space-y-1.5 max-w-sm px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/90 border border-[#ECE7DE] shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="text-[11px] font-black tracking-wider text-slate-800 uppercase">
            <span className="text-emerald-700">AKTIVITASKU</span>
            <span className="text-slate-300 mx-1.5">•</span>
            <span className="text-amber-600">7 KAIH</span>
          </span>
        </div>

        <h3 className="text-sm sm:text-base font-bold text-slate-800 pt-1">
          {message}
        </h3>

        {subMessage && (
          <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
            {subMessage}
          </p>
        )}

        <p className="text-[10px] text-slate-400 font-semibold tracking-wide pt-1">
          Perguruan Budi Utomo Binjai
        </p>
      </div>
    </div>
  );
};

export default KaihLoadingScreen;
