import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { LogOut, Building, Activity, Printer, TrendingUp, BarChart2 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function FoundationDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, totalActivities: 0, evaluated: 0 });
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // 1. Get totals
    const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_active', true);
    const { count: activitiesCount } = await supabase.from('activities').select('*', { count: 'exact', head: true });
    const { count: evalCount } = await supabase.from('evaluations').select('*', { count: 'exact', head: true });
    
    // 2. Get activities grouped by date for the area chart
    const { data: actData } = await supabase
      .from('activities')
      .select('activity_date')
      .order('activity_date', { ascending: true });

    if (actData) {
      const dateCount: Record<string, number> = {};
      actData.forEach(act => {
        dateCount[act.activity_date] = (dateCount[act.activity_date] || 0) + 1;
      });
      
      const chartData = Object.keys(dateCount).slice(-14).map(date => ({
        date,
        Total: dateCount[date]
      }));
      setTimelineData(chartData);
      
      setStats({
        totalUsers: usersCount || 0,
        totalActivities: activitiesCount || 0,
        evaluated: evalCount || 0
      });
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const printReport = () => {
    window.print();
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Memuat Data Yayasan...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-fuchsia-600 rounded-lg flex items-center justify-center text-white font-bold">Y</div>
            <h1 className="text-xl font-bold text-slate-900">Dashboard Yayasan (Executive)</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={printReport} className="flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 px-3 py-1.5 rounded-md">
              <Printer size={16} className="mr-2" /> Cetak Laporan
            </button>
            <button onClick={handleLogout} className="flex items-center text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-md">
              <LogOut size={16} className="mr-2" /> Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Print Header */}
        <div className="hidden print:block mb-8 text-center border-b pb-4">
          <h1 className="text-2xl font-bold uppercase tracking-wider">Laporan Eksekutif Yayasan</h1>
          <p className="text-slate-500 font-bold text-lg">Yayasan Pendidikan Budi Utomo</p>
          <p className="text-sm mt-2 text-slate-400">Dicetak pada: {new Date().toLocaleDateString('id-ID')}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-fuchsia-100 text-fuchsia-600 rounded-full flex items-center justify-center mb-4">
              <Building size={32} />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">Total Pengguna Aktif</p>
            <h2 className="text-3xl font-bold text-slate-900">{stats.totalUsers}</h2>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <Activity size={32} />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">Total Aktivitas Terekam</p>
            <h2 className="text-3xl font-bold text-slate-900">{stats.totalActivities}</h2>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <TrendingUp size={32} />
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1">Total Evaluasi Guru</p>
            <h2 className="text-3xl font-bold text-slate-900">{stats.evaluated}</h2>
          </div>
        </div>

        {/* Charts */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
            <BarChart2 size={20} className="mr-2 text-fuchsia-600" /> Tren Aktivitas Harian (14 Hari Terakhir)
          </h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                <XAxis dataKey="date" tick={{fontSize: 12}} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="Total" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}
