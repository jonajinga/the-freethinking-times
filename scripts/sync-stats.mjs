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

// Page through Umami's events endpoint to collect every event
// matching `eventName` in the lookback window. Each record carries
// the urlPath where the event fired, so we can bucket by article.
//
// Why we don't use /metrics?type=event: that endpoint groups the
// response by event NAME (returning [{ x: 'article-like', y: 12 }])
// not by URL, so all likes get attributed to a fake `/article-like/`
// path. The /events endpoint returns one row per event with the
// real urlPath, which is what we want.
async function fetchEventRecords(eventName) {
  const all = [];
  const pageSize = 200;
  let page = 1;
  let total = Infinity;
  while (all.length < total && page < 200) { // hard cap on pagination
    const resp = await umami(`/websites/${SITE_ID}/events`, {
      startAt, endAt, query: eventName, pageSize, page
    });
    if (!resp) break;
    // Umami's /events returns either { data: [...], count } or a bare array.
    const data = Array.isArray(resp) ? resp : (resp.data || []);
    if (resp && typeof resp.count === 'number') total = resp.count;
    if (!data.length) break;
    // Filter strictly to records whose name matches — `query` is a
    // search, not an exact match, so 'share-twitter' could pull in
    // unrelated entries on a noisy site.
    for (const ev of data) {
      const name = ev.eventName || ev.name || ev.event_name;
      if (name === eventName) all.push(ev);
    }
    if (data.length < pageSize) break;
    page += 1;
  }
  return all;
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

  // Event records, bucketed by the URL where each fired
  const events = ['share-twitter', 'share-linkedin', 'share-bluesky',
                  'share-mastodon', 'share-reddit', 'share-facebook',
                  'share-email', 'share-copy', 'article-like'];
  for (const name of events) {
    let records = [];
    try {
      records = await fetchEventRecords(name);
    } catch (e) {
      console.warn(`event ${name}: ${e.message}`);
      continue;
    }
    for (const ev of records) {
      const path = ev.urlPath || ev.url_path || ev.url;
      const url = normalizeUrl(path);
      if (!url || url === '/') continue;
      stats[url] = stats[url] || { views: 0, shares: 0, likes: 0 };
      if (name === 'article-like') stats[url].likes  += 1;
      else                          stats[url].shares += 1;
    }
    if (records.length) console.log(`  ${name}: ${records.length} records`);
  }

  const out = join(__dirname, '..', 'src', '_data', 'articleStats.json');
  await writeFile(out, JSON.stringify(stats, null, 2));
  const totals = Object.values(stats).reduce((a, s) => ({ v: a.v + s.views, s: a.s + s.shares, l: a.l + s.likes }), { v: 0, s: 0, l: 0 });
  console.log(`Wrote ${Object.keys(stats).length} article stats → ${out}`);
  console.log(`Totals: ${totals.v} views, ${totals.s} shares, ${totals.l} likes`);
}

main().catch(err => { console.error(err); process.exit(1); });
