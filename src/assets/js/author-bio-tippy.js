/**
 * Author bio tooltips — init Tippy on author byline links that carry
 * data-tippy-content (the short bio). Deferred; waits for tippy to be ready.
 */
(function () {
  'use strict';
  if (typeof tippy === 'undefined') return;
  var els = document.querySelectorAll('.article-header__author[data-tippy-content]');
  if (!els.length) return;
  tippy(els, {
    theme: 'author-bio',
    placement: 'top-start',
    arrow: true,
    delay: [150, 0],
    maxWidth: 300,
    interactive: false,
    appendTo: function () { return document.body; },
    zIndex: 9999,
    popperOptions: {
      strategy: 'fixed'
    }
  });
})();
