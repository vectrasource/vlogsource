export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { fullPrompt } = req.body;
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: { message: 'OPENROUTER_API_KEY not set in Vercel environment variables.' } });
    }
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vectrasource.com',
        'X-Title': 'Vectrasource AI Suite'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-001',
        messages: [{ role: 'user', content: fullPrompt }],
        max_tokens: 4000,
        temperature: 0.4
      })
    });
    const data = await response.json();
    if (data.error) {
      return res.status(400).json({ error: { message: data.error.message } });
    }
    const text = data.choices?.[0]?.message?.content || 'No output received.';
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
