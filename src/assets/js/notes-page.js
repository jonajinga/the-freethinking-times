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

  function editAnnotation(key, id) {
    try {
      var list = JSON.parse(localStorage.getItem(key) || '[]');
      var ann = list.find(function (a) { return a.id === id; });
      if (!ann) return;
      var newNote = prompt('Edit note:', ann.note || '');
      if (newNote === null) return;
      ann.note = newNote;
      ann.modified = Date.now();
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {}
    render();
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

    // Import button always visible
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

    var btnWrap = document.createElement('div');
    btnWrap.style.cssText = 'display:flex;gap:var(--space-2);align-items:center;';

    function iconBtn(label, svg, handler) {
      var b = document.createElement('button');
      b.className = 'article-action-btn';
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.title = label;
      b.innerHTML = svg;
      b.addEventListener('click', handler);
      return b;
    }

    var SVG = {
      share: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
      print: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
      download: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
      upload: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
      trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
    };

    btnWrap.appendChild(iconBtn('Import', SVG.upload, importNotes));

    if (keys.length) {
      actions.appendChild(count);
      btnWrap.appendChild(iconBtn('Share', SVG.share, shareNotes));
      btnWrap.appendChild(iconBtn('Print', SVG.print, printNotes));
      btnWrap.appendChild(iconBtn('Export Markdown', SVG.download, exportMarkdown));
      btnWrap.appendChild(iconBtn('Export JSON', SVG.download, exportJSON));
      btnWrap.appendChild(iconBtn('Clear all', SVG.trash, clearAll));
    }
    actions.appendChild(btnWrap);
    root.appendChild(actions);

    if (!keys.length) {
      var empty = document.createElement('p');
      empty.style.cssText = 'color:var(--color-ink-faint);font-style:italic;padding:var(--space-8) 0;';
      empty.textContent = 'No notes, highlights, or bookmarks yet. Select text on any article or library page to get started.';
      root.appendChild(empty);
      return;
    }

    // Sort by most recent activity
    keys.sort(function (a, b) {
      return getLatestTs(pages[b]) - getLatestTs(pages[a]);
    });

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

      var pageBtns = document.createElement('div');
      pageBtns.style.cssText = 'display:flex;gap:var(--space-1);align-items:center;';

      // Per-page share
      pageBtns.appendChild(iconBtn('Share', SVG.share, (function (p) {
        return function () {
          var m = getPageMeta(p.slug, p.type);
          var text = m.title + '\n\n';
          p.annotations.forEach(function (a) {
            text += '"' + a.quote.slice(0, 80) + '..."';
            if (a.note) text += ' — ' + a.note;
            text += '\n';
          });
          if (navigator.share) navigator.share({ title: m.title, text: text }).catch(function () {});
          else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { alert('Copied.'); });
        };
      })(page)));

      // Per-page export markdown
      pageBtns.appendChild(iconBtn('Export', SVG.download, (function (p) {
        return function () {
          var m = getPageMeta(p.slug, p.type);
          var lines = ['# ' + m.title, 'URL: ' + window.location.origin + m.url, ''];
          p.annotations.forEach(function (a) {
            lines.push('> ' + a.quote);
            if (a.note) { lines.push(''); lines.push('**Note:** ' + a.note); }
            lines.push('*' + formatDate(a.ts) + '*');
            lines.push('');
          });
          if (p.bookmarks.length) {
            lines.push('## Bookmarks');
            p.bookmarks.forEach(function (b) {
              lines.push('- ' + (b.context || b.scrollPct + '%') + ' (' + formatDate(b.ts) + ')');
            });
          }
          downloadFile(p.slug + '-notes.md', lines.join('\n'), 'text/markdown');
        };
      })(page)));

      // Per-page clear
      pageBtns.appendChild(iconBtn('Clear', SVG.trash, (function (s, t) {
        return function () {
          if (confirm('Remove all notes and bookmarks for this page?')) clearPage(s, t);
        };
      })(page.slug, page.type)));

      var titleWrap = document.createElement('div');
      titleWrap.appendChild(titleLink);
      titleWrap.appendChild(badge);
      header.appendChild(titleWrap);
      header.appendChild(pageBtns);
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

          var dateStr = formatDate(ann.ts);
          if (ann.modified) dateStr += ' (edited ' + formatDate(ann.modified) + ')';
          var date = document.createElement('span');
          date.style.cssText = 'font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-ink-faint);';
          date.textContent = dateStr;

          var btnWrap = document.createElement('div');
          btnWrap.style.cssText = 'display:flex;gap:var(--space-2);';

          var edit = document.createElement('button');
          edit.style.cssText = 'background:none;border:none;font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-ink-faint);cursor:pointer;text-decoration:underline;';
          edit.textContent = 'Edit';
          edit.addEventListener('click', (function (k, i) {
            return function () { editAnnotation(k, i); };
          })(annKey, ann.id));

          var del = document.createElement('button');
          del.style.cssText = 'background:none;border:none;font-family:var(--font-ui);font-size:var(--text-xs);color:var(--color-ink-faint);cursor:pointer;text-decoration:underline;';
          del.textContent = 'Remove';
          del.addEventListener('click', (function (k, i) {
            return function () { deleteAnnotation(k, i); };
          })(annKey, ann.id));

          btnWrap.appendChild(edit);
          btnWrap.appendChild(del);
          meta.appendChild(date);
          meta.appendChild(btnWrap);
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

  // ── Export (JSON — for import/backup) ───────────────────────
  function exportJSON() {
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

  // ── Export (Markdown — readable) ───────────────────────────
  function exportMarkdown() {
    var pages = scanStorage();
    var keys = Object.keys(pages);
    var lines = ['# Notes & Highlights', '', '*Exported from ' + document.title + '*', '', '---', ''];

    keys.forEach(function (id) {
      var page = pages[id];
      var meta = getPageMeta(page.slug, page.type);
      lines.push('## ' + meta.title);
      lines.push('URL: ' + window.location.origin + meta.url);
      lines.push('');

      if (page.annotations.length) {
        page.annotations.sort(function (a, b) { return b.ts - a.ts; });
        page.annotations.forEach(function (ann) {
          lines.push('> ' + ann.quote);
          if (ann.note) { lines.push(''); lines.push('**Note:** ' + ann.note); }
          lines.push('');
          var dateStr = formatDate(ann.ts);
          if (ann.modified) dateStr += ' (edited ' + formatDate(ann.modified) + ')';
          lines.push('*' + dateStr + '*');
          lines.push('');
        });
      }

      if (page.bookmarks.length) {
        lines.push('### Bookmarks');
        page.bookmarks.sort(function (a, b) { return b.ts - a.ts; });
        page.bookmarks.forEach(function (bm) {
          var text = bm.context ? '"' + bm.context + '"' : bm.scrollPct + '% through';
          lines.push('- ' + text + ' (' + formatDate(bm.ts) + ')');
        });
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    });
    downloadFile('notes-export.md', lines.join('\n'), 'text/markdown');
  }

  // ── Print ──────────────────────────────────────────────────
  function printNotes() {
    window.print();
  }

  // ── Share ──────────────────────────────────────────────────
  function shareNotes() {
    var pages = scanStorage();
    var keys = Object.keys(pages);
    var text = 'My Notes & Highlights\n\n';
    keys.forEach(function (id) {
      var page = pages[id];
      var meta = getPageMeta(page.slug, page.type);
      text += meta.title + '\n';
      page.annotations.forEach(function (ann) {
        text += '  "' + ann.quote.slice(0, 60) + '..."';
        if (ann.note) text += ' — ' + ann.note;
        text += '\n';
      });
      text += '\n';
    });

    if (navigator.share) {
      navigator.share({ title: 'My Notes & Highlights', text: text, url: window.location.href }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { alert('Copied to clipboard.'); });
    }
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
