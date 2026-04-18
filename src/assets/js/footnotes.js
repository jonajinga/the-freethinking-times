/**
 * Collect article footnotes into the Reader panel's Footnotes tab so
 * readers can scan them without scrolling to the bottom of the article.
 *
 * Looks for either the markdown-it-footnote output (`.footnotes ol > li`)
 * or any element matching `[id^="fn"]` that has a back-reference.
 * Renders into:
 *   - #article-panel-footnotes (article layout)
 *   - #panel-footnotes         (library layouts)
 */
(function () {
  'use strict';

  var slot = document.getElementById('article-panel-footnotes')
          || document.getElementById('panel-footnotes');
  if (!slot) return;

  function collect() {
    var items = [];

    // markdown-it-footnote shape: <section class="footnotes"><ol><li id="fn1">…</li>…
    var fnList = document.querySelector('.footnotes ol, section.footnotes ol');
    if (fnList) {
      fnList.querySelectorAll(':scope > li').forEach(function (li, i) {
        var id = li.id || ('fn' + (i + 1));
        // Strip the "back" arrow link if present
        var clone = li.cloneNode(true);
        clone.querySelectorAll('.footnote-backref, a.footnote-backref').forEach(function (a) { a.remove(); });
        items.push({ id: id, num: i + 1, html: clone.innerHTML.trim() });
      });
    } else {
      // Fallback: any element with an id like "fn1", "fn2"
      document.querySelectorAll('[id^="fn"]').forEach(function (el, i) {
        if (!/^fn\d+$/.test(el.id)) return;
        var n = parseInt(el.id.slice(2), 10);
        var clone = el.cloneNode(true);
        clone.querySelectorAll('.footnote-backref, a.footnote-backref').forEach(function (a) { a.remove(); });
        items.push({ id: el.id, num: isNaN(n) ? (i + 1) : n, html: clone.innerHTML.trim() });
      });
    }

    return items;
  }

  function render() {
    if (slot.dataset.rendered === 'true') return;
    var items = collect();
    if (!items.length) {
      slot.innerHTML = '<p class="library-panel__empty">No footnotes in this piece.</p>';
      slot.dataset.rendered = 'true';
      return;
    }
    var html = '<ol class="footnotes-panel__list">';
    items.forEach(function (it) {
      html += '<li class="footnotes-panel__item">' +
        '<a class="footnotes-panel__num" href="#' + it.id + '">[' + it.num + ']</a>' +
        '<div class="footnotes-panel__text">' + it.html + '</div>' +
        '</li>';
    });
    html += '</ol>';
    slot.innerHTML = html;
    slot.dataset.rendered = 'true';

    // Smooth-scroll to the footnote target without leaving the panel open.
    slot.querySelectorAll('.footnotes-panel__num').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = this.getAttribute('href').slice(1);
        var target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('footnote-flash');
        setTimeout(function () { target.classList.remove('footnote-flash'); }, 1400);
      });
    });
  }

  // Render lazily on first activation, mirroring the Cite/History pattern.
  var tab = document.querySelector('[data-target="' + slot.id + '"]');
  if (tab) tab.addEventListener('click', render);
  if (slot.getAttribute('aria-hidden') === 'false') render();
})();
