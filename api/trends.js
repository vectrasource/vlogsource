export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const youtubeKey = process.env.YOUTUBE_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    if (!youtubeKey) return res.status(500).json({ error: { message: 'YOUTUBE_API_KEY not set.' } });
    if (!openrouterKey) return res.status(500).json({ error: { message: 'OPENROUTER_API_KEY not set.' } });

    // Get niche from query param — default to 'all'
    const niche = req.query.niche || 'all';

    const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Niche → search queries mapping
    const nicheQueries = {
      all: ['malayalam vlog 2026', 'kerala food vlog', 'kerala travel vlog', 'malayalam tech review', 'kerala comedy youtube', 'malayalam fitness', 'kerala lifestyle vlog', 'malayalam business tips'],
      vlog: ['malayalam vlog 2026', 'kerala daily vlog', 'kerala life vlog', 'malayalam day in my life'],
      food: ['kerala food vlog', 'kerala cooking', 'kerala street food', 'malayalam food review'],
      travel: ['kerala travel vlog', 'kerala places to visit', 'kerala trip vlog', 'malayalam travel'],
      tech: ['malayalam tech review', 'malayalam unboxing', 'kerala tech', 'malayalam smartphone review'],
      comedy: ['kerala comedy youtube', 'malayalam funny video', 'kerala skit', 'malayalam comedy short'],
      fitness: ['kerala fitness', 'malayalam workout', 'kerala gym', 'malayalam health tips'],
      lifestyle: ['kerala lifestyle vlog', 'malayalam lifestyle', 'kerala home tour', 'kerala fashion'],
      business: ['malayalam business tips', 'kerala entrepreneur', 'malayalam money tips', 'kerala startup'],
    };

    const queries = nicheQueries[niche] || nicheQueries['all'];

    // Fetch all queries in parallel
    const searchPromises = queries.map(q =>
      fetch(
        `https://www.googleapis.com/youtube/v3/search?` +
        `part=snippet&type=video` +
        `&q=${encodeURIComponent(q)}` +
        `&regionCode=IN` +
        `&relevanceLanguage=ml` +
        `&order=viewCount` +
        `&maxResults=6` +
        `&publishedAfter=${publishedAfter}` +
        `&key=${youtubeKey}`
      ).then(r => r.json())
    );

    const searchResults = await Promise.all(searchPromises);

    // Collect unique videos, filter out industry channels
    const seenIds = new Set();
    const allItems = [];

    for (const result of searchResults) {
      if (!result.items) continue;
      for (const item of result.items) {
        const id = item.id?.videoId;
        if (!id || seenIds.has(id)) continue;

        const channel = item.snippet.channelTitle.toLowerCase();
        const title = item.snippet.title.toLowerCase();

        const isIndustry =
          channel.includes('sony') || channel.includes('zee') ||
          channel.includes('asianet') || channel.includes('surya') ||
          channel.includes('mazhavil') || channel.includes('music') ||
          channel.includes('records') || channel.includes('movies') ||
          channel.includes('productions') || channel.includes('studios') ||
          title.includes('official video') || title.includes('official audio') ||
          title.includes('official song') || title.includes('video song') ||
          title.includes('full movie') || title.includes('trailer');

        if (isIndustry) continue;

        seenIds.add(id);
        allItems.push(item);
      }
    }

    if (allItems.length === 0) {
      return res.status(200).json({ videos: [], categories: [], patterns: [], insight: 'No creator trends found this week for this niche.' });
    }

    // Get view stats
    const videoIds = allItems.map(i => i.id.videoId).join(',');
    const statsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoIds}&key=${youtubeKey}`);
    const statsData = await statsRes.json();

    // Merge, filter, sort
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
      .filter(v => v.viewsRaw > 500)
      .sort((a, b) => b.viewsRaw - a.viewsRaw)
      .slice(0, 12);

    // AI analysis
    const titles = videos.slice(0, 15).map(v => v.title).join('\n');
    const nicheLabel = niche === 'all' ? 'all niches' : niche;

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
          content: `You are a Malayalam YouTube content strategy expert. Analyze these trending Malayalam YouTube titles from independent ${nicheLabel} creators this week.

Titles:
${titles}

Respond ONLY in valid JSON (no markdown, no backticks):
{
  "categories": ["category1", "category2", "category3"],
  "patterns": ["pattern1", "pattern2", "pattern3"],
  "insight": "One punchy sentence about what's working for independent Kerala ${nicheLabel} creators this week"
}

Categories: top 3 content sub-themes.
Patterns: top 3 title/hook structures that are working.
Insight: one specific, actionable sentence in English.`
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
    } catch (e) { /* use defaults */ }

    // Cache per niche for 6 hours
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=3600');

    return res.status(200).json({ videos, categories, patterns, insight, updatedAt: new Date().toISOString(), niche });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}
