import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './utils/supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import PrincipalDashboard from './pages/PrincipalDashboard';
import FoundationDashboard from './pages/FoundationDashboard';
import KaihLoadingScreen from './components/KaihLoadingScreen';

function App() {
  const [session, setSession] = useState<any>(null);
  const [role, setRole] = useState<string | null>(() => {
    return localStorage.getItem('BUDI_UTOMO_USER_ROLE') || null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchRole = async (userId: string) => {
      try {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', userId)
          .single();
        if (isMounted) {
          const userRole = data?.role || null;
          setRole(userRole);
          if (userRole) {
            localStorage.setItem('BUDI_UTOMO_USER_ROLE', userRole);
          } else {
            localStorage.removeItem('BUDI_UTOMO_USER_ROLE');
          }
        }
      } catch (err) {
        console.error('Error fetching role:', err);
      }
    };

    // Initial session retrieval
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (!isMounted) return;
      setSession(currentSession);
      if (currentSession?.user) {
        await fetchRole(currentSession.user.id);
      } else {
        setRole(null);
        localStorage.removeItem('BUDI_UTOMO_USER_ROLE');
      }
      if (isMounted) {
        setLoading(false);
      }
    });

    // Handle Auth Changes silently (prevent unmounting on tab switch or token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !currentSession) {
        setSession(null);
        setRole(null);
        localStorage.removeItem('BUDI_UTOMO_USER_ROLE');
        return;
      }

      setSession(currentSession);

      // Only re-fetch role if signed in or not yet set
      if (currentSession?.user) {
        const cachedRole = localStorage.getItem('BUDI_UTOMO_USER_ROLE');
        if (!cachedRole || event === 'SIGNED_IN') {
          await fetchRole(currentSession.user.id);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <KaihLoadingScreen message="Memverifikasi Sesi Masuk..." />;
  }

  // Redirect logic based on role
  // Kepsek & Yayasan use the same rich claymorphic portal as Guru (/dashboard) in read-only monitoring mode
  const getHomeRoute = () => {
    if (role === 'admin') return '/admin';
    if (['guru', 'kepsek', 'yayasan'].includes(role || '')) return '/dashboard';
    return '/'; // Fallback if no role or unauthenticated
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
        {/* Forward legacy routes to /dashboard for unified leadership experience */}
        <Route 
          path="/principal" 
          element={
            session && ['kepsek', 'admin'].includes(role || '') ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <PrincipalDashboard />
            )
          } 
        />
        <Route 
          path="/foundation" 
          element={
            session && ['yayasan', 'admin'].includes(role || '') ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <FoundationDashboard />
            )
          } 
        />
        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
