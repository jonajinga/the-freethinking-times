/**
 * The Freethinking Times — Reading Settings
 * Font size, line width, and font-family preferences for article pages.
 * Stored in localStorage. OpenDyslexic loaded on demand from CDN.
 */

(function () {
  'use strict';

  var _p = window.__PREFIX || 'tft';
  var KEYS = {
    fontSize: _p + '-rs-font-size',
    font:     _p + '-rs-font'
  };

  var btn   = document.getElementById('reading-settings-btn');
  var panel = document.getElementById('reading-settings-panel');
  var body  = document.querySelector('.article-body');

  if (!btn || !panel || !body) return;

  // ─── Load saved preferences ──────────────────────────────────
  var prefs = {
    fontSize: parseInt(localStorage.getItem(KEYS.fontSize), 10) || 18,
    font:     localStorage.getItem(KEYS.font) || 'serif'
  };

  function applyFontSize(px) {
    body.style.fontSize = px + 'px';
  }

  function applyFont(f) {
    body.setAttribute('data-rs-font', f);
    if (f === 'dyslexic') loadOpenDyslexic();
    panel.querySelectorAll('[data-rs-font]').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.rsFont === f);
    });
  }

  function loadOpenDyslexic() {
    if (document.getElementById(_p + '-open-dyslexic')) return;
    // @fontsource/open-dyslexic provides woff2 files and correct @font-face declarations
    var link = document.createElement('link');
    link.id = _p + '-open-dyslexic';
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@fontsource/open-dyslexic@5/index.css';
    document.head.appendChild(link);
  }

  // ─── Apply on page load ───────────────────────────────────────
  applyFontSize(prefs.fontSize);
  applyFont(prefs.font);

  var slider = document.getElementById('rs-font-size');
  if (slider) slider.value = prefs.fontSize;

  // ─── Font size slider ─────────────────────────────────────────
  if (slider) {
    slider.addEventListener('input', function () {
      prefs.fontSize = parseInt(this.value, 10);
      applyFontSize(prefs.fontSize);
      localStorage.setItem(KEYS.fontSize, prefs.fontSize);
    });
  }

  // ─── Font buttons ─────────────────────────────────────────────
  panel.querySelectorAll('[data-rs-font]').forEach(function (b) {
    b.addEventListener('click', function () {
      prefs.font = this.dataset.rsFont;
      applyFont(prefs.font);
      localStorage.setItem(KEYS.font, prefs.font);
    });
  });

  // ─── Panel toggle ─────────────────────────────────────────────
  btn.addEventListener('click', function () {
    var open = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
  });

  document.addEventListener('click', function (e) {
    if (!btn.contains(e.target) && !panel.contains(e.target)) {
      btn.setAttribute('aria-expanded', 'false');
      panel.hidden = true;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hidden) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });

})();
