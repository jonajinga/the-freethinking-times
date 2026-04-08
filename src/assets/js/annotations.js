/**
 * Article Annotations — highlights, notes, and bookmarks for article pages.
 * Adapted from the library reader system.
 * Stores data in localStorage keyed by page URL slug.
 */
(function () {
  'use strict';

  var _p = window.__PREFIX || 'tft';

  // Only run on article pages (check for the context element)
  var ctx = document.getElementById('annotations-context');
  if (!ctx) return;

  var pageSlug = ctx.dataset.pageSlug || '';
  if (!pageSlug) return;

  // ─── Storage helpers ──────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Bookmarks ────────────────────────────────────────────
  var Bookmarks = (function () {
    var KEY = _p + '-art-bookmarks-' + pageSlug;

    function load() {
      try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
      catch (e) { return []; }
    }

    function save(list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    }

    function add(scrollPct, context, bodyPct) {
      var list = load();
      var id = 'bm-' + Date.now();
      list.push({ id: id, scrollPct: scrollPct, bodyPct: bodyPct != null ? bodyPct : scrollPct, context: context || '', ts: Date.now() });
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
        containerEl.innerHTML = '<p class="library-panel__empty">No bookmarks yet. Click "Bookmark" to save your position.</p>';
        return;
      }
      var ul = document.createElement('div');
      ul.className = 'library-bookmark-list';
      list.sort(function (a, b) { return b.ts - a.ts; }).forEach(function (bm) {
        var item = document.createElement('div');
        item.className = 'library-bookmark-item';
        var contextHtml = bm.context
          ? '<span class="library-bookmark-item__chapter">&ldquo;' + escHtml(bm.context) + '&rdquo;</span>'
          : '';
        item.innerHTML =
          contextHtml +
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

    return { add: add, remove: remove, render: render, loadAll: load };
  }());

  // ─── Annotations ──────────────────────────────────────────
  var Annotations = (function () {
    var KEY = _p + '-art-annotations-' + pageSlug;

    function load() {
      try { return JSON.parse(localStorage.getItem(KEY) || '[]'); }
      catch (e) { return []; }
    }

    function save(list) {
      try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    }

    function add(quote, note) {
      var list = load();
      var id = 'ann-' + Date.now();
      list.push({ id: id, quote: quote, note: note || '', ts: Date.now() });
      save(list);
      return id;
    }

    function remove(id) {
      save(load().filter(function (a) { return a.id !== id; }));
    }

    function render(containerEl) {
      var list = load();
      containerEl.innerHTML = '';
      if (!list.length) {
        containerEl.innerHTML = '<p class="library-panel__empty">No notes yet. Select text to highlight or annotate.</p>';
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
          restoreHighlights(document.querySelector('.article-body'));
        });
        wrapper.appendChild(item);
      });
      containerEl.appendChild(wrapper);
    }

    function restoreHighlights(bodyEl) {
      if (!bodyEl) return;
      // Remove existing highlights first
      bodyEl.querySelectorAll('.library-highlight').forEach(function (mark) {
        var parent = mark.parentNode;
        parent.replaceChild(document.createTextNode(mark.textContent), mark);
        parent.normalize();
      });
      // Re-apply all saved annotations
      var list = load();
      list.forEach(function (ann) {
        try { highlightTextInEl(bodyEl, ann.quote, ann.id); }
        catch (e) {}
      });
    }

    function highlightTextInEl(el, text, annId) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while ((node = walker.nextNode())) {
        var idx = node.nodeValue.indexOf(text);
        if (idx !== -1) {
          var before = document.createTextNode(node.nodeValue.slice(0, idx));
          var mark = document.createElement('mark');
          mark.className = 'library-highlight';
          mark.dataset.annId = annId;
          mark.textContent = text;
          var after = document.createTextNode(node.nodeValue.slice(idx + text.length));
          var parent = node.parentNode;
          parent.insertBefore(before, node);
          parent.insertBefore(mark, node);
          parent.insertBefore(after, node);
          parent.removeChild(node);
          break;
        }
      }
    }

    function renderFiltered(containerEl, filterFn, emptyMsg) {
      var list = load().filter(filterFn);
      containerEl.innerHTML = '';
      if (!list.length) {
        containerEl.innerHTML = '<p class="library-panel__empty">' + emptyMsg + '</p>';
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
          renderFiltered(containerEl, filterFn, emptyMsg);
          restoreHighlights(document.querySelector('.article-body'));
        });
        wrapper.appendChild(item);
      });
      containerEl.appendChild(wrapper);
    }

    function renderHighlights(containerEl) {
      renderFiltered(containerEl, function (a) { return !a.note; }, 'No highlights yet. Select text and click Highlight.');
    }

    function renderNotes(containerEl) {
      renderFiltered(containerEl, function (a) { return !!a.note; }, 'No notes yet. Select text and click Note to add one.');
    }

    return { add: add, remove: remove, render: render, renderHighlights: renderHighlights, renderNotes: renderNotes, restoreHighlights: restoreHighlights };
  }());

  // ─── Init ─────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {

    // ── Panel ──
    var panelToggles = document.querySelectorAll('.article-notes-toggle');
    var panel        = document.getElementById('article-notes-panel');
    var panelOverlay = document.querySelector('.article-notes-overlay');
    var panelClose   = panel ? panel.querySelector('.library-panel__close') : null;

    function openPanel() {
      if (!panel) return;
      panel.setAttribute('aria-hidden', 'false');
      if (panelOverlay) panelOverlay.setAttribute('aria-hidden', 'false');
      panelToggles.forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
      refreshPanelContents();
    }

    function closePanel() {
      if (!panel) return;
      panel.setAttribute('aria-hidden', 'true');
      if (panelOverlay) panelOverlay.setAttribute('aria-hidden', 'true');
      panelToggles.forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
    }

    panelToggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var expanded = this.getAttribute('aria-expanded') === 'true';
        expanded ? closePanel() : openPanel();
      });
    });
    if (panelClose) panelClose.addEventListener('click', closePanel);
    if (panelOverlay) panelOverlay.addEventListener('click', closePanel);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel && panel.getAttribute('aria-hidden') === 'false') {
        closePanel();
      }
    });

    // ── Panel tabs ──
    var tabs = panel ? panel.querySelectorAll('.library-panel__tab') : [];
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
      var hlContainer   = document.getElementById('article-panel-highlights');
      var noteContainer = document.getElementById('article-panel-notes');
      var bmContainer   = document.getElementById('article-panel-bookmarks');
      if (hlContainer)   Annotations.renderHighlights(hlContainer);
      if (noteContainer) Annotations.renderNotes(noteContainer);
      if (bmContainer) Bookmarks.render(bmContainer, function (bm) {
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        if (docHeight > 0) window.scrollTo(0, Math.round((bm.scrollPct / 100) * docHeight));
        closePanel();
      });
    }

    // ── Body element (used by toolbar + bookmark indicators) ──
    var bodyEl = document.querySelector('.article-body');

    // ── Annotation toolbar (text selection) ──
    var toolbar = document.getElementById('annotation-toolbar');
    var highlightBtn = document.getElementById('ann-highlight-btn');
    var annotateBtn = document.getElementById('ann-annotate-btn');
    var shareBtn = document.getElementById('ann-share-btn');
    var bookmarkBtn = document.getElementById('ann-bookmark-btn');
    var lastRange = null;

    // Wrap the live selection range in a <mark> for immediate visual feedback
    function wrapSelectionInMark(annId) {
      var sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      var range = sel.getRangeAt(0);
      try {
        var mark = document.createElement('mark');
        mark.className = 'library-highlight';
        mark.dataset.annId = annId;
        range.surroundContents(mark);
      } catch (e) {
        try {
          var fragment = range.extractContents();
          var mark2 = document.createElement('mark');
          mark2.className = 'library-highlight';
          mark2.dataset.annId = annId;
          mark2.appendChild(fragment);
          range.insertNode(mark2);
        } catch (e2) {}
      }
    }

    if (toolbar && bodyEl) {
      var isMobile = 'ontouchstart' in window;

      function showToolbar() {
        if (_actionInProgress) return;
        var sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) {
          hideToolbar();
          return;
        }
        var range = sel.getRangeAt(0);
        if (!bodyEl.contains(range.commonAncestorContainer)) {
          hideToolbar();
          return;
        }
        var text = sel.toString().trim();
        if (!text) {
          hideToolbar();
          return;
        }
        lastRange = { text: text };

        // Position: desktop near selection, mobile fixed at bottom (via CSS)
        if (!isMobile) {
          try {
            var rect = range.getBoundingClientRect();
            toolbar.style.top = (rect.top + window.scrollY - toolbar.offsetHeight - 8) + 'px';
            toolbar.style.left = Math.max(8, rect.left + (rect.width / 2) - (toolbar.offsetWidth / 2)) + 'px';
          } catch (e) {}
        } else {
          toolbar.style.top = '';
          toolbar.style.left = '';
        }
        toolbar.setAttribute('aria-hidden', 'false');
      }

      var _actionInProgress = false;

      function hideToolbar() {
        toolbar.setAttribute('aria-hidden', 'true');
        lastRange = null;
        // Prevent selectionchange from re-showing toolbar after an action
        _actionInProgress = true;
        setTimeout(function () { _actionInProgress = false; }, 400);
      }

      if (isMobile) {
        // Mobile: show toolbar after touch selection completes
        // Use a longer delay to let the browser finalize the selection
        document.addEventListener('selectionchange', function () {
          clearTimeout(showToolbar._t);
          showToolbar._t = setTimeout(function () {
            var sel = window.getSelection();
            if (sel && !sel.isCollapsed && sel.toString().trim()) {
              showToolbar();
            }
          }, 300);
        });

        // Also trigger on touchend inside the body
        bodyEl.addEventListener('touchend', function () {
          setTimeout(showToolbar, 300);
        });

        // Hide when tapping outside body and toolbar
        document.addEventListener('touchstart', function (e) {
          if (toolbar.getAttribute('aria-hidden') === 'false' &&
              !toolbar.contains(e.target) && !bodyEl.contains(e.target)) {
            hideToolbar();
          }
        }, { passive: true });
      } else {
        // Desktop: selectionchange with debounce
        document.addEventListener('selectionchange', function () {
          clearTimeout(showToolbar._t);
          showToolbar._t = setTimeout(showToolbar, 100);
        });

        // Hide when clicking outside body and toolbar
        document.addEventListener('mousedown', function (e) {
          if (!toolbar.contains(e.target) && !bodyEl.contains(e.target)) {
            hideToolbar();
          }
        });

        // Hide on scroll (desktop only — mobile selection shouldn't dismiss on scroll)
        window.addEventListener('scroll', function () {
          if (toolbar.getAttribute('aria-hidden') === 'false') {
            hideToolbar();
          }
        }, { passive: true });
      }

      if (highlightBtn) {
        highlightBtn.addEventListener('click', function () {
          if (!lastRange) return;
          var annId = Annotations.add(lastRange.text, '');
          wrapSelectionInMark(annId);
          toolbar.setAttribute('aria-hidden', 'true');
          window.getSelection().removeAllRanges();
          lastRange = null;
        });
      }

      if (annotateBtn) {
        annotateBtn.addEventListener('click', function () {
          if (!lastRange) return;
          var note = prompt('Add a note (optional):') || '';
          var annId = Annotations.add(lastRange.text, note);
          wrapSelectionInMark(annId);
          toolbar.setAttribute('aria-hidden', 'true');
          window.getSelection().removeAllRanges();
          lastRange = null;
        });
      }

      if (shareBtn) {
        shareBtn.addEventListener('click', function () {
          if (!lastRange) return;
          var shareText = '\u201c' + lastRange.text + '\u201d';
          var shareUrl = window.location.href;

          if (navigator.share) {
            navigator.share({ text: shareText, url: shareUrl }).catch(function () {});
          } else if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText + ' ' + shareUrl).then(function () {
              var orig = shareBtn.textContent;
              shareBtn.textContent = 'Copied!';
              setTimeout(function () { shareBtn.textContent = orig; }, 1200);
            });
          }
          toolbar.setAttribute('aria-hidden', 'true');
          window.getSelection().removeAllRanges();
          lastRange = null;
        });
      }

      if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', function () {
          // Store both page scroll % (for jumping back) and body-relative % (for indicator)
          var scrollTop = window.scrollY || document.documentElement.scrollTop;
          var docHeight = document.documentElement.scrollHeight - window.innerHeight;
          var pagePct = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

          var bodyRect = bodyEl.getBoundingClientRect();
          var bodyTop = bodyRect.top + scrollTop;
          var bodyPct = bodyEl.offsetHeight > 0
            ? Math.round(((scrollTop - bodyTop) / bodyEl.offsetHeight) * 100)
            : 0;
          bodyPct = Math.max(0, Math.min(100, bodyPct));

          var context = lastRange ? lastRange.text.slice(0, 80) : '';
          Bookmarks.add(pagePct, context, bodyPct);
          toolbar.setAttribute('aria-hidden', 'true');
          window.getSelection().removeAllRanges();
          lastRange = null;
          renderBookmarkIndicators();
          var orig = bookmarkBtn.textContent;
          bookmarkBtn.textContent = 'Saved!';
          setTimeout(function () { bookmarkBtn.textContent = orig; }, 1200);
        });
      }

    }

    // Restore saved highlights on load
    if (bodyEl) Annotations.restoreHighlights(bodyEl);

    // Render bookmark indicators in the margin
    renderBookmarkIndicators();

    function renderBookmarkIndicators() {
      document.querySelectorAll('.bookmark-indicator').forEach(function (el) { el.remove(); });

      var list = Bookmarks.loadAll();
      if (!list.length || !bodyEl) return;

      var bodyHeight = bodyEl.offsetHeight;

      list.forEach(function (bm) {
        // Use bodyPct if available (new bookmarks), fall back to scrollPct (legacy)
        var pct = bm.bodyPct != null ? bm.bodyPct : bm.scrollPct;
        var topPx = Math.round((pct / 100) * bodyHeight);

        // For clicking, use page scroll %
        var pageScrollHeight = document.documentElement.scrollHeight - window.innerHeight;
        var scrollTarget = Math.round((bm.scrollPct / 100) * pageScrollHeight);

        var indicator = document.createElement('div');
        indicator.className = 'bookmark-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.title = bm.context ? '\u201c' + bm.context.slice(0, 40) + '\u2026\u201d' : bm.scrollPct + '% through';
        indicator.style.top = topPx + 'px';
        indicator.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
        indicator.addEventListener('click', function () {
          window.scrollTo({ top: scrollTarget, behavior: 'smooth' });
        });
        bodyEl.appendChild(indicator);
      });
    }

  }); // end DOMContentLoaded
}());
