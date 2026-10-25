import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StatusBar,
  Image,
  Modal,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme/colors';
import { WebView } from 'react-native-webview';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { getUserStudentProfile } from '../../utils/userCache';
import kaihLogoAsset from '../../../assets/kaih_logo.png';
import { KaihLoadingScreen } from '../../components/KaihLoadingLogo';
import { parseAndDeduplicateActivities } from '../../utils/kaihPlanUtils';

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu', 'Minggu'];
const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function LaporanWeeklyScreen() {
  const { colors, isDark } = useTheme();

  // Date selection state for week range
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Student & Parent Metadata
  const [parentName, setParentName] = useState('Anton');
  const [studentName, setStudentName] = useState('Budi Utomo');
  const [studentNisn, setStudentNisn] = useState('0012345678');
  const [className, setClassName] = useState('Kelas X - SMA Budi Utomo');
  const [activities, setActivities] = useState<any[]>([]);

  // Parent hopes text & digital signature state
  const [parentHopes, setParentHopes] = useState('');
  const [confirmPrintModalVisible, setConfirmPrintModalVisible] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [sigModalVisible, setSigModalVisible] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const webViewRef = useRef<WebView>(null);

  // Calculate Start of Week (Monday) and End of Week (Sunday)
  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  const startOfWeek = getStartOfWeek(currentDate);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const weekDaysList = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const formatDateShort = (d: Date) => {
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].substring(0, 3)} ${d.getFullYear()}`;
  };

  const dateRangeStr = `${formatDateShort(startOfWeek)} s/d ${formatDateShort(endOfWeek)}`;
  
  // Perhitungan Minggu ke- (1 s/d 5) khusus dalam bulan ini
  const getWeekOfMonth = (d: Date) => {
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const dayOfWeek = firstDay.getDay();
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    return Math.ceil((d.getDate() + offset) / 7);
  };

  const weekNum = getWeekOfMonth(startOfWeek);

  // Trigger Confirmation Popup Before Printing
  const handlePressCetakButton = () => {
    if (!signatureDataUrl) {
      Alert.alert(
        'Tanda Tangan Diperlukan',
        'Silakan klik tombol "Tanda Tangan Orang Tua/Wali" untuk membubuhkan tanda tangan terlebih dahulu.',
        [{ text: 'Buka Papan Tanda Tangan', onPress: () => setSigModalVisible(true) }]
      );
      return;
    }

    setConfirmPrintModalVisible(true);
  };

  async function loadInitialData(isRefreshing = false) {
    if (!isRefreshing && !hasLoadedOnce) {
      setLoading(true);
    }

    // Safety timeout: Never hang loading screen more than 800ms
    const safetyTimer = setTimeout(() => {
      setLoading(false);
      setHasLoadedOnce(true);
    }, 800);

    try {
      const userProfile = await getUserStudentProfile();
      if (userProfile?.profile?.full_name) {
        setStudentName(userProfile.profile.full_name);
      }

      // Fast parallel fetch for parent name & activities
      if (userProfile?.profile?.id) {
        supabase
          .from('students')
          .select('nisn, nis, notes, guardian_name, parent_name')
          .eq('profile_id', userProfile.profile.id)
          .maybeSingle()
          .then(({ data: stDb }) => {
            if (stDb) {
              if (stDb.nisn) setStudentNisn(stDb.nisn);
              else if (stDb.nis) setStudentNisn(stDb.nis);

              let pName = stDb.guardian_name || stDb.parent_name;
              if (!pName && stDb.notes) {
                try {
                  const pNotes = typeof stDb.notes === 'string' ? JSON.parse(stDb.notes) : stDb.notes;
                  if (pNotes?.name) pName = pNotes.name;
                } catch (e) {}
              }
              if (pName) setParentName(pName);
            }
          })
          .catch(e => console.log('Fast parent fetch error:', e));
      }

      await fetchWeeklyActivities();
    } catch (err) {
      console.error('Error loading laporan metadata:', err);
    } finally {
      clearTimeout(safetyTimer);
      setHasLoadedOnce(true);
      setLoading(false);
    }
  }

  async function fetchWeeklyActivities() {
    try {
      const userProfile = await getUserStudentProfile();
      let studentId = userProfile?.student?.id;

      let { data } = studentId
        ? await supabase.from('activities').select('*').eq('student_id', studentId).order('created_at', { ascending: false })
        : { data: null };

      if (!data || data.length === 0) {
        const { data: allData } = await supabase.from('activities').select('*').order('created_at', { ascending: false });
        data = allData;
      }

      if (data) {
        setActivities(parseAndDeduplicateActivities(data));
      }
    } catch (e) {
      console.error('Error fetching activities:', e);
    }
  }

  useEffect(() => {
    loadInitialData(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchWeeklyActivities();
    }, [])
  );

  // Navigation handlers for week range
  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  // Build matrix checklist for the week including 7 Beribadah sub-items (only REALISASI counts)
  const matrixData = weekDaysList.map(wDate => {
    const dayActs = activities.filter(act => {
      if (act.kaihStatus === 'RENCANA') return false;
      let actDate: Date | null = null;
      if (act.activity_date) {
        const str = String(act.activity_date).substring(0, 10);
        const parts = str.split('-');
        if (parts.length === 3) {
          actDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
      }
      if (!actDate && act.created_at) {
        const str = String(act.created_at).substring(0, 10);
        const parts = str.split('-');
        if (parts.length === 3) {
          actDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          actDate = new Date(act.created_at);
        }
      }

      if (!actDate) return false;

      return (
        actDate.getFullYear() === wDate.getFullYear() &&
        actDate.getMonth() === wDate.getMonth() &&
        actDate.getDate() === wDate.getDate()
      );
    });

    const checkMap: Record<string, boolean> = {};

    dayActs.forEach(act => {
      const titleLower = (act.title || '').toLowerCase();
      const descLower = (act.description || '').toLowerCase();
      const catLower = (act.category || '').toLowerCase();
      const fullText = `${titleLower} ${descLower} ${catLower}`;

      // 1. Bangun Pagi
      if (fullText.includes('bangun') || fullText.includes('pagi')) {
        checkMap['Bangun Pagi'] = true;
      }

      // 2. Beribadah & Sub-items
      if (
        fullText.includes('ibadah') || fullText.includes('shalat') || fullText.includes('sholat') ||
        fullText.includes('subuh') || fullText.includes('zuhur') || fullText.includes('dzuhur') ||
        fullText.includes('ashar') || fullText.includes('asar') || fullText.includes('maghrib') ||
        fullText.includes('magrib') || fullText.includes('isya') || fullText.includes('tahajud') ||
        fullText.includes('tilawah') || fullText.includes('quran') || fullText.includes('qur\'an')
      ) {
        if (fullText.includes('tahajud')) checkMap['Beribadah_Tahajud'] = true;
        if (fullText.includes('subuh')) checkMap['Beribadah_Subuh'] = true;
        if (fullText.includes('zuhur') || fullText.includes('dzuhur')) checkMap['Beribadah_Dzuhur'] = true;
        if (fullText.includes('ashar') || fullText.includes('asar')) checkMap['Beribadah_Ashar'] = true;
        if (fullText.includes('maghrib') || fullText.includes('magrib')) checkMap['Beribadah_Magrib'] = true;
        if (fullText.includes('isya')) checkMap['Beribadah_Isya'] = true;
        if (fullText.includes('tilawah') || fullText.includes('quran') || fullText.includes('qur\'an') || fullText.includes('baca')) checkMap['Beribadah_Tilawah'] = true;

        // Default sub-item fallback for general prayer if no sub-item specified
        if (
          !checkMap['Beribadah_Tahajud'] && !checkMap['Beribadah_Subuh'] &&
          !checkMap['Beribadah_Dzuhur'] && !checkMap['Beribadah_Ashar'] &&
          !checkMap['Beribadah_Magrib'] && !checkMap['Beribadah_Isya'] &&
          !checkMap['Beribadah_Tilawah']
        ) {
          checkMap['Beribadah_Subuh'] = true;
        }
      }

      // 3. Berolahraga
      if (fullText.includes('olahraga') || fullText.includes('senam') || fullText.includes('lari') || fullText.includes('sepeda') || fullText.includes('futsal')) {
        checkMap['Berolahraga'] = true;
      }

      // 4. Makan Sehat dan Bergizi
      if (fullText.includes('makan') || fullText.includes('sehat') || fullText.includes('gizi') || fullText.includes('sarapan') || fullText.includes('buah') || fullText.includes('sayur')) {
        checkMap['Makan Sehat dan Bergizi'] = true;
      }

      // 5. Gemar Belajar
      if (fullText.includes('belajar') || fullText.includes('buku') || fullText.includes('pr') || fullText.includes('tugas') || fullText.includes('les') || fullText.includes('sekolah')) {
        checkMap['Gemar Belajar'] = true;
      }

      // 6. Bermasyarakat
      if (fullText.includes('masyarakat') || fullText.includes('sosial') || fullText.includes('gotong') || fullText.includes('bantu') || fullText.includes('tetangga') || fullText.includes('teman')) {
        checkMap['Bermasyarakat'] = true;
      }

      // 7. Tidur Cepat
      if (fullText.includes('tidur') || fullText.includes('cepat') || fullText.includes('istirahat')) {
        checkMap['Tidur Cepat'] = true;
      }
    });

    return checkMap;
  });

  // Handle messages from signature modal WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'SIGNATURE') {
        setSignatureDataUrl(data.data);
      } else if (data.type === 'SAVE_AND_CLOSE') {
        setSignatureDataUrl(data.data);
        setSigModalVisible(false);
      } else if (data.type === 'EMPTY_ERROR') {
        Alert.alert('Belum Ber Tanda Tangan', 'Silakan goreskan tanda tangan Anda pada area putih terlebih dahulu.');
      } else if (data.type === 'CLEAR') {
        setSignatureDataUrl(null);
      }
    } catch (e) {
      console.error('Error handling signature message:', e);
    }
  };

  const clearCanvasInModal = () => {
    setSignatureDataUrl(null);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('clearCanvas(); true;');
    }
  };

  const saveSignatureAndCloseModal = () => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript('requestSaveSignature(); true;');
    } else if (signatureDataUrl) {
      setSigModalVisible(false);
    } else {
      Alert.alert('Belum Ber Tanda Tangan', 'Silakan goreskan tanda tangan Anda pada area putih terlebih dahulu.');
    }
  };

  // Robust Professional 1-Page A4 Landscape PDF Output Generator
  const generateAndPrintPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const cleanSignatureImg = signatureDataUrl ? signatureDataUrl.trim() : '';

      // Calculate 8 Dimensi Deep Learning Analytics
      let totalCheckedCount = 0;
      let ibadahCount = 0;
      let sehatCount = 0;
      let mandiriCount = 0;
      let belajarCount = 0;
      let masyarakatCount = 0;

      matrixData.forEach(dayMap => {
        Object.keys(dayMap).forEach(k => {
          if (dayMap[k]) {
            totalCheckedCount++;
            if (k.startsWith('Beribadah_')) ibadahCount++;
            if (k === 'Berolahraga' || k === 'Makan Sehat dan Bergizi') sehatCount++;
            if (k === 'Bangun Pagi' || k === 'Tidur Cepat') mandiriCount++;
            if (k === 'Gemar Belajar') belajarCount++;
            if (k === 'Bermasyarakat') masyarakatCount++;
          }
        });
      });

      const maxTarget = 91; // 13 sub-items * 7 days
      const overallPct = Math.round((totalCheckedCount / maxTarget) * 100);
      const predikatStr = overallPct >= 85 ? 'Sangat Baik (A)' : overallPct >= 70 ? 'Baik (B)' : overallPct >= 55 ? 'Cukup (C)' : 'Perlu Bimbingan';

      const ibadahPct = Math.round((ibadahCount / 49) * 100);
      const sehatPct = Math.round((sehatCount / 14) * 100);
      const mandiriPct = Math.round((mandiriCount / 14) * 100);
      const belajarPct = Math.round((belajarCount / 7) * 100);
      const masyarakatPct = Math.round((masyarakatCount / 7) * 100);

      // Professional Structured File Naming Formula (Starting with NISN)
      const studentCodeName = studentName.trim().replace(/[^a-zA-Z0-9]/g, '_');
      const nisnPrefix = (studentNisn || '0012345678').trim().replace(/[^a-zA-Z0-9]/g, '');
      const startDateStr = `${startOfWeek.getFullYear()}${String(startOfWeek.getMonth() + 1).padStart(2, '0')}${String(startOfWeek.getDate()).padStart(2, '0')}`;
      const endDateStr = `${endOfWeek.getFullYear()}${String(endOfWeek.getMonth() + 1).padStart(2, '0')}${String(endOfWeek.getDate()).padStart(2, '0')}`;
      
      const cleanFileName = `${nisnPrefix}_${studentCodeName}_W${weekNum}_${startDateStr}-${endDateStr}.pdf`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>${cleanFileName.replace('.pdf', '')}</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 4mm 10mm 10mm 10mm;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #000000;
              margin: 0;
              padding: 0;
              font-size: 10.5px;
              background-color: #ffffff;
              position: relative;
              min-height: 100%;
            }
            .header-title {
              text-align: center;
              margin-bottom: 28px;
              line-height: 1.35;
              color: #000000;
            }
            .header-title-line1 {
              font-size: 16px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 5px;
            }
            .header-title-line2 {
              font-size: 14px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .meta-table {
              width: 100%;
              margin-top: 10px;
              margin-bottom: 16px;
              font-size: 13px;
              line-height: 1.6;
            }
            .meta-table td {
              padding: 3px 0;
              vertical-align: top;
            }
            .meta-label {
              font-weight: bold;
              font-size: 13px;
            }
            table.kaih-grid {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 16px;
              table-layout: fixed;
              box-sizing: border-box;
            }
            table.kaih-grid th, table.kaih-grid td {
              border: 1px solid #000000;
              text-align: center;
              font-size: 10px;
              vertical-align: middle;
              box-sizing: border-box;
            }
            table.kaih-grid tr {
              height: 24px;
            }
            table.kaih-grid td {
              height: 24px;
              padding: 2px 1px;
            }
            table.kaih-grid th {
              font-weight: bold;
              background-color: #e2e8f0;
              color: #000000;
            }
            .th-sub {
              font-size: 9px;
              padding: 3px 1px !important;
              background-color: #e2e8f0 !important;
              color: #000000 !important;
              font-weight: bold;
            }
            .check-pill {
              display: inline-block;
              width: 16px;
              height: 16px;
              border-radius: 8px;
              background-color: #dcfce7;
              color: #15803d;
              font-size: 11px;
              font-weight: bold;
              line-height: 16px;
              text-align: center;
            }
            .bottom-row {
              width: 100%;
              margin-top: 14px;
            }
            .bottom-row td {
              vertical-align: top;
            }
            .deeplearning-box-card {
              border: 1px solid #64748b;
              border-radius: 10px;
              padding: 10px 12px;
              background-color: #f8fafc;
              min-height: 125px;
            }
            .hopes-box-card {
              border: 1px solid #64748b;
              border-radius: 10px;
              padding: 10px 12px;
              background-color: #f8fafc;
              min-height: 70px;
            }
            .box-title {
              font-weight: bold;
              font-size: 12.5px;
              margin-bottom: 6px;
              color: #0f172a;
            }
            .hopes-text {
              min-height: 45px;
              line-height: 16px;
              font-size: 11px;
              font-style: italic;
            }
            .sig-box {
              width: 100%;
              text-align: center;
              margin-top: 10px;
            }
            .sig-label {
              font-weight: bold;
              font-size: 12.5px;
              margin-bottom: 0px;
            }
            .sig-img {
              height: 65px;
              max-width: 100%;
              object-fit: contain;
              margin-top: -6px;
              margin-bottom: -10px;
            }
            .footer-note-box {
              margin-top: 16px;
              width: 100%;
              border-top: 1px dashed #64748b;
              padding-top: 4px;
            }
            .footer-note-text {
              font-size: 8.5px;
              font-style: italic;
              color: #334155;
              margin: 0;
              line-height: 1.4;
            }
          </style>
        </head>
        <body>
          <div class="header-title">
            <div class="header-title-line1">LEMBAR KONTROL MINGGUAN ORANG TUA/WALI</div>
            <div class="header-title-line2">7 KEBIASAAN ANAK INDONESIA HEBAT (KAIH)</div>
          </div>

          <table class="meta-table">
            <tr>
              <td style="width: 17%;" class="meta-label">Nama Orang Tua/ Wali</td>
              <td style="width: 2%;">:</td>
              <td style="width: 41%; font-weight: bold; font-size: 13px;">${parentName || 'Anton'}</td>
              <td style="width: 10%;" class="meta-label">Kelas</td>
              <td style="width: 2%;">:</td>
              <td style="width: 28%; font-weight: bold; font-size: 13px;">${className || ''}</td>
            </tr>
            <tr>
              <td class="meta-label">Nama Peserta Didik</td>
              <td>:</td>
              <td style="font-weight: bold; font-size: 13px;">${studentName || ''}</td>
              <td class="meta-label">Hari/Tanggal</td>
              <td>:</td>
              <td style="font-weight: bold; font-size: 13px;">${dateRangeStr}</td>
            </tr>
          </table>

          <table class="kaih-grid">
            <thead>
              <tr>
                <th rowspan="2" style="width: 3.2%;">No.</th>
                <th rowspan="2" style="width: 10.5%;">
                  7 KAIH<br/>HARI
                </th>
                <th rowspan="2" style="width: 7.5%;">☀️ Bangun<br/>Pagi</th>
                <th colspan="7" style="width: 33%;">🤲 Beribadah</th>
                <th rowspan="2" style="width: 8.5%;">🏃 Berolahraga</th>
                <th rowspan="2" style="width: 10.5%;">🥗 Makan Sehat<br/>dan Bergizi</th>
                <th rowspan="2" style="width: 8.5%;">📚 Gemar<br/>Belajar</th>
                <th rowspan="2" style="width: 9.5%;">🤝 Bermasyarakat</th>
                <th rowspan="2" style="width: 8.8%;">🌙 Tidur<br/>Cepat</th>
              </tr>
              <tr>
                <th class="th-sub" style="width: 4.7%;">Tahajud</th>
                <th class="th-sub" style="width: 4.7%;">Subuh</th>
                <th class="th-sub" style="width: 4.7%;">Dzuhur</th>
                <th class="th-sub" style="width: 4.7%;">Ashar</th>
                <th class="th-sub" style="width: 4.7%;">Magrib</th>
                <th class="th-sub" style="width: 4.7%;">Isya</th>
                <th class="th-sub" style="width: 4.8%;">Tilawah</th>
              </tr>
            </thead>
            <tbody>
              ${DAY_NAMES.map((dayName, idx) => {
                const dayMap = matrixData[idx];
                const wDate = weekDaysList[idx];
                const dayWithDate = `${dayName}, ${wDate.getDate()} ${MONTH_NAMES[wDate.getMonth()].substring(0, 3)}`;
                const rowBg = idx % 2 === 1 ? '#f1f5f9' : '#ffffff';

                return `
                  <tr style="background-color: ${rowBg};">
                    <td>${idx + 1}</td>
                    <td style="font-weight: bold; text-align: left; padding-left: 6px; color: #000000; font-size: 10.5px;">${dayWithDate}</td>
                    <td>${dayMap['Bangun Pagi'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                    <td>${dayMap['Beribadah_Tahajud'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                    <td>${dayMap['Beribadah_Subuh'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                    <td>${dayMap['Beribadah_Dzuhur'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                    <td>${dayMap['Beribadah_Ashar'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                    <td>${dayMap['Beribadah_Magrib'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                    <td>${dayMap['Beribadah_Isya'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                    <td>${dayMap['Beribadah_Tilawah'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                    <td>${dayMap['Berolahraga'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                    <td>${dayMap['Makan Sehat dan Bergizi'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                    <td>${dayMap['Gemar Belajar'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                    <td>${dayMap['Bermasyarakat'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                    <td>${dayMap['Tidur Cepat'] ? '<span class="check-pill">&#10003;</span>' : ''}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <table class="bottom-row">
            <tr>
              <!-- COLUMN 1: 8 DIMENSI DEEP LEARNING ANALYTICS -->
              <td style="width: 44%; padding-right: 10px;">
                <div class="deeplearning-box-card">
                  <div class="box-title">📊 Analisis Capaian 8 Dimensi Deep Learning & KAIH</div>
                  <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; font-size: 11px;">
                    <span>Total Capaian: ${totalCheckedCount}/91 Kegiatan (${overallPct}%)</span>
                    <span style="color: #15803d;">Predikat: ${predikatStr}</span>
                  </div>
                  <table style="width: 100%; font-size: 10px; border-collapse: collapse; line-height: 1.45;">
                    <tr>
                      <td style="padding: 1.5px 0;">💜 <b>Keimanan & Ketakwaan:</b> ${ibadahCount}/49 (${ibadahPct}%)</td>
                      <td style="padding: 1.5px 0;">🏃 <b>Kesehatan & Jasmani:</b> ${sehatCount}/14 (${sehatPct}%)</td>
                    </tr>
                    <tr>
                      <td style="padding: 1.5px 0;">🧘 <b>Kemandirian:</b> ${mandiriCount}/14 (${mandiriPct}%)</td>
                      <td style="padding: 1.5px 0;">📚 <b>Penalaran Kritis & Kreativitas:</b> ${belajarCount}/7 (${belajarPct}%)</td>
                    </tr>
                    <tr>
                      <td style="padding: 1.5px 0;" colspan="2">🤝 <b>Kewargaan, Kolaborasi & Komunikasi:</b> ${masyarakatCount}/7 (${masyarakatPct}%)</td>
                    </tr>
                  </table>
                  <div style="font-size: 9px; font-style: italic; color: #334155; margin-top: 6px; border-top: 1px dashed #cbd5e1; padding-top: 4px;">
                    ✨ <b>Manfaat KAIH 24 Jam:</b> Membentuk karakter disiplin tinggi, sehat jasmani rohani, berakhlak mulia & mandiri.
                  </div>
                </div>

                <!-- CATATAN KAKI DI BAWAH KOTAK ANALISIS BERGARIS PUTUS-PUTUS -->
                <div class="footer-note-box">
                  <p class="footer-note-text">
                    “Lembar kontrol ini dibuat apa adanya sesuai perkembangan anak dirumah. Hasilnya tidak mempengaruhi nilai akademik disekolah, melainkan berfungsi sebagai sarana kerja sama antara sekolah dan orang tua untuk membentuk karakter positif anak”
                  </p>
                </div>
              </td>

              <!-- COLUMN 2: PESAN / HARAPAN ORANG TUA IN COMPACT ROUNDED CARD -->
              <td style="width: 34%; padding-right: 10px;">
                <div class="hopes-box-card">
                  <div class="box-title">✍️ Pesan / Harapan Orang Tua</div>
                  <div class="hopes-text">${parentHopes ? parentHopes : ''}</div>
                </div>
              </td>

              <!-- COLUMN 3: TANDA TANGAN ORANG TUA / WALI ME PET -->
              <td style="width: 22%; text-align: center; vertical-align: bottom;">
                <div class="sig-box">
                  <div class="sig-label">Orang Tua / Wali</div>
                  <div style="height: 60px; text-align: center; margin-top: -6px; margin-bottom: -10px;">
                    <img src="${cleanSignatureImg}" class="sig-img" />
                  </div>
                  <div style="font-size: 12px; margin-top: -4px; font-weight: bold; color: #000000;">
                    (${parentName || 'Anton'})
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      // 1. Generate real PDF file via Print.printToFileAsync
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        orientation: (Print as any).Orientation?.landscape,
      } as any);

      // 2. Upload real PDF binary to Supabase via fetch(uri) -> blob (bypasses all base64 issues)
      try {
        const response = await fetch(uri);
        const blob = await response.blob();
        console.log('PDF blob size:', blob.size, 'bytes, type:', blob.type);

        if (blob.size > 1000) {
          const storagePath = `${cleanFileName}`;
          const { data: upData, error: upErr } = await supabase.storage
            .from('Lembar Kontrol Mingguan')
            .upload(storagePath, blob, {
              contentType: 'application/pdf',
              upsert: true,
            });

          if (upErr) {
            console.warn('Supabase upload notice:', upErr.message);
          } else {
            console.log('PDF uploaded to Supabase OK!', upData);
          }
        }
      } catch (upErr) {
        console.warn('Supabase upload exception:', upErr);
      }

      // 3. Open native Print & Save as PDF dialog
      await Print.printAsync({
        html: htmlContent,
        orientation: Print.Orientation.landscape,
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
      Alert.alert('Gagal Membuat PDF', 'Terjadi kesalahan saat membuat lembar kontrol PDF. Silakan coba lagi.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const signatureCanvasHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        body, html { margin:0; padding:0; width:100%; height:100%; background:#ffffff; overflow:hidden; touch-action:none; }
        #canvas { width:100%; height:100%; display:block; cursor:crosshair; background:#ffffff; }
      </style>
    </head>
    <body>
      <canvas id="canvas"></canvas>
      <script>
        var canvas = document.getElementById('canvas');
        var ctx = canvas.getContext('2d');
        var isDrawing = false;
        var hasDrawn = false;

        function resizeCanvas() {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#000000';
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        function getPos(e) {
          var rect = canvas.getBoundingClientRect();
          if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
          }
          return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        function startDrawing(e) {
          isDrawing = true;
          hasDrawn = true;
          var pos = getPos(e);
          ctx.beginPath();
          ctx.moveTo(pos.x, pos.y);
        }

        function draw(e) {
          if (!isDrawing) return;
          e.preventDefault();
          var pos = getPos(e);
          ctx.lineTo(pos.x, pos.y);
          ctx.stroke();
        }

        function stopDrawing() {
          if (isDrawing) {
            isDrawing = false;
            sendSignature();
          }
        }

        function sendSignature() {
          if (!hasDrawn) return;
          var dataUrl = canvas.toDataURL('image/png');
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SIGNATURE', data: dataUrl }));
          }
        }

        function requestSaveSignature() {
          if (!hasDrawn) {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'EMPTY_ERROR' }));
            }
          } else {
            var dataUrl = canvas.toDataURL('image/png');
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SAVE_AND_CLOSE', data: dataUrl }));
            }
          }
        }

        function clearCanvas() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          hasDrawn = false;
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CLEAR' }));
          }
        }

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);

        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);
      </script>
    </body>
    </html>
  `;

  // Helper cell renderer for full fine lines grid table
  const CellCheck = ({ mark, width, color, isLast }: { mark?: boolean; width: number; color: string; isLast?: boolean }) => {
    return (
      <View style={[styles.tdCellBox, { width }, !isLast && { borderRightWidth: 1, borderRightColor: colors.border }]}>
        {mark ? (
          <View style={[styles.checkMarkPill, { backgroundColor: `${color}20` }]}>
            <Ionicons name="checkmark" size={12} color={color} />
          </View>
        ) : (
          <View style={[styles.emptyDotPin, { backgroundColor: colors.border }]} />
        )}
      </View>
    );
  };

  if (loading && !hasLoadedOnce) {
    return <KaihLoadingScreen message="Memuat Laporan..." backgroundColor={colors.background} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Header */}
      <View style={[styles.headerCurve, { backgroundColor: colors.primary, paddingTop: (StatusBar.currentHeight || 24) + 10 }]}>
        <View style={styles.headerTopRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <Image source={kaihLogoAsset} style={styles.headerLogo} resizeMode="contain" />
            <Text style={styles.headerTitle} numberOfLines={2}>
              Laporan Lembar Kontrol Mingguan 7 KAIH
            </Text>
          </View>
        </View>

        {/* Date Navigator */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={handlePrevWeek} style={styles.monthNavBtn}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.monthNavCenter}>
            <Ionicons name="calendar" size={16} color="rgba(255,255,255,0.85)" style={{ marginRight: 6 }} />
            <Text style={styles.monthNavText}>{dateRangeStr}</Text>
          </View>
          <TouchableOpacity onPress={handleNextWeek} style={styles.monthNavBtn}>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Matrix Table Preview Component - Styled like Rekap 7 KAIH with Frozen Left Columns */}
        <View style={[styles.cardBox, { backgroundColor: colors.card, borderColor: colors.border, paddingHorizontal: 4 }]}>
          <Text style={[styles.cardBoxTitle, { color: colors.text, paddingHorizontal: 12 }]}>
            📊 Tabel Kontrol Mingguan 7 KAIH
          </Text>

          <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, marginHorizontal: 8, marginTop: 4, flexDirection: 'row' }}>
            {/* FIXED / FROZEN LEFT COLUMNS: No & HARI */}
            <View style={{ width: 84, borderRightWidth: 1.5, borderRightColor: colors.border, backgroundColor: isDark ? '#1e293b' : '#f8fafc', zIndex: 10 }}>
              {/* Header 1 (Combined No & HARI height: 70px) */}
              <View style={[styles.tableHeaderRowCombined, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row' }]}>
                <View style={[styles.thCellBox, { width: 22, borderRightWidth: 1, borderRightColor: colors.border }]}>
                  <Text style={[styles.thCellText, { color: colors.text, fontSize: 9 }]}>No</Text>
                </View>
                <View style={[styles.thCellBox, { width: 62 }]}>
                  <Text style={[styles.thCellText, { color: colors.primary, fontSize: 10 }]}>HARI</Text>
                </View>
              </View>

              {/* Day Rows with Date & Month */}
              {DAY_NAMES.map((dayName, dIdx) => {
                const wDate = weekDaysList[dIdx];
                const dayWithDate = `${dayName}, ${wDate.getDate()} ${MONTH_NAMES[wDate.getMonth()].substring(0, 3)}`;
                const isLastRow = dIdx === DAY_NAMES.length - 1;

                return (
                  <View
                    key={dayName}
                    style={[
                      styles.tableDataRow,
                      !isLastRow && { borderBottomWidth: 1, borderBottomColor: colors.border },
                      dIdx % 2 === 1 && { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' },
                      { flexDirection: 'row' }
                    ]}
                  >
                    <View style={[styles.tdCellBox, { width: 22, borderRightWidth: 1, borderRightColor: colors.border }]}>
                      <Text style={[styles.tdCellText, { color: colors.textSecondary, fontSize: 9.5 }]}>{dIdx + 1}</Text>
                    </View>
                    <View style={[styles.tdCellBox, { width: 62, alignItems: 'flex-start', paddingLeft: 3 }]}>
                      <Text style={[styles.tdCellText, { fontWeight: 'bold', color: colors.text, fontSize: 8.5 }]} numberOfLines={1}>
                        {dayWithDate}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* SCROLLABLE NARROW COMPACT CATEGORY COLUMNS */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                {/* Header Row 1 */}
                <View style={[styles.tableHeaderRow1, { backgroundColor: isDark ? '#1e293b' : '#f8fafc', borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  {/* Bangun Pagi */}
                  <View style={[styles.thCellBox, { width: 58, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <View style={[styles.catHeaderBadge, { backgroundColor: '#e0f2fe' }]}>
                      <Text style={{ fontSize: 9 }}>☀️</Text>
                      <Text style={[styles.catHeaderBadgeText, { color: '#0284c7', fontSize: 8 }]}>Bangun</Text>
                    </View>
                  </View>

                  {/* Beribadah (Colspan 7) */}
                  <View style={[styles.thCellBox, { width: 228, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <View style={[styles.catHeaderBadge, { backgroundColor: '#dcfce7' }]}>
                      <Text style={{ fontSize: 9 }}>🤲</Text>
                      <Text style={[styles.catHeaderBadgeText, { color: '#16a34a', fontSize: 8 }]}>Beribadah</Text>
                    </View>
                  </View>

                  {/* Berolahraga */}
                  <View style={[styles.thCellBox, { width: 58, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <View style={[styles.catHeaderBadge, { backgroundColor: '#fce7f3' }]}>
                      <Text style={{ fontSize: 9 }}>🏃</Text>
                      <Text style={[styles.catHeaderBadgeText, { color: '#db2777', fontSize: 8 }]}>Olahraga</Text>
                    </View>
                  </View>

                  {/* Makan Sehat */}
                  <View style={[styles.thCellBox, { width: 60, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <View style={[styles.catHeaderBadge, { backgroundColor: '#fef3c7' }]}>
                      <Text style={{ fontSize: 9 }}>🥗</Text>
                      <Text style={[styles.catHeaderBadgeText, { color: '#d97706', fontSize: 8 }]}>Makan</Text>
                    </View>
                  </View>

                  {/* Gemar Belajar */}
                  <View style={[styles.thCellBox, { width: 60, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <View style={[styles.catHeaderBadge, { backgroundColor: '#f3e8ff' }]}>
                      <Text style={{ fontSize: 9 }}>📚</Text>
                      <Text style={[styles.catHeaderBadgeText, { color: '#9333ea', fontSize: 8 }]}>Belajar</Text>
                    </View>
                  </View>

                  {/* Bermasyarakat */}
                  <View style={[styles.thCellBox, { width: 64, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <View style={[styles.catHeaderBadge, { backgroundColor: '#e0f2fe' }]}>
                      <Text style={{ fontSize: 9 }}>🤝</Text>
                      <Text style={[styles.catHeaderBadgeText, { color: '#0284c7', fontSize: 8 }]}>Sosial</Text>
                    </View>
                  </View>

                  {/* Tidur Cepat */}
                  <View style={[styles.thCellBox, { width: 56 }]}>
                    <View style={[styles.catHeaderBadge, { backgroundColor: '#e0e7ff' }]}>
                      <Text style={{ fontSize: 9 }}>🌙</Text>
                      <Text style={[styles.catHeaderBadgeText, { color: '#4f46e5', fontSize: 8 }]}>Tidur</Text>
                    </View>
                  </View>
                </View>

                {/* Header Row 2 (Under Beribadah) */}
                <View style={[styles.tableHeaderRow2, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <View style={{ width: 58, borderRightWidth: 1, borderRightColor: colors.border }} />

                  {/* 7 Sub-columns under Beribadah */}
                  <View style={[styles.thSubCellBox, { width: 36, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <Text style={[styles.thSubText, { fontSize: 7.5 }]}>Tahajud</Text>
                  </View>
                  <View style={[styles.thSubCellBox, { width: 30, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <Text style={[styles.thSubText, { fontSize: 7.5 }]}>Subuh</Text>
                  </View>
                  <View style={[styles.thSubCellBox, { width: 36, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <Text style={[styles.thSubText, { fontSize: 7.5 }]}>Dzuhur</Text>
                  </View>
                  <View style={[styles.thSubCellBox, { width: 30, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <Text style={[styles.thSubText, { fontSize: 7.5 }]}>Ashar</Text>
                  </View>
                  <View style={[styles.thSubCellBox, { width: 32, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <Text style={[styles.thSubText, { fontSize: 7.5 }]}>Magrib</Text>
                  </View>
                  <View style={[styles.thSubCellBox, { width: 28, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <Text style={[styles.thSubText, { fontSize: 7.5 }]}>Isya</Text>
                  </View>
                  <View style={[styles.thSubCellBox, { width: 36, borderRightWidth: 1, borderRightColor: colors.border }]}>
                    <Text style={[styles.thSubText, { fontSize: 7.5 }]}>Tilawah</Text>
                  </View>

                  <View style={{ width: 58, borderRightWidth: 1, borderRightColor: colors.border }} />
                  <View style={{ width: 60, borderRightWidth: 1, borderRightColor: colors.border }} />
                  <View style={{ width: 60, borderRightWidth: 1, borderRightColor: colors.border }} />
                  <View style={{ width: 64, borderRightWidth: 1, borderRightColor: colors.border }} />
                  <View style={{ width: 56 }} />
                </View>

                {/* 7 Days Body Rows */}
                {DAY_NAMES.map((dayName, dIdx) => {
                  const dayMap = matrixData[dIdx];
                  const isLastRow = dIdx === DAY_NAMES.length - 1;

                  return (
                    <View
                      key={dayName}
                      style={[
                        styles.tableDataRow,
                        !isLastRow && { borderBottomWidth: 1, borderBottomColor: colors.border },
                        dIdx % 2 === 1 && { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }
                      ]}
                    >
                      {/* Checkmark Cells */}
                      <CellCheck mark={dayMap['Bangun Pagi']} width={58} color="#0284c7" />
                      
                      {/* 7 Beribadah Sub-Cells */}
                      <CellCheck mark={dayMap['Beribadah_Tahajud']} width={36} color="#16a34a" />
                      <CellCheck mark={dayMap['Beribadah_Subuh']} width={30} color="#16a34a" />
                      <CellCheck mark={dayMap['Beribadah_Dzuhur']} width={36} color="#16a34a" />
                      <CellCheck mark={dayMap['Beribadah_Ashar']} width={30} color="#16a34a" />
                      <CellCheck mark={dayMap['Beribadah_Magrib']} width={32} color="#16a34a" />
                      <CellCheck mark={dayMap['Beribadah_Isya']} width={28} color="#16a34a" />
                      <CellCheck mark={dayMap['Beribadah_Tilawah']} width={36} color="#16a34a" />

                      <CellCheck mark={dayMap['Berolahraga']} width={58} color="#db2777" />
                      <CellCheck mark={dayMap['Makan Sehat dan Bergizi']} width={60} color="#d97706" />
                      <CellCheck mark={dayMap['Gemar Belajar']} width={60} color="#9333ea" />
                      <CellCheck mark={dayMap['Bermasyarakat']} width={64} color="#0284c7" />
                      <CellCheck mark={dayMap['Tidur Cepat']} width={56} color="#4f46e5" isLast />
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Input Pesan/Harapan Orang Tua */}
        <View style={[styles.cardBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardBoxTitle, { color: colors.text }]}>✍️ Pesan / Harapan Orang Tua</Text>
          <TextInput
            style={[
              styles.textAreaInput,
              { color: colors.text, borderColor: colors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }
            ]}
            multiline
            numberOfLines={4}
            value={parentHopes}
            onChangeText={setParentHopes}
            placeholder="Tulis pesan atau harapan Anda untuk perkembangan anak minggu ini..."
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Signature Button & Preview Card */}
        <View style={[styles.cardBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardBoxTitle, { color: colors.text }]}>🖋️ Tanda Tangan Orang Tua/Wali</Text>

          {signatureDataUrl ? (
            <View style={{ alignItems: 'center' }}>
              <View style={styles.signaturePreviewFrame}>
                <Image source={{ uri: signatureDataUrl }} style={{ width: '100%', height: 75 }} resizeMode="contain" />
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity onPress={() => setSigModalVisible(true)} style={[styles.sigActionBtn, { backgroundColor: '#e0f2fe' }]}>
                  <Ionicons name="create-outline" size={14} color="#0284c7" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 12, color: '#0284c7', fontWeight: 'bold' }}>Ubah Tanda Tangan</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSignatureDataUrl(null)} style={[styles.sigActionBtn, { backgroundColor: '#fef2f2' }]}>
                  <Ionicons name="trash-outline" size={14} color="#ef4444" style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: 'bold' }}>Hapus</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.openSigModalBtn} onPress={() => setSigModalVisible(true)} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={24} color="#2563eb" style={{ marginRight: 8 }} />
              <View>
                <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#2563eb' }}>
                  Buka Papan Tanda Tangan
                </Text>
                <Text style={{ fontSize: 10.5, color: colors.textSecondary, marginTop: 2 }}>
                  Klik di sini untuk menggambar tanda tangan di popup layar penuh
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Tombol Cetak Laporan 7 KAIH */}
        <View style={{ paddingHorizontal: 16, marginTop: 10 }}>
          <TouchableOpacity
            style={[styles.printPdfBtn, { backgroundColor: colors.primary }, isGeneratingPdf && { opacity: 0.7 }]}
            onPress={handlePressCetakButton}
            disabled={isGeneratingPdf}
          >
            <Ionicons name="print-outline" size={20} color="#ffffff" style={{ marginRight: 8 }} />
            <Text style={styles.printPdfBtnText}>
              {isGeneratingPdf ? 'Membuat PDF...' : 'Cetak Laporan 7 KAIH'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Popup Modal Dedicated for Signature */}
      <Modal visible={sigModalVisible} transparent animationType="slide" onRequestClose={() => setSigModalVisible(false)}>
        <View style={styles.modalOverlayDark}>
          <View style={[styles.sigModalContainer, { backgroundColor: colors.card }]}>
            {/* Modal Header */}
            <View style={styles.sigModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="pencil" size={20} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.sigModalTitle, { color: colors.text }]}>Tanda Tangan Orang Tua / Wali</Text>
              </View>
              <TouchableOpacity onPress={() => setSigModalVisible(false)}>
                <Ionicons name="close-circle" size={26} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 11.5, color: colors.textSecondary, marginBottom: 12 }}>
              Goreskan tanda tangan Anda dengan sentuhan jari pada area putih di bawah:
            </Text>

            {/* Canvas Box inside Modal */}
            <View style={styles.modalCanvasBox}>
              {sigModalVisible && (
                <WebView
                  ref={webViewRef}
                  originWhitelist={['*']}
                  source={{ html: signatureCanvasHtml }}
                  scrollEnabled={false}
                  onMessage={handleWebViewMessage}
                  style={{ flex: 1, backgroundColor: '#ffffff' }}
                />
              )}
            </View>

            {/* Modal Actions */}
            <View style={styles.sigModalFooterRow}>
              <TouchableOpacity onPress={clearCanvasInModal} style={styles.modalClearBtn}>
                <Ionicons name="trash-outline" size={16} color="#ef4444" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 13, color: '#ef4444', fontWeight: 'bold' }}>Bersihkan</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={saveSignatureAndCloseModal} style={[styles.modalSaveBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, color: '#ffffff', fontWeight: 'bold' }}>Simpan Tanda Tangan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* POPUP MODAL ELEGAN: KONFIRMASI CETAK LAPORAN 7 KAIH */}
      <Modal visible={confirmPrintModalVisible} transparent animationType="fade" onRequestClose={() => setConfirmPrintModalVisible(false)}>
        <View style={styles.modalOverlayDark}>
          <View style={[styles.confirmPrintModalContainer, { backgroundColor: colors.card }]}>
            {/* Header Banner */}
            <View style={[styles.confirmPrintHeaderBanner, { backgroundColor: colors.primary }]}>
              <View style={styles.confirmPrintBadgeIcon}>
                <Ionicons name="print" size={26} color={colors.primary} />
              </View>
              <Text style={styles.confirmPrintHeaderTitle}>Konfirmasi Cetak Laporan</Text>
              <Text style={styles.confirmPrintHeaderSubtitle}>7 Kebiasaan Anak Indonesia Hebat (KAIH)</Text>
            </View>

            {/* Modal Body Info */}
            <View style={{ padding: 18 }}>
              {/* Periode Badge Box */}
              <View style={styles.confirmPrintInfoBoxBlue}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="calendar-outline" size={16} color="#0284c7" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12.5, fontWeight: 'bold', color: '#0369a1' }}>
                    Periode Laporan: Minggu ke-{weekNum}
                  </Text>
                </View>
                <Text style={{ fontSize: 11.5, color: '#0284c7', fontWeight: '600', paddingLeft: 22 }}>
                  {dateRangeStr}
                </Text>
              </View>

              {/* Student Metadata Box */}
              <View style={[styles.confirmPrintInfoBoxGray, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="person-outline" size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 11.5, color: colors.text, fontWeight: 'bold' }}>
                    Nama Siswa: {studentName}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="card-outline" size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 11.5, color: colors.textSecondary }}>
                    NISN: {studentNisn}
                  </Text>
                </View>
              </View>

              {/* Warning Notice Box */}
              <View style={styles.confirmPrintNoticeWarningBox}>
                <Ionicons name="alert-circle" size={20} color="#d97706" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 11, color: '#b45309', lineHeight: 16, fontStyle: 'italic' }}>
                  <Text style={{ fontWeight: 'bold' }}>Catatan:</Text> Cetak ini hanya bisa dilakukan sekali. Pastikan seluruh data dan tanda tangan orang tua/wali sudah benar dan sesuai.
                </Text>
              </View>
            </View>

            {/* Modal Actions Footer */}
            <View style={styles.confirmPrintFooterRow}>
              <TouchableOpacity
                onPress={() => setConfirmPrintModalVisible(false)}
                style={styles.confirmPrintCancelBtn}
              >
                <Ionicons name="close-circle-outline" size={18} color="#64748b" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 13, color: '#475569', fontWeight: 'bold' }}>Batal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setConfirmPrintModalVisible(false);
                  generateAndPrintPdf();
                }}
                style={[styles.confirmPrintSubmitBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="print" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 13, color: '#ffffff', fontWeight: 'bold' }}>Yakin, Cetak Sekarang</Text>
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
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCurve: {
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    zIndex: 30,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLogo: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
    color: '#ffffff',
    lineHeight: 18,
    flexShrink: 1,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  monthNavBtn: {
    padding: 4,
  },
  monthNavCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthNavText: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: 'bold',
  },
  cardBox: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  cardBoxTitle: {
    fontSize: 13.5,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  inputRow: {
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
  },
  textInputDisabled: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12.5,
  },
  textAreaInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12.5,
    textAlignVertical: 'top',
    minHeight: 80,
  },

  // Table Preview Styles matching Rekap 7 KAIH
  tableHeaderRowCombined: {
    height: 70,
  },
  tableHeaderRow1: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
  },
  tableHeaderRow2: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
  },
  thCellBox: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: 1,
  },
  thCellText: {
    fontSize: 9.5,
    fontWeight: 'bold',
  },
  catHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  catHeaderBadgeText: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  thSubCellBox: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  thSubText: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#64748b',
  },
  tdCellBox: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  tdCellText: {
    fontSize: 10,
  },
  checkMarkPill: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyDotPin: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },

  // Signature Buttons & Modal Styles
  openSigModalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#93c5fd',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
  },
  signaturePreviewFrame: {
    width: '100%',
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  sigActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalOverlayDark: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sigModalContainer: {
    width: '100%',
    borderRadius: 20,
    padding: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sigModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sigModalTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalCanvasBox: {
    height: 260,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#2563eb',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  sigModalFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  modalClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#fef2f2',
  },
  modalSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  printPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  printPdfBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Confirm Print Modal Styles
  confirmPrintModalContainer: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  confirmPrintHeaderBanner: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  confirmPrintBadgeIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  confirmPrintHeaderTitle: {
    fontSize: 16.5,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
  },
  confirmPrintHeaderSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
    textAlign: 'center',
  },
  confirmPrintInfoBoxBlue: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  confirmPrintInfoBoxGray: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  confirmPrintNoticeWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 14,
    padding: 10,
  },
  confirmPrintFooterRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingBottom: 18,
    gap: 10,
  },
  confirmPrintCancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  confirmPrintSubmitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    elevation: 2,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
