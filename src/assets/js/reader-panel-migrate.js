/**
 * Move article reader tools out of the article header and into the Reader panel.
 *
 * Background: the page HTML still renders the original .article-header__actions
 * block with all its buttons, dropdowns, and data attributes — this keeps every
 * existing JS handler (reading-settings.js, download.js, progress.js, etc) wired
 * up exactly as before, no changes required.
 *
 * This script runs at load time and physically re-parents those elements into
 * empty slots inside the Reader panel. Since the elements are moved (not cloned),
 * the JS listeners follow them, so every feature continues to work.
 *
 * A CSS rule hides the now-empty .article-header__actions so the old bar no
 * longer appears above the article.
 */
(function () {
  'use strict';

  function move(srcId, slotId) {
    var src = document.getElementById(srcId);
    var slot = document.getElementById(slotId);
    if (src && slot) slot.appendChild(src);
  }

  // Find the Reader panel; bail out if we're not on an article/library page
  var panel = document.getElementById('article-notes-panel') || document.getElementById('library-panel');
  if (!panel) return;

  // Quick-action row (panel header): Save, Listen, Focus
  move('bookmark-btn', 'reader-panel-slot-bookmark');
  move('tts-btn',      'reader-panel-slot-tts');
  move('focus-btn',    'reader-panel-slot-focus');

  // Tab sections (panel body)
  move('reading-settings-panel', 'reader-panel-slot-display');
  move('share-panel',            'reader-panel-slot-share');
  move('download-panel',         'reader-panel-slot-download');
  move('cite-btn',               'reader-panel-slot-cite');

  // Footer links (panel bottom)
  move('revision-history-btn', 'reader-panel-slot-history');
  move('article-feedback-btn', 'reader-panel-slot-feedback');
  move('article-feedback-popup', 'reader-panel-slot-feedback');

  // Comments: find the commenting button by its onclick-content. It's the only
  // button inside .article-header__actions without an id that sets comments-body.
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

  // The reading-settings-panel and others have a `hidden` attribute to start —
  // clear it so the tab system (which uses aria-hidden) controls visibility.
  ['reading-settings-panel', 'share-panel', 'download-panel'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.hidden = false;
      el.classList.add('is-in-panel');
    }
  });
})();
