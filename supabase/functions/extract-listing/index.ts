import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ExtractRequestBody {
  text?: string;
  url?: string;
}

type ListingType = "scholarship" | "internship" | "hackathon" | "scheme";

interface ExtractedListing {
  title: string;
  type: ListingType;
  deadline: string | null;
  eligibility: string;
  documents_required: string[];
  summary: string;
}

function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TYPE_KEYWORDS: { type: ListingType; keywords: string[] }[] = [
  { type: "scholarship", keywords: ["scholarship", "fellowship", "financial aid", "stipend", "grant", "education funding", "merit scholarship"] },
  { type: "internship", keywords: ["internship", "intern", "trainee", "summer program", "industry training"] },
  { type: "hackathon", keywords: ["hackathon", "coding challenge", "codefest", "makeathon", "devfest", "coding competition"] },
  { type: "scheme", keywords: ["scheme", "yojana", "government", "govt", "subsidy", "welfare", "initiative", "mission"] },
];

const DOCUMENT_KEYWORDS: string[] = [
  "aadhaar", "aadhar", "pan card", "income certificate", "caste certificate",
  "mark sheet", "marksheets", "marksheet", "transcript", "admission proof",
  "admission letter", "bonafide", "bonafide certificate", "passport photo",
  "passport-size", "recommendation letter", "reference letter", "resume", "cv",
  "cover letter", "statement of purpose", "identity proof", "bank passbook",
  "bank statement", "student id", "college id", " domicile", "residence proof",
  "photo", "signature", "ssc", "hsc", "10th", "12th", "degree certificate",
];

function detectType(text: string): ListingType {
  const lower = text.toLowerCase();
  let best: { type: ListingType; score: number } = { type: "scheme", score: 0 };
  for (const { type, keywords } of TYPE_KEYWORDS) {
    let score = 0;
    for (const kw of keywords) {
      const matches = lower.split(kw).length - 1;
      score += matches;
    }
    if (score > best.score) best = { type, score };
  }
  return best.type;
}

function detectDeadline(text: string): string | null {
  const lower = text.toLowerCase();

  // Look for "deadline", "last date", "apply by", "closes on", "ends on" followed by a date.
  const labels = [
    /(?:deadline|last\s*date|apply\s*by|closes?\s*(?:on)?|ends?\s*(?:on)?|due\s*(?:by|on)?|application\s*closes?)[:\s]*/i,
  ];

  // Date patterns: 31 March 2026, March 31 2026, 31/03/2026, 2026-03-31, 31-03-2026
  const datePatterns = [
    // DD Month YYYY
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i,
    // Month DD, YYYY
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i,
    // DD/MM/YYYY or DD-MM-YYYY
    /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/,
    // YYYY-MM-DD
    /\b(\d{4})-(\d{2})-(\d{2})\b/,
  ];

  const monthMap: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
    jan: "01", feb: "02", mar: "03", apr: "04", jun: "06",
    jul: "07", aug: "08", sep: "09", sept: "09", oct: "10", nov: "11", dec: "12",
  };

  const tryFormat = (m: RegExpMatchArray, variant: number): string | null => {
    try {
      let day: string, month: string, year: string;
      if (variant === 0) {
        day = m[1].padStart(2, "0");
        month = monthMap[m[2].toLowerCase()] ?? "01";
        year = m[3];
      } else if (variant === 1) {
        month = monthMap[m[1].toLowerCase()] ?? "01";
        day = m[2].padStart(2, "0");
        year = m[3];
      } else if (variant === 2) {
        day = m[1].padStart(2, "0");
        month = m[2].padStart(2, "0");
        year = m[3];
      } else {
        year = m[1];
        month = m[2];
        day = m[3];
      }
      const iso = `${year}-${month}-${day}`;
      const parsed = Date.parse(iso);
      if (!Number.isNaN(parsed)) return iso;
    } catch { /* ignore */ }
    return null;
  };

  // First pass: look near a deadline label.
  for (const label of labels) {
    for (let i = 0; i < datePatterns.length; i++) {
      const combined = new RegExp(
        label.source + datePatterns[i].source,
        "i"
      );
      const m = lower.match(combined);
      if (m) {
        const result = tryFormat(m, i);
        if (result) return result;
      }
    }
  }

  // Second pass: any date in the text that is in the future (heuristic).
  for (let i = 0; i < datePatterns.length; i++) {
    const re = new RegExp(datePatterns[i].source, "gi");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const result = tryFormat(m, i);
      if (result) {
        const date = new Date(result);
        // Only accept dates up to 2 years in the future.
        const now = new Date();
        const maxFuture = new Date(now.getFullYear() + 2, 11, 31);
        if (date >= now && date <= maxFuture) return result;
      }
    }
  }

  return null;
}

function detectDocuments(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();

  for (const doc of DOCUMENT_KEYWORDS) {
    if (lower.includes(doc)) {
      // Capitalize nicely.
      const nice = doc.replace(/\b\w/g, (c) => c.toUpperCase());
      found.add(nice);
    }
  }

  return Array.from(found);
}

function extractEligibility(text: string): string {
  const lower = text.toLowerCase();

  // Look for an "eligibility" section.
  const eligMatch = lower.match(
    /(?:eligibility|who can apply|eligible candidates?)[:\s]*([\s\S]{10,500}?)(?:\n\n|documents|required|deadline|how to apply|about|summary|$)/i
  );
  if (eligMatch && eligMatch[1].trim().length > 15) {
    return eligMatch[1].trim().replace(/\s+/g, " ").slice(0, 500);
  }

  // Fallback: look for sentences with eligibility-related keywords.
  const sentences = text.split(/(?<=[.!?])\s+/);
  const eligSentences = sentences.filter((s) =>
    /\b(eligib|must be|should be|applicants? must|students? (?:must|should|enrolled|pursuing)|candidates? (?:must|should))\b/i.test(s)
  );
  if (eligSentences.length > 0) {
    return eligSentences.slice(0, 3).join(" ").slice(0, 500);
  }

  return "";
}

function extractTitle(text: string, url: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  // Look for a markdown heading (## Title) or the first meaningful line.
  const heading = lines.find((l) => /^#{1,3}\s+\S/.test(l));
  if (heading) return heading.replace(/^#{1,3}\s+/, "").slice(0, 200);

  // First line that looks like a title (short, not a nav/link fragment).
  const candidate = lines.find(
    (l) => l.length > 5 && l.length < 150 && !/^(https?:|www\.|©|all rights|download|scan|click)/i.test(l)
  );
  if (candidate) return candidate.slice(0, 200);

  // Fallback to the URL's last path segment.
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last) {
      return decodeURIComponent(last).replace(/[-_]/g, " ").slice(0, 200);
    }
  } catch { /* ignore */ }

  return url;
}

function extractSummary(text: string, type: ListingType): string {
  // Take the first 2-3 meaningful sentences that aren't boilerplate.
  const cleaned = text
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\s+/g, " ");
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) =>
      s.length > 20 &&
      !/^(since|having|download|scan|click|all rights|©|we'll|stay updated|join the|whatsapp)/i.test(s)
    );

  if (sentences.length === 0) return "";
  return sentences.slice(0, 3).join(" ").slice(0, 600);
}

function extractListing(text: string, url: string): ExtractedListing {
  const type = detectType(text);
  const deadline = detectDeadline(text);
  const documents = detectDocuments(text);
  const eligibility = extractEligibility(text);
  const title = extractTitle(text, url);
  const summary = extractSummary(text, type);

  return { title, type, deadline, eligibility, documents_required: documents, summary };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return errorResponse("Only POST is supported.", 405);
    }

    const body: ExtractRequestBody = await req.json().catch(() => ({}));
    const pageText = typeof body.text === "string" ? body.text.trim() : "";
    const url = typeof body.url === "string" ? body.url.trim() : "";

    if (!pageText) {
      return errorResponse("A 'text' field (page content) is required.", 400);
    }
    if (!url) {
      return errorResponse("A 'url' field (source URL) is required.", 400);
    }

    // Set up a service-role client to read/write the listings table.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse("Server is not configured for database access.", 503);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // 24-hour cache check: if a listing with the same source_url was verified
    // in the last 24 hours, return the stored row.
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cached, error: cacheError } = await supabase
      .from("listings")
      .select("*")
      .eq("source_url", url)
      .gte("last_verified_at", twentyFourHoursAgo)
      .order("last_verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cacheError) {
      console.error("Cache lookup error:", cacheError.message);
    }

    if (cached) {
      const listing: ExtractedListing = {
        title: cached.title ?? "",
        type: (cached.type as ListingType) ?? "scheme",
        deadline: cached.deadline ?? null,
        eligibility: cached.eligibility ?? "",
        documents_required: Array.isArray(cached.documents)
          ? (cached.documents as string[])
          : [],
        summary: cached.summary ?? "",
      };
      return jsonResponse({ cached: true, source_url: url, listing });
    }

    // Extract structured data from the page text.
    const extracted = extractListing(pageText, url);

    // Upsert into the listings table so the next call within 24h is cached.
    const now = new Date().toISOString();
    const { error: upsertError } = await supabase.from("listings").upsert(
      {
        title: extracted.title || url,
        type: extracted.type,
        url,
        deadline: extracted.deadline,
        eligibility: extracted.eligibility,
        documents: extracted.documents_required,
        summary: extracted.summary,
        source_url: url,
        last_verified_at: now,
      },
      { onConflict: "source_url" }
    );

    if (upsertError) {
      console.error("Upsert error:", upsertError.message);
    }

    return jsonResponse({ cached: false, source_url: url, listing: extracted });
  } catch (err) {
    console.error("extract-listing error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return errorResponse(message, 500);
  }
});
