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

  var pageUrl   = ctx.dataset.pageUrl || '';
  var pageTitle = ctx.dataset.pageTitle || '';

  // Save page metadata so the /notes/ page can link back
  try {
    localStorage.setItem(_p + '-art-meta-' + pageSlug, JSON.stringify({ url: pageUrl, title: pageTitle }));
  } catch (e) {}

  // ─── Storage helpers ──────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtDate(ts) {
    if (!ts) return '';
    try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch (e) { return ''; }
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

    function add(scrollPct, context, bodyOffset) {
      var list = load();
      var id = 'bm-' + Date.now();
      list.push({ id: id, scrollPct: scrollPct, bodyOffset: bodyOffset != null ? bodyOffset : -1, context: context || '', ts: Date.now() });
      save(list);
      return id;
    }

    function remove(id) {
      save(load().filter(function (b) { return b.id !== id; }));
    }

    function render(containerEl, onJump, onChange) {
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
          '<span style="font-size:var(--text-xs);color:var(--color-ink-faint);">' + fmtDate(bm.ts) + '</span>' +
          '<button class="library-bookmark-item__delete" data-bm-id="' + escHtml(bm.id) + '" aria-label="Delete bookmark">Remove</button>';
        item.addEventListener('click', function (e) {
          if (e.target.dataset.bmId) {
            remove(e.target.dataset.bmId);
            render(containerEl, onJump, onChange);
            if (onChange) onChange();
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

    function updateNote(id, note) {
      var list = load();
      var ann = list.find(function (a) { return a.id === id; });
      if (ann) { ann.note = note; ann.modified = Date.now(); save(list); }
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
        try { highlightTextInEl(bodyEl, ann.quote, ann.id, !!ann.note); }
        catch (e) {}
      });
    }

    function highlightTextInEl(el, text, annId, hasNote) {
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      var node;
      while ((node = walker.nextNode())) {
        var idx = node.nodeValue.indexOf(text);
        if (idx !== -1) {
          var before = document.createTextNode(node.nodeValue.slice(0, idx));
          var mark = document.createElement('mark');
          mark.className = 'library-highlight' + (hasNote ? ' library-highlight--note' : '');
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
        item.style.cursor = 'pointer';

        var dateStr = fmtDate(ann.ts);
        var modStr = ann.modified ? ' (edited ' + fmtDate(ann.modified) + ')' : '';

        item.innerHTML =
          '<p class="library-annotation-item__quote">&ldquo;' + escHtml(ann.quote) + '&rdquo;</p>' +
          (ann.note ? '<p class="library-annotation-item__note">' + escHtml(ann.note) + '</p>' : '') +
          '<p style="font-size:var(--text-xs);color:var(--color-ink-faint);margin:var(--space-1) 0 0;">' + dateStr + modStr + '</p>' +
          '<div class="library-annotation-item__actions">' +
            (ann.note ? '<button class="library-annotation-item__action" data-ann-edit="' + escHtml(ann.id) + '">Edit</button>' : '') +
            '<button class="library-annotation-item__action" data-ann-delete="' + escHtml(ann.id) + '">Delete</button>' +
          '</div>';

        // Click quote to scroll to highlight
        item.querySelector('.library-annotation-item__quote').addEventListener('click', function () {
          var mark = document.querySelector('.library-highlight[data-ann-id="' + ann.id + '"]');
          if (mark) {
            mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            mark.style.outline = '2px solid var(--color-link)';
            setTimeout(function () { mark.style.outline = ''; }, 2000);
          }
        });

        var editBtn = item.querySelector('[data-ann-edit]');
        if (editBtn) {
          editBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var newNote = prompt('Edit note:', ann.note || '');
            if (newNote !== null) {
              updateNote(ann.id, newNote);
              renderFiltered(containerEl, filterFn, emptyMsg);
            }
          });
        }

        item.querySelector('[data-ann-delete]').addEventListener('click', function (e) {
          e.stopPropagation();
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
        // Jump to bookmark position
        var bodyRect = bodyEl ? bodyEl.getBoundingClientRect() : null;
        var bodyAbsTop = bodyRect ? bodyRect.top + (window.scrollY || 0) : 0;
        var scrollTarget = (bm.bodyOffset != null && bm.bodyOffset >= 0 && bodyEl)
          ? bodyAbsTop + bm.bodyOffset
          : Math.round((bm.scrollPct / 100) * (document.documentElement.scrollHeight - window.innerHeight));
        window.scrollTo({ top: Math.max(0, scrollTarget - 60), behavior: 'smooth' });
        closePanel();
      }, renderBookmarkIndicators);
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

    // Wrap the saved selection range in a <mark> for immediate visual feedback
    function wrapSelectionInMark(annId, hasNote) {
      if (!lastRange) return;
      var cls = 'library-highlight' + (hasNote ? ' library-highlight--note' : '');
      var done = false;

      // Try using the saved range first
      if (lastRange.range) {
        try {
          var mark = document.createElement('mark');
          mark.className = cls;
          mark.dataset.annId = annId;
          lastRange.range.surroundContents(mark);
          done = true;
        } catch (e) {
          try {
            var fragment = lastRange.range.extractContents();
            var mark2 = document.createElement('mark');
            mark2.className = cls;
            mark2.dataset.annId = annId;
            mark2.appendChild(fragment);
            lastRange.range.insertNode(mark2);
            done = true;
          } catch (e2) {}
        }
      }

      // Fallback: search for the text in the body and wrap it
      if (!done && lastRange.text && bodyEl) {
        highlightTextInEl(bodyEl, lastRange.text, annId, hasNote);
      }
    }

    if (toolbar && bodyEl) {
      var selBtns = toolbar.querySelectorAll('.annotation-toolbar__btn--needs-selection');

      function updateSelectionState() {
        if (_actionInProgress) return;
        var sel = window.getSelection();
        var hasSelection = sel && !sel.isCollapsed && sel.rangeCount > 0;
        var inBody = false;

        if (hasSelection) {
          var range = sel.getRangeAt(0);
          inBody = bodyEl.contains(range.commonAncestorContainer);
          var text = sel.toString().trim();
          if (inBody && text) {
            lastRange = { text: text, range: range.cloneRange() };
          } else {
            hasSelection = false;
          }
        }

        if (!hasSelection || !inBody) {
          lastRange = null;
        }

        // Toggle active state on selection-dependent buttons
        selBtns.forEach(function (btn) {
          btn.classList.toggle('is-active', !!(hasSelection && inBody));
        });
      }

      var _actionInProgress = false;

      function afterAction() {
        lastRange = null;
        _actionInProgress = true;
        selBtns.forEach(function (btn) { btn.classList.remove('is-active'); });
        window.getSelection().removeAllRanges();
        setTimeout(function () { _actionInProgress = false; }, 400);
      }

      document.addEventListener('selectionchange', function () {
        clearTimeout(updateSelectionState._t);
        updateSelectionState._t = setTimeout(updateSelectionState, 200);
      });

      bodyEl.addEventListener('touchend', function () {
        setTimeout(updateSelectionState, 250);
      });

      if (highlightBtn) {
        highlightBtn.addEventListener('click', function () {
          if (!lastRange) return;
          var annId = Annotations.add(lastRange.text, '');
          wrapSelectionInMark(annId, false);
          afterAction();
        });
      }

      if (annotateBtn) {
        annotateBtn.addEventListener('click', function () {
          if (!lastRange) return;
          var note = prompt('Add a note (optional):') || '';
          var annId = Annotations.add(lastRange.text, note);
          wrapSelectionInMark(annId, !!note);
          afterAction();
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
          afterAction();
        });
      }

      if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', function () {
          var scrollTop = window.scrollY || document.documentElement.scrollTop;
          var docHeight = document.documentElement.scrollHeight - window.innerHeight;
          var pagePct = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;

          var bodyOffset = -1;
          if (lastRange && lastRange.range) {
            try {
              var selRect = lastRange.range.getBoundingClientRect();
              var bodyRect = bodyEl.getBoundingClientRect();
              bodyOffset = Math.round(selRect.top - bodyRect.top);
            } catch (e) {}
          }

          var context = lastRange ? lastRange.text.slice(0, 80) : '';
          Bookmarks.add(pagePct, context, bodyOffset);
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

    // Render bookmark indicators after layout is stable
    if (document.readyState === 'complete') {
      renderBookmarkIndicators();
    } else {
      window.addEventListener('load', renderBookmarkIndicators);
    }

    function renderBookmarkIndicators() {
      document.querySelectorAll('.bookmark-indicator').forEach(function (el) { el.remove(); });

      var list = Bookmarks.loadAll();
      if (!list.length || !bodyEl) return;

      list.forEach(function (bm) {
        var topPx;
        if (bm.bodyOffset != null && bm.bodyOffset >= 0) {
          topPx = bm.bodyOffset;
        } else {
          // Legacy fallback: approximate from page scroll %
          var bodyAbsTop = bodyEl.getBoundingClientRect().top + (window.scrollY || 0);
          var pageScrollHeight = document.documentElement.scrollHeight - window.innerHeight;
          var pageY = Math.round((bm.scrollPct / 100) * pageScrollHeight);
          topPx = Math.max(0, pageY - bodyAbsTop);
        }

        var indicator = document.createElement('div');
        indicator.className = 'bookmark-indicator';
        indicator.setAttribute('aria-hidden', 'true');
        indicator.title = bm.context ? '\u201c' + bm.context.slice(0, 40) + '\u2026\u201d' : bm.scrollPct + '% through';
        indicator.style.top = topPx + 'px';
        indicator.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
        // Compute scroll target at click time, offset for fixed header
        indicator.addEventListener('click', function () {
          var bodyAbsTop = bodyEl.getBoundingClientRect().top + (window.scrollY || 0);
          var headerOffset = 60; // approximate height of sticky reading header
          window.scrollTo({ top: Math.max(0, bodyAbsTop + topPx - headerOffset), behavior: 'smooth' });
        });
        bodyEl.appendChild(indicator);
      });
    }

  }); // end DOMContentLoaded
}());
