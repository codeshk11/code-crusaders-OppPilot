import { useEffect, useState, type FormEvent } from 'react';
import { GraduationCap, LogOut, Sparkles, Search, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Profile } from '@/types/database';

interface DashboardPageProps {
  onSignOut: () => void;
}

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export default function DashboardPage({ onSignOut }: DashboardPageProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Opportunities search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [opportunities, setOpportunities] = useState<SearchResult[]>([]);

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

  const runSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setOpportunities([]);

    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tf-search`;
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          (data && typeof data.error === 'string' && data.error) ||
          `Search failed (${res.status})`;
        throw new Error(msg);
      }

      if (data && Array.isArray(data.results)) {
        setOpportunities(data.results as SearchResult[]);
      } else {
        setOpportunities([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setSearchError(msg);
    } finally {
      setSearching(false);
    }
  };

  // Default search suggestion based on profile
  const suggestedQuery = profile?.branch
    ? `${profile.branch} scholarship internship`
    : 'scholarship internship hackathon';

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
                Your profile is set up. Search for opportunities below or visit the debug page to test the pipeline.
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
          <div className="mt-4 bento-card bg-white/80 p-7 animate-fade-up" style={{ animationDelay: '160ms' }}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
              <Search className="h-6 w-6" />
            </div>
            <h2 className="font-display text-xl font-bold text-ink-900 text-center">
              Find opportunities
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-600 text-center">
              Search live scholarships, internships, hackathons, and schemes.
            </p>

            <form onSubmit={runSearch} className="mt-5 flex gap-2">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={suggestedQuery}
                className="input-field"
              />
              <button type="submit" disabled={searching || !searchQuery.trim()} className="btn-primary px-5 flex-shrink-0">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="hidden sm:inline">Search</span>
              </button>
            </form>

            {searchError && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 animate-fade-in">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {searching && (
              <div className="mt-4 flex items-center justify-center gap-2 py-8 text-ink-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Searching for opportunities...</span>
              </div>
            )}

            {!searching && opportunities.length > 0 && (
              <div className="mt-5 space-y-3">
                {opportunities.map((r, i) => (
                  <div
                    key={i}
                    className="bento-card bg-white/90 p-4 animate-fade-up"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-display text-sm font-semibold text-ink-900">
                        {r.title || '(no title)'}
                      </h3>
                      {r.url && (
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-ink-500 transition-colors hover:text-sky-600"
                          aria-label="Open link"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                    {r.snippet && (
                      <p className="mt-1 text-sm leading-relaxed text-ink-600">{r.snippet}</p>
                    )}
                    {r.url && (
                      <p className="mt-1.5 truncate text-xs text-sky-600">{r.url}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!searching && !searchError && opportunities.length === 0 && searchQuery.trim() && (
              <p className="mt-5 rounded-2xl border border-ink-400/15 bg-white/60 px-4 py-6 text-center text-sm text-ink-500">
                No opportunities found. Try a different search term.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
