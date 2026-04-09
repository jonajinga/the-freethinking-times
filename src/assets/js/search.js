/**
 * The Freethinking Times — Search
 * Loads Pagefind on demand (after first keystroke) and displays
 * results in a keyboard-navigable modal overlay.
 */

(function () {
  'use strict';

  let pagefind = null;
  let searchLoaded = false;
  let currentQuery = '';
  let activeSection = '';

  const modal       = document.getElementById('search-modal');
  const overlay     = document.getElementById('search-overlay');
  const input       = document.getElementById('search-input');
  const results     = document.getElementById('search-results');
  const openBtn     = document.getElementById('search-open');
  const closeBtn    = document.getElementById('search-close');
  const filterBtns  = document.querySelectorAll('.search-filter-btn');

  if (!modal || !input) return;

  // ── Load Pagefind lazily ───────────────────────────────────────
  async function loadPagefind() {
    if (searchLoaded) return;
    try {
      // Pagefind generates its bundle into /pagefind/ after build
      pagefind = await import('/pagefind/pagefind.js');
      await pagefind.options({ excerptLength: 20 });
      searchLoaded = true;
    } catch (e) {
      results.innerHTML = `<p class="search-notice">
        Search is loading the index. If this persists, the search index may not have been generated during the last build.
      </p>`;
      // Retry once after a short delay (index may still be generating)
      setTimeout(async function () {
        if (searchLoaded) return;
        try {
          pagefind = await import('/pagefind/pagefind.js');
          await pagefind.options({ excerptLength: 20 });
          searchLoaded = true;
          results.innerHTML = '';
        } catch (e2) {
          results.innerHTML = `<p class="search-notice">
            Search index not available. Run <code>npm run build</code> to generate it.
          </p>`;
        }
      }, 2000);
    }
  }

  // ── Open / Close ───────────────────────────────────────────────
  function openSearch() {
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    input.focus();
    loadPagefind();
  }

  function closeSearch() {
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    input.value = '';
    results.innerHTML = '';
    currentQuery = '';
    openBtn && openBtn.focus();
  }

  // ── Section filter buttons ─────────────────────────────────────
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activeSection = btn.getAttribute('data-filter-section') || '';
      currentQuery = ''; // force re-search
      runSearch(input.value);
    });
  });

  // ── Search ─────────────────────────────────────────────────────
  async function runSearch(query) {
    if (!searchLoaded) await loadPagefind();
    if (!searchLoaded) return;
    currentQuery = query;

    if (!query.trim() && !activeSection) {
      results.innerHTML = '';
      return;
    }

    results.innerHTML = '<p class="search-notice">Searching…</p>';

    try {
      const opts = {};
      if (activeSection) opts.filters = { section: activeSection };
      const search = await pagefind.search(query.trim() || null, opts);
      const data   = await Promise.all(search.results.slice(0, 8).map(r => r.data()));

      if (data.length === 0) {
        results.innerHTML = `<p class="search-notice">No results for <strong>${escapeHtml(query)}</strong>.</p>`;
        return;
      }

      results.innerHTML = data.map(item => `
        <a class="search-result" href="${item.url}">
          <span class="search-result__meta">${item.meta?.section || ''}</span>
          <span class="search-result__title">${item.meta?.title || 'Untitled'}</span>
          <span class="search-result__excerpt">${item.excerpt}</span>
        </a>
      `).join('');
    } catch (e) {
      results.innerHTML = '<p class="search-notice">Search error. Please try again.</p>';
    }
  }

  // ── Event Listeners ────────────────────────────────────────────
  openBtn  && openBtn.addEventListener('click', openSearch);
  closeBtn && closeBtn.addEventListener('click', closeSearch);
  overlay  && overlay.addEventListener('click', closeSearch);

  input.addEventListener('input', debounce(e => {
    currentQuery = ''; // force re-search on any input change
    runSearch(e.target.value);
  }, 220));

  // Keyboard: / to open, Escape to close, arrow keys for results
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !isTypingInField()) {
      e.preventDefault();
      openSearch();
    }
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      closeSearch();
    }
    if (e.key === 'ArrowDown' && modal.classList.contains('is-open')) {
      e.preventDefault();
      focusResult(1);
    }
    if (e.key === 'ArrowUp' && modal.classList.contains('is-open')) {
      e.preventDefault();
      focusResult(-1);
    }
  });

  // ── Helpers ────────────────────────────────────────────────────
  function focusResult(dir) {
    const items = [...results.querySelectorAll('.search-result')];
    if (!items.length) return;
    const active = document.activeElement;
    const idx    = items.indexOf(active);
    const next   = idx + dir;
    if (next < 0) { input.focus(); return; }
    if (next < items.length) items[next].focus();
  }

  function isTypingInField() {
    const tag = document.activeElement.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement.isContentEditable;
  }

  function debounce(fn, delay) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

})();
