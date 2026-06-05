export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const youtubeKey = process.env.YOUTUBE_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    if (!youtubeKey) return res.status(500).json({ error: { message: 'YOUTUBE_API_KEY not set.' } });
    if (!openrouterKey) return res.status(500).json({ error: { message: 'OPENROUTER_API_KEY not set.' } });

    // Step 1: Fetch trending Malayalam videos from last 7 days
    const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const searchRes = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&type=video` +
      `&q=malayalam` +
      `&regionCode=IN` +
      `&relevanceLanguage=ml` +
      `&order=viewCount` +
      `&maxResults=20` +
      `&publishedAfter=${publishedAfter}` +
      `&key=${youtubeKey}`
    );

    const searchData = await searchRes.json();

    if (searchData.error) {
      return res.status(400).json({ error: { message: searchData.error.message } });
    }

    if (!searchData.items || searchData.items.length === 0) {
      return res.status(200).json({ videos: [], categories: [], patterns: [], insight: 'No trends found this week.' });
    }

    // Step 2: Get view counts via videos endpoint
    const videoIds = searchData.items.map(i => i.id.videoId).filter(Boolean).join(',');

    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?` +
      `part=statistics&id=${videoIds}&key=${youtubeKey}`
    );
    const statsData = await statsRes.json();

    // Step 3: Merge video data + stats
    const videos = searchData.items
      .filter(item => item.id?.videoId)
      .map(item => {
        const stat = statsData.items?.find(s => s.id === item.id.videoId);
        const views = stat ? parseInt(stat.statistics.viewCount || 0) : 0;
        return {
          id: item.id.videoId,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
          published: item.snippet.publishedAt,
          url: `https://youtube.com/watch?v=${item.id.videoId}`,
          views: views > 0 ? views.toLocaleString('en-IN') : 'N/A',
          viewsRaw: views
        };
      })
      .sort((a, b) => b.viewsRaw - a.viewsRaw) // sort by views descending
      .slice(0, 12); // top 12

    // Step 4: AI analysis via OpenRouter (same pattern as generate.js)
    const titles = videos.map(v => v.title).join('\n');

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openrouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://vectrasource.com',
        'X-Title': 'Vectrasource AI Suite'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        messages: [{
          role: 'user',
          content: `You are an expert in Malayalam YouTube content strategy. Analyze these trending Malayalam YouTube video titles from this week and extract insights.

Titles:
${titles}

Respond ONLY in valid JSON with this exact structure (no markdown, no backticks):
{
  "categories": ["category1", "category2", "category3"],
  "patterns": ["pattern1", "pattern2", "pattern3"],
  "insight": "One sentence about what Kerala YouTube viewers are most interested in this week"
}

For categories: identify the top 3 content themes (e.g. "Food & Travel", "Tech Reviews", "Comedy").
For patterns: identify the top 3 title/hook structures that are working (e.g. "Shocking reveal format", "First time trying X", "Best X in Kerala").
For insight: write one punchy sentence in English about the trend.`
        }],
        max_tokens: 300,
        temperature: 0.3
      })
    });

    const aiData = await aiRes.json();

    let categories = ['General Content', 'Entertainment', 'Lifestyle'];
    let patterns = ['Reaction & Review format', 'Best of Kerala series', 'Personal story format'];
    let insight = 'Malayalam viewers are engaging heavily with authentic local content this week.';

    try {
      const aiText = aiData.choices?.[0]?.message?.content || '';
      const cleaned = aiText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.categories) categories = parsed.categories;
      if (parsed.patterns) patterns = parsed.patterns;
      if (parsed.insight) insight = parsed.insight;
    } catch (e) {
      // fallback to defaults above if AI parse fails
    }

    // Cache for 6 hours on Vercel edge
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');

    return res.status(200).json({
      videos,
      categories,
      patterns,
      insight,
      updatedAt: new Date().toISOString()
    });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
