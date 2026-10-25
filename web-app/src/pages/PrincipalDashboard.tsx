import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { LogOut, Users, BookOpen, Activity, Map, Printer, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix leaflet marker icon issue in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const COLORS = ['#0D9488', '#F59E0B', '#6366F1', '#10B981', '#F97316', '#EF4444'];

export default function PrincipalDashboard() {
  const [stats, setStats] = useState({ students: 0, teachers: 0, activitiesToday: 0 });
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    
    // 1. Get total students and teachers
    const { count: studentCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'siswa').eq('is_active', true);
    const { count: teacherCount } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'guru').eq('is_active', true);
    
    // 2. Get activities
    const today = new Date().toISOString().split('T')[0];
    const { data: actData } = await supabase
      .from('activities')
      .select(`
        id, title, activity_date, latitude, longitude, location_name,
        students(user_profiles(full_name)),
        activity_categories(name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (actData) {
      setActivities(actData);
      const todayActs = actData.filter(a => a.activity_date === today).length;
      
      // Calculate category distribution
      const catCount: Record<string, number> = {};
      actData.forEach((act: any) => {
        const catName = Array.isArray(act.activity_categories) ? act.activity_categories[0]?.name : act.activity_categories?.name;
        const finalCatName = catName || 'Lainnya';
        catCount[finalCatName] = (catCount[finalCatName] || 0) + 1;
      });
      
      const chartData = Object.keys(catCount).map(key => ({
        name: key,
        value: catCount[key]
      }));
      setCategoryData(chartData);
      
      setStats({
        students: studentCount || 0,
        teachers: teacherCount || 0,
        activitiesToday: todayActs
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
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Memuat Data Sekolah...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">KS</div>
            <h1 className="text-xl font-bold text-slate-900">Dashboard Kepala Sekolah</h1>
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
        <div className="hidden print:block mb-8 text-center">
          <h1 className="text-2xl font-bold">Laporan Ringkasan Aktivitas Siswa</h1>
          <p className="text-slate-500">Yayasan Pendidikan Budi Utomo</p>
          <p className="text-sm mt-2">Dicetak pada: {new Date().toLocaleDateString('id-ID')}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mr-4">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Total Siswa Aktif</p>
              <h2 className="text-2xl font-bold text-slate-900">{stats.students}</h2>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center mr-4">
              <BookOpen size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Total Guru</p>
              <h2 className="text-2xl font-bold text-slate-900">{stats.teachers}</h2>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center mr-4">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Aktivitas Hari Ini</p>
              <h2 className="text-2xl font-bold text-slate-900">{stats.activitiesToday}</h2>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
              <PieChartIcon size={20} className="mr-2 text-indigo-600" /> Distribusi Kategori Aktivitas
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
              <Activity size={20} className="mr-2 text-indigo-600" /> Aktivitas (Berdasarkan Kategori)
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip cursor={{fill: 'rgba(0,0,0,0.05)'}} />
                  <Bar dataKey="value" fill="#0D9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 print:hidden">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
            <Map size={20} className="mr-2 text-indigo-600" /> Peta Sebaran Aktivitas Siswa
          </h3>
          <div className="h-[400px] w-full rounded-lg overflow-hidden border border-slate-200 relative z-0">
            <MapContainer center={[-6.200000, 106.816666]} zoom={10} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {activities.filter(a => a.latitude && a.longitude).map(act => (
                <Marker key={act.id} position={[act.latitude, act.longitude]}>
                  <Popup>
                    <strong>{act.students?.user_profiles?.full_name}</strong><br/>
                    {act.title}<br/>
                    <span className="text-xs text-slate-500">{act.location_name}</span>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      </main>
    </div>
  );
}
