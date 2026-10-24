import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useHashRoute } from '@/lib/router';
import { supabase } from '@/lib/supabase';
import LandingPage from '@/pages/LandingPage';
import AuthPage from '@/pages/AuthPage';
import OnboardingPage from '@/pages/OnboardingPage';
import DashboardPage from '@/pages/DashboardPage';
import DebugPage from '@/pages/DebugPage';

function AppRoutes() {
  const { path, navigate } = useHashRoute();
  const { session, loading, signOut } = useAuth();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [profileChecking, setProfileChecking] = useState(false);

  // Normalize the path into a clean route.
  const route = path.replace(/^\/+/, '/') || '/';
  const segments = route.split('/').filter(Boolean);
  const first = segments[0] ?? '';

  // When the user is signed in, check whether they have a profile.
  useEffect(() => {
    if (loading || !session?.user) {
      setHasProfile(null);
      return;
    }
    let mounted = true;
    setProfileChecking(true);
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', session.user.id)
        .maybeSingle();
      if (mounted) {
        setHasProfile(!!data);
        setProfileChecking(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [session?.user?.id, loading]);

  // After login redirect logic: signed-in users not actively visiting auth/onboarding/dashboard
  // get routed based on profile presence.
  useEffect(() => {
    if (loading || !session) return;
    const onAuthPage = first === 'login' || first === 'signup';
    if (onAuthPage) {
      // signed-in user on an auth page -> send to dashboard (the onboarding check below refines)
      if (hasProfile === false) navigate('/onboarding');
      else if (hasProfile === true) navigate('/dashboard');
      return;
    }
    if (first === 'onboarding' && hasProfile === true) {
      navigate('/dashboard');
      return;
    }
    // If logged in and at root, route by profile presence.
    if (route === '/') {
      if (hasProfile === false) navigate('/onboarding');
      else if (hasProfile === true) navigate('/dashboard');
    }
  }, [loading, session, hasProfile, first, route, navigate]);

  // Guard onboarding/dashboard for signed-out users.
  useEffect(() => {
    if (loading) return;
    if (!session) {
      if (first === 'onboarding' || first === 'dashboard') {
        navigate('/login');
      }
    }
  }, [loading, session, first, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-400/20 border-t-sky-500" />
      </div>
    );
  }

  // Hidden debug page — accessible regardless of auth state.
  if (first === 'debug') {
    return <DebugPage onBack={() => navigate('/')} />;
  }

  // Landing
  if (!session) {
    if (first === 'login') {
      return <AuthPage mode="login" onBack={() => navigate('/')} onToggleMode={() => navigate('/signup')} />;
    }
    if (first === 'signup') {
      return <AuthPage mode="signup" onBack={() => navigate('/')} onToggleMode={() => navigate('/login')} />;
    }
    return <LandingPage onGetStarted={() => navigate('/signup')} />;
  }

  // Signed in
  if (first === 'onboarding') {
    return <OnboardingPage onComplete={() => navigate('/dashboard')} onBack={() => navigate('/dashboard')} />;
  }

  if (first === 'dashboard') {
    return <DashboardPage onSignOut={signOut} />;
  }

  // Fallback while profile state is still resolving.
  if (profileChecking || hasProfile === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-400/20 border-t-sky-500" />
      </div>
    );
  }

  // Signed in at an unknown route: route by profile presence.
  if (hasProfile) {
    return <DashboardPage onSignOut={signOut} />;
  }
  return <OnboardingPage onComplete={() => navigate('/dashboard')} onBack={() => navigate('/dashboard')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
