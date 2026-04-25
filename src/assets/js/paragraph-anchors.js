/**
 * Per-paragraph permalinks for articles and library entries.
 *
 * Walks every direct <p> child of .article-body or .library-body,
 * assigns a stable id (`p1`, `p2`, ...) based on document order, and
 * appends a hover-revealed pilcrow (¶) anchor that, when clicked,
 * copies the full canonical URL with #pN to the clipboard, updates
 * the address bar without a history entry, and briefly flashes a
 * "Copied" tooltip on the anchor.
 *
 * Skip rules:
 *  - Paragraphs inside <aside>, <figure>, <blockquote>, <details>,
 *    .pullquote, .callout, .republish, .funding (these are decoration
 *    or chrome, not the body of the piece).
 *  - Empty paragraphs and paragraphs containing only an <img> or <br>.
 *
 * Re-runnable on SPA-nav: bound via spa-nav.js re-inject list.
 */
(function () {
  'use strict';

  var isFirstRun = !window.__paraAnchorsBootstrapped;
  window.__paraAnchorsBootstrapped = true;

  var SKIP_PARENT_SELECTOR = 'aside, figure, blockquote, details, .pullquote, .callout, .republish, .funding, .wm, .article-footer, .responses-section, .backlinks-section, .article-comments';

  function isMeaningful(p) {
    if (!p) return false;
    if (p.closest(SKIP_PARENT_SELECTOR)) return false;
    var text = (p.textContent || '').trim();
    if (!text) return false;
    return true;
  }

  function annotate(root) {
    if (!root || root.dataset.paraAnchored === 'true') return;
    var paras = root.querySelectorAll(':scope > p');
    var n = 0;
    paras.forEach(function (p) {
      if (!isMeaningful(p)) return;
      n += 1;
      if (!p.id) p.id = 'p' + n;
      if (p.querySelector(':scope > .para-anchor')) return;
      var a = document.createElement('a');
      a.className = 'para-anchor';
      a.href = '#' + p.id;
      a.setAttribute('aria-label', 'Permalink to paragraph ' + n);
      a.title = 'Copy permalink to this paragraph';
      a.textContent = '¶';
      a.dataset.umamiEvent = 'para-permalink';
      p.appendChild(a);
    });
    root.dataset.paraAnchored = 'true';
  }

  function copyAndFlash(a) {
    var url = location.origin + location.pathname + a.getAttribute('href');
    var done = function () {
      a.classList.add('para-anchor--copied');
      setTimeout(function () { a.classList.remove('para-anchor--copied'); }, 1400);
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, fallback);
      } else { fallback(); }
    } catch (_) { fallback(); }
    function fallback() {
      // Older browsers / missing permission: select the URL and copy via execCommand
      var ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (_) { /* give up silently */ }
      document.body.removeChild(ta);
    }
  }

  // Annotate fresh content on initial run + every SPA swap (this script
  // is in the spa-nav re-inject list, so this whole IIFE re-runs).
  document.querySelectorAll('.article-body, .library-body').forEach(annotate);

  // Single document-level click handler bound on first run; survives
  // SPA navigations because document persists across content swaps.
  if (isFirstRun) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('.para-anchor');
      if (!a) return;
      e.preventDefault();
      copyAndFlash(a);
      // Update the address bar without leaving a history entry.
      try { history.replaceState(null, '', a.getAttribute('href')); } catch (_) {}
    });

    // Highlight a paragraph briefly when arriving via #pN — gives the
    // reader a visual cue that the URL pointed somewhere specific.
    var flashTarget = function () {
      var hash = location.hash || '';
      if (!/^#p\d+$/.test(hash)) return;
      var el = document.getElementById(hash.slice(1));
      if (!el) return;
      el.classList.add('para-anchor-target');
      setTimeout(function () { el.classList.remove('para-anchor-target'); }, 2000);
    };
    flashTarget();
    window.addEventListener('hashchange', flashTarget);
    document.addEventListener('spa:contentswap', flashTarget);
  }
})();
