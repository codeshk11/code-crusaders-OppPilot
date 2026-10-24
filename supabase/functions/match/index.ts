import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface Profile {
  id: string;
  name: string;
  college: string | null;
  branch: string | null;
  year: string | null;
  state: string | null;
  category: string | null;
  family_income: string | null;
  cgpa: number | null;
  interests: string[] | null;
  skills: string[] | null;
}

interface Listing {
  id: string;
  title: string;
  type: string | null;
  url: string | null;
  deadline: string | null;
  eligibility: string | null;
  documents: unknown;
  summary: string | null;
  source_url: string | null;
  last_verified_at: string | null;
}

interface MatchResult {
  score: number;
  why_match: string;
  missing: string[];
}

interface MatchRow {
  id: string;
  listing_id: string;
  score: number;
  why_match: string;
  missing: string[];
}

interface EnrichedMatch extends MatchRow {
  listing: Listing;
  matched_by: string;
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

// --- AI matching via TinyFish Agent API ---

const MATCH_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    why_match: { type: "string" },
    missing: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["score", "why_match", "missing"],
} as const;

function buildAgentGoal(profile: Profile, listing: Listing): string {
  const profileLines = [
    `Student branch: ${profile.branch ?? "not specified"}`,
    `Year of study: ${profile.year ?? "not specified"}`,
    `State: ${profile.state ?? "not specified"}`,
    `Category: ${profile.category ?? "not specified"}`,
    `CGPA: ${profile.cgpa != null ? profile.cgpa : "not specified"}`,
    `Interests: ${(profile.interests ?? []).join(", ") || "not specified"}`,
    `Skills: ${(profile.skills ?? []).join(", ") || "not specified"}`,
  ].join("\n");

  return `You are an opportunity-matching assistant for Indian college students.

A student has this profile:
${profileLines}

The opportunity being evaluated:
- Title: ${listing.title}
- Type: ${listing.type ?? "unknown"}
- URL: ${listing.source_url ?? listing.url ?? "unknown"}
- Deadline: ${listing.deadline ?? "not specified"}
- Eligibility text: ${listing.eligibility ?? "not specified"}
- Summary: ${listing.summary ?? "not specified"}

Read this page and evaluate how well this opportunity matches the student's profile.

Return a match score from 0 to 100 (higher = better fit), a "why_match" explanation in exactly 2 short sentences, and a "missing" array listing any unmet criteria the student does not satisfy.`;
}

async function aiMatch(
  profile: Profile,
  listing: Listing,
  apiKey: string,
): Promise<MatchResult | null> {
  const url = listing.source_url ?? listing.url;
  if (!url) return null;

  const goal = buildAgentGoal(profile, listing);

  try {
    const res = await fetch("https://agent.tinyfish.ai/v1/automation/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        url,
        goal,
        output_schema: MATCH_OUTPUT_SCHEMA,
        browser_profile: "lite",
      }),
    });

    if (!res.ok) {
      console.error(`TinyFish agent failed (${res.status}) for ${url}`);
      return null;
    }

    const data = await res.json().catch(() => null);
    if (!data) return null;

    // The result is in data.result (structured per output_schema).
    const result = data.result ?? data;

    const score = typeof result.score === "number" ? result.score : null;
    const whyMatch = typeof result.why_match === "string" ? result.why_match : null;
    const missing = Array.isArray(result.missing)
      ? result.missing.filter((m: unknown): m is string => typeof m === "string")
      : null;

    if (score === null || whyMatch === null) return null;

    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      why_match: whyMatch,
      missing: missing ?? [],
    };
  } catch (err) {
    console.error(`TinyFish agent error for ${url}:`, err);
    return null;
  }
}

// --- Heuristic fallback (used if the AI call fails) ---

function computeHeuristicMatch(profile: Profile, listing: Listing): MatchResult {
  let score = 50;
  const reasons: string[] = [];
  const missing: string[] = [];

  const listingText = [
    listing.title ?? "",
    listing.eligibility ?? "",
    listing.summary ?? "",
  ].join(" ").toLowerCase();

  if (profile.branch) {
    const branchLower = profile.branch.toLowerCase();
    if (listingText.includes(branchLower) || listingText.includes("all branches") || listingText.includes("any branch")) {
      score += 15;
      reasons.push(`Your branch (${profile.branch}) matches the eligibility criteria.`);
    } else {
      score -= 5;
      missing.push(`Specific branch requirement not clearly matching ${profile.branch}.`);
    }
  }

  if (profile.year) {
    if (listingText.includes(profile.year.toLowerCase()) || listingText.includes("all years") || listingText.includes("any year")) {
      score += 10;
      reasons.push(`Your year (${profile.year}) is eligible.`);
    } else {
      missing.push(`Year requirement may not include ${profile.year} students.`);
    }
  }

  if (profile.category && listingText.includes(profile.category.toLowerCase())) {
    score += 10;
    reasons.push(`Your category (${profile.category}) is mentioned.`);
  }

  if (profile.state) {
    if (listingText.includes(profile.state.toLowerCase()) || listingText.includes("all india") || listingText.includes("pan india")) {
      score += 10;
      reasons.push(`Available in your state (${profile.state}).`);
    } else {
      missing.push(`May not be available in ${profile.state}.`);
    }
  }

  if (profile.cgpa != null) {
    const cgpaText = listingText.match(/(\d+(?:\.\d+)?)\s*(?:cgpa|gpa|minimum)/);
    if (cgpaText) {
      const requiredCgpa = parseFloat(cgpaText[1]);
      if (profile.cgpa >= requiredCgpa) {
        score += 10;
        reasons.push(`Your CGPA (${profile.cgpa}) meets the requirement (${requiredCgpa}).`);
      } else {
        score -= 10;
        missing.push(`CGPA requirement of ${requiredCgpa} not met (yours: ${profile.cgpa}).`);
      }
    }
  }

  if (profile.interests && listing.type) {
    const typeLower = listing.type.toLowerCase();
    const interestMap: Record<string, string> = {
      scholarship: "scholarships",
      internship: "internships",
      hackathon: "hackathons",
      scheme: "govt schemes",
    };
    const interestKey = interestMap[typeLower] ?? typeLower;
    if (profile.interests.some((i) => i.toLowerCase() === interestKey)) {
      score += 10;
      reasons.push(`This matches your interest in ${typeLower}s.`);
    }
  }

  if (listing.source_url) {
    try {
      const host = new URL(listing.source_url).hostname.toLowerCase();
      if (host.endsWith(".gov.in") || host.endsWith(".nic.in")) {
        score += 10;
        reasons.push("Verified government source.");
      } else if (host.endsWith(".ac.in") || host.endsWith(".edu")) {
        score += 8;
        reasons.push("From an accredited educational institution.");
      } else if (host.endsWith(".org")) {
        score += 5;
        reasons.push("From a recognized organization.");
      }
    } catch { /* ignore */ }
  }

  if (listing.deadline) {
    const deadline = new Date(listing.deadline);
    const now = new Date();
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft > 0 && daysLeft <= 30) {
      score += 5;
      reasons.push(`Deadline is approaching in ${daysLeft} days.`);
    } else if (daysLeft <= 0) {
      score -= 15;
      missing.push("Deadline has passed.");
    }
  }

  score = Math.max(0, Math.min(100, score));

  let whyMatch: string;
  if (reasons.length >= 2) {
    whyMatch = reasons.slice(0, 2).join(" ");
  } else if (reasons.length === 1) {
    whyMatch = reasons[0] + (missing.length > 0 ? ` ${missing[0]}` : "");
  } else {
    whyMatch = "This opportunity is available based on your general profile. Review the eligibility criteria for specific requirements.";
  }

  return { score: Math.round(score), why_match: whyMatch, missing };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return errorResponse("Only POST is supported.", 405);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return errorResponse("Authentication required.", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return errorResponse("Server is not configured for database access.", 503);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify the token and get the user via the service-role client.
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) {
      return errorResponse("Invalid or expired session. Please sign in again.", 401);
    }

    const userId = userData.user.id;

    const { data: profileData, error: profileError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profileData) {
      return errorResponse("Could not load your profile.", 404);
    }

    const profile = profileData as Profile;

    const body = await req.json().catch(() => ({}));
    const listingIds: string[] | undefined = body?.listing_ids;

    let listingsQuery = adminClient
      .from("listings")
      .select("*")
      .order("last_verified_at", { ascending: false })
      .limit(20);

    if (Array.isArray(listingIds) && listingIds.length > 0) {
      listingsQuery = adminClient
        .from("listings")
        .select("*")
        .in("id", listingIds);
    }

    const { data: listingRows, error: listingsError } = await listingsQuery;

    if (listingsError || !listingRows) {
      return errorResponse("Could not load listings.", 500);
    }

    const listings = listingRows as Listing[];

    if (listings.length === 0) {
      return jsonResponse({ matches: [], message: "No listings to match." });
    }

    const tinyfishKey = Deno.env.get("TINYFISH_API_KEY");

    const matches: EnrichedMatch[] = [];

    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i];

      // Try AI matching first; fall back to heuristic if AI unavailable or fails.
      let matchResult: MatchResult;
      let matchedBy: string;

      if (tinyfishKey) {
        const aiResult = await aiMatch(profile, listing, tinyfishKey);
        if (aiResult) {
          matchResult = aiResult;
          matchedBy = "ai";
        } else {
          matchResult = computeHeuristicMatch(profile, listing);
          matchedBy = "heuristic";
        }
      } else {
        matchResult = computeHeuristicMatch(profile, listing);
        matchedBy = "heuristic";
      }

      // Upsert into matches table using the service-role client.
      const { data: existing } = await adminClient
        .from("matches")
        .select("id")
        .eq("user_id", userId)
        .eq("listing_id", listing.id)
        .maybeSingle();

      let matchId: string;

      if (existing?.id) {
        const { data: updated, error: updateError } = await adminClient
          .from("matches")
          .update({
            score: matchResult.score,
            why_match: matchResult.why_match,
            missing: matchResult.missing,
          })
          .eq("id", existing.id)
          .select("id")
          .single();

        if (updateError || !updated) {
          console.error(`Failed to update match for listing ${listing.id}:`, updateError?.message);
          continue;
        }
        matchId = updated.id;
      } else {
        const { data: inserted, error: insertError } = await adminClient
          .from("matches")
          .insert({
            user_id: userId,
            listing_id: listing.id,
            score: matchResult.score,
            why_match: matchResult.why_match,
            missing: matchResult.missing,
          })
          .select("id")
          .single();

        if (insertError || !inserted) {
          console.error(`Failed to insert match for listing ${listing.id}:`, insertError?.message);
          continue;
        }
        matchId = inserted.id;
      }

      matches.push({
        id: matchId,
        listing_id: listing.id,
        score: matchResult.score,
        why_match: matchResult.why_match,
        missing: matchResult.missing,
        listing,
        matched_by: matchedBy,
      });

      // Small delay between listings. Agent runs take ~30s each, so
      // no artificial delay needed between AI calls; but keep a small
      // pause for heuristic mode to avoid hammering the DB.
      if (matchedBy === "heuristic" && i < listings.length - 1) {
        await sleep(200);
      }
    }

    matches.sort((a, b) => b.score - a.score);

    return jsonResponse({ matches });
  } catch (err) {
    console.error("match error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return errorResponse(message, 500);
  }
});
