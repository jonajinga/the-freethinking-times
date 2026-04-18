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

  // ── Print buttons inside the share popover
  // (data-print is on items now combined into ann-share-popover)
  if (sharePopover) {
    sharePopover.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-print]');
      if (!btn) return;
      var mode = btn.getAttribute('data-print');
      if (mode === 'article-with-notes') document.body.classList.add('print-include-notes');
      else document.body.classList.remove('print-include-notes');
      setTimeout(function () {
        window.print();
        setTimeout(function () { document.body.classList.remove('print-include-notes'); }, 100);
      }, 0);
    });
  }

  // ── Panel "Export notes" menu — position:fixed positioning, since
  // the tabs row's overflow-x: auto clips absolutely-positioned children.
  var exportWraps = document.querySelectorAll('.library-panel__export-wrap');
  exportWraps.forEach(function (wrap) {
    var trigger = wrap.querySelector('button');
    var menu    = wrap.querySelector('.library-panel__export-menu');
    if (!trigger || !menu) return;

    // Replace the inline onclick (which was assuming absolute positioning)
    trigger.onclick = null;

    function position() {
      var r = trigger.getBoundingClientRect();
      var menuW = menu.offsetWidth || 200;
      var top   = r.bottom + 6;
      var left  = Math.min(r.right - menuW, window.innerWidth - menuW - 8);
      menu.style.top  = Math.max(8, top)  + 'px';
      menu.style.left = Math.max(8, left) + 'px';
    }
    function open()  { menu.hidden = false; position(); }
    function close() { menu.hidden = true; }

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      menu.hidden ? open() : close();
    });
    document.addEventListener('click', function (e) {
      if (menu.hidden) return;
      if (!menu.contains(e.target) && e.target !== trigger) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !menu.hidden) close();
    });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('button')) setTimeout(close, 50);
    });
    window.addEventListener('resize', function () {
      if (!menu.hidden) position();
    }, { passive: true });
  });
})();
