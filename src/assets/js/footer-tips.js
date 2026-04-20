/**
 * Footer tooltips — init Tippy.js on any link in the footer that carries
 * a data-tippy-content attribute. Gives richer hover explanations than
 * the native browser title tooltip, styled to match the site.
 */
(function () {
  'use strict';
  if (typeof tippy === 'undefined') return;
  var els = document.querySelectorAll('.site-footer a[data-tippy-content], .nav-drawer a[data-tippy-content]');
  if (!els.length) return;
  tippy(els, {
    theme: 'badge',
    arrow: true,
    delay: [250, 0],
    maxWidth: 320,
    placement: 'top',
    interactive: false,
    appendTo: function () { return document.body; },
    zIndex: 9999,
    popperOptions: { strategy: 'fixed' }
  });
})();
