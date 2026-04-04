/**
 * The Freethinking Times — Public Domain Library
 * Modules: ReadingPosition, ChapterCompletion, Bookmarks, Annotations
 * Context is read from #library-context (data-work-slug, data-chapter-slug, data-chapter-title).
 */
(function () {
  'use strict';

  // ─── Context ──────────────────────────────────────────────
  var ctx = document.getElementById('library-context');
  if (!ctx) return;

  var workSlug    = ctx.dataset.workSlug    || '';
  var chapterSlug = ctx.dataset.chapterSlug || '';
  var chapterTitle = ctx.dataset.chapterTitle || '';

  var isChapterPage = chapterSlug !== '';

  // ─── ReadingPosition ──────────────────────────────────────
  var ReadingPosition = (function () {
    var KEY_PREFIX = 'tft-lib-pos-';
    var EXPIRY_MS  = 30 * 24 * 60 * 60 * 1000; // 30 days

    function storageKey(slug) {
      return KEY_PREFIX + slug;
    }

    function save(slug, pct) {
      try {
        localStorage.setItem(storageKey(slug), JSON.stringify({
          pct: pct,
          ts:  Date.now()
        }));
      } catch (e) {}
    }

    function load(slug) {
      try {
        var raw = localStorage.getItem(storageKey(slug));
        if (!raw) return null;
        var obj = JSON.parse(raw);
        if (Date.now() - obj.ts > EXPIRY_MS) {
          localStorage.removeItem(storageKey(slug));
          return null;
        }
        return obj.pct;
      } catch (e) { return null; }
    }

    function remove(slug) {
      try { localStorage.removeItem(storageKey(slug)); } catch (e) {}
    }

    function getScrollPct() {
      var scrollTop  = window.scrollY || document.documentElement.scrollTop;
      var docHeight  = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return 100;
      return Math.min(100, Math.round((scrollTop / docHeight) * 100));
    }

    // Restore scroll position on load
    function restore(slug) {
      var pct = load(slug);
      if (pct == null || pct === 0) return;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        window.scrollTo(0, Math.round((pct / 100) * docHeight));
      }
    }

    return { save: save, load: load, remove: remove, getScrollPct: getScrollPct, restore: restore };
  }());

  // ─── ChapterCompletion ────────────────────────────────────
  var ChapterCompletion = (function () {
    var KEY = 'tft-lib-completed-' + workSlug;
    var COMPLETE_THRESHOLD = 88; // percent

    function getCompleted() {
      try {
        return JSON.parse(localStorage.getItem(KEY) || '[]');
      } catch (e) { return []; }
    }

    function markComplete(slug) {
      var list = getCompleted();
      if (list.indexOf(slug) === -1) {
        list.push(slug);
        try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
      }
    }

    function isComplete(slug) {
      return getCompleted().indexOf(slug) !== -1;
    }

    return {
      getCompleted:    getCompleted,
      markComplete:    markComplete,
      isComplete:      isComplete,
      COMPLETE_THRESHOLD: COMPLETE_THRESHOLD
    };
  }());

  // ─── Bookmarks ────────────────────────────────────────────
  var Bookmarks = (function () {
    var KEY = 'tft-lib-bookmarks-' + workSlug;

    function load() {
      try {
        return JSON.parse(localStorage.getItem(KEY) || '[]');
      } catch (e) { return []; }
    }

    function save(list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    }

    function add(chapter, scrollPct) {
      var list = load();
      var id   = 'bm-' + Date.now();
      list.push({ id: id, chapter: chapter, scrollPct: scrollPct, ts: Date.now() });
      save(list);
      return id;
    }

    function remove(id) {
      save(load().filter(function (b) { return b.id !== id; }));
    }

    function render(containerEl, onJump) {
      var list = load();
      containerEl.innerHTML = '';
      if (!list.length) {
        containerEl.innerHTML = '<p class="library-panel__empty">No bookmarks yet.</p>';
        return;
      }
      var ul = document.createElement('div');
      ul.className = 'library-bookmark-list';
      list.sort(function (a, b) { return b.ts - a.ts; }).forEach(function (bm) {
        var item = document.createElement('div');
        item.className = 'library-bookmark-item';
        item.innerHTML =
          '<span class="library-bookmark-item__chapter">' + escHtml(bm.chapter) + '</span>' +
          '<span class="library-bookmark-item__pos">' + bm.scrollPct + '% through</span>' +
          '<button class="library-bookmark-item__delete" data-bm-id="' + escHtml(bm.id) + '" aria-label="Delete bookmark">Remove</button>';
        item.addEventListener('click', function (e) {
          if (e.target.dataset.bmId) {
            remove(e.target.dataset.bmId);
            render(containerEl, onJump);
          } else if (onJump) {
            onJump(bm);
          }
        });
        ul.appendChild(item);
      });
      containerEl.appendChild(ul);
    }

    return { add: add, remove: remove, render: render, load: load };
  }());

  // ─── Annotations ──────────────────────────────────────────
  var Annotations = (function () {
    var KEY = 'tft-lib-annotations-' + workSlug;

    function load() {
      try {
        return JSON.parse(localStorage.getItem(KEY) || '[]');
      } catch (e) { return []; }
    }

    function save(list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    }

    function add(chapter, quote, note) {
      var list = load();
      var id   = 'ann-' + Date.now();
      list.push({ id: id, chapter: chapter, quote: quote, note: note || '', ts: Date.now() });
      save(list);
      return id;
    }

    function remove(id) {
      save(load().filter(function (a) { return a.id !== id; }));
    }

    function updateNote(id, note) {
      var list = load();
      var ann  = list.find(function (a) { return a.id === id; });
      if (ann) { ann.note = note; save(list); }
    }

    function render(containerEl) {
      var list = load().filter(function (a) { return a.chapter === chapterSlug || !chapterSlug; });
      containerEl.innerHTML = '';
      if (!list.length) {
        containerEl.innerHTML = '<p class="library-panel__empty">No annotations for this chapter.</p>';
        return;
      }
      var wrapper = document.createElement('div');
      wrapper.className = 'library-annotation-list';
      list.sort(function (a, b) { return b.ts - a.ts; }).forEach(function (ann) {
        var item = document.createElement('div');
        item.className = 'library-annotation-item';
        item.innerHTML =
          '<p class="library-annotation-item__quote">&ldquo;' + escHtml(ann.quote) + '&rdquo;</p>' +
          (ann.note ? '<p class="library-annotation-item__note">' + escHtml(ann.note) + '</p>' : '') +
          '<div class="library-annotation-item__actions">' +
            '<button class="library-annotation-item__action" data-ann-delete="' + escHtml(ann.id) + '">Delete</button>' +
          '</div>';
        item.querySelector('[data-ann-delete]').addEventListener('click', function () {
          remove(ann.id);
          render(containerEl);
        });
        wrapper.appendChild(item);
      });
      containerEl.appendChild(wrapper);
    }

    // Restore highlight spans for saved annotations in the body
    function restoreHighlights(bodyEl) {
      if (!bodyEl) return;
      var list = load().filter(function (a) { return a.chapter === chapterSlug; });
      list.forEach(function (ann) {
        try {
          highlightTextInEl(bodyEl, ann.quote, ann.id);
        } catch (e) {}
      });
    }

    // Simple text-match highlight (first occurrence only)
    function highlightTextInEl(el, text, annId) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while ((node = walker.nextNode())) {
        var idx = node.nodeValue.indexOf(text);
        if (idx !== -1) {
          var before  = document.createTextNode(node.nodeValue.slice(0, idx));
          var mark    = document.createElement('mark');
          mark.className  = 'library-highlight';
          mark.dataset.annId = annId;
          mark.textContent = text;
          var after   = document.createTextNode(node.nodeValue.slice(idx + text.length));
          var parent  = node.parentNode;
          parent.insertBefore(before, node);
          parent.insertBefore(mark, node);
          parent.insertBefore(after, node);
          parent.removeChild(node);
          break;
        }
      }
    }

    return { add: add, remove: remove, updateNote: updateNote, render: render, restoreHighlights: restoreHighlights };
  }());

  // ─── Utility ──────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  // ─── Init: Chapter reading page ───────────────────────────
  document.addEventListener('DOMContentLoaded', function () {

    // ── Progress bar ──
    var progressBar = document.querySelector('.library-reading-progress__bar');
    function updateProgress() {
      var pct = ReadingPosition.getScrollPct();
      if (progressBar) progressBar.style.width = pct + '%';

      // Auto-complete at threshold
      if (isChapterPage && pct >= ChapterCompletion.COMPLETE_THRESHOLD) {
        ChapterCompletion.markComplete(chapterSlug);
      }
    }

    // ── Save / restore position ──
    var savePosition = debounce(function () {
      if (isChapterPage) {
        ReadingPosition.save(chapterSlug, ReadingPosition.getScrollPct());
      }
    }, 500);

    if (isChapterPage) {
      ReadingPosition.restore(chapterSlug);
    }

    window.addEventListener('scroll', function () {
      updateProgress();
      savePosition();
    }, { passive: true });

    updateProgress();

    // ── Panel ──
    var panelToggle  = document.querySelector('.library-panel-toggle');
    var panel        = document.getElementById('library-panel');
    var panelOverlay = document.querySelector('.library-panel-overlay');
    var panelClose   = document.querySelector('.library-panel__close');

    function openPanel() {
      if (!panel) return;
      panel.setAttribute('aria-hidden', 'false');
      if (panelOverlay) panelOverlay.setAttribute('aria-hidden', 'false');
      if (panelToggle) panelToggle.setAttribute('aria-expanded', 'true');
      refreshPanelContents();
    }

    function closePanel() {
      if (!panel) return;
      panel.setAttribute('aria-hidden', 'true');
      if (panelOverlay) panelOverlay.setAttribute('aria-hidden', 'true');
      if (panelToggle) panelToggle.setAttribute('aria-expanded', 'false');
    }

    if (panelToggle) {
      panelToggle.addEventListener('click', function () {
        var expanded = this.getAttribute('aria-expanded') === 'true';
        expanded ? closePanel() : openPanel();
      });
    }

    if (panelClose) panelClose.addEventListener('click', closePanel);
    if (panelOverlay) panelOverlay.addEventListener('click', closePanel);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel && panel.getAttribute('aria-hidden') === 'false') {
        closePanel();
      }
    });

    // ── Panel tabs ──
    var tabs = document.querySelectorAll('.library-panel__tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          t.setAttribute('aria-selected', 'false');
          var target = document.getElementById(t.dataset.target);
          if (target) target.setAttribute('aria-hidden', 'true');
        });
        this.setAttribute('aria-selected', 'true');
        var section = document.getElementById(this.dataset.target);
        if (section) section.setAttribute('aria-hidden', 'false');
      });
    });

    function refreshPanelContents() {
      var bmContainer  = document.getElementById('panel-bookmarks');
      var annContainer = document.getElementById('panel-annotations');
      if (bmContainer)  Bookmarks.render(bmContainer, function (bm) {
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) window.scrollTo(0, Math.round((bm.scrollPct / 100) * docHeight));
        closePanel();
      });
      if (annContainer) Annotations.render(annContainer);
    }

    // ── Bookmark button ──
    var bookmarkBtn = document.querySelector('.library-bookmark-btn');
    if (bookmarkBtn && isChapterPage) {
      bookmarkBtn.addEventListener('click', function () {
        var pct = ReadingPosition.getScrollPct();
        Bookmarks.add(chapterTitle || chapterSlug, pct);
        this.setAttribute('aria-pressed', 'true');
        setTimeout(function () {
          if (bookmarkBtn) bookmarkBtn.setAttribute('aria-pressed', 'false');
        }, 1500);
      });
    }

    // ── Annotation toolbar ──
    var toolbar     = document.getElementById('annotation-toolbar');
    var highlightBtn = document.getElementById('ann-highlight-btn');
    var annotateBtn  = document.getElementById('ann-annotate-btn');
    var dismissBtn   = document.getElementById('ann-dismiss-btn');
    var bodyEl       = document.querySelector('.library-body');
    var lastRange    = null;

    if (toolbar && bodyEl) {
      function evalSelection() {
        var sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) {
          toolbar.setAttribute('aria-hidden', 'true');
          lastRange = null;
          return;
        }
        var range = sel.getRangeAt(0);
        if (!bodyEl.contains(range.commonAncestorContainer)) {
          toolbar.setAttribute('aria-hidden', 'true');
          lastRange = null;
          return;
        }
        var text = sel.toString().trim();
        if (!text) {
          toolbar.setAttribute('aria-hidden', 'true');
          lastRange = null;
          return;
        }
        lastRange = { text: text };
        // Position toolbar near selection on mobile
        try {
          var rect = range.getBoundingClientRect();
          toolbar.style.top  = (rect.top  + window.scrollY - toolbar.offsetHeight - 8) + 'px';
          toolbar.style.left = Math.max(8, rect.left + (rect.width / 2) - (toolbar.offsetWidth / 2)) + 'px';
        } catch (e) {}
        toolbar.setAttribute('aria-hidden', 'false');
      }

      document.addEventListener('selectionchange', evalSelection);

      // touchend fires after finger lifts — re-evaluate so toolbar appears on mobile
      bodyEl.addEventListener('touchend', function () {
        setTimeout(evalSelection, 50);
      });

      if (highlightBtn) {
        highlightBtn.addEventListener('click', function () {
          if (!lastRange) return;
          Annotations.add(chapterSlug, lastRange.text, '');
          Annotations.restoreHighlights(bodyEl);
          toolbar.setAttribute('aria-hidden', 'true');
          window.getSelection().removeAllRanges();
          lastRange = null;
        });
      }

      if (annotateBtn) {
        annotateBtn.addEventListener('click', function () {
          if (!lastRange) return;
          var note = prompt('Add a note (optional):') || '';
          Annotations.add(chapterSlug, lastRange.text, note);
          Annotations.restoreHighlights(bodyEl);
          toolbar.setAttribute('aria-hidden', 'true');
          window.getSelection().removeAllRanges();
          lastRange = null;
        });
      }

      if (dismissBtn) {
        dismissBtn.addEventListener('click', function () {
          toolbar.setAttribute('aria-hidden', 'true');
          window.getSelection().removeAllRanges();
          lastRange = null;
        });
      }

      // Restore saved highlights on load
      Annotations.restoreHighlights(bodyEl);
    }

  }); // end DOMContentLoaded

  // ─── Expose for work landing page (continue reading) ──────
  window.LibraryChapterCompletion = ChapterCompletion;
  window.LibraryReadingPosition   = ReadingPosition;

}());
