#!/usr/bin/env node
/**
 * generate-tts.mjs — local Kokoro TTS pipeline.
 *
 * Walks src/content/<section>/<slug>.md, generates an MP3 per article
 * via kokoro-js → ffmpeg, and writes a sidecar JSON describing the
 * source-content hash so subsequent runs skip unchanged articles.
 *
 * Usage:
 *   node scripts/generate-tts.mjs                      # incremental
 *   node scripts/generate-tts.mjs -- --force           # regenerate all
 *   node scripts/generate-tts.mjs -- --only=<slug>     # one article
 *   node scripts/generate-tts.mjs -- --voice=af_bella  # global voice override
 *
 * Outputs:
 *   src/assets/audio/<section>/<slug>.mp3  — committed to git
 *   src/assets/audio/<section>/<slug>.json — { hash, voice, durationSec, byteSize, generatedAt }
 *
 * Notes:
 *   - Model load (~30 s on first call, then cached at ~/.cache/onnx by
 *     transformers.js) happens ONCE per script run, not per article.
 *   - WAV is an intermediate temp file that ffmpeg consumes and we
 *     delete. Only the .mp3 + .json end up on disk.
 *   - 96 kbps mono MP3 for spoken word: ~3 MB / 5 min, well below
 *     Cloudflare Pages' 25 MB per-file limit.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import matter from 'gray-matter';
import removeMd from 'remove-markdown';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { KokoroTTS } from 'kokoro-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

ffmpeg.setFfmpegPath(ffmpegPath);

// ── Config ──────────────────────────────────────────────────────
const CONTENT_DIR = path.join(ROOT, 'src', 'content');
const AUDIO_DIR   = path.join(ROOT, 'src', 'assets', 'audio');
const MODEL_ID    = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const DTYPE       = 'q8';
const DEFAULT_VOICE = 'af_heart';
const HASH_VERSION  = 'kokoro-q8-v1';
const MP3_BITRATE   = '96k';

// ── CLI parsing ─────────────────────────────────────────────────
const args = process.argv.slice(2);
const flags = {
  force: args.includes('--force'),
  only:  (args.find(a => a.startsWith('--only=')) || '').split('=')[1] || '',
  voice: (args.find(a => a.startsWith('--voice=')) || '').split('=')[1] || ''
};

// ── Helpers ─────────────────────────────────────────────────────
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (entry.isFile()) yield p;
  }
}

function relSection(filePath) {
  // src/content/news/foo.md  →  ['news', 'foo']
  const rel = path.relative(CONTENT_DIR, filePath);
  const parts = rel.split(path.sep);
  const slug = parts.pop().replace(/\.md$/, '');
  const section = parts.join('/');
  return { section, slug };
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function sha256(...parts) {
  const h = crypto.createHash('sha256');
  for (const p of parts) h.update(String(p));
  return h.digest('hex');
}

function cleanForTTS(markdown) {
  // Remove footnote markers, image shortcodes, raw HTML, and YAML
  // remnants before handing the text to remove-markdown / kokoro.
  let text = markdown
    .replace(/\{%\s*image[\s\S]*?%\}/g, '')          // {% image ... %}
    .replace(/\[\^[^\]]+\]/g, '')                    // [^1] footnote refs
    .replace(/<!--[\s\S]*?-->/g, '')                  // HTML comments
    .replace(/<[^>]+>/g, ' ')                          // raw HTML tags
    .replace(/```[\s\S]*?```/g, '')                   // fenced code
    .replace(/`[^`\n]*`/g, '');                        // inline code
  text = removeMd(text, { stripListLeaders: true, useImgAltText: false });
  // Collapse whitespace
  return text.replace(/\s+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function probeDurationSec(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err || !data || !data.format) return resolve(0);
      resolve(Number(data.format.duration) || 0);
    });
  });
}

function transcodeWavToMp3(wavPath, mp3Path) {
  return new Promise((resolve, reject) => {
    ffmpeg(wavPath)
      .audioCodec('libmp3lame')
      .audioBitrate(MP3_BITRATE)
      .audioChannels(1)
      .format('mp3')
      .on('error', reject)
      .on('end', resolve)
      .save(mp3Path);
  });
}

function audioToWav(audio) {
  // kokoro-js exposes either toWav (Uint8Array) or toBlob (Blob).
  // In Node we prefer toWav and write the bytes directly.
  if (typeof audio.toWav === 'function') {
    const u8 = audio.toWav();
    return Buffer.from(u8);
  }
  if (typeof audio.save === 'function') {
    // Newer versions: save(path) writes a .wav. We pipe to a temp.
    return null; // handled differently in the caller
  }
  throw new Error('Kokoro audio object missing toWav/save methods');
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  ensureDir(AUDIO_DIR);

  // Discover articles
  if (!fs.existsSync(CONTENT_DIR)) {
    console.error('No content directory at', CONTENT_DIR);
    process.exit(1);
  }
  const allMd = [...walk(CONTENT_DIR)].filter(p => p.endsWith('.md'));
  let candidates = allMd;
  if (flags.only) {
    candidates = allMd.filter(p => p.endsWith(flags.only + '.md') || p.includes('/' + flags.only + '/'));
    if (!candidates.length) {
      console.error('No article matched --only=' + flags.only);
      process.exit(1);
    }
  }
  console.log(`Scanning ${candidates.length} article${candidates.length === 1 ? '' : 's'}…`);

  // Decide which ones need work (avoid loading the model if nothing to do)
  const work = [];
  for (const filePath of candidates) {
    const { section, slug } = relSection(filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);
    const text = cleanForTTS(parsed.content);
    if (!text || text.length < 60) continue; // skip empties / stubs
    const voice = flags.voice || (parsed.data && parsed.data.voice) || DEFAULT_VOICE;
    const hash = sha256(text, voice, HASH_VERSION);
    const outDir = path.join(AUDIO_DIR, section);
    const mp3Path = path.join(outDir, slug + '.mp3');
    const sidecarPath = path.join(outDir, slug + '.json');

    let skip = false;
    if (!flags.force && fs.existsSync(mp3Path) && fs.existsSync(sidecarPath)) {
      try {
        const existing = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
        if (existing.hash === hash) skip = true;
      } catch (e) { /* fall through */ }
    }
    if (skip) {
      console.log(`  skip   ${section}/${slug}  (hash match)`);
      continue;
    }
    work.push({ filePath, section, slug, text, voice, hash, outDir, mp3Path, sidecarPath });
  }

  if (!work.length) {
    console.log('Nothing to do. Use --force to regenerate everything.');
    return;
  }
  console.log(`Generating ${work.length} article${work.length === 1 ? '' : 's'}…`);

  // Load model once
  console.log(`Loading Kokoro model (${MODEL_ID}, dtype=${DTYPE})…`);
  const t0 = Date.now();
  let tts;
  try {
    tts = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: DTYPE });
  } catch (err) {
    console.error('Could not load Kokoro model:', err.message || err);
    process.exit(1);
  }
  console.log(`Model ready in ${((Date.now() - t0) / 1000).toFixed(1)} s.`);

  let generated = 0, failed = 0;
  for (const item of work) {
    try {
      ensureDir(item.outDir);
      console.log(`  gen    ${item.section}/${item.slug}  (${item.text.length} chars, voice=${item.voice})`);

      const tStart = Date.now();
      const audio = await tts.generate(item.text, { voice: item.voice });

      // Write WAV to temp, transcode to MP3, then clean up
      const tmpWav = path.join(os.tmpdir(), `tft-${item.slug}-${Date.now()}.wav`);
      const wavBuf = audioToWav(audio);
      if (wavBuf) {
        fs.writeFileSync(tmpWav, wavBuf);
      } else if (typeof audio.save === 'function') {
        await audio.save(tmpWav);
      } else {
        throw new Error('Could not write WAV from kokoro audio');
      }

      await transcodeWavToMp3(tmpWav, item.mp3Path);
      const durationSec = await probeDurationSec(item.mp3Path);
      const stat = fs.statSync(item.mp3Path);
      try { fs.unlinkSync(tmpWav); } catch (e) {}

      const sidecar = {
        hash: item.hash,
        voice: item.voice,
        durationSec: Math.round(durationSec * 10) / 10,
        byteSize: stat.size,
        sourceMarkdownLength: item.text.length,
        generatedAt: new Date().toISOString(),
        modelId: MODEL_ID,
        dtype: DTYPE
      };
      fs.writeFileSync(item.sidecarPath, JSON.stringify(sidecar, null, 2));

      const took = ((Date.now() - tStart) / 1000).toFixed(1);
      const mb = (stat.size / 1024 / 1024).toFixed(2);
      const min = (durationSec / 60).toFixed(1);
      console.log(`         done  ${mb} MB, ${min} min audio, took ${took} s`);
      generated += 1;
    } catch (err) {
      failed += 1;
      console.error(`  FAIL   ${item.section}/${item.slug}: ${err.message || err}`);
    }
  }

  console.log('');
  console.log(`Summary: ${generated} generated, ${failed} failed, ${work.length - generated - failed} other.`);
  process.exit(failed > 0 ? failed : 0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
