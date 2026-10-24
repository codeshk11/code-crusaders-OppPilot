import { useState, type FormEvent } from 'react';
import { GraduationCap, ArrowLeft, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AuthPageProps {
  mode: 'login' | 'signup';
  onBack: () => void;
  onToggleMode: () => void;
}

export default function AuthPage({ mode, onBack, onToggleMode }: AuthPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === 'signup';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      // onAuthStateChange in AuthContext picks up the session; App routes onward.
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-cream-50 overflow-hidden">
      {/* pastel backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-0 h-80 w-80 rounded-full bg-sky-200/50 blur-3xl" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-rose-200/40 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint-200/30 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* nav */}
        <nav className="flex items-center justify-between px-6 py-5 md:px-12">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-white/60"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-cream-50">
              <GraduationCap className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <span className="font-display font-bold tracking-tight text-ink-900">Pathwise</span>
          </div>
        </nav>

        {/* card */}
        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-md animate-fade-up">
            <div className="bento-card bg-white/80 p-8 md:p-10">
              <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
                {isSignup ? 'Create your account' : 'Welcome back'}
              </h1>
              <p className="mt-1.5 text-sm text-ink-600">
                {isSignup
                  ? 'Sign up to find opportunities matched to you.'
                  : 'Sign in to continue to your dashboard.'}
              </p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-800">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@college.edu"
                      className="input-field pl-11"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-800">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" />
                    <input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isSignup ? 'At least 6 characters' : 'Your password'}
                      className="input-field pl-11"
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 animate-fade-in">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isSignup ? 'Creating account...' : 'Signing in...'}
                    </>
                  ) : (
                    <>{isSignup ? 'Create account' : 'Sign in'}</>
                  )}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-ink-600">
                {isSignup ? (
                  <>
                    Already have an account?{' '}
                    <button
                      onClick={onToggleMode}
                      className="font-semibold text-sky-600 hover:text-sky-700"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    New here?{' '}
                    <button
                      onClick={onToggleMode}
                      className="font-semibold text-sky-600 hover:text-sky-700"
                    >
                      Create an account
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
