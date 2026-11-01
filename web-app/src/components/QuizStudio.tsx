import { useCallback, useEffect, useState } from 'react';
import { Gamepad2, Play, Square, Trash2, Plus, Trophy, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from '../utils/supabase';

type Kind = 'pilihan_ganda' | 'benar_salah' | 'studi_kasus';
interface Question { q: string; options: string[]; answer: number; explanation?: string }
interface Quiz {
  id: string; title: string; category: string; kind: Kind; target_class: string;
  per_question_seconds: number; total_seconds: number | null; shuffle_questions: boolean; speed_bonus: boolean;
  questions: Question[]; status: 'DRAFT' | 'LIVE' | 'ENDED'; host_name: string | null; created_at: string;
}
interface Submission { id: string; quiz_id: string; student_id: string; student_name: string; kelas: string; score: number; correct_count: number; total_count: number }

const TEMPLATES: Record<string, Question[]> = {
  'Karakter 7 KAIH': [
    { q: 'Apa manfaat utama bangun pagi bagi pelajar?', options: ['Melatih disiplin & siap belajar', 'Bisa bermain lebih lama', 'Tidak perlu sarapan', 'Terlambat ke sekolah'], answer: 0, explanation: 'Bangun pagi melatih disiplin dan kesiapan mental.' },
    { q: 'Waktu tidur yang ideal bagi pelajar adalah sebelum pukul…', options: ['22.00', '01.00', '24.00', '03.00'], answer: 0, explanation: 'Tidur cukup memulihkan energi dan memori otak.' },
    { q: 'Manakah contoh makan sehat dan bergizi?', options: ['Nasi, lauk, sayur, buah', 'Hanya mi instan', 'Hanya gorengan', 'Hanya minuman manis'], answer: 0, explanation: 'Gizi seimbang menopang konsentrasi belajar.' },
    { q: 'Gotong royong membersihkan lingkungan termasuk kebiasaan…', options: ['Bermasyarakat', 'Tidur tepat waktu', 'Berolahraga', 'Bangun pagi'], answer: 0, explanation: 'Bermasyarakat melatih empati dan kepedulian.' },
    { q: 'Berolahraga secara teratur bermanfaat untuk…', options: ['Kebugaran & fokus belajar', 'Membuat mudah sakit', 'Mengurangi semangat', 'Menambah malas'], answer: 0, explanation: 'Olahraga menjaga kebugaran fisik dan fokus.' },
  ],
  'Akademik Umum': [
    { q: 'Ibu kota negara Indonesia adalah…', options: ['Jakarta', 'Bandung', 'Medan', 'Surabaya'], answer: 0 },
    { q: '12 × 8 = …', options: ['96', '86', '108', '88'], answer: 0 },
    { q: 'Planet terdekat dengan Matahari adalah…', options: ['Merkurius', 'Venus', 'Mars', 'Bumi'], answer: 0 },
  ],
};

const blankQuestion = (kind: Kind): Question =>
  kind === 'benar_salah'
    ? { q: '', options: ['Benar', 'Salah'], answer: 0, explanation: '' }
    : { q: '', options: ['', '', '', ''], answer: 0, explanation: '' };

export default function QuizStudio({
  hostName, classes, readOnly,
}: { hostName: string; classes: string[]; readOnly: boolean }) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [subs, setSubs] = useState<Record<string, Submission[]>>({});
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [openResult, setOpenResult] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Karakter 7 KAIH');
  const [kind, setKind] = useState<Kind>('pilihan_ganda');
  const [targetClass, setTargetClass] = useState('SEMUA');
  const [timerMode, setTimerMode] = useState<'per' | 'total'>('per');
  const [perSec, setPerSec] = useState(20);
  const [totalMin, setTotalMin] = useState(10);
  const [shuffle, setShuffle] = useState(true);
  const [speedBonus, setSpeedBonus] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([blankQuestion('pilihan_ganda')]);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('quizzes').select('*').order('created_at', { ascending: false }).limit(50);
    if (err) {
      setError('Tabel kuis belum dibuat. Jalankan supabase/prd_v2_chat_quiz.sql di Supabase SQL Editor.');
      return;
    }
    setError('');
    setQuizzes((data as Quiz[]) || []);
    const ids = ((data as Quiz[]) || []).map((q) => q.id);
    if (ids.length) {
      const { data: sdata } = await supabase.from('quiz_submissions').select('*').in('quiz_id', ids);
      const map: Record<string, Submission[]> = {};
      ((sdata as Submission[]) || []).forEach((s) => { (map[s.quiz_id] ||= []).push(s); });
      Object.values(map).forEach((arr) => arr.sort((a, b) => b.score - a.score));
      setSubs(map);
    }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('quiz-studio')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_submissions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const changeKind = (k: Kind) => {
    setKind(k);
    setQuestions((prev) => prev.map((q) => {
      const b = blankQuestion(k);
      return { ...b, q: q.q, explanation: q.explanation };
    }));
  };

  const loadTemplate = () => {
    const tpl = TEMPLATES[category];
    if (!tpl) { alert('Belum ada paket contoh untuk kategori ini.'); return; }
    setKind('pilihan_ganda');
    setQuestions(tpl.map((q) => ({ ...q, options: [...q.options] })));
    if (!title) setTitle(`Kuis ${category}`);
  };

  const save = async () => {
    const cleaned = questions.filter((q) => q.q.trim() && q.options.every((o) => o.trim()));
    if (!title.trim()) return alert('Judul kuis wajib diisi.');
    if (cleaned.length === 0) return alert('Minimal 1 soal lengkap (pertanyaan & semua opsi terisi).');
    const { error: err } = await supabase.from('quizzes').insert({
      title: title.trim(), category, kind, target_class: targetClass,
      per_question_seconds: perSec, total_seconds: timerMode === 'total' ? totalMin * 60 : null,
      shuffle_questions: shuffle, speed_bonus: speedBonus, questions: cleaned, status: 'DRAFT', host_name: hostName,
    });
    if (err) return alert('Gagal menyimpan kuis: ' + err.message);
    setCreating(false); setTitle(''); setQuestions([blankQuestion('pilihan_ganda')]); setKind('pilihan_ganda');
    load();
  };

  const setStatus = async (q: Quiz, status: 'LIVE' | 'ENDED') => {
    const patch: any = { status };
    if (status === 'LIVE') patch.started_at = new Date().toISOString();
    else patch.ended_at = new Date().toISOString();
    const { error: err } = await supabase.from('quizzes').update(patch).eq('id', q.id);
    if (err) return alert('Gagal mengubah status: ' + err.message);
    load();
  };

  const remove = async (q: Quiz) => {
    if (!confirm(`Hapus kuis "${q.title}" beserta seluruh skornya?`)) return;
    await supabase.from('quizzes').delete().eq('id', q.id);
    load();
  };

  const badge = (s: string) =>
    s === 'LIVE' ? 'bg-rose-100 text-rose-700 border-rose-200 animate-pulse' : s === 'ENDED' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <section className="space-y-4">
      <div className="clay-box p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
            <Gamepad2 size={18} className="text-emerald-600" /> KAIH Quiz Arena
          </h3>
          <p className="text-[11px] text-slate-500">Buat kuis, tekan Mulai — otomatis muncul di HP siswa kelas target. Skor tampil realtime.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="clay-btn-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"><RefreshCw size={12} /> Muat Ulang</button>
          {!readOnly && (
            <button onClick={() => setCreating(!creating)} className="clay-btn-coral px-4 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer">
              <Plus size={13} /> {creating ? 'Tutup Form' : 'Buat Kuis Baru'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}

      {creating && !readOnly && (
        <div className="clay-box p-4 sm:p-5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-[10px] font-bold uppercase text-slate-500 md:col-span-3">Judul Kuis
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Kuis Disiplin Pagi"
                className="mt-1 w-full px-3 py-2 text-xs font-medium normal-case border border-[#E5E0D5] rounded-xl bg-[#FAF8F5]" />
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">Kategori
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full px-2 py-2 text-xs font-semibold normal-case border border-[#E5E0D5] rounded-xl bg-white">
                {['Karakter 7 KAIH', 'Akademik Umum', 'Logika & Numerasi', 'Literasi', 'Agama & Budi Pekerti'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">Jenis Kuis
              <select value={kind} onChange={(e) => changeKind(e.target.value as Kind)} className="mt-1 w-full px-2 py-2 text-xs font-semibold normal-case border border-[#E5E0D5] rounded-xl bg-white">
                <option value="pilihan_ganda">Pilihan Ganda (4 opsi)</option>
                <option value="benar_salah">Benar / Salah</option>
                <option value="studi_kasus">Studi Kasus Karakter</option>
              </select>
            </label>
            <label className="text-[10px] font-bold uppercase text-slate-500">Target Kelas
              <select value={targetClass} onChange={(e) => setTargetClass(e.target.value)} className="mt-1 w-full px-2 py-2 text-xs font-semibold normal-case border border-[#E5E0D5] rounded-xl bg-white">
                <option value="SEMUA">Semua Kelas</option>
                {classes.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-700">
            <span className="text-[10px] font-bold uppercase text-slate-500">Waktu:</span>
            <select value={timerMode} onChange={(e) => setTimerMode(e.target.value as any)} className="px-2 py-1.5 border border-[#E5E0D5] rounded-xl bg-white">
              <option value="per">Per soal</option><option value="total">Total durasi</option>
            </select>
            {timerMode === 'per' ? (
              <select value={perSec} onChange={(e) => setPerSec(+e.target.value)} className="px-2 py-1.5 border border-[#E5E0D5] rounded-xl bg-white">
                {[10, 20, 30, 60].map((n) => <option key={n} value={n}>{n} detik / soal</option>)}
              </select>
            ) : (
              <select value={totalMin} onChange={(e) => setTotalMin(+e.target.value)} className="px-2 py-1.5 border border-[#E5E0D5] rounded-xl bg-white">
                {[5, 10, 15].map((n) => <option key={n} value={n}>{n} menit total</option>)}
              </select>
            )}
            <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={shuffle} onChange={(e) => setShuffle(e.target.checked)} /> Acak soal</label>
            <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={speedBonus} onChange={(e) => setSpeedBonus(e.target.checked)} /> Bonus kecepatan</label>
            <button type="button" onClick={loadTemplate} className="ml-auto clay-btn-white px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer text-emerald-800">
              <Sparkles size={12} /> Pakai Paket Soal Contoh
            </button>
          </div>

          <div className="space-y-2.5">
            {questions.map((q, qi) => (
              <div key={qi} className="clay-box-sm p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-emerald-700">#{qi + 1}</span>
                  <input value={q.q} onChange={(e) => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, q: e.target.value } : x))}
                    placeholder={kind === 'studi_kasus' ? 'Tulis situasi/kasus...' : 'Tulis pertanyaan...'}
                    className="flex-1 px-3 py-1.5 text-xs border border-[#E5E0D5] rounded-xl bg-[#FAF8F5]" />
                  {questions.length > 1 && (
                    <button onClick={() => setQuestions((p) => p.filter((_, i) => i !== qi))} className="text-rose-500 cursor-pointer"><Trash2 size={14} /></button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {q.options.map((o, oi) => (
                    <label key={oi} className={`flex items-center gap-1.5 px-2 py-1 border rounded-xl text-xs ${q.answer === oi ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                      <input type="radio" name={`ans-${qi}`} checked={q.answer === oi} onChange={() => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, answer: oi } : x))} />
                      <input value={o} disabled={kind === 'benar_salah'}
                        onChange={(e) => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, options: x.options.map((oo, j) => j === oi ? e.target.value : oo) } : x))}
                        placeholder={`Opsi ${String.fromCharCode(65 + oi)}`} className="flex-1 bg-transparent focus:outline-none" />
                    </label>
                  ))}
                </div>
                <input value={q.explanation || ''} onChange={(e) => setQuestions((p) => p.map((x, i) => i === qi ? { ...x, explanation: e.target.value } : x))}
                  placeholder="Penjelasan / makna jawaban (opsional, tampil di HP siswa)" className="w-full px-3 py-1.5 text-[11px] border border-[#E5E0D5] rounded-xl bg-[#FAF8F5]" />
              </div>
            ))}
            <button onClick={() => setQuestions((p) => [...p, blankQuestion(kind)])} className="clay-btn-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"><Plus size={12} /> Tambah Soal</button>
          </div>

          <div className="flex justify-end">
            <button onClick={save} className="clay-btn-coral px-6 py-2 rounded-2xl text-xs font-bold cursor-pointer">Simpan Kuis</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {quizzes.length === 0 && !error && <p className="clay-box p-6 text-center text-xs text-slate-400 lg:col-span-2">Belum ada kuis. Klik “Buat Kuis Baru”.</p>}
        {quizzes.map((q) => {
          const list = subs[q.id] || [];
          return (
            <div key={q.id} className="clay-box p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{q.title}</p>
                  <p className="text-[10px] text-slate-500">
                    {q.category} • {q.questions.length} soal • {q.kind.replace('_', ' ')} • {q.target_class === 'SEMUA' ? 'Semua kelas' : q.target_class} •{' '}
                    {q.total_seconds ? `${Math.round(q.total_seconds / 60)} mnt total` : `${q.per_question_seconds} dtk/soal`}
                  </p>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0 ${badge(q.status)}`}>{q.status === 'LIVE' ? '● LIVE' : q.status}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {!readOnly && q.status !== 'LIVE' && (
                  <button onClick={() => setStatus(q, 'LIVE')} className="clay-btn-coral px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"><Play size={11} /> {q.status === 'ENDED' ? 'Mulai Ulang' : 'Mulai Kuis'}</button>
                )}
                {!readOnly && q.status === 'LIVE' && (
                  <button onClick={() => setStatus(q, 'ENDED')} className="px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 bg-rose-600 text-white cursor-pointer"><Square size={11} /> Akhiri</button>
                )}
                <button onClick={() => setOpenResult(openResult === q.id ? null : q.id)} className="clay-btn-white px-3 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"><Trophy size={11} className="text-amber-500" /> Skor ({list.length})</button>
                {!readOnly && <button onClick={() => remove(q)} className="ml-auto text-rose-500 cursor-pointer"><Trash2 size={14} /></button>}
              </div>
              {openResult === q.id && (
                <div className="border-t border-slate-100 pt-2 space-y-1">
                  {list.length === 0 && <p className="text-[11px] text-slate-400">Belum ada siswa yang menyelesaikan.</p>}
                  {list.map((s, i) => (
                    <div key={s.id} className="flex items-center justify-between text-xs bg-[#FAF8F5] rounded-lg px-2.5 py-1">
                      <span className="font-semibold text-slate-800 truncate">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`} {s.student_name} <span className="text-slate-400 font-normal">{s.kelas}</span></span>
                      <span className="font-black text-emerald-700 shrink-0">{s.score} <span className="text-[10px] text-slate-400 font-normal">({s.correct_count}/{s.total_count})</span></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
