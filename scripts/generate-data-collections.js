// One-time migration script: convert JSON data arrays to individual .md files
// Run from the project root: node scripts/generate-data-collections.js
const fs = require('fs');
const path = require('path');
const yaml = require('../node_modules/js-yaml');

const root = path.join(__dirname, '..');

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function writeMd(dir, filename, data) {
  fs.mkdirSync(dir, { recursive: true });
  const front = yaml.dump(data, { lineWidth: 120, quotingType: '"' });
  fs.writeFileSync(path.join(dir, filename), `---\n${front}---\n`);
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(root, 'src/_data', name), 'utf8'));
}

// ── Timeline ──────────────────────────────────────────────────────────────────
const timeline = readJson('timeline.json');
const timelineDir = path.join(root, 'src/timeline-data');
timeline.forEach(item => {
  const yearStr = item.year < 0 ? `bce${Math.abs(item.year)}` : String(item.year);
  const filename = `${yearStr}-${slugify(item.title)}.md`;
  writeMd(timelineDir, filename, item);
});
console.log(`timeline: ${timeline.length} files`);

// ── Events ────────────────────────────────────────────────────────────────────
const events = readJson('events.json');
const eventsDir = path.join(root, 'src/events-data');
events.forEach(item => {
  const filename = `${item.date}-${slugify(item.name)}.md`;
  writeMd(eventsDir, filename, item);
});
console.log(`events: ${events.length} files`);

// ── Videos ────────────────────────────────────────────────────────────────────
const videos = readJson('videos.json');
const videosDir = path.join(root, 'src/videos-data');
videos.forEach(item => {
  const filename = `${slugify(item.speaker)}-${slugify(item.title)}.md`;
  writeMd(videosDir, filename, item);
});
console.log(`videos: ${videos.length} files`);

// ── Feeds ─────────────────────────────────────────────────────────────────────
const feeds = readJson('feeds.json');
const feedsDir = path.join(root, 'src/feeds-data');
feeds.forEach(item => {
  const filename = `${slugify(item.name)}.md`;
  writeMd(feedsDir, filename, item);
});
console.log(`feeds: ${feeds.length} files`);

// ── Gallery ───────────────────────────────────────────────────────────────────
const gallery = readJson('gallery.json');
const galleryDir = path.join(root, 'src/gallery-data');
gallery.forEach(item => {
  const filename = `${slugify(item.alt).slice(0, 60)}.md`;
  writeMd(galleryDir, filename, item);
});
console.log(`gallery: ${gallery.length} files`);

// ── Playlists ─────────────────────────────────────────────────────────────────
const playlists = readJson('playlists.json');
const playlistsDir = path.join(root, 'src/playlists-data');
playlists.forEach(item => {
  const filename = `${slugify(item.name)}.md`;
  writeMd(playlistsDir, filename, item);
});
console.log(`playlists: ${playlists.length} files`);

// ── Songs ─────────────────────────────────────────────────────────────────────
const songs = readJson('songs.json');
const songsDir = path.join(root, 'src/songs-data');
songs.forEach(item => {
  const filename = `${slugify(item.artist)}-${slugify(item.title)}.md`;
  writeMd(songsDir, filename, item);
});
console.log(`songs: ${songs.length} files`);

// ── Games ─────────────────────────────────────────────────────────────────────
const games = readJson('games.json');
const gamesDir = path.join(root, 'src/games-data');
games.forEach(item => {
  const filename = `${item.slug}.md`;
  writeMd(gamesDir, filename, item);
});
console.log(`games: ${games.length} files`);

// ── Changelog ─────────────────────────────────────────────────────────────────
const changelog = readJson('changelog.json');
const changelogDir = path.join(root, 'src/changelog-data');
changelog.forEach(item => {
  const filename = `${item.date}-${slugify(item.title).slice(0, 50)}.md`;
  writeMd(changelogDir, filename, item);
});
console.log(`changelog: ${changelog.length} files`);

console.log('\nDone. Now delete the old JSON files and update .pages.yml.');
