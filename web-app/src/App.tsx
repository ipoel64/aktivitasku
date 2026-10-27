import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './utils/supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import PrincipalDashboard from './pages/PrincipalDashboard';
import FoundationDashboard from './pages/FoundationDashboard';

function App() {
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessionAndRole = async (currentSession: any) => {
      setSession(currentSession);
      if (currentSession?.user) {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', currentSession.user.id)
          .single();
        setRole(data?.role || null);
      } else {
        setRole(null);
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      fetchSessionAndRole(currentSession);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setLoading(true);
      fetchSessionAndRole(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">Memuat Sesi...</div>;
  }

  // Redirect logic based on role
  const getHomeRoute = () => {
    if (role === 'admin') return '/admin';
    if (role === 'guru') return '/dashboard';
    if (role === 'kepsek') return '/principal';
    if (role === 'yayasan') return '/foundation';
    return '/'; // Fallback if no role or student (student gets rejected in Login anyway)
  };

  return (
    <Router>
      <Routes>
        <Route 
          path="/" 
          element={!session ? <Login /> : <Navigate to={getHomeRoute()} replace />} 
        />
        <Route 
          path="/dashboard" 
          element={
            session && ['guru', 'admin', 'kepsek', 'yayasan'].includes(role || '') ? (
              <Dashboard />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/admin" 
          element={
            session && role === 'admin' ? (
              <AdminDashboard />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/principal" 
          element={
            session && role === 'kepsek' ? (
              <PrincipalDashboard />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
        <Route 
          path="/foundation" 
          element={
            session && role === 'yayasan' ? (
              <FoundationDashboard />
            ) : (
              <Navigate to="/" replace />
            )
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;
