/**
 * Render citation formats inline inside the Reader panel's Cite tab.
 *
 * Reads #cite-data (rendered into article.njk by the article header) and
 * builds APA / MLA / Chicago entries with a copy button for each. Renders
 * into whichever Cite tab section is on the page:
 *   - #article-panel-cite-inline (article layout)
 *   - #panel-cite-inline         (library layouts)
 */
(function () {
  'use strict';

  var data = document.getElementById('cite-data');
  var slot = document.getElementById('article-panel-cite-inline')
          || document.getElementById('panel-cite-inline');
  if (!data || !slot) return;

  var info = {
    title:       data.dataset.title       || document.title,
    author:      data.dataset.author      || '',
    date:        data.dataset.date        || '',
    publication: data.dataset.publication || '',
    url:         data.dataset.url         || window.location.href
  };

  function parseName(full) {
    var parts = full.trim().split(/\s+/);
    var last = parts.pop() || '';
    return { first: parts.join(' '), last: last };
  }
  function fmtDate(iso, style) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var y = d.getUTCFullYear();
    var m = d.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
    var day = d.getUTCDate();
    if (style === 'apa')     return y + ', ' + m + ' ' + day;
    if (style === 'mla')     return day + ' ' + m + ' ' + y;
    if (style === 'chicago') return m + ' ' + day + ', ' + y;
    return String(y);
  }
  function build(format) {
    var n   = parseName(info.author);
    var url = info.url;
    var pub = info.publication;
    var t   = info.title;
    var hasAuthor = !!(n.last);
    if (format === 'apa') {
      var init = n.first ? n.first.split(/\s+/).map(function (w) { return w[0] + '.'; }).join(' ') : '';
      var auth = hasAuthor ? (n.last + (init ? ', ' + init : '') + ' ') : '';
      return auth + '(' + fmtDate(info.date, 'apa') + '). ' + t + '. ' + pub + '. ' + url;
    }
    if (format === 'mla') {
      var auth2 = hasAuthor ? (n.last + (n.first ? ', ' + n.first : '') + '. ') : '';
      return auth2 + '\u201c' + t + '.\u201d ' + pub + ', ' + fmtDate(info.date, 'mla') + ', ' + url + '.';
    }
    if (format === 'chicago') {
      var auth3 = hasAuthor ? (n.last + (n.first ? ', ' + n.first : '') + '. ') : '';
      return auth3 + '\u201c' + t + '.\u201d ' + pub + ', ' + fmtDate(info.date, 'chicago') + '. ' + url + '.';
    }
    return '';
  }

  function copy(text, btn) {
    var orig = btn.textContent;
    function done() {
      btn.textContent = 'Copied';
      setTimeout(function () { btn.textContent = orig; }, 1500);
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(done);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  function render() {
    if (slot.dataset.rendered === 'true') return;
    slot.dataset.rendered = 'true';
    slot.innerHTML = '';
    [['APA 7th', 'apa'], ['MLA 9th', 'mla'], ['Chicago 17th', 'chicago']].forEach(function (pair) {
      var wrap = document.createElement('div');
      wrap.className = 'cite-inline__entry';
      var label = document.createElement('p');
      label.className = 'cite-inline__label';
      label.textContent = pair[0];
      var text = document.createElement('p');
      text.className = 'cite-inline__text';
      text.textContent = build(pair[1]);
      var btn = document.createElement('button');
      btn.className = 'cite-inline__copy';
      btn.type = 'button';
      btn.textContent = 'Copy';
      btn.addEventListener('click', function () { copy(text.textContent, btn); });
      wrap.appendChild(label);
      wrap.appendChild(text);
      wrap.appendChild(btn);
      slot.appendChild(wrap);
    });
  }

  // Render on first activation rather than on load so we don't waste
  // work if the user never opens the Cite tab.
  var tab = document.querySelector('[data-target="' + slot.id + '"]');
  if (tab) tab.addEventListener('click', render);

  // Also render if the tab is the active one on page load (unlikely but safe).
  if (slot.getAttribute('aria-hidden') === 'false') render();
})();
