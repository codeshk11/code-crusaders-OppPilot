import { useState, type FormEvent } from 'react';
import { ArrowLeft, Search, Loader2, AlertCircle, ExternalLink, FileText, Sparkles } from 'lucide-react';

interface DebugPageProps {
  onBack: () => void;
}

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

interface ExtractedListing {
  title: string;
  type: string;
  deadline: string | null;
  eligibility: string;
  documents_required: string[];
  summary: string;
}

type Tab = 'search' | 'extract';

export default function DebugPage({ onBack }: DebugPageProps) {
  const [tab, setTab] = useState<Tab>('search');

  // Search state
  const [query, setQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searchRaw, setSearchRaw] = useState<unknown>(null);

  // Fetch + extract state
  const [fetchUrl, setFetchUrl] = useState('');
  const [extractLoading, setExtractLoading] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractStep, setExtractStep] = useState<string>('');
  const [listing, setListing] = useState<ExtractedListing | null>(null);
  const [extractCached, setExtractCached] = useState<boolean | null>(null);
  const [extractRaw, setExtractRaw] = useState<unknown>(null);

  const runSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearchLoading(true);
    setSearchError(null);
    setResults(null);
    setSearchRaw(null);

    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tf-search`;
      const res = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          (data && typeof data.error === 'string' && data.error) ||
          `Request failed (${res.status})`;
        throw new Error(msg);
      }

      setSearchRaw(data);
      if (data && Array.isArray(data.results)) {
        setResults(data.results as SearchResult[]);
      } else {
        setResults([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setSearchError(msg);
    } finally {
      setSearchLoading(false);
    }
  };

  const runFetchExtract = async (e: FormEvent) => {
    e.preventDefault();
    if (!fetchUrl.trim()) return;
    setExtractLoading(true);
    setExtractError(null);
    setListing(null);
    setExtractCached(null);
    setExtractRaw(null);
    setExtractStep('Fetching page content...');

    try {
      const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

      // Step 1: fetch page content via tf-fetch
      const fetchRes = await fetch(`${baseUrl}/tf-fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [fetchUrl.trim()] }),
      });

      const fetchData = await fetchRes.json().catch(() => null);

      if (!fetchRes.ok) {
        const msg =
          (fetchData && typeof fetchData.error === 'string' && fetchData.error) ||
          `Fetch failed (${fetchRes.status})`;
        throw new Error(msg);
      }

      const pages = (fetchData && Array.isArray(fetchData.pages)) ? fetchData.pages : [];
      const page = pages[0];
      const pageContent = page?.content ?? '';

      if (!pageContent) {
        throw new Error('The fetch service returned no content for that URL.');
      }

      setExtractStep('Extracting listing details with AI...');

      // Step 2: extract via extract-listing
      const extractRes = await fetch(`${baseUrl}/extract-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pageContent, url: fetchUrl.trim() }),
      });

      const extractData = await extractRes.json().catch(() => null);

      if (!extractRes.ok) {
        const msg =
          (extractData && typeof extractData.error === 'string' && extractData.error) ||
          `Extraction failed (${extractRes.status})`;
        throw new Error(msg);
      }

      setExtractRaw(extractData);
      setExtractCached(extractData?.cached === true);
      if (extractData?.listing) {
        setListing(extractData.listing as ExtractedListing);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setExtractError(msg);
    } finally {
      setExtractLoading(false);
      setExtractStep('');
    }
  };

  return (
    <div className="relative min-h-screen bg-cream-50 overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-lavender-200/40 blur-3xl" />
        <div className="absolute right-0 bottom-0 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      </div>

      <div className="relative z-10">
        <nav className="flex items-center justify-between px-6 py-5 md:px-12">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-white/60"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <span className="font-display text-sm font-bold tracking-tight text-ink-500">
            debug
          </span>
        </nav>

        <div className="mx-auto max-w-2xl px-6 pb-24 pt-4">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">
            Edge function playground
          </h1>
          <p className="mt-1.5 text-sm text-ink-600">
            Test the search and fetch + extract pipelines directly.
          </p>

          {/* Tabs */}
          <div className="mt-6 inline-flex rounded-2xl border border-ink-400/15 bg-white/60 p-1">
            <button
              onClick={() => setTab('search')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                tab === 'search'
                  ? 'bg-ink-900 text-cream-50 shadow-soft'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            <button
              onClick={() => setTab('extract')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                tab === 'extract'
                  ? 'bg-ink-900 text-cream-50 shadow-soft'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              <FileText className="h-4 w-4" />
              Fetch + extract
            </button>
          </div>

          {/* SEARCH TAB */}
          {tab === 'search' && (
            <div className="mt-6 animate-fade-in">
              <p className="text-sm text-ink-600">
                Results are returned as {`{ title, snippet, url }`}.
              </p>

              <form onSubmit={runSearch} className="mt-4 flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type a search query..."
                  className="input-field"
                />
                <button type="submit" disabled={searchLoading || !query.trim()} className="btn-primary px-4">
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="hidden sm:inline">Search</span>
                </button>
              </form>

              {searchError && (
                <div className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 animate-fade-in">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {searchLoading && (
                <div className="mt-5 flex items-center justify-center gap-2 py-10 text-ink-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Searching...</span>
                </div>
              )}

              {results !== null && !searchLoading && !searchError && (
                <div className="mt-5 space-y-4">
                  {results.length === 0 ? (
                    <p className="rounded-2xl border border-ink-400/15 bg-white/60 px-4 py-6 text-center text-sm text-ink-500">
                      No results returned.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {results.map((r, i) => (
                        <div
                          key={i}
                          className="bento-card bg-white/80 p-4 animate-fade-up"
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

                  <details className="mt-4 rounded-2xl border border-ink-400/15 bg-white/60 px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium text-ink-700">
                      Raw results
                    </summary>
                    <pre className="mt-3 overflow-x-auto rounded-xl bg-ink-900 p-4 text-xs leading-relaxed text-cream-100 no-scrollbar">
                      {JSON.stringify(searchRaw, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}

          {/* FETCH + EXTRACT TAB */}
          {tab === 'extract' && (
            <div className="mt-6 animate-fade-in">
              <p className="text-sm text-ink-600">
                Paste a URL. We fetch its content, then AI extracts structured listing data:
                title, type, deadline, eligibility, documents, and summary.
              </p>

              <form onSubmit={runFetchExtract} className="mt-4 flex gap-2">
                <input
                  value={fetchUrl}
                  onChange={(e) => setFetchUrl(e.target.value)}
                  placeholder="https://example.com/scholarship"
                  className="input-field"
                  type="url"
                />
                <button type="submit" disabled={extractLoading || !fetchUrl.trim()} className="btn-primary px-4">
                  {extractLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  <span className="hidden sm:inline">Extract</span>
                </button>
              </form>

              {extractError && (
                <div className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 animate-fade-in">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{extractError}</span>
                </div>
              )}

              {extractLoading && (
                <div className="mt-5 flex flex-col items-center justify-center gap-2 py-10 text-ink-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">{extractStep || 'Working...'}</span>
                </div>
              )}

              {listing && !extractLoading && !extractError && (
                <div className="mt-5 space-y-4 animate-fade-up">
                  {extractCached && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-mint-300 bg-mint-50 px-3 py-1 text-xs font-medium text-mint-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
                      Served from 24h cache
                    </div>
                  )}

                  <div className="bento-card bg-white/80 p-5">
                    <h3 className="font-display text-lg font-bold text-ink-900">
                      {listing.title || '(no title extracted)'}
                    </h3>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                        {listing.type}
                      </span>
                      {listing.deadline && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          Deadline: {listing.deadline}
                        </span>
                      )}
                    </div>

                    {listing.summary && (
                      <p className="mt-3 text-sm leading-relaxed text-ink-700">{listing.summary}</p>
                    )}

                    {listing.eligibility && (
                      <div className="mt-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Eligibility</h4>
                        <p className="mt-1 text-sm leading-relaxed text-ink-700">{listing.eligibility}</p>
                      </div>
                    )}

                    {listing.documents_required.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-500">Documents required</h4>
                        <ul className="mt-1.5 space-y-1">
                          {listing.documents_required.map((d, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-ink-700">
                              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-ink-400" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <details className="rounded-2xl border border-ink-400/15 bg-white/60 px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium text-ink-700">
                      Raw results
                    </summary>
                    <pre className="mt-3 overflow-x-auto rounded-xl bg-ink-900 p-4 text-xs leading-relaxed text-cream-100 no-scrollbar">
                      {JSON.stringify(extractRaw, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
