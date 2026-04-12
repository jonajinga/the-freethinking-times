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
    // Font size (0 = default, don't override)
    if (prefs.fontSize > 0) root.style.fontSize = prefs.fontSize + 'px';
    else root.style.fontSize = '';

    // Font
    root.removeAttribute('data-gs-font');
    if (prefs.font !== 'default') {
      root.setAttribute('data-gs-font', prefs.font);
      if (webFonts[prefs.font]) loadWebFont(prefs.font);
    }

    // Spacing — override the design token
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

    // Word spacing — set on body to cascade
    document.body.style.wordSpacing = prefs.wordspace === 'normal' ? '' : (prefs.wordspace === 'wide' ? '0.12em' : '0.25em');

    // Background
    root.removeAttribute('data-gs-bg');
    if (prefs.bg !== 'default') root.setAttribute('data-gs-bg', prefs.bg);
  }

  applyAll();

  // ── Bind panel (runs after DOM ready) ──
  function bindPanel() {
    var panel = document.getElementById('global-settings-panel');
    if (!panel) return;

    // Font size slider
    var slider = document.getElementById('gs-font-size');
    if (slider) {
      slider.value = prefs.fontSize || 16;
      slider.addEventListener('input', function () {
        prefs.fontSize = parseInt(this.value, 10);
        save('fontSize', prefs.fontSize);
        applyAll();
      });
    }

    // Font select
    var fontSel = document.getElementById('gs-font-select');
    if (fontSel) {
      fontSel.value = prefs.font;
      fontSel.addEventListener('change', function () {
        prefs.font = this.value;
        save('font', prefs.font);
        applyAll();
      });
    }

    // Button groups
    function bindGroup(attr, prefKey) {
      panel.querySelectorAll('[' + attr + ']').forEach(function (b) {
        var dk = Object.keys(b.dataset).find(function (k) { return k.startsWith('gs'); });
        b.classList.toggle('is-active', b.dataset[dk] === prefs[prefKey]);
        b.addEventListener('click', function () {
          prefs[prefKey] = b.dataset[dk];
          save(prefKey, prefs[prefKey]);
          applyAll();
          panel.querySelectorAll('[' + attr + ']').forEach(function (x) {
            var xk = Object.keys(x.dataset).find(function (k) { return k.startsWith('gs'); });
            x.classList.toggle('is-active', x.dataset[xk] === prefs[prefKey]);
          });
        });
      });
    }

    bindGroup('data-gs-spacing', 'spacing');
    bindGroup('data-gs-wordspace', 'wordspace');
    bindGroup('data-gs-bg', 'bg');

    // Theme buttons
    var themeGroup = document.getElementById('gs-theme-group');
    if (themeGroup) {
      var themeBtns = themeGroup.querySelectorAll('[data-gs-theme]');
      // Set initial active state
      var currentTheme = localStorage.getItem(_p + '-theme');
      var currentBg = localStorage.getItem(K.bg);
      var activeTheme = 'auto';
      if (currentTheme === 'dark') activeTheme = 'dark';
      else if (currentBg === 'sepia') activeTheme = 'sepia';
      else if (currentBg === 'cream') activeTheme = 'cream';
      else if (currentTheme === 'light') activeTheme = 'light';
      themeBtns.forEach(function (b) { b.classList.toggle('is-active', b.dataset.gsTheme === activeTheme); });

      themeBtns.forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.dataset.gsTheme;
          themeBtns.forEach(function (x) { x.classList.remove('is-active'); });
          b.classList.add('is-active');
          if (v === 'auto') {
            root.removeAttribute('data-theme'); root.removeAttribute('data-gs-bg');
            localStorage.removeItem(_p + '-theme'); localStorage.removeItem(K.bg);
          } else if (v === 'dark') {
            root.setAttribute('data-theme', 'dark'); root.removeAttribute('data-gs-bg');
            localStorage.setItem(_p + '-theme', 'dark'); localStorage.removeItem(K.bg);
          } else if (v === 'sepia' || v === 'cream') {
            root.setAttribute('data-theme', 'light'); root.setAttribute('data-gs-bg', v);
            localStorage.setItem(_p + '-theme', 'light'); localStorage.setItem(K.bg, v);
            prefs.bg = v;
          } else {
            root.setAttribute('data-theme', 'light'); root.removeAttribute('data-gs-bg');
            localStorage.setItem(_p + '-theme', 'light'); localStorage.removeItem(K.bg);
          }
        });
      });
    }

    // Close on outside click (with grace period for drawer button)
    var panelOpenTime = 0;
    var origHiddenProp = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden') ||
      Object.getOwnPropertyDescriptor(Element.prototype, 'hidden');
    // Track when panel opens
    new MutationObserver(function () {
      if (!panel.hidden) panelOpenTime = Date.now();
    }).observe(panel, { attributes: true, attributeFilter: ['hidden'] });

    document.addEventListener('click', function (e) {
      if (panel.hidden) return;
      // Ignore clicks within 200ms of opening (prevents drawer button from closing)
      if (Date.now() - panelOpenTime < 200) return;
      var btn = document.getElementById('global-settings-btn');
      if (btn && btn.contains(e.target)) return;
      if (panel.contains(e.target)) return;
      panel.hidden = true;
    });

    // Reset
    window.__resetGlobalSettings = function () {
      Object.keys(K).forEach(function (k) { localStorage.removeItem(K[k]); });
      prefs = { fontSize: 0, font: 'default', spacing: 'normal', wordspace: 'normal', bg: 'default' };
      applyAll();
      if (slider) slider.value = 16;
      if (fontSel) fontSel.value = 'default';
      bindGroup('data-gs-spacing', 'spacing');
      bindGroup('data-gs-wordspace', 'wordspace');
      bindGroup('data-gs-bg', 'bg');
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindPanel);
  else bindPanel();
})();
