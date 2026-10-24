import { GraduationCap, Sparkles, ArrowRight, Compass, ShieldCheck, Zap } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-cream-50 overflow-x-hidden">
      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 md:px-12 md:py-7">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-900 text-cream-50 shadow-soft">
            <GraduationCap className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-ink-900">
            Pathwise
          </span>
        </div>
        <button
          onClick={onGetStarted}
          className="hidden rounded-2xl px-5 py-2.5 font-display text-sm font-semibold text-ink-800 transition-colors hover:bg-white/60 md:block"
        >
          Sign in
        </button>
      </nav>

      {/* Hero */}
      <header className="relative px-6 pt-10 pb-20 md:px-12 md:pt-16 md:pb-28">
        {/* floating pastel blobs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-sky-200/50 blur-3xl" />
          <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-rose-200/40 blur-3xl" />
          <div className="absolute left-1/3 -bottom-10 h-72 w-72 rounded-full bg-mint-200/40 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-1.5 text-sm font-medium text-ink-700 shadow-soft animate-fade-in">
            <Sparkles className="h-4 w-4 text-amber-400" />
            Built for Indian students
          </div>

          <h1 className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-ink-900 text-balance animate-fade-up md:text-7xl">
            Find the opportunities
            <br />
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-sky-500 via-sky-400 to-mint-400 bg-clip-text text-transparent">
                meant for you.
              </span>
              <span className="absolute -bottom-1 left-0 z-0 h-3 w-full rounded-full bg-amber-200/60" />
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-600 animate-fade-up md:text-xl">
            Scholarships, internships, hackathons, and government schemes —
            matched to your branch, year, category, and skills. No more
            scrolling past what doesn't apply.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 animate-fade-up sm:flex-row">
            <button onClick={onGetStarted} className="btn-primary group w-full sm:w-auto">
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={onGetStarted}
              className="btn-secondary w-full sm:w-auto"
            >
              I already have an account
            </button>
          </div>

          <p className="mt-5 text-sm text-ink-500">
            Free to use &middot; No credit card needed
          </p>
        </div>
      </header>

      {/* Feature bento */}
      <section className="px-6 pb-24 md:px-12">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          <div className="bento-card-pastel bg-sky-100 p-6 animate-fade-up">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 text-sky-500">
              <Compass className="h-5 w-5" />
            </div>
            <h3 className="font-display font-semibold text-ink-900">Personalized matches</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
              We score every listing against your profile so the best fits rise to the top.
            </p>
          </div>

          <div className="bento-card-pastel bg-mint-100 p-6 animate-fade-up" style={{ animationDelay: '60ms' }}>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 text-mint-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-display font-semibold text-ink-900">Verified listings</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
              Every opportunity is sourced and checked, with deadlines and documents laid out clearly.
            </p>
          </div>

          <div className="bento-card-pastel bg-amber-100 p-6 animate-fade-up sm:col-span-2 md:col-span-1" style={{ animationDelay: '120ms' }}>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 text-amber-500">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-display font-semibold text-ink-900">Always fresh</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
              New scholarships and schemes are added continuously, so your feed never goes stale.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-400/15 px-6 py-8 md:px-12">
        <p className="text-center text-sm text-ink-500">
          Made with care for students across India.
        </p>
      </footer>
    </div>
  );
}
