/**
 * Reader-panel migration + share/print popover wiring.
 *
 * The article HTML still renders the original .article-header__actions block
 * (hidden via CSS) so existing scripts (reading-settings.js, download.js,
 * progress.js, reading-list.js) keep wiring up by ID. This script:
 *
 *   - moves Save / Listen / Focus / Feedback buttons into the bottom toolbar
 *   - moves Reading-settings panel into the Reader panel's Display tab
 *   - moves share-panel / download-panel into the Share popover
 *   - wires the Share and Print popovers (toggle + close-on-outside)
 *   - delegates to navigator.share() on mobile if available
 */
(function () {
  'use strict';

  function move(srcId, slotId) {
    var src = document.getElementById(srcId);
    var slot = document.getElementById(slotId);
    if (src && slot) slot.appendChild(src);
  }

  var panel   = document.getElementById('article-notes-panel') || document.getElementById('library-panel');
  var toolbar = document.getElementById('annotation-toolbar');
  if (!panel && !toolbar) return;

  // ── Bottom toolbar slots (Save / Listen / Focus stay here)
  move('bookmark-btn', 'ann-save-slot');
  move('tts-btn',      'ann-listen-slot');
  move('focus-btn',    'ann-focus-slot');

  // Hide the panel-footer "Comments" button if the page has no comments
  // section to scroll to (e.g. comments aren't configured for this site).
  if (!document.getElementById('comments-body')) {
    document.querySelectorAll('.library-panel__footer-btn').forEach(function (b) {
      if ((b.getAttribute('aria-label') || '').toLowerCase().indexOf('comment') !== -1) {
        b.hidden = true;
      }
    });
  }

  // ── Reader panel footer slot for the Feedback button + popup
  // (bar gets too crowded on mobile when this lives inline; the panel
  // is a more natural home for "Send feedback" anyway)
  move('article-feedback-btn',   'ann-feedback-slot');
  move('article-feedback-popup', 'ann-feedback-slot');

  // ── Reader panel: Display tab
  move('reading-settings-panel', 'reader-panel-slot-display');

  // ── Share popover slots
  move('share-panel',    'ann-share-slot');
  move('download-panel', 'ann-download-slot');

  // Clear [hidden] on relocated panels — visibility now lives on the new
  // containers (the Display tab, the Share popover).
  ['reading-settings-panel', 'share-panel', 'download-panel'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.hidden = false; el.classList.add('is-in-panel'); }
  });

  // ── Generic popover wiring used by Share and Print.
  // Toggles `aria-expanded`, dismisses on outside click / Escape / item-click.
  function bindPopover(triggerId, popoverId, opts) {
    var trigger = document.getElementById(triggerId);
    var popover = document.getElementById(popoverId);
    if (!trigger || !popover) return null;

    function open()  { popover.hidden = false; trigger.setAttribute('aria-expanded', 'true');  }
    function close() { popover.hidden = true;  trigger.setAttribute('aria-expanded', 'false'); }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (opts && opts.onClick && opts.onClick(e) === false) return;
      if (popover.hidden) open(); else close();
    });

    document.addEventListener('click', function (e) {
      if (popover.hidden) return;
      if (!popover.contains(e.target) && e.target !== trigger) close();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !popover.hidden) { close(); trigger.focus(); }
    });

    // Click any link/button inside → close popover (after the click resolves)
    popover.addEventListener('click', function (e) {
      if (e.target.closest('a, button')) setTimeout(close, 50);
    });

    return { open: open, close: close };
  }

  // ── Share button: native share on mobile, popover on desktop
  var shareBtn = document.getElementById('ann-share-btn');
  var sharePopover = document.getElementById('ann-share-popover');
  if (shareBtn) shareBtn.classList.remove('annotation-toolbar__btn--needs-selection');

  // Coarse pointer = touch device (phones, most tablets). Desktop with
  // a mouse always sees the popover so the user can pick a specific
  // network or copy the link.
  var isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var hasNativeShare  = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  if (shareBtn && sharePopover && isCoarsePointer && hasNativeShare) {
    // Mobile: hand off to the system share sheet, skip the popover entirely.
    shareBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var src = document.getElementById('share-btn');
      var title = (src && src.dataset.title) || document.title;
      var url   = (src && src.dataset.url)   || window.location.href;
      navigator.share({ title: title, url: url }).catch(function () { /* user cancelled */ });
    }, { capture: true });
  } else {
    bindPopover('ann-share-btn', 'ann-share-popover');
  }

  // For article+notes print: walk every .library-highlight--note <mark> in
  // the article body and append its note text inline as a .print-inline-note
  // span. CSS reveals these only in print + print-include-notes mode.
  function injectInlineNotes() {
    var key = (window.__PREFIX || 'tft') + '-annotations';
    var ann = [];
    try { ann = JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) {}
    var byId = {};
    ann.forEach(function (a) { if (a && a.id) byId[a.id] = a; });
    document.querySelectorAll('mark.library-highlight--note').forEach(function (mark) {
      if (mark.querySelector('.print-inline-note')) return;
      var entry = byId[mark.dataset.annId];
      if (!entry || !entry.note) return;
      var span = document.createElement('span');
      span.className = 'print-inline-note';
      span.textContent = entry.note;
      mark.appendChild(span);
    });
  }
  function stripInlineNotes() {
    document.querySelectorAll('.print-inline-note').forEach(function (n) { n.remove(); });
  }

  // ── Print buttons inside the share popover (all standardized: each
  // calls window.print() with a body class controlling which sections
  // appear in the printout).
  //   article             → no class, just the article
  //   article-with-notes  → .print-include-notes (article + appendix)
  //   notes-only          → .print-notes-only (only the appendix)
  function clearPrintMode() {
    document.body.classList.remove('print-include-notes', 'print-notes-only');
    stripInlineNotes();
  }
  // Populate panel sections that render lazily (highlights / notes /
  // bookmarks via annotations.js, footnotes via footnotes.js), so print
  // captures them even when the user never opened the panel/tabs.
  function populatePanelForPrint() {
    if (typeof window.__refreshReaderPanel === 'function') {
      try { window.__refreshReaderPanel(); } catch (e) {}
    }
    // Force the lazy tab populators to run by flipping aria-hidden to
    // "false" for a tick — our populators observe that attribute.
    ['article-panel-footnotes', 'panel-footnotes', 'article-panel-cite-inline', 'panel-cite-inline'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.dataset.rendered !== 'true') {
        var prev = el.getAttribute('aria-hidden');
        el.setAttribute('aria-hidden', 'false');
        setTimeout(function () {
          if (prev !== null) el.setAttribute('aria-hidden', prev);
        }, 0);
      }
    });
  }

  if (sharePopover) {
    sharePopover.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-print]');
      if (!btn) return;
      var mode = btn.getAttribute('data-print');
      clearPrintMode();
      if (mode === 'article-with-notes') {
        document.body.classList.add('print-include-notes');
        populatePanelForPrint();
        injectInlineNotes();
      } else if (mode === 'notes-only') {
        document.body.classList.add('print-notes-only');
        populatePanelForPrint();
      }
      // Give the populators a tick to finish before opening the print dialog.
      setTimeout(function () {
        window.print();
        setTimeout(clearPrintMode, 100);
      }, 80);
    });
  }

  // ── Panel "Export notes" menu — position:fixed positioning, since
  // the tabs row's overflow-x: auto clips absolutely-positioned children.
  var exportWraps = document.querySelectorAll('.library-panel__export-wrap');
  exportWraps.forEach(function (wrap) {
    var trigger = wrap.querySelector('button');
    var menu    = wrap.querySelector('.library-panel__export-menu');
    if (!trigger || !menu) return;

    // Strip the legacy inline onclick (assumed absolute positioning that
    // got clipped by the tabs row's overflow-x:auto).
    trigger.removeAttribute('onclick');
    trigger.onclick = null;

    function position() {
      var r = trigger.getBoundingClientRect();
      // offsetWidth is 0 while still hidden, so place first then measure
      var menuW = menu.offsetWidth || 180;
      var top   = r.bottom + 6;
      var left  = Math.min(r.right - menuW, window.innerWidth - menuW - 8);
      menu.style.top  = Math.max(8, top)  + 'px';
      menu.style.left = Math.max(8, left) + 'px';
    }
    function openMenu() {
      menu.hidden = false;
      // Two-pass positioning: first show, then measure, then re-position
      position();
      requestAnimationFrame(position);
    }
    function closeMenu() { menu.hidden = true; }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      e.preventDefault();
      menu.hidden ? openMenu() : closeMenu();
    });
    document.addEventListener('click', function (e) {
      if (menu.hidden) return;
      if (!menu.contains(e.target) && e.target !== trigger && !trigger.contains(e.target)) closeMenu();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) closeMenu();
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('button')) setTimeout(closeMenu, 50);
    });
    window.addEventListener('resize', function () {
      if (!menu.hidden) position();
    }, { passive: true });
  });
})();
