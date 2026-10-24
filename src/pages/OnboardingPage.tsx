import { useState, type FormEvent } from 'react';
import {
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  AlertCircle,
  X,
  Plus,
  Briefcase,
  Trophy,
  Landmark,
  School,
  User as UserIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import {
  YEAR_OPTIONS,
  CATEGORY_OPTIONS,
  INCOME_RANGES,
  INTEREST_OPTIONS,
  type YearValue,
  type CategoryValue,
  type InterestValue,
} from '@/types/database';

interface OnboardingPageProps {
  onComplete: () => void;
  onBack: () => void;
}

const TOTAL_STEPS = 3;

const INTEREST_ICONS: Record<string, typeof GraduationCap> = {
  GraduationCap,
  Briefcase,
  Trophy,
  Landmark,
};

export default function OnboardingPage({ onComplete, onBack }: OnboardingPageProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [branch, setBranch] = useState('');
  const [year, setYear] = useState<YearValue | ''>('');
  const [state, setState] = useState('');

  // Step 2
  const [category, setCategory] = useState<CategoryValue | ''>('');
  const [income, setIncome] = useState('');
  const [cgpa, setCgpa] = useState('');

  // Step 3
  const [interests, setInterests] = useState<InterestValue[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  const toggleInterest = (value: InterestValue) => {
    setInterests((prev) =>
      prev.includes(value) ? prev.filter((i) => i !== value) : [...prev, value]
    );
  };

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setSkillInput('');
  };

  const removeSkill = (s: string) => {
    setSkills((prev) => prev.filter((x) => x !== s));
  };

  const step1Valid = name.trim() && college.trim() && branch.trim() && year && state.trim();
  const step2Valid = category && income && cgpa;
  const step3Valid = interests.length > 0;

  const canAdvance = (s: number) => {
    if (s === 1) return !!step1Valid;
    if (s === 2) return !!step2Valid;
    return true;
  };

  const handleNext = () => {
    setError(null);
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const handleBack = () => {
    setError(null);
    if (step > 1) setStep(step - 1);
    else onBack();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('You must be signed in to save your profile.');
      return;
    }
    if (!step3Valid) {
      setError('Pick at least one interest so we can match you.');
      return;
    }

    setSaving(true);
    try {
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: user.id,
        name: name.trim(),
        college: college.trim(),
        branch: branch.trim(),
        year: year as YearValue,
        state: state.trim(),
        category: category as CategoryValue,
        family_income: income,
        cgpa: cgpa ? parseFloat(cgpa) : null,
        interests,
        skills,
      });

      if (upsertError) throw upsertError;
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save your profile. Try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div className="relative min-h-screen bg-cream-50 overflow-x-hidden">
      {/* pastel backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-10 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-mint-200/40 blur-3xl" />
        <div className="absolute -bottom-10 left-1/4 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen">
        {/* nav */}
        <nav className="flex items-center justify-between px-6 py-5 md:px-12">
          <button
            onClick={handleBack}
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

        {/* content */}
        <div className="mx-auto max-w-2xl px-6 pb-20 pt-4 md:pt-8">
          {/* heading */}
          <div className="mb-6 text-center animate-fade-up">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">
              Let's set up your profile
            </h1>
            <p className="mt-2 text-ink-600">
              This helps us match you with the right opportunities. Takes about a minute.
            </p>
          </div>

          {/* progress bar */}
          <div className="mb-8 animate-fade-up">
            <div className="mb-2 flex items-center justify-between text-sm font-medium text-ink-600">
              <span>
                Step {step} of {TOTAL_STEPS}
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-400/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-mint-400 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-3 flex items-center justify-between">
              {[1, 2, 3].map((s) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                      s < step
                        ? 'bg-mint-400 text-white'
                        : s === step
                        ? 'bg-sky-500 text-white scale-110 shadow-soft'
                        : 'bg-white/70 text-ink-500 border border-ink-400/20'
                    }`}
                  >
                    {s < step ? <Check className="h-3.5 w-3.5" /> : s}
                  </div>
                  <span
                    className={`hidden text-xs font-medium sm:block ${
                      s === step ? 'text-ink-900' : 'text-ink-500'
                    }`}
                  >
                    {s === 1 ? 'Basics' : s === 2 ? 'Background' : 'Interests'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* STEP 1 */}
            {step === 1 && (
              <div className="space-y-4 animate-fade-up">
                <div className="bento-card-pastel bg-sky-100 p-6">
                  <div className="mb-1 flex items-center gap-2 text-ink-700">
                    <UserIcon className="h-4 w-4 text-sky-500" />
                    <span className="font-display text-sm font-semibold">The basics</span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink-800">
                        Full name
                      </label>
                      <input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Ananya Sharma"
                        className="input-field"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="college" className="mb-1.5 block text-sm font-medium text-ink-800">
                        College
                      </label>
                      <input
                        id="college"
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        placeholder="e.g. IIT Delhi"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label htmlFor="branch" className="mb-1.5 block text-sm font-medium text-ink-800">
                        Branch / stream
                      </label>
                      <input
                        id="branch"
                        value={branch}
                        onChange={(e) => setBranch(e.target.value)}
                        placeholder="e.g. Computer Science"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label htmlFor="state" className="mb-1.5 block text-sm font-medium text-ink-800">
                        State
                      </label>
                      <input
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="e.g. Maharashtra"
                        className="input-field"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-2 block text-sm font-medium text-ink-800">Year of study</label>
                      <div className="flex flex-wrap gap-2">
                        {YEAR_OPTIONS.map((y) => (
                          <button
                            key={y}
                            type="button"
                            onClick={() => setYear(y)}
                            className={`chip ${
                              year === y
                                ? 'border-sky-400 bg-sky-400 text-white shadow-soft'
                                : 'border-ink-400/20 bg-white/70 text-ink-700 hover:border-sky-300 hover:bg-sky-50'
                            }`}
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="space-y-4 animate-fade-up">
                <div className="bento-card-pastel bg-mint-100 p-6">
                  <div className="mb-1 flex items-center gap-2 text-ink-700">
                    <School className="h-4 w-4 text-mint-500" />
                    <span className="font-display text-sm font-semibold">Your background</span>
                  </div>
                  <div className="grid gap-4">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-ink-800">Category</label>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORY_OPTIONS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCategory(c)}
                            className={`chip ${
                              category === c
                                ? 'border-mint-400 bg-mint-400 text-white shadow-soft'
                                : 'border-ink-400/20 bg-white/70 text-ink-700 hover:border-mint-300 hover:bg-mint-50'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-ink-800">Family income (annual)</label>
                      <select
                        value={income}
                        onChange={(e) => setIncome(e.target.value)}
                        className="input-field cursor-pointer"
                      >
                        <option value="" disabled>
                          Select a range
                        </option>
                        {INCOME_RANGES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cgpa" className="mb-1.5 block text-sm font-medium text-ink-800">
                        CGPA
                      </label>
                      <input
                        id="cgpa"
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        inputMode="decimal"
                        value={cgpa}
                        onChange={(e) => setCgpa(e.target.value)}
                        placeholder="e.g. 8.5"
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="space-y-4 animate-fade-up">
                <div className="bento-card-pastel bg-amber-100 p-6">
                  <div className="mb-1 flex items-center gap-2 text-ink-700">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    <span className="font-display text-sm font-semibold">Interests & skills</span>
                  </div>
                  <div className="grid gap-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-ink-800">
                        What are you looking for?
                      </label>
                      <p className="mb-3 text-xs text-ink-600">Pick all that apply.</p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {INTEREST_OPTIONS.map((opt) => {
                          const Icon = INTEREST_ICONS[opt.icon] ?? GraduationCap;
                          const active = interests.includes(opt.value);
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => toggleInterest(opt.value)}
                              className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all duration-200 active:scale-[0.97] ${
                                active
                                  ? 'border-amber-400 bg-amber-400 text-white shadow-soft'
                                  : 'border-ink-400/20 bg-white/70 text-ink-700 hover:border-amber-300 hover:bg-amber-50'
                              }`}
                            >
                              <Icon className="h-6 w-6" />
                              <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="skill" className="mb-2 block text-sm font-medium text-ink-800">
                        Your skills
                      </label>
                      <p className="mb-3 text-xs text-ink-600">
                        Add a few and press Enter. e.g. Python, React, Public Speaking.
                      </p>
                      <div className="flex gap-2">
                        <input
                          id="skill"
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addSkill();
                            }
                          }}
                          placeholder="Type a skill..."
                          className="input-field"
                        />
                        <button
                          type="button"
                          onClick={addSkill}
                          className="btn-secondary px-4"
                          aria-label="Add skill"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      {skills.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {skills.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-700 animate-pop"
                            >
                              {s}
                              <button
                                type="button"
                                onClick={() => removeSkill(s)}
                                className="text-sky-400 transition-colors hover:text-sky-600"
                                aria-label={`Remove ${s}`}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* error */}
            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 animate-fade-in">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* nav buttons */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <button type="button" onClick={handleBack} className="btn-secondary">
                {step === 1 ? 'Cancel' : 'Back'}
              </button>
              {step < TOTAL_STEPS ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canAdvance(step)}
                  className="btn-primary group"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <button type="submit" disabled={saving} className="btn-primary group">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Finish setup
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
