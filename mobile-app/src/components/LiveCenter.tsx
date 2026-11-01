import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { supabase } from '../utils/supabase';
import { getUserStudentProfile } from '../utils/userCache';

interface Question { q: string; options: string[]; answer: number; explanation?: string }
interface Quiz {
  id: string; title: string; target_class: string; per_question_seconds: number; total_seconds: number | null;
  shuffle_questions: boolean; speed_bonus: boolean; questions: Question[]; status: string; host_name?: string | null;
}
interface Msg { id: string; sender_role: string; sender_name: string | null; kind: string; body: string; created_at: string }

const shuffleArr = <T,>(a: T[]) => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
};

/**
 * Pusat notifikasi realtime siswa:
 *  - Pop-up pesan/notifikasi dari guru (Peta Sebaran) + balas pesan
 *  - Undangan & arena Kuis Live dari guru
 */
export default function LiveCenter() {
  const [student, setStudent] = useState<{ id: string; name: string; kelas: string } | null>(null);
  const [incoming, setIncoming] = useState<Msg | null>(null);
  const [reply, setReply] = useState('');
  const [invite, setInvite] = useState<Quiz | null>(null);
  const [playing, setPlaying] = useState<Quiz | null>(null);
  const seenQuiz = useRef<Set<string>>(new Set());

  // ---- game state
  const [qs, setQs] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(0);
  const [done, setDone] = useState(false);
  const endAt = useRef(0);
  const totalEndAt = useRef(0);

  const loadIdentity = useCallback(async (force = false) => {
    try {
      const data = await getUserStudentProfile(force);
      if (!data?.student) { setStudent(null); return; }
      let kelas = '';
      try { kelas = JSON.parse(data.student.notes || '{}').kelas || ''; } catch {}
      setStudent({ id: data.student.id, name: data.profile?.full_name || 'Siswa', kelas });
    } catch { setStudent(null); }
  }, []);

  useEffect(() => {
    loadIdentity();
    const { data: sub } = supabase.auth.onAuthStateChange((event: string) => {
      if (event === 'SIGNED_OUT') { setStudent(null); setIncoming(null); setInvite(null); setPlaying(null); }
      if (event === 'SIGNED_IN') loadIdentity(true);
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [loadIdentity]);

  // ---- pesan realtime
  useEffect(() => {
    if (!student) return;
    const show = async (m: Msg) => {
      if (m.sender_role === 'siswa') return;
      setIncoming(m);
      supabase.from('map_messages').update({ read_at: new Date().toISOString() }).eq('id', m.id).then(() => {});
      try {
        await Notifications.scheduleNotificationAsync({
          content: { title: m.kind === 'notif' ? '🔔 Notifikasi dari Guru' : `💬 ${m.sender_name || 'Guru'}`, body: m.body },
          trigger: null,
        });
      } catch {}
    };
    (async () => {
      const { data } = await supabase.from('map_messages').select('*').eq('student_id', student.id)
        .is('read_at', null).neq('sender_role', 'siswa').order('created_at', { ascending: false }).limit(1);
      if (data && data[0]) show(data[0]);
    })();
    const ch = supabase.channel(`student-msg-${student.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'map_messages', filter: `student_id=eq.${student.id}` },
        (p: any) => show(p.new as Msg))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [student]);

  // ---- kuis live
  const checkQuizzes = useCallback(async () => {
    if (!student) return;
    const { data } = await supabase.from('quizzes').select('*').eq('status', 'LIVE');
    if (!data) return;
    for (const q of data as Quiz[]) {
      if (q.target_class !== 'SEMUA' && q.target_class !== student.kelas) continue;
      if (seenQuiz.current.has(q.id)) continue;
      const { data: done } = await supabase.from('quiz_submissions').select('id').eq('quiz_id', q.id).eq('student_id', student.id).maybeSingle();
      if (done) { seenQuiz.current.add(q.id); continue; }
      seenQuiz.current.add(q.id);
      setInvite(q);
      try { await Notifications.scheduleNotificationAsync({ content: { title: '🎮 Kuis Live Dimulai!', body: `${q.title} — ayo bergabung sekarang!` }, trigger: null }); } catch {}
      break;
    }
  }, [student]);

  useEffect(() => {
    if (!student) return;
    checkQuizzes();
    const ch = supabase.channel(`student-quiz-${student.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, () => checkQuizzes())
      .subscribe();
    const poll = setInterval(checkQuizzes, 15000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); };
  }, [student, checkQuizzes]);

  const sendReply = async () => {
    if (!student || !reply.trim()) return;
    await supabase.from('map_messages').insert({ student_id: student.id, sender_role: 'siswa', sender_name: student.name, kind: 'chat', body: reply.trim() });
    setReply(''); setIncoming(null);
  };

  // ---- game logic
  const questionLimit = (quiz: Quiz) => {
    if (quiz.total_seconds) return Math.max(1, Math.round((totalEndAt.current - Date.now()) / 1000));
    return quiz.per_question_seconds || 20;
  };

  const startQuiz = (quiz: Quiz) => {
    const list = quiz.shuffle_questions ? shuffleArr(quiz.questions) : quiz.questions;
    setQs(list); setIdx(0); setScore(0); setCorrect(0); setPicked(null); setDone(false);
    if (quiz.total_seconds) totalEndAt.current = Date.now() + quiz.total_seconds * 1000;
    endAt.current = Date.now() + questionLimit(quiz) * 1000;
    setLeft(questionLimit(quiz));
    setInvite(null); setPlaying(quiz);
  };

  const finish = useCallback(async (finalScore: number, finalCorrect: number, quiz: Quiz, total: number) => {
    setDone(true);
    if (!student) return;
    await supabase.from('quiz_submissions').upsert({
      quiz_id: quiz.id, student_id: student.id, student_name: student.name, kelas: student.kelas,
      score: finalScore, correct_count: finalCorrect, total_count: total,
    }, { onConflict: 'quiz_id,student_id' });
  }, [student]);

  const advance = useCallback((newScore: number, newCorrect: number) => {
    if (!playing) return;
    const nextIdx = idx + 1;
    const timeUp = playing.total_seconds ? Date.now() >= totalEndAt.current : false;
    if (nextIdx >= qs.length || timeUp) { finish(newScore, newCorrect, playing, qs.length); return; }
    setIdx(nextIdx); setPicked(null);
    const lim = questionLimit(playing);
    endAt.current = Date.now() + lim * 1000; setLeft(lim);
  }, [playing, idx, qs.length, finish]);

  const answer = (choice: number | null) => {
    if (!playing || picked !== null || done) return;
    const q = qs[idx];
    const isRight = choice !== null && choice === q.answer;
    const limit = playing.total_seconds ? Math.max(1, left + 1) : (playing.per_question_seconds || 20);
    const gained = isRight ? 500 + (playing.speed_bonus ? Math.round(500 * Math.max(0, left) / limit) : 500) : 0;
    const ns = score + gained, nc = correct + (isRight ? 1 : 0);
    setPicked(choice ?? -1); setScore(ns); setCorrect(nc);
    setTimeout(() => advance(ns, nc), q.explanation ? 1800 : 1000);
  };

  useEffect(() => {
    if (!playing || done || picked !== null) return;
    const t = setInterval(() => {
      const rem = Math.ceil((endAt.current - Date.now()) / 1000);
      setLeft(Math.max(0, rem));
      if (rem <= 0) answer(null);
    }, 250);
    return () => clearInterval(t);
  });

  const q = playing && qs[idx];

  return (
    <>
      {/* Pesan / notifikasi dari guru */}
      <Modal visible={!!incoming} transparent animationType="slide" onRequestClose={() => setIncoming(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={st.overlay}>
          <View style={st.card}>
            <Text style={st.badge}>{incoming?.kind === 'notif' ? '🔔 NOTIFIKASI DARI GURU' : '💬 PESAN DARI GURU'}</Text>
            <Text style={st.sender}>{incoming?.sender_name || 'Guru'}</Text>
            <Text style={st.body}>{incoming?.body}</Text>
            <TextInput value={reply} onChangeText={setReply} placeholder="Balas pesan..." placeholderTextColor="#94a3b8" style={st.input} />
            <View style={st.row}>
              <TouchableOpacity style={[st.btn, st.btnGhost]} onPress={() => setIncoming(null)}><Text style={st.btnGhostText}>Tutup</Text></TouchableOpacity>
              <TouchableOpacity style={[st.btn, { opacity: reply.trim() ? 1 : 0.5 }]} disabled={!reply.trim()} onPress={sendReply}><Text style={st.btnText}>Kirim Balasan</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Undangan kuis */}
      <Modal visible={!!invite} transparent animationType="fade" onRequestClose={() => setInvite(null)}>
        <View style={st.overlay}>
          <View style={st.card}>
            <Text style={{ fontSize: 40, textAlign: 'center' }}>🎮</Text>
            <Text style={[st.sender, { textAlign: 'center', fontSize: 18 }]}>Kuis Live Dimulai!</Text>
            <Text style={[st.body, { textAlign: 'center' }]}>{invite?.title}</Text>
            <Text style={{ textAlign: 'center', color: '#64748b', fontSize: 12, marginBottom: 12 }}>
              {invite?.questions.length} soal • {invite?.total_seconds ? `${Math.round(invite.total_seconds / 60)} menit total` : `${invite?.per_question_seconds} dtk/soal`}
              {invite?.host_name ? ` • oleh ${invite.host_name}` : ''}
            </Text>
            <View style={st.row}>
              <TouchableOpacity style={[st.btn, st.btnGhost]} onPress={() => setInvite(null)}><Text style={st.btnGhostText}>Nanti</Text></TouchableOpacity>
              <TouchableOpacity style={st.btn} onPress={() => invite && startQuiz(invite)}><Text style={st.btnText}>Gabung Sekarang</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Arena kuis */}
      <Modal visible={!!playing} animationType="slide" onRequestClose={() => {}}>
        <View style={st.arena}>
          {!done && q ? (
            <>
              <View style={st.topbar}>
                <Text style={st.topText}>Soal {idx + 1}/{qs.length}</Text>
                <Text style={st.topText}>⭐ {score}</Text>
                <Text style={[st.topText, left <= 5 && { color: '#fca5a5' }]}>⏱ {left}s</Text>
              </View>
              <View style={st.timerTrack}>
                <View style={[st.timerFill, { width: `${Math.min(100, (left / Math.max(1, playing!.total_seconds ? left || 1 : playing!.per_question_seconds)) * 100)}%` }]} />
              </View>
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Text style={st.question}>{q.q}</Text>
                {q.options.map((o, i) => {
                  const showRes = picked !== null;
                  const right = i === q.answer;
                  const bg = showRes ? (right ? '#16a34a' : picked === i ? '#dc2626' : '#334155') : ['#2563eb', '#7c3aed', '#d97706', '#db2777'][i % 4];
                  return (
                    <TouchableOpacity key={i} disabled={showRes} onPress={() => answer(i)} style={[st.option, { backgroundColor: bg }]}>
                      <Text style={st.optionText}>{String.fromCharCode(65 + i)}. {o}</Text>
                    </TouchableOpacity>
                  );
                })}
                {picked !== null && (
                  <Text style={st.feedback}>
                    {picked === q.answer ? '✅ Benar! Pertahankan 🔥' : picked === -1 ? '⏰ Waktu habis' : '❌ Kurang tepat, tetap semangat!'}
                    {q.explanation ? `\n${q.explanation}` : ''}
                  </Text>
                )}
              </ScrollView>
            </>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
              <Text style={{ fontSize: 56, textAlign: 'center' }}>🏆</Text>
              <Text style={[st.question, { textAlign: 'center' }]}>Kuis Selesai!</Text>
              <Text style={st.resultScore}>{score}</Text>
              <Text style={{ color: '#cbd5e1', textAlign: 'center', marginBottom: 24 }}>
                {correct} dari {qs.length} jawaban benar • Akurasi {qs.length ? Math.round((correct / qs.length) * 100) : 0}%
              </Text>
              <TouchableOpacity style={st.btn} onPress={() => setPlaying(null)}><Text style={st.btnText}>Selesai</Text></TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#ffffff', borderRadius: 20, padding: 20 },
  badge: { fontSize: 11, fontWeight: '800', color: '#b45309', marginBottom: 4 },
  sender: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  body: { fontSize: 14, color: '#1e293b', marginBottom: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: '#0f172a', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' },
  btnGhost: { backgroundColor: '#f1f5f9' },
  btnGhostText: { color: '#334155', fontWeight: '700' },
  arena: { flex: 1, backgroundColor: '#0f172a', paddingTop: 40 },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  topText: { color: '#e2e8f0', fontWeight: '800', fontSize: 14 },
  timerTrack: { height: 6, backgroundColor: '#1e293b', marginHorizontal: 20, borderRadius: 3, overflow: 'hidden' },
  timerFill: { height: 6, backgroundColor: '#22c55e' },
  question: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 20, lineHeight: 28 },
  option: { borderRadius: 14, padding: 16, marginBottom: 10 },
  optionText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  feedback: { color: '#e2e8f0', marginTop: 8, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  resultScore: { color: '#fbbf24', fontSize: 64, fontWeight: '900', textAlign: 'center', marginVertical: 8 },
});
