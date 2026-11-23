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

  const results = [];

  // Helper: clean HTML tags and entities
  const cleanText = (str) => {
    if (!str) return '';
    return str
      .replace(/<[^>]+>/g, '')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // 1. Source 1: Google News RSS (real-time news, breaking events, latest updates)
  try {
    const gUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const gRes = await fetch(gUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (gRes.ok) {
      const xml = await gRes.text();
      const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
      for (const item of items.slice(0, 4)) {
        const titleMatch = item[1].match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = item[1].match(/<link>([\s\S]*?)<\/link>/);
        const descMatch = item[1].match(/<description>([\s\S]*?)<\/description>/);
        const pubDateMatch = item[1].match(/<pubDate>([\s\S]*?)<\/pubDate>/);

        const cleanTitle = cleanText(titleMatch ? titleMatch[1] : '');
        const cleanDesc = cleanText(descMatch ? descMatch[1] : '');
        const rawLink = linkMatch ? linkMatch[1].trim() : '';
        const dateStr = pubDateMatch ? pubDateMatch[1].trim() : '';

        if (cleanTitle && rawLink) {
          results.push({
            title: cleanTitle,
            url: rawLink,
            snippet: dateStr ? `(${dateStr}) ${cleanDesc || cleanTitle}` : (cleanDesc || cleanTitle)
          });
        }
      }
    }
  } catch (err) {
    console.warn('Google News search failed:', err.message);
  }

  // 2. Source 2: Wikipedia Search API (facts, technical concepts, bios, overview)
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
    const wikiRes = await fetch(wikiUrl, {
      headers: {
        'User-Agent': 'AntigravityGroqPlayground/1.0 (https://ll-seven-beta.vercel.app)'
      }
    });

    if (wikiRes.ok) {
      const wikiData = await wikiRes.json();
      const searchItems = wikiData.query?.search || [];
      for (const item of searchItems.slice(0, 3)) {
        const cleanTitle = cleanText(item.title);
        const cleanSnippet = cleanText(item.snippet);
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, '_'))}`;

        if (cleanTitle && cleanSnippet) {
          results.push({
            title: `${cleanTitle} - Wikipedia`,
            url,
            snippet: cleanSnippet
          });
        }
      }
    }
  } catch (err) {
    console.warn('Wiki search failed:', err.message);
  }

  // 3. Source 3: DuckDuckGo Lite (general web results fallback)
  if (results.length < 3) {
    try {
      const ddgRes = await fetch('https://lite.duckduckgo.com/lite/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        body: `q=${encodeURIComponent(query)}`
      });

      if (ddgRes.ok) {
        const html = await ddgRes.text();
        const linkMatches = [...html.matchAll(/<a[^>]*class=['"]result-link['"][^>]*href=['"]([^'"]*)['"][^>]*>([\s\S]*?)<\/a>/g)];
        const snippetMatches = [...html.matchAll(/<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/g)];

        const count = Math.min(linkMatches.length, snippetMatches.length, 4);
        for (let i = 0; i < count; i++) {
          let rawUrl = linkMatches[i][1] || '';
          if (rawUrl.includes('uddg=')) {
            try {
              const m = rawUrl.match(/uddg=([^&]+)/);
              if (m) rawUrl = decodeURIComponent(m[1]);
            } catch (_) {}
          }
          const cleanTitle = cleanText(linkMatches[i][2]);
          const cleanSnippet = cleanText(snippetMatches[i][1]);

          if (cleanTitle && cleanSnippet) {
            results.push({
              title: cleanTitle,
              url: rawUrl,
              snippet: cleanSnippet
            });
          }
        }
      }
    } catch (err) {
      console.warn('DDG Lite search failed:', err.message);
    }
  }

  return new Response(JSON.stringify({ query, results }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=120, stale-while-revalidate'
    }
  });
}
