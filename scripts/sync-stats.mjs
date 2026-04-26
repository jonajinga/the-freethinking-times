#!/usr/bin/env node
/**
 * sync-stats.mjs — pull per-article pageviews + share/like event counts
 * from Umami Cloud and write `src/_data/articleStats.json`.
 *
 * Run:
 *   UMAMI_API_KEY=xxx UMAMI_WEBSITE_ID=xxx node scripts/sync-stats.mjs
 *
 * Required env:
 *   UMAMI_API_KEY      — Cloud API key (Settings → Profile → API)
 *   UMAMI_WEBSITE_ID   — UUID of the website (Settings → Websites → ID)
 *
 * Optional env:
 *   UMAMI_API_BASE     — defaults to https://api.umami.is/v1
 *                        self-hosted: https://your-umami.example/api
 *   STATS_LOOKBACK_DAYS — default 365
 *
 * The script:
 *   1. Lists pageview totals per URL for the lookback window
 *   2. Queries event counts for share-* and article-like
 *   3. Maps them by URL and writes the JSON file the build reads
 *
 * If the JSON file is missing or empty, the article meta line + the
 * /most-read/ chart hide gracefully — nothing visible breaks.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const API_KEY  = process.env.UMAMI_API_KEY;
const SITE_ID  = process.env.UMAMI_WEBSITE_ID;
const API_BASE = process.env.UMAMI_API_BASE || 'https://api.umami.is/v1';
const LOOKBACK = Number(process.env.STATS_LOOKBACK_DAYS || 365);

if (!API_KEY || !SITE_ID) {
  console.error('Missing UMAMI_API_KEY or UMAMI_WEBSITE_ID env vars.');
  process.exit(1);
}

const startAt = Date.now() - LOOKBACK * 24 * 60 * 60 * 1000;
const endAt   = Date.now();

async function umami(path, params = {}) {
  const url = new URL(API_BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  const r = await fetch(url, {
    headers: { 'x-umami-api-key': API_KEY, 'Accept': 'application/json' }
  });
  if (!r.ok) throw new Error(`Umami ${r.status} ${r.statusText} on ${path}`);
  return r.json();
}

function normalizeUrl(u) {
  if (!u) return '';
  let s = u.split('?')[0].split('#')[0];
  if (!s.startsWith('/')) s = '/' + s;
  if (!s.endsWith('/'))   s = s + '/';
  return s;
}

async function main() {
  // Pageviews per URL
  const pages = await umami(`/websites/${SITE_ID}/metrics`, {
    type: 'url', startAt, endAt, limit: 5000
  });
  const stats = {};
  for (const row of pages || []) {
    const url = normalizeUrl(row.x);
    if (!url || url === '/') continue;
    stats[url] = stats[url] || { views: 0, shares: 0, likes: 0 };
    stats[url].views += Number(row.y || 0);
  }

  // Event counts (share-*, article-like) — pulled per event name
  const events = ['share-twitter', 'share-linkedin', 'share-bluesky',
                  'share-mastodon', 'share-reddit', 'share-facebook',
                  'share-email', 'share-copy', 'article-like'];
  for (const name of events) {
    let rows = [];
    try {
      rows = await umami(`/websites/${SITE_ID}/metrics`, {
        type: 'event', event: name, startAt, endAt, limit: 5000
      });
    } catch (e) {
      console.warn(`event ${name}: ${e.message}`);
      continue;
    }
    for (const row of rows || []) {
      const url = normalizeUrl(row.x);
      if (!url) continue;
      stats[url] = stats[url] || { views: 0, shares: 0, likes: 0 };
      if (name === 'article-like') stats[url].likes  += Number(row.y || 0);
      else                          stats[url].shares += Number(row.y || 0);
    }
  }

  const out = join(__dirname, '..', 'src', '_data', 'articleStats.json');
  await writeFile(out, JSON.stringify(stats, null, 2));
  console.log(`Wrote ${Object.keys(stats).length} article stats → ${out}`);
}

main().catch(err => { console.error(err); process.exit(1); });
