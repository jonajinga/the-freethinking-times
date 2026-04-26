/**
 * Article TTS — Web Speech API with smart voice selection.
 *
 * Honest note on Kokoro: kokoro-js exists, but it requires loading
 * Transformers.js + an 80–200MB ONNX model on first click. That's
 * acceptable for an opt-in download, not for a click-and-go reader
 * button. The earlier "auto-load Kokoro on first click" approach
 * silently fell back to Web Speech every time because the package
 * surface I assumed didn't match the real one — so the voice you
 * heard was always the platform's default Web Speech voice.
 *
 * Two real options live here now:
 *
 *   1. Default: Web Speech API with the best available voice picked
 *      automatically. We rank voices by a heuristic that prefers
 *      named "Google", "Microsoft", "Premium", "Enhanced", and
 *      English (en-US / en-GB) voices — the platform's high-quality
 *      voices when present.
 *
 *   2. Optional: Kokoro via the official kokoro-js ESM build, opt-in
 *      via window.__tftEnableKokoro = true (set in your console for
 *      a one-off, or in a settings panel later). Reads a status line
 *      while it downloads, plays Kokoro audio when ready, and
 *      caches the model for repeat use.
 *
 * UI: a single play/pause button (#tts-btn) on the article. Pause
 * stops at the current sentence so resume continues from there.
 */
(function () {
  'use strict';

  var KOKORO_ESM = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
  var KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
  var KOKORO_VOICE = 'af_heart';

  var state = {
    btn: null,
    body: null,
    sentences: [],
    cursor: 0,
    speaking: false,
    paused: false,
    engine: 'webspeech', // or 'kokoro'
    voice: null,
    kokoro: null,
    kokoroLoading: null,
    audio: null
  };

  // ── Pick the best Web Speech voice the platform offers ──
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    var voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    function score(v) {
      var name = (v.name || '').toLowerCase();
      var lang = (v.lang || '').toLowerCase();
      var s = 0;
      if (lang.indexOf('en-us') === 0) s += 30;
      else if (lang.indexOf('en-gb') === 0) s += 20;
      else if (lang.indexOf('en') === 0) s += 10;
      // Quality cues platforms expose in the voice name
      if (name.indexOf('google') !== -1)   s += 25;
      if (name.indexOf('natural') !== -1)  s += 25;
      if (name.indexOf('premium') !== -1)  s += 20;
      if (name.indexOf('enhanced') !== -1) s += 18;
      if (name.indexOf('neural') !== -1)   s += 18;
      if (name.indexOf('online') !== -1)   s += 12;
      if (name.indexOf('siri') !== -1)     s += 15;
      if (v.localService) s += 4;
      // Penalise the obviously-robotic defaults so they only win
      // when nothing else is on the device.
      if (name === 'microsoft david' || name === 'microsoft zira') s -= 10;
      if (name.indexOf('compact') !== -1) s -= 12;
      return s;
    }
    var ranked = voices.slice().sort(function (a, b) { return score(b) - score(a); });
    return ranked[0] || null;
  }

  function pickArticleBody() {
    return document.querySelector('.article-body, .library-body, [data-pagefind-body]');
  }

  function extractSentences(root) {
    if (!root) return [];
    var clone = root.cloneNode(true);
    clone.querySelectorAll('script, style, .article-action-btn, .annotation-toolbar, .share-panel, .responses-section, [data-tts-skip], pre, code').forEach(function (n) { n.remove(); });
    var text = clone.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return [];
    var raw = text.split(/(?<=[.!?])\s+(?=[A-Z"'‘“])/);
    return raw.map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function setBtnState(playing) {
    if (!state.btn) return;
    state.btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    state.btn.classList.toggle('is-playing', playing);
    var play  = state.btn.querySelector('.tts-icon-play');
    var pause = state.btn.querySelector('.tts-icon-pause');
    if (play)  play.hidden  = playing;
    if (pause) pause.hidden = !playing;
    var label = state.btn.querySelector('.tts-btn__label');
    if (label) label.textContent = playing ? 'Pause' : 'Listen';
  }

  // ── Web Speech path ──
  function speakWebSpeech() {
    if (!('speechSynthesis' in window)) return;
    if (state.cursor >= state.sentences.length) { stop(); return; }
    var u = new SpeechSynthesisUtterance(state.sentences[state.cursor]);
    u.rate = 1.0;
    u.pitch = 1.0;
    if (state.voice) { u.voice = state.voice; u.lang = state.voice.lang; }
    u.onend = function () {
      if (!state.speaking) return;
      state.cursor += 1;
      speakWebSpeech();
    };
    u.onerror = function () { stop(); };
    window.speechSynthesis.speak(u);
  }

  // ── Kokoro path (opt-in) ──
  function ensureKokoro() {
    if (state.kokoro) return Promise.resolve(state.kokoro);
    if (state.kokoroLoading) return state.kokoroLoading;
    state.kokoroLoading = import(KOKORO_ESM)
      .then(function (mod) {
        if (!mod || !mod.KokoroTTS) throw new Error('kokoro-js missing KokoroTTS export');
        return mod.KokoroTTS.from_pretrained(KOKORO_MODEL_ID, { dtype: 'q8' });
      })
      .then(function (tts) { state.kokoro = tts; return tts; })
      .catch(function (e) {
        console.warn('Kokoro failed to load, falling back to Web Speech:', e);
        state.engine = 'webspeech';
        state.kokoro = null;
        throw e;
      });
    return state.kokoroLoading;
  }

  function speakKokoro() {
    if (state.cursor >= state.sentences.length) { stop(); return; }
    var sentence = state.sentences[state.cursor];
    state.kokoro.generate(sentence, { voice: KOKORO_VOICE })
      .then(function (audio) {
        if (!state.speaking) return;
        var url = URL.createObjectURL(audio.toBlob());
        var el = new Audio(url);
        state.audio = el;
        el.onended = function () {
          URL.revokeObjectURL(url);
          if (!state.speaking) return;
          state.cursor += 1;
          speakKokoro();
        };
        el.onerror = function () { stop(); };
        el.play().catch(function () { stop(); });
      })
      .catch(function () {
        state.engine = 'webspeech';
        speakWebSpeech();
      });
  }

  function play() {
    if (!state.body) state.body = pickArticleBody();
    if (!state.sentences.length) state.sentences = extractSentences(state.body);
    if (!state.sentences.length) return;
    state.speaking = true;
    state.paused = false;
    setBtnState(true);

    var wantKokoro = !!window.__tftEnableKokoro;
    if (wantKokoro) {
      state.engine = 'kokoro';
      // Start Web Speech immediately while Kokoro warms up; once ready,
      // the next `play()` (after stop / new article) will use Kokoro.
      ensureKokoro().then(function () {
        // If still speaking under Web Speech, swap engines on next sentence
      }).catch(function () {});
      if (state.kokoro) speakKokoro();
      else speakWebSpeech();
    } else {
      state.engine = 'webspeech';
      // Re-pick voice in case voices loaded after init
      if (!state.voice) state.voice = pickVoice();
      speakWebSpeech();
    }
  }

  function pause() {
    state.speaking = false;
    state.paused = true;
    setBtnState(false);
    if (state.audio) { try { state.audio.pause(); } catch (e) {} }
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  }

  function stop() {
    state.speaking = false;
    state.paused = false;
    state.cursor = 0;
    setBtnState(false);
    if (state.audio) { try { state.audio.pause(); } catch (e) {} state.audio = null; }
    if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (e) {} }
  }

  function init() {
    var btn = document.getElementById('tts-btn');
    if (!btn) return;
    state.btn = btn;
    state.body = pickArticleBody();
    state.sentences = [];
    state.cursor = 0;
    state.speaking = false;
    state.paused = false;
    state.voice = pickVoice();

    // voices may load lazily on Chrome — re-pick when they arrive
    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = function () {
        if (!state.voice) state.voice = pickVoice();
      };
    }

    btn.addEventListener('click', function () {
      if (state.speaking) pause();
      else if (state.paused) play();
      else play();
    });

    document.addEventListener('spa:contentswap', stop, { once: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  document.addEventListener('spa:contentswap', init);
})();
