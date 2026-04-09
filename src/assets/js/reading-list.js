/**
 * Reading list — localStorage bookmark system.
 * Runs on both article pages (bookmark button) and /reading-list/ (renders saved list).
 */
(function () {
  'use strict';

  var KEY = (window.__PREFIX || 'tft') + '-reading-list';

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function isSaved(url) {
    return load().some(function (item) { return item.url === url; });
  }

  function addItem(item) {
    var list = load();
    if (!list.some(function (i) { return i.url === item.url; })) {
      list.unshift(item);
      save(list);
    }
  }

  function removeItem(url) {
    save(load().filter(function (i) { return i.url !== url; }));
  }

  /* ── Bookmark button (article pages) ─────────────────────── */
  var btn = document.getElementById('bookmark-btn');
  if (btn) {
    var url   = btn.getAttribute('data-url');
    var label = btn.querySelector('.btn-label');
    var icon  = btn.querySelector('.bookmark-icon');

    function syncBtn() {
      var saved = isSaved(url);
      btn.classList.toggle('is-saved', saved);
      btn.setAttribute('aria-label', saved ? 'Remove from reading list' : 'Save to reading list');
      if (label) label.textContent = saved ? 'Saved' : 'Save';
      if (icon)  icon.style.fill = saved ? 'currentColor' : 'none';
    }

    syncBtn();

    btn.addEventListener('click', function () {
      if (isSaved(url)) {
        removeItem(url);
      } else {
        addItem({
          url:     url,
          title:   btn.getAttribute('data-title'),
          section: btn.getAttribute('data-section'),
          date:    btn.getAttribute('data-date'),
          mins:    btn.getAttribute('data-mins')
        });
      }
      syncBtn();
    });
  }

  /* ── Reading list page ────────────────────────────────────── */
  var root = document.getElementById('reading-list-root');
  if (!root) return;

  function render() {
    var list = load();
    root.innerHTML = '';

    if (!list.length) {
      root.innerHTML =
        '<p style="color:var(--color-ink-faint);font-style:italic;padding:var(--space-8) 0;">'
        + 'No saved articles yet. On any article, click <strong>Save</strong> to add it here.'
        + '</p>';
      return;
    }

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;justify-content:flex-end;gap:var(--space-2);margin-bottom:var(--space-4);';

    var importBtn = document.createElement('button');
    importBtn.className = 'reading-list-clear';
    importBtn.type = 'button';
    importBtn.textContent = 'Import';
    importBtn.addEventListener('click', function () {
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
            if (Array.isArray(data)) {
              var existing = load();
              var urls = existing.map(function (i) { return i.url; });
              data.forEach(function (item) {
                if (item.url && item.title && urls.indexOf(item.url) === -1) {
                  existing.push(item);
                }
              });
              save(existing);
              alert('Imported ' + data.length + ' items.');
              render();
            }
          } catch (e) {
            alert('Could not read file. Make sure it is a valid JSON export.');
          }
        };
        reader.readAsText(file);
      });
      input.click();
    });
    actions.appendChild(importBtn);

    var exportBtn = document.createElement('button');
    exportBtn.className = 'reading-list-clear';
    exportBtn.type = 'button';
    exportBtn.textContent = 'Export';
    exportBtn.addEventListener('click', function () {
      var items = load();
      var blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'reading-list.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
    actions.appendChild(exportBtn);

    var clearAll = document.createElement('button');
    clearAll.className = 'reading-list-clear';
    clearAll.type = 'button';
    clearAll.textContent = 'Clear all';
    clearAll.addEventListener('click', function () {
      if (confirm('Remove all saved articles?')) { save([]); render(); }
    });
    actions.appendChild(clearAll);
    root.appendChild(actions);

    var ul = document.createElement('ul');
    ul.className = 'reading-list';
    ul.setAttribute('role', 'list');

    list.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'reading-list__item';

      var sectionHtml = item.section
        ? '<span class="reading-list__section">' + item.section + '</span>'
        : '';

      var minsHtml = item.mins
        ? '<span class="reading-list__mins">' + item.mins + ' min read</span>'
        : '';

      li.innerHTML =
        '<div class="reading-list__meta">' + sectionHtml + minsHtml + '</div>'
        + '<a class="reading-list__title" href="' + item.url + '">' + item.title + '</a>'
        + '<div class="reading-list__foot">'
        + '<time class="reading-list__date">' + (item.date || '') + '</time>'
        + '<button class="reading-list__remove" type="button" data-url="' + item.url + '" aria-label="Remove from reading list">Remove</button>'
        + '</div>';

      li.querySelector('.reading-list__remove').addEventListener('click', function () {
        removeItem(item.url);
        render();
      });

      ul.appendChild(li);
    });

    root.appendChild(ul);
  }

  render();
}());
