export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
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
    const groqRes = await fetch('https://api.groq.com/openai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`
      }
    });

    const data = await groqRes.text();
    return new Response(data, {
      status: groqRes.status,
      headers: { 'Content-Type': 'application/json' }
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
