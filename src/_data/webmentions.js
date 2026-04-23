// Build-time Webmentions fetcher.
//
// Pulls every mention webmention.io has received for this domain and
// groups them by target URL so templates can look up `webmentions[page.url]`.
//
// Output shape:
//   {
//     "/news/some-article/": {
//       replies:  [{ author, content, url, published, ... }, ...],
//       likes:    [{ author, url, published }, ...],
//       reposts:  [{ author, url, published }, ...],
//       mentions: [{ ... }, ... ],   // generic "mention-of" references
//       total:    N
//     },
//     ...
//   }
//
// Build-time means new mentions don't appear until the next deploy.
// Cached 24h via @11ty/eleventy-fetch so dev builds stay fast. The cache
// lives in .cache/ — delete it to force a fresh pull.
//
// Safe on failure: if webmention.io is unreachable or the token is blank,
// returns {} and templates render their empty state.

const EleventyFetch = require('@11ty/eleventy-fetch');
const site = require('./site.js');

const API_BASE = 'https://webmention.io/api/mentions.jf2';

// Normalise any incoming URL into a key that matches Eleventy's page.url
// ("/section/slug/"). webmention.io returns the full URL; strip origin +
// trailing index.html if present.
function normaliseUrl(u) {
  if (!u) return '';
  try {
    var parsed = new URL(u);
    var path = parsed.pathname || '/';
    path = path.replace(/\/index\.html?$/i, '/');
    if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) path += '/';
    return path;
  } catch (_) {
    return u;
  }
}

function isBlocked(mention, blocklist) {
  if (!blocklist || !blocklist.length) return false;
  var authorUrl = (mention.author && mention.author.url) || '';
  var sourceUrl = mention.url || '';
  var hay = (authorUrl + ' ' + sourceUrl).toLowerCase();
  return blocklist.some(function (term) { return term && hay.indexOf(String(term).toLowerCase()) !== -1; });
}

function bucketFor(type) {
  switch (type) {
    case 'in-reply-to': return 'replies';
    case 'like-of':
    case 'favorite-of': return 'likes';
    case 'repost-of': return 'reposts';
    case 'bookmark-of':
    case 'mention-of':
    default:            return 'mentions';
  }
}

module.exports = async function () {
  const cfg = site.webmention || {};
  if (!cfg.token || !cfg.domain) return {};

  const url = API_BASE
    + '?domain=' + encodeURIComponent(cfg.domain)
    + '&token='  + encodeURIComponent(cfg.token)
    + '&per-page=1000';

  let data;
  try {
    data = await EleventyFetch(url, {
      duration: '1d',
      type: 'json',
      directory: '.cache',
      verbose: false
    });
  } catch (e) {
    console.warn('[webmentions] fetch failed:', e.message);
    return {};
  }

  const items = (data && data.children) || [];
  const grouped = {};

  items.forEach(function (m) {
    if (m['wm-private']) return;
    if (isBlocked(m, cfg.blocklist)) return;
    var target = normaliseUrl(m['wm-target'] || m.url || '');
    if (!target) return;
    if (!grouped[target]) grouped[target] = { replies: [], likes: [], reposts: [], mentions: [], total: 0 };
    var bucket = bucketFor(m['wm-property']);
    grouped[target][bucket].push({
      id: m['wm-id'],
      property: m['wm-property'],
      url: m.url,
      published: m.published || m['wm-received'],
      author: m.author || {},
      content: (m.content && (m.content.text || m.content.html)) || '',
      name: m.name || ''
    });
    grouped[target].total += 1;
  });

  // Newest first per bucket.
  Object.keys(grouped).forEach(function (k) {
    ['replies', 'likes', 'reposts', 'mentions'].forEach(function (b) {
      grouped[k][b].sort(function (a, c) {
        return new Date(c.published || 0) - new Date(a.published || 0);
      });
    });
  });

  return grouped;
};
