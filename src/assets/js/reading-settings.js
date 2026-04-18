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
  ['fontSize','font','spacing','width','wordspace','bg','ruler','rulerThick','rulerColor','rulerStyle','paraNums','autoscroll','scrollSpeed'].forEach(function (k) {
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
    rulerThick:  localStorage.getItem(K.rulerThick) || '2',
    rulerColor:  localStorage.getItem(K.rulerColor) || 'accent',
    rulerStyle:  localStorage.getItem(K.rulerStyle) || 'solid',
    paraNums:    localStorage.getItem(K.paraNums) === 'true',
    autoscroll:  localStorage.getItem(K.autoscroll) === 'true',
    scrollSpeed: parseInt(localStorage.getItem(K.scrollSpeed), 10) || 3
  };

  function save(key, val) {
    try { localStorage.setItem(K[key], val); } catch (e) {}
  }

  // ─── On-demand web font loading via Bunny Fonts ────────────
  var webFonts = {
    inter: 'inter:wght@400;600;700',
    merriweather: 'merriweather:wght@400;700',
    roboto: 'roboto:wght@400;700',
    opensans: 'open-sans:wght@400;600;700',
    baskerville: 'libre-baskerville:wght@400;700',
    crimson: 'crimson-pro:wght@400;600;700',
    ibmplex: 'ibm-plex-serif:wght@400;600;700',
    literata: 'literata:wght@400;600;700',
    atkinson: 'atkinson-hyperlegible:wght@400;700'
  };
  var loadedFonts = {};

  function loadWebFont(key) {
    if (loadedFonts[key] || !webFonts[key]) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.bunny.net/css?family=' + webFonts[key] + '&display=swap';
    document.head.appendChild(link);
    loadedFonts[key] = true;
  }

  // ─── Apply functions ──────────────────────────────────────
  function applyFontSize(px) { body.style.fontSize = px + 'px'; }

  function applyFont(f) {
    body.setAttribute('data-rs-font', f);
    if (webFonts[f]) loadWebFont(f);
    var sel = document.getElementById('rs-font-select');
    if (sel) sel.value = f;
  }

  function applySpacing(v) {
    // Explicit values for every preset — the article-body's CSS default
    // is --leading-loose (1.9), so leaving "normal" empty made it wider
    // than "relaxed". Fixed ordering: tight < normal < relaxed < loose.
    var map = { tight: '1.4', normal: '1.6', relaxed: '1.8', loose: '2.1' };
    body.style.lineHeight = map[v] || '1.6';
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


  var rulerColorMap = {
    accent: 'var(--color-accent)',
    red: '#e53e3e',
    blue: '#3182ce',
    green: '#38a169',
    yellow: '#d69e2e',
    black: '#111',
    white: '#eee'
  };

  var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  function applyRuler(on) {
    var existing = document.getElementById('rs-reading-ruler');
    if (on && !existing) {
      var ruler = document.createElement('div');
      ruler.id = 'rs-reading-ruler';
      ruler.className = 'rs-ruler-line';
      document.body.appendChild(ruler);
      applyRulerStyle();
      updateRulerBounds();
      if (isTouchDevice) {
        // On touch: fixed at 40% of viewport height, stays put while scrolling
        ruler.style.top = Math.round(window.innerHeight * 0.4) + 'px';
        ruler.style.opacity = '';
      } else {
        document.addEventListener('mousemove', moveRuler);
      }
      window.addEventListener('resize', updateRulerBounds);
      window.addEventListener('scroll', updateRulerBounds, { passive: true });
    } else if (!on && existing) {
      existing.remove();
      document.removeEventListener('mousemove', moveRuler);
      window.removeEventListener('resize', updateRulerBounds);
      window.removeEventListener('scroll', updateRulerBounds);
    }
    var cb = document.getElementById('rs-ruler');
    if (cb) cb.checked = on;
    // Show/hide ruler options
    var opts = document.getElementById('rs-ruler-options');
    if (opts) opts.hidden = !on;
  }

  function applyRulerStyle() {
    var ruler = document.getElementById('rs-reading-ruler');
    if (!ruler) return;
    var thick = parseInt(prefs.rulerThick, 10) || 2;
    ruler.style.height = thick + 'px';
    ruler.style.background = rulerColorMap[prefs.rulerColor] || rulerColorMap.accent;
    // Style: solid (default), dashed, dotted, glow
    if (prefs.rulerStyle === 'dashed') {
      ruler.style.background = 'none';
      ruler.style.borderTop = thick + 'px dashed ' + (rulerColorMap[prefs.rulerColor] || rulerColorMap.accent);
      ruler.style.height = '0';
    } else if (prefs.rulerStyle === 'dotted') {
      ruler.style.background = 'none';
      ruler.style.borderTop = thick + 'px dotted ' + (rulerColorMap[prefs.rulerColor] || rulerColorMap.accent);
      ruler.style.height = '0';
    } else if (prefs.rulerStyle === 'glow') {
      var c = rulerColorMap[prefs.rulerColor] || rulerColorMap.accent;
      ruler.style.borderTop = 'none';
      ruler.style.height = thick + 'px';
      ruler.style.boxShadow = '0 0 ' + (thick * 3) + 'px ' + thick + 'px ' + c;
    } else {
      ruler.style.borderTop = 'none';
      ruler.style.boxShadow = 'none';
    }
  }

  // Cache the body bounds for ruler positioning
  var rulerBounds = { left: 0, width: 0, top: 0, bottom: 0 };
  function updateRulerBounds() {
    var rect = body.getBoundingClientRect();
    rulerBounds.left = rect.left;
    rulerBounds.width = rect.width;
    rulerBounds.top = rect.top;
    rulerBounds.bottom = rect.bottom;
    var ruler = document.getElementById('rs-reading-ruler');
    if (ruler) {
      ruler.style.left = rect.left + 'px';
      ruler.style.width = rect.width + 'px';
      // On touch devices, keep ruler at 40% viewport height
      if (isTouchDevice) {
        ruler.style.top = Math.round(window.innerHeight * 0.4) + 'px';
      }
    }
  }

  function moveRuler(e) {
    var ruler = document.getElementById('rs-reading-ruler');
    if (!ruler) return;
    var y = e.clientY;
    if (y < rulerBounds.top || y > rulerBounds.bottom) {
      ruler.style.opacity = '0';
    } else {
      ruler.style.opacity = '';
      ruler.style.top = y + 'px';
    }
  }


  // Hide ruler while text is selected
  document.addEventListener('selectionchange', function () {
    var ruler = document.getElementById('rs-reading-ruler');
    if (!ruler) return;
    var sel = window.getSelection();
    if (sel && sel.toString().length > 0) {
      ruler.style.visibility = 'hidden';
    } else {
      ruler.style.visibility = '';
    }
  });

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

  // Toggles
  var rulerCb = document.getElementById('rs-ruler');
  if (rulerCb) {
    rulerCb.addEventListener('change', function () {
      prefs.ruler = this.checked;
      applyRuler(prefs.ruler);
      save('ruler', prefs.ruler);
    });
  }

  // Ruler thickness
  var rulerThickSlider = document.getElementById('rs-ruler-thick');
  if (rulerThickSlider) {
    rulerThickSlider.value = prefs.rulerThick;
    rulerThickSlider.addEventListener('input', function () {
      prefs.rulerThick = this.value;
      save('rulerThick', prefs.rulerThick);
      applyRulerStyle();
    });
  }

  // Ruler color
  var rulerColorBtns = panel.querySelectorAll('[data-rs-ruler-color]');
  rulerColorBtns.forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.rsRulerColor === prefs.rulerColor);
    b.addEventListener('click', function () {
      prefs.rulerColor = b.dataset.rsRulerColor;
      save('rulerColor', prefs.rulerColor);
      applyRulerStyle();
      rulerColorBtns.forEach(function (x) {
        x.classList.toggle('is-active', x.dataset.rsRulerColor === prefs.rulerColor);
      });
    });
  });

  // Ruler style
  var rulerStyleBtns = panel.querySelectorAll('[data-rs-ruler-style]');
  rulerStyleBtns.forEach(function (b) {
    b.classList.toggle('is-active', b.dataset.rsRulerStyle === prefs.rulerStyle);
    b.addEventListener('click', function () {
      prefs.rulerStyle = b.dataset.rsRulerStyle;
      save('rulerStyle', prefs.rulerStyle);
      applyRulerStyle();
      rulerStyleBtns.forEach(function (x) {
        x.classList.toggle('is-active', x.dataset.rsRulerStyle === prefs.rulerStyle);
      });
    });
  });

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
    prefs.ruler = false; prefs.rulerThick = '2'; prefs.rulerColor = 'accent'; prefs.rulerStyle = 'solid';
    prefs.paraNums = false; prefs.autoscroll = false; prefs.scrollSpeed = 3;
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
  // When the panel has been relocated into the Reader panel as a tab section,
  // the tab system owns visibility via aria-hidden. Skip the dropdown toggle,
  // document-click dismissal, and Escape handlers — all would interfere with
  // the tab-based display. Checked at event time since reparenting happens
  // after this script initializes.
  function isInReaderPanel() {
    return !!(panel.closest && panel.closest('.library-panel'));
  }

  btn.addEventListener('click', function () {
    if (isInReaderPanel()) return;
    var open = this.getAttribute('aria-expanded') === 'true';
    this.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
  });

  document.addEventListener('click', function (e) {
    if (isInReaderPanel()) return;
    if (!btn.contains(e.target) && !panel.contains(e.target)) {
      btn.setAttribute('aria-expanded', 'false');
      panel.hidden = true;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (isInReaderPanel()) return;
    if (e.key === 'Escape' && !panel.hidden) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });

})();
