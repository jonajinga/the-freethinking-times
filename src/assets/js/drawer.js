/**
 * The Freethinking Times — Nav Drawer
 * Slide-out navigation drawer, always available.
 */

(function () {
  'use strict';

  const toggle  = document.getElementById('nav-drawer-toggle');
  const drawer  = document.getElementById('nav-drawer');
  const overlay = document.getElementById('nav-drawer-overlay');
  const closeBtn = document.getElementById('nav-drawer-close');

  if (!toggle || !drawer) return;

  function openDrawer() {
    drawer.classList.add('is-open');
    overlay.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeDrawer() {
    drawer.classList.remove('is-open');
    overlay.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    toggle.focus();
  }

  toggle.addEventListener('click', openDrawer);
  closeBtn.addEventListener('click', closeDrawer);
  overlay.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      closeDrawer();
    }
  });

})();

/* ── Nav dropdowns — all items ───────────────────────────────── */
(function () {
  'use strict';

  var nav = document.querySelector('.site-nav');
  if (!nav) return;

  var keys = ['news', 'opinion', 'analysis', 'arts-culture', 'science-tech', 'history', 'letters', 'library', 'projects', 'games'];

  function positionDropdown(trigger, dropdown) {
    var navRect     = nav.getBoundingClientRect();
    var triggerRect = trigger.getBoundingClientRect();
    var dropW       = dropdown.offsetWidth;
    var centre      = triggerRect.left + triggerRect.width / 2 - navRect.left;
    var left        = Math.round(centre - dropW / 2);
    left = Math.max(0, Math.min(left, navRect.width - dropW));
    dropdown.style.left  = left + 'px';
    dropdown.style.right = 'auto';
  }

  var pairs = keys.map(function (key) {
    var trigger  = document.getElementById('nav-' + key);
    var dropdown = document.getElementById('dropdown-' + key);
    return (trigger && dropdown) ? { trigger: trigger, dropdown: dropdown } : null;
  }).filter(Boolean);

  pairs.forEach(function (p) {
    positionDropdown(p.trigger, p.dropdown);

    p.trigger.addEventListener('focus', function () {
      p.trigger.setAttribute('aria-expanded', 'true');
    });
    p.trigger.addEventListener('blur', function () {
      setTimeout(function () {
        if (!p.dropdown.contains(document.activeElement)) {
          p.trigger.setAttribute('aria-expanded', 'false');
        }
      }, 100);
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    pairs.forEach(function (p) {
      if (p.trigger === document.activeElement || p.dropdown.contains(document.activeElement)) {
        p.trigger.focus();
        p.trigger.setAttribute('aria-expanded', 'false');
      }
    });
  });

  window.addEventListener('resize', function () {
    pairs.forEach(function (p) { positionDropdown(p.trigger, p.dropdown); });
  }, { passive: true });

}());
