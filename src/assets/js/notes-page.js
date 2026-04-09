/**
 * Notes & Highlights page — renders all annotations, highlights,
 * and bookmarks across the site from localStorage.
 */
(function () {
  'use strict';

  var root = document.getElementById('notes-page-root');
  if (!root) return;

  var _p = window.__PREFIX || 'tft';

  // ── Scan localStorage for all annotation/bookmark keys ────
  function scanStorage() {
    var pages = {};

    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key) continue;

      var artAnn = key.match(new RegExp('^' + _p + '-art-annotations-(.+)$'));
      var artBm  = key.match(new RegExp('^' + _p + '-art-bookmarks-(.+)$'));
      var libAnn = key.match(new RegExp('^' + _p + '-lib-annotations-(.+)$'));
      var libBm  = key.match(new RegExp('^' + _p + '-lib-bookmarks-(.+)$'));

      var slug, type, dataType;

      if (artAnn) { slug = artAnn[1]; type = 'article'; dataType = 'annotations'; }
      else if (artBm) { slug = artBm[1]; type = 'article'; dataType = 'bookmarks'; }
      else if (libAnn) { slug = libAnn[1]; type = 'library'; dataType = 'annotations'; }
      else if (libBm) { slug = libBm[1]; type = 'library'; dataType = 'bookmarks'; }
      else continue;

      var id = type + '-' + slug;
      if (!pages[id]) {
        pages[id] = { slug: slug, type: type, annotations: [], bookmarks: [] };
      }

      try {
        var data = JSON.parse(localStorage.getItem(key) || '[]');
        if (dataType === 'annotations') {
          pages[id].annotations = pages[id].annotations.concat(data);
        } else {
          pages[id].bookmarks = pages[id].bookmarks.concat(data);
        }
      } catch (e) {}
    }

    return pages;
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatDate(ts) {
    try {
      var d = new Date(ts);
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    } catch (e) { return ''; }
  }

  function getPageMeta(slug, type) {
    var metaKey = type === 'library' ? _p + '-lib-meta-' + slug : _p + '-art-meta-' + slug;
    try {
      var raw = localStorage.getItem(metaKey);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    // Fallback
    return {
      url: type === 'library' ? '/library/' + slug + '/' : '/',
      title: slug.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); })
    };
  }

  function deleteAnnotation(key, id) {
    try {
      var list = JSON.parse(localStorage.getItem(key) || '[]');
      list = list.filter(function (a) { return a.id !== id; });
      if (list.length) {
        localStorage.setItem(key, JSON.stringify(list));
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {}
    render();
  }

  function deleteBookmark(key, id) {
    try {
      var list = JSON.parse(localStorage.getItem(key) || '[]');
      list = list.filter(function (b) { return b.id !== id; });
      if (list.length) {
        localStorage.setItem(key, JSON.stringify(list));
      } else {
        localStorage.removeItem(key);
      }
    } catch (e) {}
    render();
  }

  function clearPage(slug, type) {
    var prefix = type === 'library' ? _p + '-lib-' : _p + '-art-';
    localStorage.removeItem(prefix + 'annotations-' + slug);
    localStorage.removeItem(prefix + 'bookmarks-' + slug);
    render();
  }

  function clearAll() {
    if (!confirm('Remove all notes, highlights, and bookmarks across the entire site?')) return;
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && (
        key.indexOf(_p + '-art-annotations-') === 0 ||
        key.indexOf(_p + '-art-bookmarks-') === 0 ||
        key.indexOf(_p + '-lib-annotations-') === 0 ||
        key.indexOf(_p + '-lib-bookmarks-') === 0
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(function (k) { localStorage.removeItem(k); });
    render();
  }

  // ── Render ─────────────────────────────────────────────────
  function render() {
    var pages = scanStorage();
    root.innerHTML = '';

    var keys = Object.keys(pages);
    if (!keys.length) {
      root.innerHTML =
        '<p style="color:var(--color-ink-faint);font-style:italic;padding:var(--space-8) 0;">'
        + 'No notes, highlights, or bookmarks yet. Select text on any article or library page to get started.'
        + '</p>';
      return;
    }

    // Sort by most recent activity
    keys.sort(function (a, b) {
      var aMax = getLatestTs(pages[a]);
      var bMax = getLatestTs(pages[b]);
      return bMax - aMax;
    });

    // Global actions
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-6);';

    var count = document.createElement('span');
    count.style.cssText = 'font-family:var(--font-ui);font-size:var(--text-sm);color:var(--color-ink-muted);';
    var totalAnn = 0, totalBm = 0;
    keys.forEach(function (k) {
      totalAnn += pages[k].annotations.length;
      totalBm += pages[k].bookmarks.length;
    });
    count.textContent = totalAnn + ' highlight' + (totalAnn !== 1 ? 's' : '') + ' & note' + (totalAnn !== 1 ? 's' : '') +
      ', ' + totalBm + ' bookmark' + (totalBm !== 1 ? 's' : '') +
      ' across ' + keys.length + ' page' + (keys.length !== 1 ? 's' : '');
    actions.appendChild(count);

    var btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:var(--space-2);align-items:center;';

    var importBtn = document.createElement('button');
    importBtn.className = 'reading-list-clear';
    importBtn.type = 'button';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', importNotes);
    btnWrap.appendChild(importBtn);

    var exportBtn = document.createElement('button');
    exportBtn.className = 'reading-list-clear';
    exportBtn.type = 'button';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', exportNotes);
    btnWrap.appendChild(exportBtn);

    var clearBtn = document.createElement('button');
    clearBtn.className = 'reading-list-clear';
    clearBtn.type = 'button';
    clearBtn.textContent = 'Clear all';
    clearBtn.addEventListener('click', clearAll);
    btnWrap.appendChild(clearBtn);

    actions.appendChild(btnWrap);
    root.appendChild(actions);

    // Render each page
    keys.forEach(function (id) {
      var page = pages[id];
      var section = document.createElement('div');
      section.style.cssText = 'margin-bottom:var(--space-10);padding-bottom:var(--space-8);border-bottom:1px solid var(--color-rule);';

      // Page header
      var header = document.createElement('div');
      header.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:var(--space-4);';

      var meta = getPageMeta(page.slug, page.type);
      var titleLink = document.createElement('a');
      titleLink.style.cssText = 'font-family:var(--font-headline);font-size:var(--text-lg);font-weight:700;color:var(--color-link);text-decoration:none;';
      titleLink.textContent = meta.title;
      titleLink.href = meta.url;

      var badge = document.createElement('span');
      badge.style.cssText = 'font-family:var(--font-ui);font-size:var(--text-xs);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--color-ink-faint);margin-left:var(--space-2);';
      badge.textContent = page.type === 'library' ? 'Library' : 'Article';

      var clearPageBtn = document.createElement('button');
      clearPageBtn.style.cssText = 'background:none;border:none;font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-ink-faint);cursor:pointer;text-decoration:underline;';
      clearPageBtn.textContent = 'Clear';
      clearPageBtn.addEventListener('click', (function (s, t) {
        return function () {
          if (confirm('Remove all notes and bookmarks for this page?')) clearPage(s, t);
        };
      })(page.slug, page.type));

      var titleWrap = document.createElement('div');
      titleWrap.appendChild(titleLink);
      titleWrap.appendChild(badge);
      header.appendChild(titleWrap);
      header.appendChild(clearPageBtn);
      section.appendChild(header);

      // Annotations / highlights
      if (page.annotations.length) {
        var annPrefix = page.type === 'library' ? _p + '-lib-annotations-' : _p + '-art-annotations-';
        var annKey = annPrefix + page.slug;

        page.annotations.sort(function (a, b) { return b.ts - a.ts; });
        page.annotations.forEach(function (ann) {
          var card = document.createElement('div');
          card.style.cssText = 'padding:var(--space-3) var(--space-4);margin-bottom:var(--space-3);border-left:3px solid rgba(250,204,21,0.6);background:var(--color-bg-alt);border-radius:0 var(--radius-sm) var(--radius-sm) 0;';

          var quote = document.createElement('p');
          quote.style.cssText = 'font-style:italic;color:var(--color-ink-muted);font-size:var(--text-sm);margin:0 0 var(--space-1);line-height:var(--leading-normal);';
          quote.textContent = '\u201c' + ann.quote + '\u201d';
          card.appendChild(quote);

          if (ann.note) {
            var note = document.createElement('p');
            note.style.cssText = 'font-size:var(--text-sm);color:var(--color-ink);margin:0 0 var(--space-1);line-height:var(--leading-normal);';
            note.textContent = ann.note;
            card.appendChild(note);
          }

          var meta = document.createElement('div');
          meta.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-2);';

          var date = document.createElement('span');
          date.style.cssText = 'font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-ink-faint);';
          date.textContent = formatDate(ann.ts);

          var del = document.createElement('button');
          del.style.cssText = 'background:none;border:none;font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-ink-faint);cursor:pointer;text-decoration:underline;';
          del.textContent = 'Remove';
          del.addEventListener('click', (function (k, i) {
            return function () { deleteAnnotation(k, i); };
          })(annKey, ann.id));

          meta.appendChild(date);
          meta.appendChild(del);
          card.appendChild(meta);
          section.appendChild(card);
        });
      }

      // Bookmarks
      if (page.bookmarks.length) {
        var bmPrefix = page.type === 'library' ? _p + '-lib-bookmarks-' : _p + '-art-bookmarks-';
        var bmKey = bmPrefix + page.slug;

        page.bookmarks.sort(function (a, b) { return b.ts - a.ts; });
        page.bookmarks.forEach(function (bm) {
          var card = document.createElement('div');
          card.style.cssText = 'padding:var(--space-3) var(--space-4);margin-bottom:var(--space-3);border-left:3px solid var(--color-ink-faint);background:var(--color-bg-alt);border-radius:0 var(--radius-sm) var(--radius-sm) 0;';

          var text = document.createElement('p');
          text.style.cssText = 'font-size:var(--text-sm);color:var(--color-ink-muted);margin:0 0 var(--space-1);line-height:var(--leading-normal);';
          if (bm.context) {
            text.textContent = '\u201c' + bm.context + '\u201d — ' + bm.scrollPct + '% through';
          } else if (bm.chapter) {
            text.textContent = bm.chapter + ' — ' + bm.scrollPct + '% through';
          } else {
            text.textContent = 'Bookmark at ' + bm.scrollPct + '%';
          }
          card.appendChild(text);

          var meta = document.createElement('div');
          meta.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-2);';

          var date = document.createElement('span');
          date.style.cssText = 'font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-ink-faint);';
          date.textContent = formatDate(bm.ts);

          var del = document.createElement('button');
          del.style.cssText = 'background:none;border:none;font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-ink-faint);cursor:pointer;text-decoration:underline;';
          del.textContent = 'Remove';
          del.addEventListener('click', (function (k, i) {
            return function () { deleteBookmark(k, i); };
          })(bmKey, bm.id));

          meta.appendChild(date);
          meta.appendChild(del);
          card.appendChild(meta);
          section.appendChild(card);
        });
      }

      root.appendChild(section);
    });
  }

  function getLatestTs(page) {
    var max = 0;
    page.annotations.forEach(function (a) { if (a.ts > max) max = a.ts; });
    page.bookmarks.forEach(function (b) { if (b.ts > max) max = b.ts; });
    return max;
  }

  // ── Export ──────────────────────────────────────────────────
  function exportNotes() {
    var dump = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && (
        key.indexOf(_p + '-art-') === 0 ||
        key.indexOf(_p + '-lib-') === 0
      )) {
        dump[key] = localStorage.getItem(key);
      }
    }
    downloadFile('notes-export.json', JSON.stringify(dump, null, 2), 'application/json');
  }

  // ── Import ─────────────────────────────────────────────────
  function importNotes() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(reader.result);
          var count = 0;
          Object.keys(data).forEach(function (key) {
            if (key.indexOf(_p + '-art-') === 0 || key.indexOf(_p + '-lib-') === 0) {
              localStorage.setItem(key, data[key]);
              count++;
            }
          });
          alert('Imported ' + count + ' items.');
          render();
        } catch (e) {
          alert('Could not read file. Make sure it is a valid JSON export.');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  function downloadFile(filename, content, type) {
    var blob = new Blob([content], { type: (type || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  render();
}());
