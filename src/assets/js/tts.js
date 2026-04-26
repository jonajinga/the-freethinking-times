/**
 * Article TTS — Kokoro (preferred) with Web Speech API fallback.
 *
 * Kokoro-js is a lightweight ONNX runtime model (~80MB) that runs entirely
 * in the browser, no server round-trip. We load it lazily on first click
 * because most readers will never use TTS — pre-loading 80MB of model
 * weights for everyone is unacceptable for a journalism site.
 *
 * If Kokoro fails to load (offline, slow network, browser without WebGPU
 * fallback) we drop down to the platform Web Speech API. It sounds robotic
 * but works everywhere instantly.
 *
 * UI: single play/pause button on the article (#tts-btn). Pause stops at
 * the current sentence so resume picks up where the reader left off.
 */
(function () {
  'use strict';

  var KOKORO_CDN = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.0/dist/kokoro.web.min.js';
  var VOICE = 'af_bella'; // sensible default; configurable via data-voice on the button

  var state = {
    btn: null,
    body: null,
    sentences: [],
    cursor: 0,
    speaking: false,
    paused: false,
    engine: null, // 'kokoro' | 'webspeech'
    kokoroReady: false,
    kokoroLoading: null,
    audio: null,
    utterance: null
  };

  function pickArticleBody() {
    return document.querySelector('.article-body, .library-body, [data-pagefind-body]');
  }

  function extractSentences(root) {
    if (!root) return [];
    var clone = root.cloneNode(true);
    // Strip non-spoken chrome
    clone.querySelectorAll('script, style, .article-action-btn, .share-panel, .responses-section, [data-tts-skip], pre, code').forEach(function (n) { n.remove(); });
    var text = clone.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return [];
    // Split into sentences but keep terminal punctuation
    var raw = text.split(/(?<=[.!?])\s+(?=[A-Z"'‘“])/);
    return raw.map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[data-kokoro]')) return resolve();
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.dataset.kokoro = 'true';
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Kokoro failed to load')); };
      document.head.appendChild(s);
    });
  }

  function ensureKokoro() {
    if (state.kokoroReady) return Promise.resolve();
    if (state.kokoroLoading) return state.kokoroLoading;
    state.kokoroLoading = loadScript(KOKORO_CDN)
      .then(function () {
        if (!window.KokoroTTS || !window.KokoroTTS.from_pretrained) throw new Error('Kokoro global missing');
        return window.KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-ONNX', { dtype: 'q8' });
      })
      .then(function (tts) {
        state.kokoro = tts;
        state.kokoroReady = true;
        state.engine = 'kokoro';
      })
      .catch(function () {
        state.engine = 'webspeech';
      });
    return state.kokoroLoading;
  }

  function setBtnState(playing) {
    if (!state.btn) return;
    state.btn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    state.btn.classList.toggle('is-playing', playing);
    var play = state.btn.querySelector('.tts-icon-play');
    var pause = state.btn.querySelector('.tts-icon-pause');
    if (play) play.hidden = playing;
    if (pause) pause.hidden = !playing;
    var label = state.btn.querySelector('.tts-btn__label');
    if (label) label.textContent = playing ? 'Pause' : 'Listen';
  }

  function speakWebSpeech() {
    if (!('speechSynthesis' in window)) return;
    if (state.cursor >= state.sentences.length) {
      stop();
      return;
    }
    var u = new SpeechSynthesisUtterance(state.sentences[state.cursor]);
    u.rate = 1.0;
    u.pitch = 1.0;
    state.utterance = u;
    u.onend = function () {
      if (!state.speaking) return;
      state.cursor += 1;
      speakWebSpeech();
    };
    u.onerror = function () { stop(); };
    window.speechSynthesis.speak(u);
  }

  function speakKokoro() {
    if (state.cursor >= state.sentences.length) {
      stop();
      return;
    }
    var sentence = state.sentences[state.cursor];
    state.kokoro.generate(sentence, { voice: VOICE })
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
        // Drop down to web speech on a per-sentence failure
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
    if (state.engine === 'kokoro' && state.kokoroReady) {
      speakKokoro();
    } else if ('speechSynthesis' in window) {
      // Web speech first while Kokoro loads in background; first launch will
      // already have triggered ensureKokoro().
      state.engine = state.engine || 'webspeech';
      speakWebSpeech();
    }
  }

  function pause() {
    state.speaking = false;
    state.paused = true;
    setBtnState(false);
    if (state.audio) {
      try { state.audio.pause(); } catch (e) {}
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  function stop() {
    state.speaking = false;
    state.paused = false;
    state.cursor = 0;
    setBtnState(false);
    if (state.audio) {
      try { state.audio.pause(); } catch (e) {}
      state.audio = null;
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
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
    state.engine = null;

    btn.addEventListener('click', function () {
      if (state.speaking) {
        pause();
      } else if (state.paused) {
        play();
      } else {
        // First click: start in web-speech mode immediately for low latency,
        // and warm up Kokoro in the background. Once Kokoro is ready, the
        // *next* play (after stop / new article) uses Kokoro.
        ensureKokoro();
        play();
      }
    });

    document.addEventListener('spa:contentswap', stop, { once: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
})();
