/**
 * The Freethinking Times — Smart Header
 * Shrinks the masthead to a compact state once the user scrolls down
 * past the initial decorative padding. Uses requestAnimationFrame
 * to batch DOM writes and passive listener to avoid blocking scroll.
 *
 * Hysteresis (prevents stutter):
 *   - Goes compact only after scrolling DOWN ≥10 px from the local trough,
 *     while the page is already past COMPACT_AT.
 *   - Restores only after scrolling UP ≥30 px from the local peak.
 */

(function () {
  'use strict';

  const masthead = document.querySelector('.masthead');
  if (!masthead) return;

  const articleHeader = document.querySelector('.article-reading-header') || document.querySelector('.library-reading-header');

  const COMPACT_AT     = 90;  // px — position threshold
  const DOWN_THRESHOLD = 10;  // px of downward travel required to compact
  const UP_THRESHOLD   = 30;  // px of upward travel required to restore

  let ticking   = false;
  let isCompact = false;
  let peakY     = window.scrollY;   // highest y reached while compact
  let troughY   = window.scrollY;   // lowest y reached while full

  function setCompact(compact) {
    isCompact = compact;
    masthead.classList.toggle('is-compact', compact);
    if (articleHeader) {
      masthead.classList.toggle('is-replaced', compact);
      articleHeader.classList.toggle('is-visible', compact);
    }
  }

  function update() {
    const y = window.scrollY;

    if (!isCompact) {
      // Track local trough so we measure genuine downward movement
      if (y < troughY) troughY = y;
      if (y > COMPACT_AT && (y - troughY) >= DOWN_THRESHOLD) {
        peakY = y;
        setCompact(true);
      }
    } else {
      // Track local peak so we measure genuine upward movement
      if (y > peakY) peakY = y;
      if ((peakY - y) >= UP_THRESHOLD) {
        troughY = y;
        setCompact(false);
      }
    }

    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (ticking) return;
    requestAnimationFrame(update);
    ticking = true;
  }, { passive: true });

  // Run once on load in case the page is pre-scrolled (back/forward nav)
  if (window.scrollY > COMPACT_AT) {
    peakY = window.scrollY;
    setCompact(true);
  } else {
    troughY = window.scrollY;
  }

})();
