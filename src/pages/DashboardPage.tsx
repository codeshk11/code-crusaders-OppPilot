import { useEffect, useRef, useState } from 'react';
import {
  GraduationCap, LogOut, Sparkles, Search, Loader2, AlertCircle,
  ExternalLink, Compass, FileCheck, ListChecks, Check, Calendar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Profile } from '@/types/database';

interface DashboardPageProps {
  onSignOut: () => void;
}

interface DiscoveredListing {
  id: string;
  title: string;
  type: string;
  deadline: string | null;
  eligibility: string;
  documents_required: string[];
  summary: string;
  url: string;
  source_url: string;
  cached: boolean;
}

type DiscoverStep = 'idle' | 'discovering' | 'verifying' | 'matching' | 'done' | 'error';

const STEPS: { key: DiscoverStep; label: string; icon: typeof Compass }[] = [
  { key: 'discovering', label: 'Discovering', icon: Compass },
  { key: 'verifying', label: 'Verifying', icon: FileCheck },
  { key: 'matching', label: 'Matching', icon: ListChecks },
];

export default function DashboardPage({ onSignOut }: DashboardPageProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Discover state
  const [step, setStep] = useState<DiscoverStep>('idle');
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [listings, setListings] = useState<DiscoveredListing[]>([]);
  const [stepDetail, setStepDetail] = useState<string>('');
  const stepRef = useRef<DiscoverStep>('idle');

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

  const runDiscover = async () => {
    setStep('discovering');
    stepRef.current = 'discovering';
    setDiscoverError(null);
    setListings([]);
    setStepDetail('Building search queries from your profile...');

    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discover`;
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      if (!accessToken) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      // Phase 1: Discovering (searching)
      // The discover function takes ~40-60s total. We simulate step transitions
      // while it runs, then reconcile with the real result.
      setStepDetail('Searching scholarships, internships, and hackathons for you...');

      // After ~20s, advance to verifying visually.
      const verifyTimer = setTimeout(() => {
        if (stepRef.current === 'discovering') {
          stepRef.current = 'verifying';
          setStep('verifying');
          setStepDetail('Fetching and verifying official pages...');
        }
      }, 20000);

      // After ~45s, advance to matching visually.
      const matchTimer = setTimeout(() => {
        if (stepRef.current === 'verifying') {
          stepRef.current = 'matching';
          setStep('matching');
          setStepDetail('Extracting and matching listings to your profile...');
        }
      }, 45000);

      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({}),
      });

      clearTimeout(verifyTimer);
      clearTimeout(matchTimer);

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          (data && typeof data.error === 'string' && data.error) ||
          `Discovery failed (${res.status})`;
        throw new Error(msg);
      }

      const foundListings: DiscoveredListing[] =
        data && Array.isArray(data.listings) ? data.listings : [];

      setStep('done');
      stepRef.current = 'done';
      setStepDetail('');
      setListings(foundListings);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setDiscoverError(msg);
      setStep('error');
      stepRef.current = 'error';
      setStepDetail('');
    }
  };

  const isRunning = step === 'discovering' || step === 'verifying' || step === 'matching';

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
                Your profile is set up. Tap "Find opportunities" to discover scholarships, internships, and hackathons matched to you.
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
              We'll search for scholarships, internships, and hackathons based on your profile, verify official sources, and match them to you.
            </p>

            {/* Find button (idle / done / error states) */}
            {step === 'idle' && (
              <div className="mt-5 text-center">
                <button onClick={runDiscover} className="btn-primary mx-auto px-6">
                  <Compass className="h-4 w-4" />
                  Find opportunities
                </button>
              </div>
            )}

            {/* Progress stepper */}
            {isRunning && (
              <div className="mt-7 animate-fade-in">
                <div className="flex items-center justify-between">
                  {STEPS.map((s, i) => {
                    const StepIcon = s.icon;
                    const stepOrder = ['discovering', 'verifying', 'matching'];
                    const currentIdx = stepOrder.indexOf(step);
                    const stepIdx = stepOrder.indexOf(s.key);
                    const isComplete = stepIdx < currentIdx;
                    const isActive = stepIdx === currentIdx;

                    return (
                      <div key={s.key} className="flex flex-1 flex-col items-center">
                        <div className="flex w-full items-center">
                          {/* connector line before */}
                          {i > 0 && (
                            <div className={`h-0.5 flex-1 transition-colors duration-500 ${
                              isComplete || isActive ? 'bg-sky-300' : 'bg-ink-200'
                            }`} />
                          )}
                          {/* circle */}
                          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                            isComplete
                              ? 'border-mint-400 bg-mint-100 text-mint-500'
                              : isActive
                              ? 'border-sky-400 bg-sky-100 text-sky-500 scale-110'
                              : 'border-ink-200 bg-white text-ink-400'
                          }`}>
                            {isComplete ? (
                              <Check className="h-4 w-4" />
                            ) : isActive ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <StepIcon className="h-4 w-4" />
                            )}
                          </div>
                          {/* connector line after */}
                          {i < STEPS.length - 1 && (
                            <div className={`h-0.5 flex-1 transition-colors duration-500 ${
                              isComplete ? 'bg-sky-300' : 'bg-ink-200'
                            }`} />
                          )}
                        </div>
                        <span className={`mt-2 text-xs font-medium transition-colors duration-300 ${
                          isActive ? 'text-sky-600' : isComplete ? 'text-mint-500' : 'text-ink-400'
                        }`}>
                          {s.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-5 text-center text-sm text-ink-500 animate-fade-in">
                  {stepDetail}
                </p>
              </div>
            )}

            {/* Error */}
            {step === 'error' && discoverError && (
              <>
                <div className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 animate-fade-in">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{discoverError}</span>
                </div>
                <div className="mt-4 text-center">
                  <button onClick={runDiscover} className="btn-primary mx-auto px-6">
                    <Compass className="h-4 w-4" />
                    Try again
                  </button>
                </div>
              </>
            )}

            {/* Results */}
            {step === 'done' && listings.length === 0 && !discoverError && (
              <p className="mt-5 rounded-2xl border border-ink-400/15 bg-white/60 px-4 py-6 text-center text-sm text-ink-500">
                No opportunities found right now. Try again later as new listings appear.
              </p>
            )}

            {step === 'done' && listings.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-700">
                  <Check className="h-4 w-4 text-mint-500" />
                  {listings.length} {listings.length === 1 ? 'opportunity' : 'opportunities'} found
                </div>
                {listings.map((l, i) => (
                  <ListingCard key={l.id || i} listing={l} index={i} />
                ))}
                <div className="mt-4 text-center">
                  <button onClick={runDiscover} className="btn-primary mx-auto px-6">
                    <Compass className="h-4 w-4" />
                    Search again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListingCard({ listing, index }: { listing: DiscoveredListing; index: number }) {
  return (
    <div
      className="bento-card bg-white/90 p-5 animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-base font-bold text-ink-900">
          {listing.title || '(untitled)'}
        </h3>
        {listing.source_url && (
          <a
            href={listing.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-ink-500 transition-colors hover:text-sky-600"
            aria-label="Open source page"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {listing.type && (
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
            {listing.type}
          </span>
        )}
        {listing.deadline && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            <Calendar className="h-3 w-3" />
            {listing.deadline}
          </span>
        )}
        {listing.cached && (
          <span className="rounded-full border border-mint-300 bg-mint-50 px-3 py-1 text-xs font-medium text-mint-500">
            Cached
          </span>
        )}
      </div>

      {listing.summary && (
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{listing.summary}</p>
      )}

      {listing.eligibility && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Eligibility</h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-700">{listing.eligibility}</p>
        </div>
      )}

      {listing.documents_required.length > 0 && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Documents required</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {listing.documents_required.map((d, j) => (
              <span key={j} className="rounded-lg bg-cream-200 px-2.5 py-1 text-xs text-ink-600">
                {d}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
