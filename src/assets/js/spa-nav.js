/**
 * SPA-style navigation — swaps <main> content without full page reload.
 * Keeps the music player, header, footer, and all global state alive.
 * Falls back to normal navigation for external links, downloads, etc.
 */
(function () {
  'use strict';

  // Only run if browser supports what we need
  if (!window.history || !window.fetch || !document.querySelector) return;

  var mainEl = document.getElementById('main-content');
  if (!mainEl) return;

  var cache = {};
  var transitioning = false;

  function shouldIntercept(link) {
    if (!link || !link.href) return false;
    // Same origin only
    if (link.origin !== location.origin) return false;
    // Skip anchors on same page
    if (link.pathname === location.pathname && link.hash) return false;
    // Skip downloads, mailto, tel
    if (link.hasAttribute('download')) return false;
    if (link.href.startsWith('mailto:') || link.href.startsWith('tel:')) return false;
    // Skip targets
    if (link.target && link.target !== '_self') return false;
    // Skip file extensions that aren't pages
    var ext = link.pathname.split('.').pop();
    if (['xml', 'json', 'pdf', 'txt', 'md', 'epub', 'zip', 'jpg', 'png', 'svg', 'css', 'js'].indexOf(ext) !== -1) return false;
    // Skip if marked
    if (link.dataset.noSpa) return false;
    // Skip if inside a form
    if (link.closest('form')) return false;
    // Skip article and library pages — they have complex page-specific JS
    // (progress.js, reading-settings.js, annotations.js) that needs full reload
    var path = link.pathname;
    if (path.match(/^\/(news|opinion|analysis|arts-culture|science-technology|history|letters|reviews)\/.+/)) return false;
    if (path.match(/^\/library\/.+\/.+/)) return false;
    if (path.match(/^\/glossary\/.+/) && path !== '/glossary/') return false;
    if (path.match(/^\/bookshelf\/.+/) && path !== '/bookshelf/') return false;
    if (path.match(/^\/trials\/.+/) && !path.match(/\/(timeline|showcase|submit)\//)) return false;
    if (path.match(/^\/thought-experiments\/.+/) && !path.match(/\/(showcase|submit)\//)) return false;
    // Pages with complex page-specific JS
    if (path === '/reader/' || path === '/search/' || path === '/notes/' || path === '/reading-list/' || path === '/dashboard/' || path === '/events/') return false;
    return true;
  }

  function extractMain(html) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    var newMain = doc.getElementById('main-content');
    var newTitle = doc.querySelector('title');
    var newMeta = doc.querySelector('meta[name="description"]');
    var newScripts = doc.querySelectorAll('main script, #main-content script');
    // Collect page-specific inline scripts. Start from the new page's
    // main content (most page scripts live there); also include inline
    // scripts outside main that aren't site-wide bootstraps.
    // Deduplicate at the end because a script inside main would
    // otherwise be picked up by both passes and run twice — this was
    // the cause of duplicated <select> options on the Archives page.
    var seen = Object.create(null);
    var scripts = [];
    function pushScript(s) {
      var code = s.textContent;
      if (seen[code]) return;
      seen[code] = true;
      scripts.push(code);
    }
    if (newMain) {
      newMain.querySelectorAll('script').forEach(pushScript);
    }
    doc.querySelectorAll('script:not([src])').forEach(function (s) {
      var code = s.textContent;
      // Skip the site-wide bootstrap scripts; they're already running.
      if (code.indexOf('__glossaryTerms') !== -1) return;
      if (code.indexOf('iframe_api') !== -1) return;
      if (code.indexOf('music-player') !== -1) return;
      if (code.indexOf('drawer') !== -1) return;
      if (code.indexOf('gtranslateSettings') !== -1) return;
      if (code.indexOf('__PREFIX') !== -1) return;
      pushScript(s);
    });
    return {
      main: newMain ? newMain.innerHTML : null,
      title: newTitle ? newTitle.textContent : document.title,
      description: newMeta ? newMeta.getAttribute('content') : '',
      scripts: scripts
    };
  }

  function navigate(url, pushState) {
    if (transitioning) return;
    transitioning = true;

    // Fade out
    mainEl.style.opacity = '0';
    mainEl.style.transition = 'opacity 0.15s ease';

    var doSwap = function (data) {
      if (!data.main) {
        // Fallback to full reload
        location.href = url;
        return;
      }

      // Swap content
      mainEl.innerHTML = data.main;
      document.title = data.title;

      // Update meta description
      var metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && data.description) metaDesc.setAttribute('content', data.description);

      // Update canonical
      var canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.setAttribute('href', url);

      // Push state
      if (pushState) {
        history.pushState({ url: url }, data.title, url);
      }

      // Close any open overlays/panels
      var drawer = document.getElementById('nav-drawer');
      var drawerOverlay = document.getElementById('nav-drawer-overlay');
      if (drawer) { drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true'); }
      if (drawerOverlay) drawerOverlay.classList.remove('is-open');
      var searchModal = document.getElementById('search-modal');
      var searchOverlay = document.getElementById('search-overlay');
      if (searchModal) { searchModal.classList.remove('is-open'); searchModal.setAttribute('aria-hidden', 'true'); }
      if (searchOverlay) searchOverlay.classList.remove('is-open');
      var gsPanel = document.getElementById('global-settings-panel');
      if (gsPanel) gsPanel.hidden = true;
      document.body.style.overflow = '';
      var toggleBtn = document.getElementById('nav-drawer-toggle');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');

      // Scroll to top (or to hash)
      var hash = url.split('#')[1];
      if (hash) {
        var target = document.getElementById(hash);
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo(0, 0);
      }

      // Execute page-specific scripts
      data.scripts.forEach(function (code) {
        try { new Function(code)(); } catch (e) { console.warn('SPA script error:', e); }
      });

      // Re-run glossary tooltips
      if (window.tippy && window.__glossaryTerms) {
        setTimeout(function () {
          // Re-init tippy for new content
          var body = document.querySelector('.article-body') || document.querySelector('.library-body');
          if (body && body.querySelectorAll('.glossary-tip').length === 0) {
            // Glossary tips script needs to re-run on new content
            // We'll dispatch a custom event
            document.dispatchEvent(new Event('spa:contentswap'));
          }
        }, 100);
      }

      // Fade in
      requestAnimationFrame(function () {
        mainEl.style.opacity = '1';
        setTimeout(function () {
          mainEl.style.transition = '';
          transitioning = false;
        }, 150);
      });

      // Update active nav links
      document.querySelectorAll('[aria-current="page"]').forEach(function (el) {
        el.removeAttribute('aria-current');
      });
      var path = new URL(url, location.origin).pathname;
      document.querySelectorAll('.site-nav__link, .nav-drawer__link').forEach(function (el) {
        if (el.getAttribute('href') === path) el.setAttribute('aria-current', 'page');
      });

      // Track page view in Umami
      if (window.umami) {
        try { umami.track(); } catch (e) {}
      }
    };

    // Check cache
    if (cache[url]) {
      doSwap(cache[url]);
      return;
    }

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (html) {
        var data = extractMain(html);
        cache[url] = data;
        doSwap(data);
      })
      .catch(function () {
        // Fallback to full navigation
        transitioning = false;
        location.href = url;
      });
  }

  // Intercept clicks
  document.addEventListener('click', function (e) {
    // Find closest anchor
    var link = e.target.closest('a');
    if (!link) return;
    if (!shouldIntercept(link)) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    e.preventDefault();
    if (link.href === location.href) return;
    navigate(link.href, true);
  });

  // Handle back/forward
  window.addEventListener('popstate', function (e) {
    if (e.state && e.state.url) {
      navigate(e.state.url, false);
    } else {
      navigate(location.href, false);
    }
  });

  // Set initial state
  history.replaceState({ url: location.href }, document.title, location.href);

  // Limit cache size
  setInterval(function () {
    var keys = Object.keys(cache);
    if (keys.length > 20) {
      delete cache[keys[0]];
    }
  }, 30000);

})();
