const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FetchRequestBody {
  urls?: string[];
}

interface FetchResultItem {
  url?: string;
  content?: string;
  text?: string;
  title?: string;
  html?: string;
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
    if (req.method !== "POST") {
      return errorResponse("Only POST is supported.", 405);
    }

    const body: FetchRequestBody = await req.json().catch(() => ({}));
    const urls = body.urls;

    if (!Array.isArray(urls) || urls.length === 0) {
      return errorResponse("A 'urls' array (max 5) is required.", 400);
    }

    if (urls.length > 5) {
      return errorResponse("A maximum of 5 URLs is allowed.", 400);
    }

    const trimmedUrls = urls
      .map((u) => (typeof u === "string" ? u.trim() : ""))
      .filter((u) => u.length > 0);

    if (trimmedUrls.length === 0) {
      return errorResponse("No valid URLs provided.", 400);
    }

    const apiKey = Deno.env.get("TINYFISH_API_KEY");
    if (!apiKey) {
      return errorResponse(
        "Fetch is not configured. The TINYFISH_API_KEY secret has not been set.",
        503
      );
    }

    let apiRes: Response;
    try {
      apiRes = await fetch("https://api.fetch.tinyfish.ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({ urls: trimmedUrls }),
      });
    } catch {
      return errorResponse(
        "Could not reach the fetch service. Please try again in a moment.",
        502
      );
    }

    if (apiRes.status === 429) {
      return errorResponse(
        "The fetch service is busy right now. Please wait a moment and try again.",
        429
      );
    }

    if (!apiRes.ok) {
      const detail = await apiRes.text().catch(() => "");
      console.error(`TinyFish fetch API error ${apiRes.status}: ${detail}`);
      return errorResponse(
        "The fetch service returned an error. Please try again later.",
        502
      );
    }

    const raw = await apiRes.json().catch(() => null);
    if (raw === null) {
      return errorResponse("The fetch service returned an invalid response.", 502);
    }

    // Normalize: accept an array, { results: [...] }, or { data: [...] }.
    const rawItems: FetchResultItem[] = Array.isArray(raw)
      ? (raw as FetchResultItem[])
      : Array.isArray((raw as { results?: unknown }).results)
      ? ((raw as { results: FetchResultItem[] }).results)
      : Array.isArray((raw as { data?: unknown }).data)
      ? ((raw as { data: FetchResultItem[] }).data)
      : [];

    const pages = rawItems.map((item, i) => ({
      url: typeof item.url === "string" ? item.url : trimmedUrls[i] ?? "",
      content:
        (typeof item.content === "string" && item.content) ||
        (typeof item.text === "string" && item.text) ||
        (typeof item.html === "string" && item.html) ||
        "",
      title: typeof item.title === "string" ? item.title : "",
    }));

    return new Response(
      JSON.stringify({ count: pages.length, pages }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("tf-fetch error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return errorResponse(message, 500);
  }
});
