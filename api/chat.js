export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Use server environment variable GROQ_API_KEY, or fallback to client-supplied header if present
  const authHeader = req.headers.get('authorization');
  const clientKey = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
  const apiKey = process.env.GROQ_API_KEY || clientKey;

  if (!apiKey) {
    return new Response(JSON.stringify({
      error: {
        message: 'GROQ_API_KEY is not configured on the server. Please add GROQ_API_KEY in your Vercel Project Settings > Environment Variables.'
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const payload = await req.json();

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify(payload)
    });

    // Forward headers including rate limits
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', groqRes.headers.get('content-type') || 'text/event-stream');
    responseHeaders.set('Cache-Control', 'no-cache, no-transform');
    responseHeaders.set('Connection', 'keep-alive');

    const rateLimitHeaders = [
      'x-ratelimit-remaining-requests',
      'x-ratelimit-limit-requests',
      'x-ratelimit-remaining-tokens',
      'x-ratelimit-limit-tokens',
      'x-ratelimit-reset-requests',
      'x-ratelimit-reset-tokens',
      'retry-after'
    ];

    rateLimitHeaders.forEach(h => {
      const val = groqRes.headers.get(h);
      if (val !== null) responseHeaders.set(h, val);
    });

    return new Response(groqRes.body, {
      status: groqRes.status,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: { message: `Server error: ${err.message}` }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
