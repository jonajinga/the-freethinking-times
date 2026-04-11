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

  // ── Apply ──
  function applyAll() {
    // Font size (0 = default, don't override)
    if (prefs.fontSize > 0) root.style.fontSize = prefs.fontSize + 'px';
    else root.style.fontSize = '';

    // Font
    root.removeAttribute('data-gs-font');
    if (prefs.font !== 'default') root.setAttribute('data-gs-font', prefs.font);

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

    // Close on outside click
    document.addEventListener('click', function (e) {
      var btn = document.getElementById('global-settings-btn');
      if (btn && !btn.contains(e.target) && !panel.contains(e.target)) {
        panel.hidden = true;
      }
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
