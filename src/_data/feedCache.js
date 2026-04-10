// Fetch RSS feeds at build time so no CORS proxy is needed at runtime
const Parser = require('rss-parser');
const parser = new Parser({ timeout: 10000 });
const feeds = require('./feeds.json');

module.exports = async function () {
  const results = {};

  await Promise.all(feeds.map(async (feed) => {
    try {
      const data = await parser.parseURL(feed.url);
      results[feed.url] = (data.items || []).slice(0, 20).map(item => ({
        title: item.title || '',
        link: item.link || '',
        description: (item.contentSnippet || item.content || '').slice(0, 200),
        date: item.isoDate || item.pubDate || '',
        feedName: feed.name
      }));
    } catch (e) {
      console.warn('Feed failed:', feed.name, '-', e.message);
      results[feed.url] = [];
    }
  }));

  return results;
};
