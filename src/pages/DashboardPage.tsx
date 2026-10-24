import { useEffect, useState } from 'react';
import { GraduationCap, LogOut, Sparkles, Search, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Profile } from '@/types/database';

interface DashboardPageProps {
  onSignOut: () => void;
}

export default function DashboardPage({ onSignOut }: DashboardPageProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (mounted) {
        setProfile(data as Profile | null);
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const firstName = profile?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="relative min-h-screen bg-cream-50 overflow-x-hidden">
      {/* pastel backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-mint-200/40 blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* nav */}
        <nav className="flex items-center justify-between px-6 py-5 md:px-12">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-cream-50">
              <GraduationCap className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <span className="font-display font-bold tracking-tight text-ink-900">Pathwise</span>
          </div>
          <button
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-white/60"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </nav>

        {/* content */}
        <div className="mx-auto max-w-4xl px-6 pb-24 pt-6 md:pt-10">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* welcome bento */}
            <div className="bento-card-pastel bg-sky-100 p-7 md:col-span-2 animate-fade-up">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-sky-600">
                <Sparkles className="h-3.5 w-3.5" />
                {loading ? 'Loading...' : 'All set'}
              </div>
              <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900 md:text-4xl">
                Welcome, {loading ? '' : firstName}
              </h1>
              <p className="mt-2 max-w-md text-ink-600">
                Your profile is set up. Your personalized opportunity feed will appear here soon.
              </p>
            </div>

            {/* profile summary bento */}
            <div className="bento-card-pastel bg-mint-100 p-7 animate-fade-up" style={{ animationDelay: '80ms' }}>
              <h2 className="font-display text-sm font-semibold text-ink-700">Your profile</h2>
              <dl className="mt-3 space-y-2.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">College</dt>
                  <dd className="font-medium text-ink-900 text-right">{profile?.college ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Branch</dt>
                  <dd className="font-medium text-ink-900 text-right">{profile?.branch ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">Year</dt>
                  <dd className="font-medium text-ink-900 text-right">{profile?.year ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-ink-500">CGPA</dt>
                  <dd className="font-medium text-ink-900 text-right">
                    {profile?.cgpa != null ? profile.cgpa : '—'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          {/* find opportunities card */}
          <div className="mt-4 bento-card bg-white/80 p-7 text-center animate-fade-up" style={{ animationDelay: '160ms' }}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-200 text-ink-500">
              <Search className="h-6 w-6" />
            </div>
            <h2 className="font-display text-xl font-bold text-ink-900">
              Find opportunities
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-600">
              Matched scholarships, internships, hackathons, and schemes will show up here once the matching engine is live.
            </p>
            <button
              disabled
              className="btn-primary mt-5 cursor-not-allowed opacity-50"
            >
              <Lock className="h-4 w-4" />
              Find opportunities
            </button>
            <p className="mt-3 text-xs text-ink-500">Coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}
