export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const youtubeKey = process.env.YOUTUBE_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    if (!youtubeKey) return res.status(500).json({ error: { message: 'YOUTUBE_API_KEY not set.' } });
    if (!openrouterKey) return res.status(500).json({ error: { message: 'OPENROUTER_API_KEY not set.' } });

    const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Run MULTIPLE searches across different creator niches
    // This gets diverse content instead of just film/music dominating
    const searchQueries = [
      'malayalam vlog 2026',
      'kerala food vlog',
      'kerala travel vlog',
      'malayalam tech review',
      'kerala comedy youtube',
      'malayalam fitness',
      'kerala lifestyle vlog',
      'malayalam business tips',
    ];

    // Fetch all queries in parallel
    const searchPromises = searchQueries.map(q =>
      fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&type=video` +
        `&q=${encodeURIComponent(q)}` +
        `&regionCode=IN` +
        `&relevanceLanguage=ml` +
        `&order=viewCount` +
        `&maxResults=5` +
        `&publishedAfter=${publishedAfter}` +
        `&key=${youtubeKey}`
      ).then(r => r.json())
    );

    const searchResults = await Promise.all(searchPromises);

    // Collect all unique video IDs
    const seenIds = new Set();
    const allItems = [];

    for (const result of searchResults) {
      if (!result.items) continue;
      for (const item of result.items) {
        const id = item.id?.videoId;
        if (!id || seenIds.has(id)) continue;

        // Filter out big label / film industry channels
        const channel = item.snippet.channelTitle.toLowerCase();
        const title = item.snippet.title.toLowerCase();

        const isIndustryChannel =
          channel.includes('sony') ||
          channel.includes('zee') ||
          channel.includes('asianet') ||
          channel.includes('surya') ||
          channel.includes('mazhavil') ||
          channel.includes('official') ||
          channel.includes('music') ||
          channel.includes('records') ||
          channel.includes('movies') ||
          channel.includes('productions') ||
          channel.includes('studios') ||
          channel.includes('entertainment') ||
          title.includes('official video') ||
          title.includes('official audio') ||
          title.includes('official song') ||
          title.includes('video song') ||
          title.includes('full movie') ||
          title.includes('trailer');

        if (isIndustryChannel) continue;

        seenIds.add(id);
        allItems.push(item);
      }
    }

    if (allItems.length === 0) {
      return res.status(200).json({ videos: [], categories: [], patterns: [], insight: 'No creator trends found this week.' });
    }

    // Get stats for all collected videos
    const videoIds = allItems.map(i => i.id.videoId).join(',');

    const statsRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?` +
      `part=statistics&id=${videoIds}&key=${youtubeKey}`
    );
    const statsData = await statsRes.json();

    // Merge + sort by views
    const videos = allItems
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
      .filter(v => v.viewsRaw > 500) // must have some real traction
      .sort((a, b) => b.viewsRaw - a.viewsRaw)
      .slice(0, 12); // show top 12

    // AI analysis
    const titles = videos.slice(0, 15).map(v => v.title).join('\n');

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
          content: `You are an expert in Malayalam YouTube content strategy for independent creators (not film industry). Analyze these trending Malayalam YouTube video titles from independent creators this week.

Titles:
${titles}

Respond ONLY in valid JSON (no markdown, no backticks):
{
  "categories": ["category1", "category2", "category3"],
  "patterns": ["pattern1", "pattern2", "pattern3"],
  "insight": "One punchy sentence about what independent Kerala YouTube creators are making that's working this week"
}

For categories: top 3 content themes among independent creators (e.g. "Food Vlogs", "Tech Reviews", "Comedy Skits").
For patterns: top 3 title/hook structures working for independent creators (e.g. "Personal challenge format", "Day in my life").
For insight: one sentence in English, specific to independent creator trends.`
        }],
        max_tokens: 300,
        temperature: 0.3
      })
    });

    const aiData = await aiRes.json();

    let categories = ['Vlog & Lifestyle', 'Food & Travel', 'Tech Reviews'];
    let patterns = ['Day in my life format', 'Personal challenge format', 'Best of Kerala series'];
    let insight = 'Independent Malayalam creators are winning with authentic personal stories this week.';

    try {
      const aiText = aiData.choices?.[0]?.message?.content || '';
      const cleaned = aiText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed.categories) categories = parsed.categories;
      if (parsed.patterns) patterns = parsed.patterns;
      if (parsed.insight) insight = parsed.insight;
    } catch (e) {
      // use fallback defaults
    }

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
