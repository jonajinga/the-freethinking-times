/**
 * Global Display Settings — applies site-wide font, size, spacing, background.
 * Stored in localStorage. Loaded on every page via base.njk.
 */
(function () {
  'use strict';

  var _p = window.__PREFIX || 'tft';
  var K = {
    fontSize: _p + '-gs-font-size',
    font:     _p + '-gs-font',
    spacing:  _p + '-gs-spacing',
    wordspace: _p + '-gs-wordspace',
    bg:       _p + '-gs-bg'
  };

  var root = document.documentElement;
  var prefs = {
    fontSize:  parseInt(localStorage.getItem(K.fontSize), 10) || 0,
    font:      localStorage.getItem(K.font) || 'default',
    spacing:   localStorage.getItem(K.spacing) || 'normal',
    wordspace: localStorage.getItem(K.wordspace) || 'normal',
    bg:        localStorage.getItem(K.bg) || 'default'
  };

  function save(key, val) {
    try { localStorage.setItem(K[key], val); } catch (e) {}
  }

  // Quick profile presets
  var PROFILES = {
    'default':    { fontSize: 0,  font: 'default',  spacing: 'normal',  wordspace: 'normal', theme: 'auto' },
    'comfort':    { fontSize: 19, font: 'lora',     spacing: 'relaxed', wordspace: 'wide',   theme: 'sepia' },
    'low-vision': { fontSize: 22, font: 'atkinson', spacing: 'relaxed', wordspace: 'wider',  theme: 'light' },
    'night':      { fontSize: 18, font: 'literata', spacing: 'relaxed', wordspace: 'wide',   theme: 'dark' }
  };

  // On-demand web font loading via Bunny Fonts
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

  // ── Apply ──
  function applyAll() {
    if (prefs.fontSize > 0) root.style.fontSize = prefs.fontSize + 'px';
    else root.style.fontSize = '';

    root.removeAttribute('data-gs-font');
    if (prefs.font !== 'default') {
      root.setAttribute('data-gs-font', prefs.font);
      if (webFonts[prefs.font]) loadWebFont(prefs.font);
    }

    var spacingMap = { tight: '1.3', normal: '', relaxed: '1.8' };
    if (prefs.spacing !== 'normal') {
      root.style.setProperty('--leading-normal', spacingMap[prefs.spacing]);
      root.style.setProperty('--leading-relaxed', (parseFloat(spacingMap[prefs.spacing]) + 0.2).toString());
      root.style.setProperty('--leading-loose', (parseFloat(spacingMap[prefs.spacing]) + 0.4).toString());
    } else {
      root.style.removeProperty('--leading-normal');
      root.style.removeProperty('--leading-relaxed');
      root.style.removeProperty('--leading-loose');
    }

    // Word spacing: set a CSS custom property on :root so a low-specificity
    // rule applies it everywhere. Direct body inline style got overridden
    // by element-level rules on .article-body.
    var wsMap = { normal: '0', wide: '0.18em', wider: '0.35em' };
    root.style.setProperty('--gs-word-spacing', wsMap[prefs.wordspace] || '0');

    root.removeAttribute('data-gs-bg');
    if (prefs.bg !== 'default') root.setAttribute('data-gs-bg', prefs.bg);
  }

  applyAll();

  // ── Bind panel (runs after DOM ready) ──
  function bindPanel() {
    var panel = document.getElementById('global-settings-panel');
    if (!panel) return;

    var slider   = document.getElementById('gs-font-size');
    var sizeOut  = document.getElementById('gs-font-size-value');
    var fontSel  = document.getElementById('gs-font-select');
    var profBtns = panel.querySelectorAll('[data-gs-profile]');
    var themeGroup = document.getElementById('gs-theme-group');
    var themeBtns  = themeGroup ? themeGroup.querySelectorAll('[data-gs-theme]') : [];

    function updateSizeReadout() {
      if (sizeOut) sizeOut.textContent = (prefs.fontSize || 16) + 'px';
    }

    // Font size slider
    if (slider) {
      slider.value = prefs.fontSize || 16;
      updateSizeReadout();
      slider.addEventListener('input', function () {
        prefs.fontSize = parseInt(this.value, 10);
        save('fontSize', prefs.fontSize);
        applyAll();
        updateSizeReadout();
      });
    }

    // Font select
    if (fontSel) {
      fontSel.value = prefs.font;
      fontSel.addEventListener('change', function () {
        prefs.font = this.value;
        save('font', prefs.font);
        applyAll();
      });
    }

    // Segmented groups (spacing, wordspace)
    function dataKeyFor(el, attr) {
      var rawKey = attr.replace(/^data-/, '').replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
      return rawKey;
    }
    function bindGroup(attr, prefKey) {
      var buttons = panel.querySelectorAll('[' + attr + ']');
      buttons.forEach(function (b) {
        var dk = dataKeyFor(b, attr);
        b.classList.toggle('is-active', b.dataset[dk] === prefs[prefKey]);
        b.addEventListener('click', function () {
          prefs[prefKey] = b.dataset[dk];
          save(prefKey, prefs[prefKey]);
          applyAll();
          buttons.forEach(function (x) {
            x.classList.toggle('is-active', x.dataset[dk] === prefs[prefKey]);
          });
        });
      });
    }
    bindGroup('data-gs-spacing', 'spacing');
    bindGroup('data-gs-wordspace', 'wordspace');

    // Theme buttons — also drive the `data-theme` + bg attrs
    function currentThemeKey() {
      var t = localStorage.getItem(_p + '-theme');
      var b = localStorage.getItem(K.bg);
      if (t === 'dark') return 'dark';
      if (b === 'sepia') return 'sepia';
      if (b === 'cream') return 'cream';
      if (t === 'light') return 'light';
      return 'auto';
    }
    function setTheme(v) {
      if (v === 'auto') {
        root.removeAttribute('data-theme'); root.removeAttribute('data-gs-bg');
        localStorage.removeItem(_p + '-theme'); localStorage.removeItem(K.bg);
        prefs.bg = 'default';
      } else if (v === 'dark') {
        root.setAttribute('data-theme', 'dark'); root.removeAttribute('data-gs-bg');
        localStorage.setItem(_p + '-theme', 'dark'); localStorage.removeItem(K.bg);
        prefs.bg = 'default';
      } else if (v === 'sepia' || v === 'cream') {
        root.setAttribute('data-theme', 'light'); root.setAttribute('data-gs-bg', v);
        localStorage.setItem(_p + '-theme', 'light'); localStorage.setItem(K.bg, v);
        prefs.bg = v;
      } else {
        root.setAttribute('data-theme', 'light'); root.removeAttribute('data-gs-bg');
        localStorage.setItem(_p + '-theme', 'light'); localStorage.removeItem(K.bg);
        prefs.bg = 'default';
      }
      themeBtns.forEach(function (x) { x.classList.toggle('is-active', x.dataset.gsTheme === v); });
    }
    if (themeBtns.length) {
      var active = currentThemeKey();
      themeBtns.forEach(function (b) {
        b.classList.toggle('is-active', b.dataset.gsTheme === active);
        b.addEventListener('click', function () { setTheme(b.dataset.gsTheme); });
      });
    }

    // Quick profile presets
    function applyProfile(key) {
      var p = PROFILES[key];
      if (!p) return;
      prefs.fontSize = p.fontSize;
      prefs.font     = p.font;
      prefs.spacing  = p.spacing;
      prefs.wordspace = p.wordspace;
      if (p.fontSize) save('fontSize', p.fontSize); else localStorage.removeItem(K.fontSize);
      save('font', p.font);
      save('spacing', p.spacing);
      save('wordspace', p.wordspace);
      setTheme(p.theme);
      applyAll();
      // Sync control UI
      if (slider) slider.value = p.fontSize || 16;
      updateSizeReadout();
      if (fontSel) fontSel.value = p.font;
      panel.querySelectorAll('[data-gs-spacing]').forEach(function (x) {
        x.classList.toggle('is-active', x.dataset.gsSpacing === p.spacing);
      });
      panel.querySelectorAll('[data-gs-wordspace]').forEach(function (x) {
        x.classList.toggle('is-active', x.dataset.gsWordspace === p.wordspace);
      });
      profBtns.forEach(function (x) { x.classList.toggle('is-active', x.dataset.gsProfile === key); });
    }
    profBtns.forEach(function (b) {
      b.addEventListener('click', function () { applyProfile(b.dataset.gsProfile); });
    });

    // Close on outside click (with grace period for drawer button)
    var panelOpenTime = 0;
    new MutationObserver(function () {
      if (!panel.hidden) panelOpenTime = Date.now();
    }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });

    document.addEventListener('click', function (e) {
      if (panel.hidden) return;
      if (Date.now() - panelOpenTime < 200) return;
      var btn = document.getElementById('global-settings-btn');
      if (btn && btn.contains(e.target)) return;
      if (panel.contains(e.target)) return;
      panel.hidden = true;
    });

    // Escape closes
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) panel.hidden = true;
    });

    // Reset
    window.__resetGlobalSettings = function () {
      Object.keys(K).forEach(function (k) { localStorage.removeItem(K[k]); });
      localStorage.removeItem(_p + '-theme');
      root.removeAttribute('data-theme');
      root.removeAttribute('data-gs-bg');
      root.removeAttribute('data-gs-font');
      prefs = { fontSize: 0, font: 'default', spacing: 'normal', wordspace: 'normal', bg: 'default' };
      applyAll();
      if (slider) slider.value = 16;
      updateSizeReadout();
      if (fontSel) fontSel.value = 'default';
      panel.querySelectorAll('[data-gs-spacing]').forEach(function (x) {
        x.classList.toggle('is-active', x.dataset.gsSpacing === 'normal');
      });
      panel.querySelectorAll('[data-gs-wordspace]').forEach(function (x) {
        x.classList.toggle('is-active', x.dataset.gsWordspace === 'normal');
      });
      themeBtns.forEach(function (x) { x.classList.toggle('is-active', x.dataset.gsTheme === 'auto'); });
      profBtns.forEach(function (x) { x.classList.remove('is-active'); });
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindPanel);
  else bindPanel();
})();
