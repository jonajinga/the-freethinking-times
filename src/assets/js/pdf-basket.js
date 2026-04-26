/**
 * PDF basket — collect articles for combined print export.
 *
 * Storage: `tft-pdf-basket` → array of { url, title, section, date, author }.
 * The /print-basket/ page reads the array and renders each article in a
 * print-friendly stack so the reader can hit Print → Save as PDF.
 *
 * Article-page UI: a button (#pdf-basket-btn) toggles membership.
 * Aria-pressed reflects current state. Fires Umami events for adds and
 * removes.
 *
 * Floating tray: when the basket has any items, a small tray fixed to the
 * bottom-right of the viewport shows the count and a link to /print-basket/.
 * Hidden on print, hidden when the basket is empty.
 */
(function () {
  'use strict';

  var KEY = 'tft-pdf-basket';

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(arr) { try { localStorage.setItem(KEY, JSON.stringify(arr)); } catch (e) {} }
  function indexOf(arr, url) {
    for (var i = 0; i < arr.length; i++) if (arr[i].url === url) return i;
    return -1;
  }

  function ensureTray() {
    var tray = document.getElementById('pdf-basket-tray');
    if (!tray) {
      tray = document.createElement('a');
      tray.id = 'pdf-basket-tray';
      tray.className = 'pdf-basket-tray';
      tray.href = '/print-basket/';
      tray.setAttribute('role', 'status');
      tray.setAttribute('aria-label', 'Open print basket');
      tray.setAttribute('title', 'Open print basket');
      tray.setAttribute('data-umami-event', 'pdf-basket-open');
      tray.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M3 7h18l-2 12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L3 7z"/>' +
          '<path d="M8 7V5a4 4 0 0 1 8 0v2"/>' +
        '</svg>' +
        '<span class="pdf-basket-tray__count" data-pdf-basket-count>0</span>';
      document.body.appendChild(tray);
    }
    return tray;
  }

  function refreshTray() {
    var basket = load();
    var tray = ensureTray();
    var count = tray.querySelector('[data-pdf-basket-count]');
    if (count) count.textContent = String(basket.length);
    tray.hidden = basket.length === 0;
    tray.setAttribute('aria-label', 'Open print basket (' + basket.length + ' article' + (basket.length === 1 ? '' : 's') + ')');
  }

  function init() {
    var btn = document.getElementById('pdf-basket-btn');
    refreshTray();
    if (!btn) return;

    var url = btn.getAttribute('data-url') || location.pathname;

    function refreshBtn() {
      var basket = load();
      var present = indexOf(basket, url) !== -1;
      btn.setAttribute('aria-pressed', present ? 'true' : 'false');
      btn.setAttribute('title', present ? 'Remove from print basket' : 'Add to print basket');
      btn.setAttribute('aria-label', present ? 'Remove from print basket' : 'Add to print basket');
      btn.classList.toggle('is-in-basket', present);
    }

    btn.addEventListener('click', function () {
      var basket = load();
      var idx = indexOf(basket, url);
      if (idx !== -1) {
        basket.splice(idx, 1);
        if (window.umami) try { umami.track('pdf-basket-remove', { url: url }); } catch (e) {}
      } else {
        basket.push({
          url: url,
          title: btn.getAttribute('data-title') || document.title,
          section: btn.getAttribute('data-section') || '',
          date: btn.getAttribute('data-date') || '',
          author: btn.getAttribute('data-author') || ''
        });
        if (window.umami) try { umami.track('pdf-basket-add', { url: url }); } catch (e) {}
      }
      save(basket);
      refreshBtn();
      refreshTray();
    });

    refreshBtn();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  document.addEventListener('spa:contentswap', init);
})();
