import { useEffect, useRef, useState } from 'react';
import {
  GraduationCap, LogOut, Sparkles, Search, Loader2, AlertCircle,
  ExternalLink, Compass, FileCheck, ListChecks, Check, Calendar,
  Bookmark, BookmarkCheck, Clock, ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import type { Profile } from '@/types/database';

interface DashboardPageProps {
  onSignOut: () => void;
}

interface MatchData {
  score: number;
  why_match: string;
  missing: string[];
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
  last_verified_at?: string | null;
  match: MatchData | null;
}

type DiscoverStep = 'idle' | 'discovering' | 'verifying' | 'matching' | 'done' | 'error';

const STEPS: { key: DiscoverStep; label: string; icon: typeof Compass }[] = [
  { key: 'discovering', label: 'Discovering', icon: Compass },
  { key: 'verifying', label: 'Verifying', icon: FileCheck },
  { key: 'matching', label: 'Matching', icon: ListChecks },
];

// Type badge colours — a different pastel per listing type.
const TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  scholarship: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-200' },
  internship: { bg: 'bg-mint-100', text: 'text-mint-500', border: 'border-mint-200' },
  hackathon: { bg: 'bg-lavender-100', text: 'text-lavender-400', border: 'border-lavender-200' },
  scheme: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
};

function getTypeStyle(type: string) {
  return TYPE_STYLES[type.toLowerCase()] ?? { bg: 'bg-cream-200', text: 'text-ink-700', border: 'border-ink-400/20' };
}

function daysUntil(deadline: string | null): number | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function deadlineLabel(deadline: string | null): { text: string; urgent: boolean; expired: boolean } {
  const days = daysUntil(deadline);
  if (days === null) return { text: 'No deadline', urgent: false, expired: false };
  if (days <= 0) return { text: 'Deadline passed', urgent: false, expired: true };
  if (days === 1) return { text: '1 day left', urgent: true, expired: false };
  if (days <= 7) return { text: `${days} days left`, urgent: true, expired: false };
  if (days <= 30) return { text: `${days} days left`, urgent: false, expired: false };
  return { text: `${deadline}`, urgent: false, expired: false };
}

function verifiedAgo(lastVerified: string | null): string | null {
  if (!lastVerified) return null;
  const d = new Date(lastVerified);
  if (Number.isNaN(d.getTime())) return null;
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Circular progress ring for match score.
function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#0ea5e9' : score >= 30 ? '#fbbf24' : '#fb7185';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          className="text-ink-400/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <span className="absolute font-display text-sm font-bold" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

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

  // Filter + saved state
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

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

  // Load saved listing IDs.
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('saved')
        .select('listing_id')
        .eq('user_id', user.id);
      if (mounted && data) {
        setSavedIds(new Set(data.map((r: { listing_id: string }) => r.listing_id)));
      }
    })();
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

      setStepDetail('Searching scholarships, internships, and hackathons for you...');

      const verifyTimer = setTimeout(() => {
        if (stepRef.current === 'discovering') {
          stepRef.current = 'verifying';
          setStep('verifying');
          setStepDetail('Fetching and verifying official pages...');
        }
      }, 20000);

      const matchTimer = setTimeout(() => {
        if (stepRef.current === 'verifying') {
          stepRef.current = 'matching';
          setStep('matching');
          setStepDetail('Matching listings to your profile...');
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

  const toggleSave = async (listingId: string) => {
    if (!user) return;
    setSavingId(listingId);

    try {
      if (savedIds.has(listingId)) {
        await supabase
          .from('saved')
          .delete()
          .eq('user_id', user.id)
          .eq('listing_id', listingId);
        setSavedIds((prev) => {
          const next = new Set(prev);
          next.delete(listingId);
          return next;
        });
      } else {
        await supabase
          .from('saved')
          .insert({ user_id: user.id, listing_id: listingId });
        setSavedIds((prev) => new Set(prev).add(listingId));
      }
    } catch {
      // ignore — user can retry
    } finally {
      setSavingId(null);
    }
  };

  const isRunning = step === 'discovering' || step === 'verifying' || step === 'matching';

  // Filter listings by type chip.
  const filteredListings = activeFilter === 'all'
    ? listings
    : listings.filter((l) => l.type?.toLowerCase() === activeFilter);

  // Get available type filters from listings.
  const availableTypes = Array.from(new Set(listings.map((l) => l.type?.toLowerCase()).filter(Boolean))) as string[];

  // The top match is the first listing (already sorted by score from discover).
  const topMatch = filteredListings[0] ?? null;
  const restListings = filteredListings.slice(1);

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
        <div className="mx-auto max-w-5xl px-6 pb-24 pt-6 md:pt-10">
          {/* Welcome + profile bento row */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

          {/* Find opportunities card */}
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

            {/* Find button */}
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
                          {i > 0 && (
                            <div className={`h-0.5 flex-1 transition-colors duration-500 ${
                              isComplete || isActive ? 'bg-sky-300' : 'bg-ink-400/20'
                            }`} />
                          )}
                          <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                            isComplete
                              ? 'border-mint-400 bg-mint-100 text-mint-500'
                              : isActive
                              ? 'border-sky-400 bg-sky-100 text-sky-500 scale-110'
                              : 'border-ink-400/30 bg-white text-ink-500'
                          }`}>
                            {isComplete ? (
                              <Check className="h-4 w-4" />
                            ) : isActive ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <StepIcon className="h-4 w-4" />
                            )}
                          </div>
                          {i < STEPS.length - 1 && (
                            <div className={`h-0.5 flex-1 transition-colors duration-500 ${
                              isComplete ? 'bg-sky-300' : 'bg-ink-400/20'
                            }`} />
                          )}
                        </div>
                        <span className={`mt-2 text-xs font-medium transition-colors duration-300 ${
                          isActive ? 'text-sky-600' : isComplete ? 'text-mint-500' : 'text-ink-500'
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

            {/* No results */}
            {step === 'done' && listings.length === 0 && !discoverError && (
              <p className="mt-5 rounded-2xl border border-ink-400/15 bg-white/60 px-4 py-6 text-center text-sm text-ink-500">
                No opportunities found right now. Try again later as new listings appear.
              </p>
            )}

            {/* Results: bento grid with top match + ranked cards */}
            {step === 'done' && listings.length > 0 && (
              <div className="mt-6">
                {/* Filter chips */}
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  <FilterChip
                    label="All"
                    active={activeFilter === 'all'}
                    onClick={() => setActiveFilter('all')}
                    count={listings.length}
                  />
                  {availableTypes.map((type) => (
                    <FilterChip
                      key={type}
                      label={type.charAt(0).toUpperCase() + type.slice(1)}
                      active={activeFilter === type}
                      onClick={() => setActiveFilter(type)}
                      count={listings.filter((l) => l.type?.toLowerCase() === type).length}
                    />
                  ))}
                </div>

                {filteredListings.length === 0 ? (
                  <p className="rounded-2xl border border-ink-400/15 bg-white/60 px-4 py-6 text-center text-sm text-ink-500">
                    No opportunities match this filter.
                  </p>
                ) : (
                  <>
                    {/* Top match card — large */}
                    {topMatch && (
                      <TopMatchCard
                        listing={topMatch}
                        isSaved={savedIds.has(topMatch.id)}
                        isSaving={savingId === topMatch.id}
                        onToggleSave={() => toggleSave(topMatch.id)}
                      />
                    )}

                    {/* Ranked opportunity cards */}
                    {restListings.length > 0 && (
                      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        {restListings.map((listing, i) => (
                          <OpportunityCard
                            key={listing.id || i}
                            listing={listing}
                            index={i}
                            isSaved={savedIds.has(listing.id)}
                            isSaving={savingId === listing.id}
                            onToggleSave={() => toggleSave(listing.id)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Search again */}
                    <div className="mt-6 text-center">
                      <button onClick={runDiscover} className="btn-primary mx-auto px-6">
                        <Compass className="h-4 w-4" />
                        Search again
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`chip ${
        active
          ? 'border-ink-900 bg-ink-900 text-cream-50 shadow-soft'
          : 'border-ink-400/20 bg-white/70 text-ink-600 hover:bg-white hover:shadow-soft'
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 text-xs ${
        active ? 'bg-cream-50/20' : 'bg-ink-400/10'
      }`}>
        {count}
      </span>
    </button>
  );
}

// Shared deadline badge.
function DeadlineBadge({ deadline }: { deadline: string | null }) {
  const info = deadlineLabel(deadline);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
      info.expired
        ? 'bg-rose-100 text-rose-500'
        : info.urgent
        ? 'bg-rose-100 text-rose-500'
        : 'bg-amber-100 text-amber-700'
    }`}>
      <Calendar className="h-3 w-3" />
      {info.text}
    </span>
  );
}

// Shared verified badge.
function VerifiedBadge({ lastVerified }: { lastVerified: string | null }) {
  const ago = verifiedAgo(lastVerified);
  if (!ago) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-mint-300 bg-mint-50 px-2.5 py-0.5 text-xs font-medium text-mint-500">
      <ShieldCheck className="h-3 w-3" />
      Verified {ago}
    </span>
  );
}

// Shared "View official source" link.
function SourceLink({ sourceUrl }: { sourceUrl: string }) {
  if (!sourceUrl) return null;
  return (
    <a
      href={sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 transition-colors hover:text-sky-700"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      View official source
    </a>
  );
}

// Shared document checklist.
function DocumentChecklist({ documents }: { documents: string[] }) {
  if (documents.length === 0) return null;
  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Documents required</h4>
      <ul className="mt-1.5 space-y-1">
        {documents.map((d, j) => (
          <li key={j} className="flex items-start gap-2 text-sm text-ink-700">
            <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-ink-400" />
            {d}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Shared Save button.
function SaveButton({ saved, saving, onClick }: { saved: boolean; saving: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-200 active:scale-[0.96] ${
        saved
          ? 'border-sky-300 bg-sky-50 text-sky-600'
          : 'border-ink-400/20 bg-white text-ink-600 hover:bg-cream-50'
      }`}
    >
      {saving ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : saved ? (
        <BookmarkCheck className="h-3.5 w-3.5" />
      ) : (
        <Bookmark className="h-3.5 w-3.5" />
      )}
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}

function TopMatchCard({
  listing, isSaved, isSaving, onToggleSave,
}: {
  listing: DiscoveredListing; isSaved: boolean; isSaving: boolean; onToggleSave: () => void;
}) {
  const typeStyle = getTypeStyle(listing.type);
  const score = listing.match?.score ?? 0;

  return (
    <div
      className="bento-card bg-white/90 p-7 animate-fade-up transition-all duration-300 hover:-translate-y-1 hover:shadow-float"
      style={{ animationDelay: '0ms' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-900 px-3 py-1 text-xs font-semibold text-cream-50">
              <Sparkles className="h-3 w-3" />
              Top match
            </span>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
              {listing.type || 'opportunity'}
            </span>
          </div>
          <h3 className="font-display text-xl font-extrabold tracking-tight text-ink-900">
            {listing.title || '(untitled)'}
          </h3>
        </div>
        {listing.match && <ScoreRing score={score} size={56} />}
      </div>

      {/* Badges row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DeadlineBadge deadline={listing.deadline} />
        <VerifiedBadge lastVerified={listing.last_verified_at ?? null} />
        {listing.cached && (
          <span className="inline-flex items-center gap-1 rounded-full border border-mint-300 bg-mint-50 px-2.5 py-0.5 text-xs font-medium text-mint-500">
            <Clock className="h-3 w-3" />
            Cached
          </span>
        )}
      </div>

      {/* Summary */}
      {listing.summary && (
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{listing.summary}</p>
      )}

      {/* Why you match */}
      {listing.match?.why_match && (
        <div className="mt-3 rounded-2xl bg-sky-50 px-4 py-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-600">Why you match</h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-700">{listing.match.why_match}</p>
        </div>
      )}

      {/* Missing criteria */}
      {listing.match?.missing && listing.match.missing.length > 0 && (
        <div className="mt-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-600">Missing criteria</h4>
          <ul className="mt-1 space-y-0.5">
            {listing.match.missing.map((m, j) => (
              <li key={j} className="flex items-start gap-1.5 text-sm text-ink-600">
                <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-amber-400" />
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Eligibility */}
      {listing.eligibility && (
        <div className="mt-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Eligibility</h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-700">{listing.eligibility}</p>
        </div>
      )}

      {/* Documents */}
      <DocumentChecklist documents={listing.documents_required} />

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <SourceLink sourceUrl={listing.source_url} />
        <SaveButton saved={isSaved} saving={isSaving} onClick={onToggleSave} />
      </div>
    </div>
  );
}

function OpportunityCard({
  listing, index, isSaved, isSaving, onToggleSave,
}: {
  listing: DiscoveredListing; index: number; isSaved: boolean; isSaving: boolean; onToggleSave: () => void;
}) {
  const typeStyle = getTypeStyle(listing.type);
  const score = listing.match?.score ?? 0;

  return (
    <div
      className="bento-card bg-white/90 p-5 animate-fade-up transition-all duration-300 hover:-translate-y-1 hover:shadow-float"
      style={{ animationDelay: `${(index + 1) * 60}ms` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}>
              {listing.type || 'opportunity'}
            </span>
          </div>
          <h3 className="font-display text-base font-bold text-ink-900 leading-snug">
            {listing.title || '(untitled)'}
          </h3>
        </div>
        {listing.match && <ScoreRing score={score} size={44} />}
      </div>

      {/* Badges */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <DeadlineBadge deadline={listing.deadline} />
        <VerifiedBadge lastVerified={listing.last_verified_at ?? null} />
      </div>

      {/* Summary */}
      {listing.summary && (
        <p className="mt-2.5 text-sm leading-relaxed text-ink-600 line-clamp-2">{listing.summary}</p>
      )}

      {/* Why you match */}
      {listing.match?.why_match && (
        <div className="mt-2.5 rounded-xl bg-sky-50 px-3 py-2">
          <p className="text-xs leading-relaxed text-ink-700">{listing.match.why_match}</p>
        </div>
      )}

      {/* Documents */}
      <DocumentChecklist documents={listing.documents_required} />

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <SourceLink sourceUrl={listing.source_url} />
        <SaveButton saved={isSaved} saving={isSaving} onClick={onToggleSave} />
      </div>
    </div>
  );
}
