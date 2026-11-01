import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X, Bell } from 'lucide-react';
import { supabase } from '../utils/supabase';

interface Msg {
  id: string;
  student_id: string;
  sender_role: string;
  sender_name: string | null;
  kind: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

const QUICK_PINGS = [
  '🔔 Panggilan Sekolah: Segera masuk ke kelas ya, Nak.',
  '📍 Konfirmasi Lokasi: Mengapa posisimu masih di luar area sekolah?',
  '🏠 Konfirmasi Kehadiran: Apakah hari ini izin atau sakit?',
  '👏 Terima kasih sudah hadir tepat waktu, pertahankan ya!',
];

export default function MapChatDrawer({
  student,
  locationName,
  senderName,
  senderRole,
  readOnly,
  onClose,
}: {
  student: { id: string; name: string; photo_url?: string; kelas?: string };
  locationName?: string;
  senderName: string;
  senderRole: string;
  readOnly: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [asNotif, setAsNotif] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setMessages([]);
    setError('');
    (async () => {
      const { data, error: err } = await supabase
        .from('map_messages')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: true })
        .limit(200);
      if (!active) return;
      if (err) {
        setError('Tabel chat belum dibuat. Jalankan supabase/prd_v2_chat_quiz.sql di Supabase SQL Editor.');
        return;
      }
      setMessages((data as Msg[]) || []);
    })();

    const channel = supabase
      .channel(`map-chat-${student.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'map_messages', filter: `student_id=eq.${student.id}` },
        (payload: any) => {
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new as Msg]));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [student.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (body: string, kind: 'chat' | 'notif') => {
    const clean = body.trim();
    if (!clean || readOnly) return;
    setSending(true);
    setError('');
    const { data, error: err } = await supabase
      .from('map_messages')
      .insert({ student_id: student.id, sender_role: senderRole, sender_name: senderName, kind, body: clean })
      .select()
      .single();
    setSending(false);
    if (err) {
      setError('Gagal mengirim: ' + err.message);
      return;
    }
    setMessages((prev) => (prev.some((m) => m.id === (data as Msg).id) ? prev : [...prev, data as Msg]));
    setText('');
  };

  return (
    <div className="fixed bottom-4 right-4 z-[1200] w-[340px] max-w-[calc(100vw-2rem)] h-[480px] max-h-[80vh] clay-box flex flex-col overflow-hidden shadow-2xl">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {student.photo_url ? (
            <img src={student.photo_url} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-white" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-white text-emerald-700 font-black flex items-center justify-center">
              {student.name.slice(0, 1)}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{student.name}</p>
            <p className="text-[10px] text-emerald-100 truncate">
              {student.kelas ? `${student.kelas} • ` : ''}📍 {locationName || 'Lokasi terdeteksi'}
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 cursor-pointer">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#FAF8F5]">
        {messages.length === 0 && !error && (
          <p className="text-center text-[11px] text-slate-400 py-8">
            Belum ada percakapan. Kirim pesan atau notifikasi — akan muncul langsung di HP siswa.
          </p>
        )}
        {error && <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</p>}
        {messages.map((m) => {
          const mine = m.sender_role !== 'siswa';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs shadow-2xs ${
                  mine ? 'bg-emerald-600 text-white rounded-br-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                }`}
              >
                {m.kind === 'notif' && (
                  <p className={`text-[9px] font-black uppercase mb-0.5 flex items-center gap-1 ${mine ? 'text-amber-200' : 'text-amber-600'}`}>
                    <Bell size={9} /> Notifikasi
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`text-[9px] mt-0.5 ${mine ? 'text-emerald-100' : 'text-slate-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  {mine && m.read_at ? ' • Terbaca ✓✓' : ''}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {readOnly ? (
        <p className="p-3 text-center text-[11px] font-semibold text-sky-800 bg-sky-50 border-t border-sky-200">
          Mode Pemantauan: hanya dapat melihat riwayat percakapan.
        </p>
      ) : (
        <div className="p-2.5 border-t border-slate-200 bg-white space-y-1.5">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {QUICK_PINGS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={sending}
                onClick={() => send(q, 'notif')}
                className="shrink-0 max-w-[200px] truncate text-[10px] font-semibold bg-amber-50 border border-amber-200 text-amber-800 rounded-full px-2.5 py-1 hover:bg-amber-100 cursor-pointer"
                title={q}
              >
                {q}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text, asNotif ? 'notif' : 'chat');
            }}
            className="flex items-center gap-1.5"
          >
            <button
              type="button"
              onClick={() => setAsNotif(!asNotif)}
              className={`p-2 rounded-xl border cursor-pointer ${asNotif ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-400'}`}
              title={asNotif ? 'Dikirim sebagai notifikasi pop-up' : 'Dikirim sebagai chat biasa'}
            >
              {asNotif ? <Bell size={14} /> : <MessageCircle size={14} />}
            </button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={asNotif ? 'Tulis notifikasi pop-up...' : 'Tulis pesan...'}
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl bg-[#FAF8F5] focus:outline-none focus:ring-1 focus:ring-emerald-400"
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="p-2 rounded-xl bg-emerald-600 text-white disabled:opacity-40 cursor-pointer"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
