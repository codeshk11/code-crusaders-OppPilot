import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SearchRequestBody {
  query?: string;
}

interface TinyFishResult {
  title?: string;
  snippet?: string;
  url?: string;
  [key: string]: unknown;
}

function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Parse the query from GET ?query= or POST body { query }
    let query = "";

    if (req.method === "GET") {
      const url = new URL(req.url);
      query = url.searchParams.get("query") ?? "";
    } else if (req.method === "POST") {
      const body: SearchRequestBody = await req.json().catch(() => ({}));
      query = body.query ?? "";
    } else {
      return errorResponse("Only GET and POST are supported.", 405);
    }

    const trimmed = query.trim();
    if (!trimmed) {
      return errorResponse("A 'query' parameter is required.", 400);
    }

    const apiKey = Deno.env.get("TINYFISH_API_KEY");
    if (!apiKey) {
      return errorResponse(
        "Search is not configured. The TINYFISH_API_KEY secret has not been set.",
        503
      );
    }

    const searchUrl = `https://api.search.tinyfish.ai?query=${encodeURIComponent(
      trimmed
    )}&location=IN&language=en`;

    let apiRes: Response;
    try {
      apiRes = await fetch(searchUrl, {
        headers: { "X-API-Key": apiKey },
      });
    } catch {
      return errorResponse(
        "Could not reach the search service. Please try again in a moment.",
        502
      );
    }

    if (apiRes.status === 429) {
      return errorResponse(
        "The search service is busy right now. Please wait a moment and try again.",
        429
      );
    }

    if (!apiRes.ok) {
      const detail = await apiRes.text().catch(() => "");
      console.error(`TinyFish API error ${apiRes.status}: ${detail}`);
      return errorResponse(
        "The search service returned an error. Please try again later.",
        502
      );
    }

    const raw = await apiRes.json().catch(() => null);
    if (raw === null) {
      return errorResponse("The search service returned an invalid response.", 502);
    }

    // Normalize results into { title, snippet, url }. Be defensive about shape.
    const rawResults: TinyFishResult[] = Array.isArray(raw)
      ? (raw as TinyFishResult[])
      : Array.isArray((raw as { results?: unknown }).results)
      ? ((raw as { results: TinyFishResult[] }).results)
      : Array.isArray((raw as { data?: unknown }).data)
      ? ((raw as { data: TinyFishResult[] }).data)
      : [];

    const results = rawResults.map((r) => ({
      title: typeof r.title === "string" ? r.title : "",
      snippet: typeof r.snippet === "string" ? r.snippet : "",
      url: typeof r.url === "string" ? r.url : "",
    }));

    return new Response(
      JSON.stringify({ query: trimmed, count: results.length, results }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("tf-search error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return errorResponse(message, 500);
  }
});
