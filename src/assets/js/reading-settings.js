/**
 * The Freethinking Times — Reading Settings
 * Font size, font choice, line spacing, text width, word spacing,
 * background presets, reading ruler, paragraph numbers, auto-scroll.
 * All preferences stored in localStorage.
 */
(function () {
  'use strict';

  var _p = window.__PREFIX || 'tft';
  var btn   = document.getElementById('reading-settings-btn');
  var panel = document.getElementById('reading-settings-panel');
  var body  = document.querySelector('.article-body');
  if (!btn || !panel || !body) return;

  // ─── Storage keys ──────────────────────────────────────────
  var K = {};
  ['fontSize','font','spacing','width','wordspace','bg','ruler','paraNums','autoscroll','scrollSpeed'].forEach(function (k) {
    K[k] = _p + '-rs-' + k;
  });

  // ─── Load preferences ─────────────────────────────────────
  var prefs = {
    fontSize:    parseInt(localStorage.getItem(K.fontSize), 10) || 18,
    font:        localStorage.getItem(K.font) || 'serif',
    spacing:     localStorage.getItem(K.spacing) || 'normal',
    width:       localStorage.getItem(K.width) || 'normal',
    wordspace:   localStorage.getItem(K.wordspace) || 'normal',
    bg:          localStorage.getItem(K.bg) || 'default',
    ruler:       localStorage.getItem(K.ruler) === 'true',
    paraNums:    localStorage.getItem(K.paraNums) === 'true',
    autoscroll:  localStorage.getItem(K.autoscroll) === 'true',
    scrollSpeed: parseInt(localStorage.getItem(K.scrollSpeed), 10) || 3
  };

  function save(key, val) {
    try { localStorage.setItem(K[key], val); } catch (e) {}
  }

  // ─── Apply functions ──────────────────────────────────────
  function applyFontSize(px) { body.style.fontSize = px + 'px'; }

  function applyFont(f) {
    body.setAttribute('data-rs-font', f);
    var sel = document.getElementById('rs-font-select');
    if (sel) sel.value = f;
  }

  function applySpacing(v) {
    var map = { tight: '1.3', normal: '', relaxed: '1.8', loose: '2.1' };
    body.style.lineHeight = map[v] || '';
    setActive('[data-rs-spacing]', v);
  }

  function applyWidth(v) {
    body.setAttribute('data-rs-width', v);
    setActive('[data-rs-width]', v);
  }

  function applyWordspace(v) {
    var map = { normal: '', wide: '0.15em', wider: '0.3em' };
    body.style.wordSpacing = map[v] || '';
    setActive('[data-rs-wordspace]', v);
  }

  function applyBg(v) {
    document.documentElement.removeAttribute('data-rs-bg');
    if (v !== 'default') document.documentElement.setAttribute('data-rs-bg', v);
    setActive('[data-rs-bg]', v);
  }

  function applyRuler(on) {
    var existing = document.getElementById('rs-reading-ruler');
    if (on && !existing) {
      var ruler = document.createElement('div');
      ruler.id = 'rs-reading-ruler';
      ruler.className = 'rs-ruler-line';
      document.body.appendChild(ruler);
      document.addEventListener('mousemove', moveRuler);
    } else if (!on && existing) {
      existing.remove();
      document.removeEventListener('mousemove', moveRuler);
    }
    var cb = document.getElementById('rs-ruler');
    if (cb) cb.checked = on;
    // Don't persist ruler — it's session-only for the current page
  }

  function moveRuler(e) {
    var ruler = document.getElementById('rs-reading-ruler');
    if (ruler) ruler.style.top = e.clientY + 'px';
  }

  function applyParaNums(on) {
    body.classList.toggle('rs-para-numbers', on);
    var cb = document.getElementById('rs-para-nums');
    if (cb) cb.checked = on;
  }

  var scrollAnim = null;
  function applyAutoscroll(on) {
    if (on) {
      var speed = prefs.scrollSpeed;
      function tick() {
        window.scrollBy(0, speed * 0.3);
        scrollAnim = requestAnimationFrame(tick);
      }
      scrollAnim = requestAnimationFrame(tick);
      var speedPanel = document.getElementById('rs-autoscroll-speed');
      if (speedPanel) speedPanel.hidden = false;
    } else {
      if (scrollAnim) cancelAnimationFrame(scrollAnim);
      scrollAnim = null;
      var speedPanel = document.getElementById('rs-autoscroll-speed');
      if (speedPanel) speedPanel.hidden = true;
    }
    var cb = document.getElementById('rs-autoscroll');
    if (cb) cb.checked = on;
  }

  function setActive(selector, val) {
    panel.querySelectorAll(selector).forEach(function (b) {
      var attr = Object.keys(b.dataset).find(function (k) { return k.startsWith('rs'); });
      b.classList.toggle('is-active', b.dataset[attr] === val);
    });
  }

  // ─── Apply all on load ────────────────────────────────────
  applyFontSize(prefs.fontSize);
  applyFont(prefs.font);
  applySpacing(prefs.spacing);
  applyWidth(prefs.width);
  applyWordspace(prefs.wordspace);
  applyBg(prefs.bg);
  // Ruler and para nums are session-only — don't auto-apply from localStorage
  // if (prefs.ruler) applyRuler(true);
  if (prefs.paraNums) applyParaNums(true);

  var slider = document.getElementById('rs-font-size');
  if (slider) slider.value = prefs.fontSize;

  // ─── Event handlers ───────────────────────────────────────
  // Font size
  if (slider) {
    slider.addEventListener('input', function () {
      prefs.fontSize = parseInt(this.value, 10);
      applyFontSize(prefs.fontSize);
      save('fontSize', prefs.fontSize);
    });
  }

  // Font select
  var fontSelect = document.getElementById('rs-font-select');
  if (fontSelect) {
    fontSelect.value = prefs.font;
    fontSelect.addEventListener('change', function () {
      prefs.font = this.value;
      applyFont(prefs.font);
      save('font', prefs.font);
    });
  }

  // Button groups
  function bindBtnGroup(attr, prefKey, applyFn) {
    panel.querySelectorAll('[' + attr + ']').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = Object.keys(b.dataset).find(function (dk) { return dk.startsWith('rs'); });
        prefs[prefKey] = b.dataset[k];
        applyFn(prefs[prefKey]);
        save(prefKey, prefs[prefKey]);
      });
    });
  }

  bindBtnGroup('data-rs-spacing', 'spacing', applySpacing);
  bindBtnGroup('data-rs-width', 'width', applyWidth);
  bindBtnGroup('data-rs-wordspace', 'wordspace', applyWordspace);
  bindBtnGroup('data-rs-bg', 'bg', applyBg);

  // Toggles
  var rulerCb = document.getElementById('rs-ruler');
  if (rulerCb) {
    rulerCb.addEventListener('change', function () {
      prefs.ruler = this.checked;
      applyRuler(prefs.ruler);
      save('ruler', prefs.ruler);
    });
  }

  var paraNumsCb = document.getElementById('rs-para-nums');
  if (paraNumsCb) {
    paraNumsCb.addEventListener('change', function () {
      prefs.paraNums = this.checked;
      applyParaNums(prefs.paraNums);
      save('paraNums', prefs.paraNums);
    });
  }

  var autoscrollCb = document.getElementById('rs-autoscroll');
  if (autoscrollCb) {
    autoscrollCb.addEventListener('change', function () {
      prefs.autoscroll = this.checked;
      applyAutoscroll(prefs.autoscroll);
      save('autoscroll', prefs.autoscroll);
    });
  }

  var scrollSpeedSlider = document.getElementById('rs-scroll-speed');
  if (scrollSpeedSlider) {
    scrollSpeedSlider.value = prefs.scrollSpeed;
    scrollSpeedSlider.addEventListener('input', function () {
      prefs.scrollSpeed = parseInt(this.value, 10);
      save('scrollSpeed', prefs.scrollSpeed);
      if (prefs.autoscroll) {
        applyAutoscroll(false);
        applyAutoscroll(true);
      }
    });
  }

  // Stop auto-scroll on user interaction
  document.addEventListener('wheel', function () {
    if (prefs.autoscroll) {
      prefs.autoscroll = false;
      applyAutoscroll(false);
      save('autoscroll', false);
    }
  });

  // ─── Reset ────────────────────────────────────────────────
  window.__resetReadingSettings = function () {
    Object.keys(K).forEach(function (k) { try { localStorage.removeItem(K[k]); } catch (e) {} });
    prefs.fontSize = 18; prefs.font = 'serif'; prefs.spacing = 'normal';
    prefs.width = 'normal'; prefs.wordspace = 'normal'; prefs.bg = 'default';
    prefs.ruler = false; prefs.paraNums = false; prefs.autoscroll = false; prefs.scrollSpeed = 3;
    body.style.fontSize = ''; body.style.lineHeight = ''; body.style.wordSpacing = '';
    body.removeAttribute('data-rs-font'); body.removeAttribute('data-rs-width');
    body.classList.remove('rs-para-numbers');
    applyRuler(false);
    applyAutoscroll(false);
    var s = document.getElementById('rs-font-size'); if (s) s.value = 18;
    var f = document.getElementById('rs-font-select'); if (f) f.value = 'serif';
    var sc = document.getElementById('rs-scroll-speed'); if (sc) sc.value = 3;
    // Reset all button group active states
    panel.querySelectorAll('.rs-btn').forEach(function (b) {
      var keys = Object.keys(b.dataset);
      var isDefault = keys.some(function (k) {
        return b.dataset[k] === 'normal' || b.dataset[k] === 'default' || b.dataset[k] === 'serif';
      });
      b.classList.toggle('is-active', isDefault);
    });
  };

  // ─── Panel toggle ─────────────────────────────────────────
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
