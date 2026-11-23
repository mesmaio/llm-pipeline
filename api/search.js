export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  let query = '';

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      query = body.query || '';
    } catch (_) {}
  } else {
    const url = new URL(req.url);
    query = url.searchParams.get('q') || '';
  }

  query = query.trim();
  if (!query) {
    return new Response(JSON.stringify({ query: '', results: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const ddgRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!ddgRes.ok) {
      throw new Error(`DuckDuckGo returned status ${ddgRes.status}`);
    }

    const html = await ddgRes.text();

    const titleMatches = [...html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
    const snippetMatches = [...html.matchAll(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)];

    const results = [];
    const count = Math.min(titleMatches.length, snippetMatches.length, 6);

    for (let i = 0; i < count; i++) {
      let rawUrl = titleMatches[i][1] || '';
      // Decode DuckDuckGo redirect link /l/?uddg=... if present
      if (rawUrl.includes('uddg=')) {
        try {
          const matchUddg = rawUrl.match(/uddg=([^&]+)/);
          if (matchUddg) {
            rawUrl = decodeURIComponent(matchUddg[1]);
          }
        } catch (_) {}
      }

      const cleanTitle = titleMatches[i][2]
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();

      const cleanSnippet = snippetMatches[i][1]
        .replace(/<[^>]+>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
        .trim();

      if (cleanTitle && cleanSnippet) {
        results.push({
          title: cleanTitle,
          url: rawUrl,
          snippet: cleanSnippet
        });
      }
    }

    return new Response(JSON.stringify({ query, results }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 's-maxage=300, stale-while-revalidate'
      }
    });
  } catch (err) {
    console.error('Search error:', err);
    return new Response(JSON.stringify({ query, results: [], error: err.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
