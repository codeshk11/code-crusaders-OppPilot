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

interface SavedListing extends ExtractedListing {
  id: string;
  url: string;
  source_url: string;
  cached: boolean;
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

function buildQueries(profile: Profile): string[] {
  const branch = profile.branch ?? "";
  const state = profile.state ?? "";
  const year = profile.year ?? "";
  const category = profile.category ?? "";

  // 1. Scholarships for their category, branch and state in 2026
  const scholarshipParts = ["scholarship 2026"];
  if (category) scholarshipParts.push(category);
  if (branch) scholarshipParts.push(branch);
  if (state) scholarshipParts.push(state);
  const scholarshipQuery = scholarshipParts.join(" ");

  // 2. Internships for their year and branch in India
  const internshipParts = ["internship India 2026"];
  if (year) internshipParts.push(year + " year");
  if (branch) internshipParts.push(branch);
  const internshipQuery = internshipParts.join(" ");

  // 3. Open hackathons for college students in India
  const hackathonQuery = "open hackathon 2026 college students India";

  return [scholarshipQuery, internshipQuery, hackathonQuery];
}

function urlAuthorityScore(url: string): number {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.endsWith(".gov.in") || host === "gov.in") return 100;
    if (host.endsWith(".ac.in") || host === "ac.in") return 90;
    if (host.endsWith(".org") || host === "org") return 80;
    if (host.endsWith(".nic.in") || host === "nic.in") return 95;
    if (host.endsWith(".edu") || host === "edu") return 85;
    if (host.endsWith(".edu.in") || host === "edu.in") return 85;
    return 50;
  } catch {
    return 0;
  }
}

function pickTopUrls(results: SearchResult[], max: number): SearchResult[] {
  // Score each result by URL authority, deduplicate by URL, sort, take top N.
  const seen = new Set<string>();
  const scored = results
    .filter((r) => {
      if (!r.url || seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    })
    .map((r) => ({ result: r, score: urlAuthorityScore(r.url) }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, max).map((s) => s.result);
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

    // Auth: extract the user's JWT from the Authorization header.
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

    // Create a service-role client for database access (bypasses RLS).
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Decode the JWT to extract the user ID. The token's signature was
    // already validated by Supabase's auth.getUser below; we just need
    // the sub claim. This avoids relying on a second network round-trip.
    const { data: userData, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !userData.user) {
      return errorResponse("Invalid or expired session. Please sign in again.", 401);
    }

    const userId = userData.user.id;

    // Fetch the user's profile using the service-role client (reliable,
    // no RLS dependency — we already validated the user via getUser).
    const { data: profileData, error: profileError } = await adminClient
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError || !profileData) {
      return errorResponse("Could not load your profile. Please complete onboarding first.", 404);
    }

    const profile = profileData as Profile;

    // Build the 3 search queries from the profile.
    const queries = buildQueries(profile);

    // Step 1: Search — call tf-search for each query, staying under 5 searches/min.
    // 3 searches with ~12s spacing = ~36s total, well under 5/min.
    const allResults: SearchResult[] = [];

    for (let i = 0; i < queries.length; i++) {
      if (i > 0) await sleep(12000); // 12s between searches to stay under 5/min

      const searchRes = await fetch(`${supabaseUrl}/functions/v1/tf-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queries[i] }),
      });

      if (!searchRes.ok) {
        console.error(`tf-search failed for query ${i}: ${searchRes.status}`);
        continue;
      }

      const searchData = await searchRes.json().catch(() => null);
      if (searchData && Array.isArray(searchData.results)) {
        allResults.push(...(searchData.results as SearchResult[]));
      }
    }

    if (allResults.length === 0) {
      return jsonResponse({
        step: "done",
        queries,
        listings: [],
        message: "No results found from any search query.",
      });
    }

    // Step 2: Pick top 4 official-looking URLs.
    const topResults = pickTopUrls(allResults, 4);

    if (topResults.length === 0) {
      return jsonResponse({
        step: "done",
        queries,
        listings: [],
        message: "No official-looking URLs found in search results.",
      });
    }

    // Step 3: Fetch page content for the top URLs via tf-fetch.
    const topUrls = topResults.map((r) => r.url);
    const fetchRes = await fetch(`${supabaseUrl}/functions/v1/tf-fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: topUrls }),
    });

    if (!fetchRes.ok) {
      console.error(`tf-fetch failed: ${fetchRes.status}`);
      return errorResponse("Could not fetch page content. Please try again later.", 502);
    }

    const fetchData = await fetchRes.json().catch(() => null);
    const pages: { url: string; content: string; title: string }[] =
      fetchData && Array.isArray(fetchData.pages) ? fetchData.pages : [];

    if (pages.length === 0) {
      return errorResponse("No page content returned from fetch.", 502);
    }

    // Step 4: Run extract-listing on each page (sequential, with small delay).
    const savedListings: SavedListing[] = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      if (!page.content || page.content.trim().length < 50) continue;

      if (i > 0) await sleep(2000); // small delay between extractions

      const extractRes = await fetch(`${supabaseUrl}/functions/v1/extract-listing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: page.content, url: page.url }),
      });

      if (!extractRes.ok) {
        console.error(`extract-listing failed for ${page.url}: ${extractRes.status}`);
        continue;
      }

      const extractData = await extractRes.json().catch(() => null);
      if (!extractData || !extractData.listing) continue;

      const listing = extractData.listing as ExtractedListing;
      const wasCached = extractData.cached === true;

      // Fetch the saved listing row to get its id.
      const { data: listingRow } = await adminClient
        .from("listings")
        .select("id, source_url, url")
        .eq("source_url", page.url)
        .maybeSingle();

      savedListings.push({
        ...listing,
        id: listingRow?.id ?? "",
        url: listingRow?.url ?? page.url,
        source_url: page.url,
        cached: wasCached,
      });
    }

      // Step 5: Run the match function to score each listing against the profile.
      const listingIds = savedListings
        .filter((l) => l.id)
        .map((l) => l.id);

      let matches: unknown[] = [];
      if (listingIds.length > 0) {
        const matchRes = await fetch(`${supabaseUrl}/functions/v1/match`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({ listing_ids: listingIds }),
        });

        if (matchRes.ok) {
          const matchData = await matchRes.json().catch(() => null);
          if (matchData && Array.isArray(matchData.matches)) {
            matches = matchData.matches;
          }
        } else {
          console.error(`match function failed: ${matchRes.status}`);
        }
      }

      // Attach match data to each listing.
      const matchesByListingId = new Map<string, unknown>();
      for (const m of matches) {
        const mo = m as { listing_id?: string };
        if (mo.listing_id) matchesByListingId.set(mo.listing_id, m);
      }

      const listingsWithMatches = savedListings.map((l) => ({
        ...l,
        match: matchesByListingId.get(l.id) ?? null,
      }));

      // Sort by match score descending.
      listingsWithMatches.sort((a, b) => {
        const sa = ((a.match as { score?: number })?.score) ?? 0;
        const sb = ((b.match as { score?: number })?.score) ?? 0;
        return sb - sa;
      });

      return jsonResponse({
        step: "done",
        queries,
        total_search_results: allResults.length,
        fetched_pages: pages.length,
        listings: listingsWithMatches,
      });
  } catch (err) {
    console.error("discover error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return errorResponse(message, 500);
  }
});
