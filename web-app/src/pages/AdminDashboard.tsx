import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';
import { LogOut, Users, Shield, UserX, CheckCircle, Search, TrendingUp, UserCheck, BookOpen, Plus, X } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Create a secondary client that doesn't save the session to localStorage,
// so creating a user won't log the admin out!
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const adminAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Stats
  const [stats, setStats] = useState({ total: 0, active: 0, teachers: 0, students: 0 });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', fullName: '', role: 'siswa' });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const lower = searchTerm.toLowerCase();
      setFilteredUsers(users.filter(u => 
        u.email?.toLowerCase().includes(lower) || 
        u.user_profiles?.[0]?.full_name?.toLowerCase().includes(lower)
      ));
    }
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, email, role, is_active, created_at,
        user_profiles ( full_name )
      `)
      .order('created_at', { ascending: false });

    if (data) {
      setUsers(data);
      setFilteredUsers(data);
      
      setStats({
        total: data.length,
        active: data.filter(u => u.is_active).length,
        teachers: data.filter(u => u.role === 'guru').length,
        students: data.filter(u => u.role === 'siswa').length
      });
    } else if (error) {
      console.error(error);
      alert("Gagal memuat data pengguna.");
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const updateRole = async (userId: string, newRole: string) => {
    setUpdating(userId);
    try {
      const { error } = await supabase.from('users').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
      await fetchUsers();
    } catch (e) {
      console.error(e);
      alert("Gagal memperbarui jabatan (role).");
    } finally {
      setUpdating(null);
    }
  };

  const toggleStatus = async (userId: string, currentStatus: boolean) => {
    setUpdating(userId);
    try {
      const { error } = await supabase.from('users').update({ is_active: !currentStatus }).eq('id', userId);
      if (error) throw error;
      await fetchUsers();
    } catch (e) {
      console.error(e);
      alert("Gagal memperbarui status pengguna.");
    } finally {
      setUpdating(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      // 1. Create User in Auth using secondary client (won't log out admin)
      const { data: authData, error: authError } = await adminAuthClient.auth.signUp({
        email: newUser.email,
        password: newUser.password,
      });

      if (authError) throw authError;

      // 2. Wait 2 seconds for Postgres Trigger to create row in public.users
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (authData.user) {
        // 3. Update the generated profile with selected role and name using primary client
        await supabase.from('users').update({ role: newUser.role }).eq('id', authData.user.id);
        const { data: prof } = await supabase
          .from('user_profiles')
          .update({ full_name: newUser.fullName })
          .eq('user_id', authData.user.id)
          .select('id')
          .single();

        if (prof?.id) {
          if (newUser.role === 'siswa') {
            await supabase.from('students').insert({ profile_id: prof.id });
          } else if (newUser.role === 'guru') {
            await supabase.from('teachers').insert({ profile_id: prof.id });
          }
        }
      }

      alert(`Berhasil menambahkan ${newUser.role} baru!`);
      setIsModalOpen(false);
      setNewUser({ email: '', password: '', fullName: '', role: 'siswa' });
      await fetchUsers();
    } catch (err: any) {
      console.error(err);
      alert("Gagal membuat pengguna: " + (err.message || 'Error tidak diketahui'));
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">Memuat Data Sistem...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <header className="bg-slate-900 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex justify-between items-center">
          <div className="flex items-center text-white">
            <div className="bg-teal-500 p-2 rounded-lg mr-3">
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Portal Admin</h1>
              <p className="text-xs text-slate-400 font-medium">Sistem Manajemen Aktivitas Budi Utomo</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center px-4 py-2 bg-slate-800 rounded-md text-slate-300 hover:text-white hover:bg-slate-700 transition-all font-medium text-sm">
            <LogOut size={16} className="mr-2" /> Keluar
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
            <div className="p-3 bg-blue-100 text-blue-600 rounded-lg mr-4"><Users size={24} /></div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Pengguna</p>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
            <div className="p-3 bg-green-100 text-green-600 rounded-lg mr-4"><UserCheck size={24} /></div>
            <div>
              <p className="text-sm font-medium text-slate-500">Akun Aktif</p>
              <p className="text-2xl font-bold text-slate-900">{stats.active}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
            <div className="p-3 bg-purple-100 text-purple-600 rounded-lg mr-4"><BookOpen size={24} /></div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Guru</p>
              <p className="text-2xl font-bold text-slate-900">{stats.teachers}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-lg mr-4"><TrendingUp size={24} /></div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Siswa</p>
              <p className="text-2xl font-bold text-slate-900">{stats.students}</p>
            </div>
          </div>
        </div>

        {/* Main Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          
          {/* Toolbar */}
          <div className="p-5 border-b border-slate-200 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center">
              Manajemen Pengguna
            </h2>
            <div className="flex w-full sm:w-auto items-center gap-4">
              <div className="relative w-full sm:w-64">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search size={18} className="text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Cari email atau nama..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 sm:text-sm transition-colors"
                />
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
              >
                <Plus size={18} className="mr-2" />
                Tambah Pengguna
              </button>
            </div>
          </div>
          
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Email / Nama Profil</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-48">Jabatan (Role)</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-32">Status Akun</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-40">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredUsers.map((u) => {
                  const fullName = u.user_profiles?.[0]?.full_name || 'Profil Belum Dilengkapi';
                  
                  return (
                    <tr key={u.id} className={`${updating === u.id ? 'opacity-50' : 'hover:bg-slate-50'} transition-colors duration-150`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-slate-900">{u.email}</div>
                        <div className="text-sm text-slate-500 mt-1">{fullName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select 
                          value={u.role}
                          onChange={(e) => updateRole(u.id, e.target.value)}
                          disabled={updating === u.id}
                          className="block w-full py-2 px-3 border border-slate-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 sm:text-sm font-medium"
                        >
                          <option value="siswa">Siswa</option>
                          <option value="guru">Guru</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full ${u.is_active ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                          {u.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => toggleStatus(u.id, u.is_active)}
                          disabled={updating === u.id}
                          className={`inline-flex items-center px-3 py-2 rounded-md border text-xs font-bold transition-colors ${u.is_active ? 'border-slate-300 text-slate-700 bg-white hover:bg-slate-100' : 'border-emerald-500 text-white bg-emerald-600 hover:bg-emerald-700'}`}
                        >
                          {u.is_active ? (
                            <><UserX size={14} className="mr-1.5" /> Blokir</>
                          ) : (
                            <><CheckCircle size={14} className="mr-1.5" /> Aktifkan</>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 flex flex-col items-center justify-center">
                      <Search size={32} className="text-slate-300 mb-3" />
                      <p className="text-lg font-medium">Tidak ada data pengguna ditemukan.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Tambah Pengguna */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 transition-opacity">
          {/* Overlay Click Handler */}
          <div className="absolute inset-0" onClick={() => !isCreating && setIsModalOpen(false)}></div>
          
          {/* Modal Content */}
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col z-10">
            <div className="bg-white px-6 pt-6 pb-4 border-b border-slate-200">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-slate-900" id="modal-title">Tambah Pengguna Baru</h3>
                <button onClick={() => !isCreating && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-500 transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handleCreateUser} autoComplete="off">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                    <input type="text" required value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} autoComplete="off" className="block w-full border border-slate-300 rounded-lg shadow-sm py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Login</label>
                    <input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} autoComplete="off" data-lpignore="true" className="block w-full border border-slate-300 rounded-lg shadow-sm py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Kata Sandi (Minimal 6 Karakter)</label>
                    <input type="password" required minLength={6} value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} autoComplete="new-password" data-lpignore="true" className="block w-full border border-slate-300 rounded-lg shadow-sm py-2.5 px-3 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Jabatan (Role)</label>
                    <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="block w-full py-2.5 px-3 border border-slate-300 bg-white rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 sm:text-sm font-medium">
                      <option value="siswa">Siswa</option>
                      <option value="guru">Guru</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="mt-8 mb-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isCreating} className="py-2 px-4 border border-slate-300 rounded-lg shadow-sm text-sm font-bold text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors">
                    Batal
                  </button>
                  <button type="submit" disabled={isCreating} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-bold rounded-lg text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-colors">
                    {isCreating ? 'Mendaftarkan...' : 'Simpan Pengguna'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
