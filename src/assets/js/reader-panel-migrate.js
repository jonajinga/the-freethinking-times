/**
 * Reader-panel migration + share-popover wiring.
 *
 * The page HTML still renders the original .article-header__actions block
 * (hidden via CSS) with all its buttons, dropdowns, and data attributes so
 * every existing JS handler (reading-settings.js, download.js, progress.js)
 * stays wired without changes. This script reparents those elements at load
 * time into three destinations:
 *
 *   - annotation toolbar at the bottom of the page (Save / Listen / Focus)
 *   - share popover above the share icon (share-panel + download-panel)
 *   - Reader panel tabs / footer (Display / Cite / History / Feedback)
 *
 * Moving (not cloning) preserves the existing event listeners on the
 * migrated elements so every feature keeps working in its new home.
 */
(function () {
  'use strict';

  function move(srcId, slotId) {
    var src = document.getElementById(srcId);
    var slot = document.getElementById(slotId);
    if (src && slot) slot.appendChild(src);
  }

  var panel = document.getElementById('article-notes-panel') || document.getElementById('library-panel');
  var toolbar = document.getElementById('annotation-toolbar');
  if (!panel && !toolbar) return;

  // ── Bottom toolbar: Save / Listen / Focus
  move('bookmark-btn', 'ann-save-slot');
  move('tts-btn',      'ann-listen-slot');
  move('focus-btn',    'ann-focus-slot');

  // ── Share popover: social links + download formats
  move('share-panel',    'ann-share-slot');
  move('download-panel', 'ann-download-slot');

  // ── Reader panel: Display tab
  move('reading-settings-panel', 'reader-panel-slot-display');

  // ── Reader panel footer: Cite / History / Feedback
  move('cite-btn',               'reader-panel-slot-cite');
  move('revision-history-btn',   'reader-panel-slot-history');
  move('article-feedback-btn',   'reader-panel-slot-feedback');
  move('article-feedback-popup', 'reader-panel-slot-feedback');

  // Comments button has no id — find by onclick signature
  var actions = document.querySelector('.article-header__actions');
  if (actions) {
    var commentsSlot = document.getElementById('reader-panel-slot-comments');
    if (commentsSlot) {
      actions.querySelectorAll('button').forEach(function (b) {
        var oc = b.getAttribute('onclick') || '';
        if (oc.indexOf('comments-body') !== -1) commentsSlot.appendChild(b);
      });
    }
  }

  // Relocated panels had [hidden] to start; clear it so tab/popover visibility
  // is controlled by the containers we just moved them into.
  ['reading-settings-panel', 'share-panel', 'download-panel'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) { el.hidden = false; el.classList.add('is-in-panel'); }
  });

  // ── Ann share popover: wire ann-share-btn to toggle it
  var shareTrigger = document.getElementById('ann-share-btn');
  var sharePopover = document.getElementById('ann-share-popover');
  if (shareTrigger && sharePopover) {
    // Force-enable — it was marked "needs-selection" in earlier revisions
    // but the popover now offers article-level share/download actions that
    // are always available.
    shareTrigger.classList.remove('annotation-toolbar__btn--needs-selection');

    function openPopover() {
      sharePopover.hidden = false;
      shareTrigger.setAttribute('aria-expanded', 'true');
    }
    function closePopover() {
      sharePopover.hidden = true;
      shareTrigger.setAttribute('aria-expanded', 'false');
    }

    shareTrigger.addEventListener('click', function (e) {
      e.stopPropagation();
      if (sharePopover.hidden) openPopover(); else closePopover();
    });

    document.addEventListener('click', function (e) {
      if (sharePopover.hidden) return;
      if (!sharePopover.contains(e.target) && e.target !== shareTrigger) closePopover();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !sharePopover.hidden) {
        closePopover();
        shareTrigger.focus();
      }
    });

    // Close after picking any share/download/print option
    sharePopover.addEventListener('click', function (e) {
      var hit = e.target.closest('a, button');
      if (hit && hit !== sharePopover) setTimeout(closePopover, 50);
    });
  }
})();
