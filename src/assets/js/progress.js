/**
 * Article utilities: reading progress bar, progress %, back to top,
 * copy link, print, table of contents, pullquote share, focus mode.
 */
(function () {
  'use strict';

  var _p = window.__PREFIX || 'tft';

  /* ── Reading progress bar + % text + back-to-top ─────────── */
  var bar    = document.querySelector('.reading-progress');
  var floats = document.getElementById('reading-floats');
  var pctEl  = document.getElementById('reading-pct');
  var bttBtn = document.getElementById('back-to-top');

  // Floats visibility (back-to-top + %) — active on any page that has #reading-floats
  if (floats) {
    var floatTarget = document.querySelector('.article-body');
    function updateFloats() {
      var scrollTop = window.scrollY;
      floats.classList.toggle('is-visible', scrollTop > 400);
      if (pctEl && floatTarget) {
        var dist = floatTarget.getBoundingClientRect().bottom + scrollTop - window.innerHeight;
        var pct = dist > 0 ? Math.min((scrollTop / dist) * 100, 100) : 0;
        pctEl.textContent = Math.round(pct) + '% through';
      }
    }
    window.addEventListener('scroll', updateFloats, { passive: true });
    updateFloats();
  }

  // Progress bar width + % text — article pages only
  if (bar) {
    var progressTarget = document.querySelector('.article-body');
    function updateProgress() {
      var scrollTop = window.scrollY;
      var scrollDistance;
      if (progressTarget) {
        // Stop at end of article body, not end of footer
        scrollDistance = progressTarget.getBoundingClientRect().bottom + scrollTop - window.innerHeight;
      } else {
        scrollDistance = document.documentElement.scrollHeight - window.innerHeight;
      }
      var pct = scrollDistance > 0 ? Math.min((scrollTop / scrollDistance) * 100, 100) : 0;

      bar.style.width = pct + '%';
      if (pctEl) pctEl.textContent = Math.round(pct) + '% through';
    }
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  if (bttBtn) {
    bttBtn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ── Share panel ──────────────────────────────────────────── */
  var shareBtn   = document.getElementById('share-btn');
  var sharePanel = document.getElementById('share-panel');

  if (shareBtn && sharePanel) {
    var shareTitle = shareBtn.dataset.title || document.title;
    var shareUrl   = shareBtn.dataset.url   || window.location.href;
    var encUrl     = encodeURIComponent(shareUrl);
    var encTitle   = encodeURIComponent(shareTitle);

    // Wire social links
    var tw = document.getElementById('share-twitter');
    var fb = document.getElementById('share-facebook');
    var li = document.getElementById('share-linkedin');
    var rd = document.getElementById('share-reddit');
    var bsky = document.getElementById('share-bluesky');
    var masto = document.getElementById('share-mastodon');
    var em = document.getElementById('share-email');
    if (tw)   tw.href   = 'https://twitter.com/intent/tweet?url=' + encUrl + '&text=' + encTitle;
    if (fb)   fb.href   = 'https://www.facebook.com/sharer/sharer.php?u=' + encUrl;
    if (li)   li.href   = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encUrl;
    if (rd)   rd.href   = 'https://www.reddit.com/submit?url=' + encUrl + '&title=' + encTitle;
    if (bsky) bsky.href = 'https://bsky.app/intent/compose?text=' + encodeURIComponent(shareTitle + '\n\n' + shareUrl);
    if (masto) masto.href = 'https://mastodon.social/share?text=' + encodeURIComponent(shareTitle + '\n\n' + shareUrl);
    if (em)   em.href   = 'mailto:?subject=' + encTitle + '&body=' + encUrl;

    // Skip toggle/auto-close when panel has been relocated out of the
    // original header rail (into the Reader panel, or into the share
    // popover above the annotation toolbar). Those containers own the
    // visibility of the share-panel; this script only needs to keep
    // share-panel's social links populated.
    function isShareInReaderPanel() {
      if (!sharePanel.closest) return false;
      return !!(sharePanel.closest('.library-panel') || sharePanel.closest('#ann-share-popover'));
    }

    function openSharePanel() {
      if (isShareInReaderPanel()) return;
      sharePanel.hidden = false;
      shareBtn.setAttribute('aria-expanded', 'true');
    }
    function closeSharePanel() {
      if (isShareInReaderPanel()) return;
      sharePanel.hidden = true;
      shareBtn.setAttribute('aria-expanded', 'false');
    }

    shareBtn.addEventListener('click', function(e) {
      if (isShareInReaderPanel()) return;
      e.stopPropagation();
      if (!sharePanel.hidden) { closeSharePanel(); } else { openSharePanel(); }
    });

    document.addEventListener('click', function(e) {
      if (isShareInReaderPanel()) return;
      if (!sharePanel.hidden && !sharePanel.contains(e.target)) closeSharePanel();
    });
    document.addEventListener('keydown', function(e) {
      if (isShareInReaderPanel()) return;
      if (e.key === 'Escape' && !sharePanel.hidden) { closeSharePanel(); shareBtn.focus(); }
    });

    // Copy link inside panel
    var shareCopy = document.getElementById('share-copy');
    if (shareCopy) {
      shareCopy.addEventListener('click', function() {
        var orig = shareCopy.textContent.trim();
        function onCopied() {
          shareCopy.textContent = 'Copied!';
          setTimeout(function() { shareCopy.textContent = orig; }, 2000);
        }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(shareUrl).then(onCopied);
        } else {
          var ta = document.createElement('textarea');
          ta.value = shareUrl;
          ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); onCopied(); } catch(e) {}
          document.body.removeChild(ta);
        }
      });
    }
  }

  /* ── Print ────────────────────────────────────────────────── */
  var printBtn = document.getElementById('print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', function () { window.print(); });
  }

  /* ── Text-to-speech ───────────────────────────────────────── */
  var ttsBtn      = document.getElementById('tts-btn');
  var ttsControls = document.getElementById('tts-controls');
  var ttsPauseBtn = document.getElementById('tts-pause-btn');
  var ttsStopBtn  = document.getElementById('tts-stop-btn');
  var voiceSelect = document.getElementById('tts-voice-select');
  var speedBtns   = document.querySelectorAll('.tts-speed-btn');

  if (ttsBtn) {
    if (!('speechSynthesis' in window)) {
      ttsBtn.style.display = 'none';
    } else {
      var ttsOrigLabel = ttsBtn.getAttribute('aria-label');
      var ttsSpeaking  = false;
      var ttsPaused    = false;
      var ttsRate      = parseFloat(localStorage.getItem(_p + '-tts-rate')) || 1;
      var ttsVoice     = null;
      var ttsText      = '';

      /* — Voice loader — */
      var voicesLoaded = false;
      function loadVoices() {
        var voices = window.speechSynthesis.getVoices();
        if (!voices.length) return; // not ready yet — wait for onvoiceschanged
        if (!voiceSelect) return;

        // Filter to English voices, prefer network over offline
        var list = voices.filter(function (v) { return v.lang.startsWith('en'); });
        if (!list.length) list = voices;
        list.sort(function (a, b) {
          // Network voices first, then alphabetical
          if (a.localService !== b.localService) return a.localService ? 1 : -1;
          return a.name.localeCompare(b.name);
        });

        if (list.length <= 1) {
          voiceSelect.hidden = true;
          if (list.length === 1) ttsVoice = list[0];
          return;
        }

        var saved = localStorage.getItem(_p + '-tts-voice');
        voiceSelect.innerHTML = '';
        var foundSaved = false;
        list.forEach(function (v) {
          var opt = document.createElement('option');
          opt.value = v.name;
          // Show a cleaner label: name + (local) indicator
          var label = v.name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
          if (v.localService) label += ' (offline)';
          opt.textContent = label;
          if (saved && v.name === saved) { opt.selected = true; ttsVoice = v; foundSaved = true; }
          voiceSelect.appendChild(opt);
        });

        // If no saved voice, select the first one as default
        if (!foundSaved) {
          ttsVoice = list[0];
          voiceSelect.value = list[0].name;
        }

        voiceSelect.hidden = false;
        voicesLoaded = true;
      }

      // Chrome loads voices async — onvoiceschanged fires when ready
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      loadVoices();

      // Fallback: retry after a short delay (some mobile browsers need this)
      if (!voicesLoaded) {
        setTimeout(loadVoices, 100);
        setTimeout(loadVoices, 500);
        setTimeout(loadVoices, 1000);
      }

      /* — TTS highlight tracking — */
      var ttsHighlightEl = null;

      function clearTtsHighlight() {
        if (ttsHighlightEl) {
          ttsHighlightEl.classList.remove('tts-word-active');
          ttsHighlightEl = null;
        }
        document.querySelectorAll('.tts-word-active').forEach(function (el) {
          el.classList.remove('tts-word-active');
        });
      }

      /* — Helpers — */
      function buildUtterance(text) {
        var utt = new SpeechSynthesisUtterance(text);
        utt.rate  = ttsRate;
        utt.voice = ttsVoice;
        utt.onend = function () { clearTtsHighlight(); stopTts(); };

        // Synced highlighting via onboundary (Chrome, Edge)
        utt.onboundary = function (e) {
          if (e.name !== 'word') return;
          clearTtsHighlight();
          var charIdx = e.charIndex;
          var wordLen = e.charLength || 1;
          // Find the text node at this character offset in article body
          var body = document.querySelector('.article-body');
          if (!body) return;
          var walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null, false);
          var offset = 0;
          var node;
          while ((node = walker.nextNode())) {
            var len = node.nodeValue.length;
            if (offset + len > charIdx) {
              // Found the node — find the word
              var localIdx = charIdx - offset;
              var range = document.createRange();
              try {
                range.setStart(node, localIdx);
                range.setEnd(node, Math.min(localIdx + wordLen, len));
                var span = document.createElement('span');
                span.className = 'tts-word-active';
                range.surroundContents(span);
                ttsHighlightEl = span;
                // Auto-scroll to keep word visible
                var rect = span.getBoundingClientRect();
                if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
                  span.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
              } catch (ex) {}
              break;
            }
            offset += len;
          }
        };

        return utt;
      }

      function stopTts() {
        clearTtsHighlight();
        window.speechSynthesis.cancel();
        ttsSpeaking = false;
        ttsPaused   = false;
        if (ttsControls) ttsControls.hidden = true;
        ttsBtn.setAttribute('aria-label', ttsOrigLabel);
        ttsBtn.classList.remove('is-speaking');
        if (ttsPauseBtn) {
          ttsPauseBtn.setAttribute('aria-label', 'Pause');
          ttsPauseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        }
      }

      /* — Restore active speed button from saved rate — */
      speedBtns.forEach(function (b) {
        b.classList.toggle('is-active', parseFloat(b.dataset.rate) === ttsRate);
      });

      /* — Main button: show controls (first click) / stop (while speaking) — */
      ttsBtn.addEventListener('click', function () {
        if (ttsSpeaking) { stopTts(); return; }
        if (ttsControls) {
          ttsControls.hidden = !ttsControls.hidden;
        }
      });

      function startTts() {
        var body = document.querySelector('.article-body');
        if (!body) return;
        ttsText = body.innerText;
        // Stop background music — two audio sources simultaneously would
        // be incomprehensible. The reader can restart music from the
        // music slot after TTS ends.
        if (window.musicPlayer && typeof window.musicPlayer.stop === 'function') {
          try { window.musicPlayer.stop(); } catch (e) {}
        }
        // Cancel then speak immediately (setTimeout breaks user gesture chain in Chrome)
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(buildUtterance(ttsText));
        ttsSpeaking = true;
        ttsBtn.setAttribute('aria-label', 'Stop reading');
        ttsBtn.classList.add('is-speaking');
      }

      /* — Play / Pause / Resume — */
      if (ttsPauseBtn) {
        // Show play icon initially (not speaking yet)
        ttsPauseBtn.setAttribute('aria-label', 'Play');
        ttsPauseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

        ttsPauseBtn.addEventListener('click', function () {
          if (!ttsSpeaking) {
            // Start playing
            startTts();
            ttsPauseBtn.setAttribute('aria-label', 'Pause');
            ttsPauseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
          } else if (ttsPaused) {
            window.speechSynthesis.resume();
            ttsPaused = false;
            ttsPauseBtn.setAttribute('aria-label', 'Pause');
            ttsPauseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
          } else {
            window.speechSynthesis.pause();
            ttsPaused = true;
            ttsPauseBtn.setAttribute('aria-label', 'Resume');
            ttsPauseBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
          }
        });
      }

      /* — Stop — */
      if (ttsStopBtn) {
        ttsStopBtn.addEventListener('click', stopTts);
      }

      /* — Stop on navigate away — */
      window.addEventListener('beforeunload', function () {
        if (ttsSpeaking) window.speechSynthesis.cancel();
      });

      /* — Speed — */
      speedBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          ttsRate = parseFloat(btn.dataset.rate);
          try { localStorage.setItem(_p + '-tts-rate', ttsRate); } catch (e) {}
          speedBtns.forEach(function (b) { b.classList.remove('is-active'); });
          btn.classList.add('is-active');
          if (ttsSpeaking && !ttsPaused) {
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(buildUtterance(ttsText));
          }
        });
      });

      /* — Voice — */
      if (voiceSelect) {
        voiceSelect.addEventListener('change', function () {
          var voices = window.speechSynthesis.getVoices();
          ttsVoice = voices.find(function (v) { return v.name === voiceSelect.value; }) || null;
          try { localStorage.setItem(_p + '-tts-voice', voiceSelect.value); } catch (e) {}
          if (ttsSpeaking && !ttsPaused) {
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(buildUtterance(ttsText));
          }
        });
      }
    }
  }

  /* ── Focus mode ───────────────────────────────────────────── */
  var focusBtn = document.getElementById('focus-btn');
  if (focusBtn) {
    var root = document.documentElement;
    var focusLabel = focusBtn.querySelector('.btn-label');

    function syncFocusLabel() {
      var on = root.getAttribute('data-focus-mode') === 'on';
      if (focusLabel) focusLabel.textContent = on ? 'Exit focus' : 'Focus';
      focusBtn.setAttribute('aria-pressed', String(on));
    }
    syncFocusLabel();

    focusBtn.addEventListener('click', function () {
      var on = root.getAttribute('data-focus-mode') === 'on';
      root.setAttribute('data-focus-mode', on ? 'off' : 'on');
      try { localStorage.setItem(_p + '-focus', on ? 'off' : 'on'); } catch (e) {}
      syncFocusLabel();
    });
  }

  /* ── Heading anchor links ─────────────────────────────────── */
  (function () {
    var body = document.querySelector('.article-body');
    if (!body) return;
    var headings = body.querySelectorAll('h2[id], h3[id]');
    var linkIcon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
    Array.prototype.forEach.call(headings, function (h) {
      var a = document.createElement('a');
      a.className = 'heading-anchor';
      a.href = '#' + h.id;
      a.setAttribute('aria-hidden', 'true');
      a.innerHTML = linkIcon;
      h.appendChild(a);
    });
  }());

  /* ── Table of contents ────────────────────────────────────── */
  var articleBody = document.querySelector('.article-body');
  var tocNav      = document.getElementById('toc-nav');
  var tocMasthead = document.querySelector('.masthead');

  if (articleBody && tocNav) {
    var headings = Array.prototype.slice.call(
      articleBody.querySelectorAll('h2, h3')
    );

    if (headings.length >= 2) {
      // Assign IDs to headings that don't already have one
      headings.forEach(function (h, i) {
        if (!h.id) {
          h.id = 'section-' + (h.textContent.trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || i);
        }
      });

      // Build TOC list
      var ul = document.createElement('ul');
      ul.className = 'toc-list';

      headings.forEach(function (h) {
        var li   = document.createElement('li');
        li.className = 'toc-list__item toc-list__item--' + h.tagName.toLowerCase();
        var a = document.createElement('a');
        a.className = 'toc-list__link';
        a.href = '#' + h.id;
        a.textContent = h.textContent;
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var headerH = tocMasthead ? tocMasthead.getBoundingClientRect().height : 0;
          var top = h.getBoundingClientRect().top + window.scrollY - headerH - 16;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          history.replaceState(null, '', '#' + h.id);
        });
        li.appendChild(a);
        ul.appendChild(li);
      });

      tocNav.appendChild(ul);
      // TOC populated in reader panel

      // Scroll spy with IntersectionObserver
      var tocLinks = Array.prototype.slice.call(tocNav.querySelectorAll('.toc-list__link'));
      var activeLink = null;

      function setActive(link) {
        if (activeLink) activeLink.classList.remove('is-active');
        activeLink = link;
        if (activeLink) activeLink.classList.add('is-active');
      }

      if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var id = entry.target.id;
              var link = tocNav.querySelector('[href="#' + id + '"]');
              if (link) setActive(link);
            }
          });
        }, { rootMargin: '0px 0px -70% 0px', threshold: 0 });

        headings.forEach(function (h) { observer.observe(h); });
      }
    }
  }

  /* ── Inline footnote tooltips ────────────────────────────── */
  var fnTooltip = null;

  function makeFnTooltip() {
    var el = document.createElement('div');
    el.className = 'fn-tooltip';
    el.setAttribute('role', 'tooltip');
    el.hidden = true;
    var close = document.createElement('button');
    close.className = 'fn-tooltip__close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Close footnote');
    close.textContent = '✕';
    close.addEventListener('click', function () { hideFnTooltip(); });
    el.appendChild(close);
    var body = document.createElement('div');
    body.className = 'fn-tooltip__body';
    el.appendChild(body);
    document.body.appendChild(el);
    return el;
  }

  function hideFnTooltip() {
    if (fnTooltip) {
      fnTooltip.hidden = true;
      var prev = document.querySelector('.fn-btn[aria-expanded="true"]');
      if (prev) prev.setAttribute('aria-expanded', 'false');
    }
  }

  var fnBtns = document.querySelectorAll('.fn-btn');
  if (fnBtns.length) {
    fnTooltip = makeFnTooltip();
    var fnBody = fnTooltip.querySelector('.fn-tooltip__body');

    fnBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();

        // On wide screens sidenote is already visible — just highlight it
        if (btn.getAttribute('data-has-sidenote')) {
          var snId = btn.getAttribute('aria-controls');
          var sn = snId ? document.getElementById(snId) : null;
          if (sn) {
            sn.classList.add('sidenote--highlight');
            setTimeout(function () { sn.classList.remove('sidenote--highlight'); }, 1200);
          }
          return;
        }

        var already = btn.getAttribute('aria-expanded') === 'true';
        hideFnTooltip();
        if (already) return;

        // Content stored in adjacent <span class="fn-content" hidden>
        var contentEl = btn.parentElement.querySelector('.fn-content');
        if (!contentEl) return;
        fnBody.innerHTML = contentEl.innerHTML;

        // Position above the button, centred
        var rect   = btn.getBoundingClientRect();
        var scrollY = window.scrollY;
        fnTooltip.hidden = false;
        var tipW = fnTooltip.offsetWidth;
        var tipH = fnTooltip.offsetHeight;
        var left = rect.left + rect.width / 2 - tipW / 2;
        var top  = scrollY + rect.top - tipH - 10;

        // Reserve space for the bottom annotation toolbar so we never
        // place the tooltip behind it.
        var bar = document.getElementById('annotation-toolbar');
        var barH = bar ? bar.offsetHeight : 0;
        var maxBottomPx = scrollY + window.innerHeight - barH - 10;

        // Clamp to viewport
        left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));
        // Default: above the button. If clipped at the top of the viewport,
        // try below; if that would land under the toolbar, keep it above.
        if (top < scrollY + 8) {
          var below = scrollY + rect.bottom + 10;
          top = (below + tipH < maxBottomPx) ? below : Math.max(scrollY + 8, top);
        }
        // Last-resort: clamp upward so the tooltip stays clear of the toolbar.
        if (top + tipH > maxBottomPx) top = Math.max(scrollY + 8, maxBottomPx - tipH);

        fnTooltip.style.left = left + 'px';
        fnTooltip.style.top  = top  + 'px';
        btn.setAttribute('aria-expanded', 'true');
      });
    });

    document.addEventListener('click', function () { hideFnTooltip(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hideFnTooltip();
    });
  }

  /* ── Sidenotes (margin notes on screens ≥ 1400px) ────────── */
  var SIDENOTE_BREAK = 1400;
  var snProseEl = document.querySelector('.article-body');

  function isSidenotesActive() {
    if (!snProseEl) return false;
    if (window.innerWidth < SIDENOTE_BREAK) return false;
    if (snProseEl.getAttribute('data-rs-width') === 'wide') return false;
    if (document.documentElement.getAttribute('data-focus-mode') === 'on') return false;
    return true;
  }

  function clearSidenotes() {
    var existing = document.querySelectorAll('.sidenote');
    existing.forEach(function (el) { el.remove(); });
    document.querySelectorAll('.fn-btn[data-has-sidenote]').forEach(function (btn) {
      btn.removeAttribute('data-has-sidenote');
      btn.removeAttribute('aria-controls');
    });
  }

  function buildSidenotes() {
    clearSidenotes();
    if (!isSidenotesActive()) return;

    var proseTop = snProseEl.getBoundingClientRect().top + window.scrollY;
    var minTop = 0;

    document.querySelectorAll('.fn-btn').forEach(function (btn) {
      var id = btn.getAttribute('data-fn-id') || btn.textContent.trim();
      var contentEl = btn.parentElement.querySelector('.fn-content');
      if (!contentEl) return;

      var sn = document.createElement('aside');
      sn.className = 'sidenote';
      sn.id = 'sidenote-' + id;
      sn.setAttribute('role', 'note');
      sn.setAttribute('aria-label', 'Note ' + id);
      sn.innerHTML =
        '<span class="sidenote__number" aria-hidden="true">' + id + '</span>' +
        '<p class="sidenote__text">' + contentEl.textContent + '</p>';
      snProseEl.appendChild(sn);

      // Align top of sidenote with the vertical position of its fn-ref
      var refRect  = btn.getBoundingClientRect();
      var idealTop = refRect.top + window.scrollY - proseTop;
      var top = Math.max(minTop, idealTop);
      sn.style.top = top + 'px';
      minTop = top + sn.offsetHeight + 8;

      // Mark button so tooltip is suppressed; link to sidenote for a11y
      btn.setAttribute('data-has-sidenote', 'true');
      btn.setAttribute('aria-controls', sn.id);
    });
  }

  if (snProseEl && document.querySelector('.fn-btn')) {
    buildSidenotes();
    setTimeout(buildSidenotes, 400); // rerun after fonts/images settle

    var snResizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(snResizeTimer);
      snResizeTimer = setTimeout(buildSidenotes, 150);
    }, { passive: true });

    // Rebuild when focus mode or reading width changes
    document.documentElement.addEventListener('data-focus-mode', buildSidenotes);
    if (snProseEl) {
      var snObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
          if (m.attributeName === 'data-rs-width' || m.attributeName === 'data-focus-mode') {
            buildSidenotes();
          }
        });
      });
      snObserver.observe(snProseEl, { attributes: true });
      snObserver.observe(document.documentElement, { attributes: true });
    }
  }

  /* ── Footnotes (visible + print) ─────────────────────────── */
  var allFnBtns = document.querySelectorAll('.fn-btn');
  var articleFnEl = document.getElementById('article-footnotes');
  var printFnEl = document.getElementById('print-footnotes');

  if (allFnBtns.length) {
    // Build footnotes list
    function buildFnList(className) {
      var ol = document.createElement('ol');
      ol.className = className;
      allFnBtns.forEach(function (btn) {
        var contentEl = btn.parentElement.querySelector('.fn-content');
        if (!contentEl) return;
        var li = document.createElement('li');
        var id = btn.getAttribute('data-fn-id');
        if (id) li.setAttribute('value', id);
        li.textContent = contentEl.textContent;
        ol.appendChild(li);
      });
      return ol;
    }

    // Visible footnotes section
    if (articleFnEl) {
      var fnHeader = document.createElement('div');
      fnHeader.className = 'article-footnotes__header';
      fnHeader.innerHTML = '<span class="article-footnotes__title">Footnotes</span>' +
        '<button class="article-footnotes__toggle" type="button" id="fn-toggle">Hide footnotes</button>';
      articleFnEl.appendChild(fnHeader);

      var fnBody = document.createElement('div');
      fnBody.id = 'fn-body';
      fnBody.appendChild(buildFnList('article-footnotes__list'));
      articleFnEl.appendChild(fnBody);

      document.getElementById('fn-toggle').addEventListener('click', function () {
        var body = document.getElementById('fn-body');
        var hidden = body.hidden;
        body.hidden = !hidden;
        this.textContent = hidden ? 'Hide footnotes' : 'Show footnotes';
      });
    }

    // Print footnotes
    if (printFnEl) {
      var pfnHeading = document.createElement('p');
      pfnHeading.className = 'print-footnotes__heading';
      pfnHeading.textContent = 'Notes';
      printFnEl.appendChild(pfnHeading);
      printFnEl.appendChild(buildFnList('print-footnotes__list'));
    }
  }

  /* ── Pullquote share ──────────────────────────────────────── */
  var shareTooltip = null;

  function makeShareTooltip() {
    var el = document.createElement('button');
    el.className = 'pullquote-share';
    el.setAttribute('aria-label', 'Share this quote');
    el.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'
      + ' Share quote';
    document.body.appendChild(el);
    return el;
  }

  function hideShareTooltip() {
    if (shareTooltip) shareTooltip.style.display = 'none';
  }

  // Skip pullquote share if annotation toolbar is present (it has its own share)
  if (articleBody && !document.getElementById('annotation-toolbar')) {
    shareTooltip = makeShareTooltip();

    document.addEventListener('mouseup', function () {
      setTimeout(function () {
        var sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.toString().trim()) {
          hideShareTooltip();
          return;
        }

        // Only trigger within .article-body
        var node = sel.anchorNode;
        var inside = false;
        while (node) {
          if (node === articleBody) { inside = true; break; }
          node = node.parentNode;
        }
        if (!inside) { hideShareTooltip(); return; }

        var text = sel.toString().trim();
        if (text.length < 10 || text.length > 600) { hideShareTooltip(); return; }

        // Position tooltip above the selection
        var range = sel.getRangeAt(0);
        var rect  = range.getBoundingClientRect();
        var scrollY = window.scrollY || document.documentElement.scrollTop;

        shareTooltip.style.display  = 'inline-flex';
        shareTooltip.style.top      = (scrollY + rect.top - 44) + 'px';
        shareTooltip.style.left     = (rect.left + rect.width / 2) + 'px';

        shareTooltip.onclick = function () {
          var shareText = '\u201c' + text + '\u201d';
          var shareUrl  = window.location.href;

          if (navigator.share) {
            navigator.share({ text: shareText, url: shareUrl }).catch(function () {});
          } else if (navigator.clipboard) {
            navigator.clipboard.writeText(shareText + ' ' + shareUrl).then(function () {
              shareTooltip.textContent = 'Copied';
              setTimeout(function () {
                shareTooltip.innerHTML =
                  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>'
                  + ' Share quote';
                hideShareTooltip();
              }, 1500);
            });
          }
        };
      }, 10);
    });

    document.addEventListener('mousedown', function (e) {
      if (shareTooltip && e.target !== shareTooltip) hideShareTooltip();
    });
  }

  /* ── Cite this article ──────────────────────────────────────── */
  var citeBtn     = document.getElementById('cite-btn');
  var citeModal   = document.getElementById('cite-modal');
  var citeOverlay = document.getElementById('cite-overlay');
  var citeClose   = document.getElementById('cite-close');
  var citeText    = document.getElementById('cite-text');
  var citeCopyBtn = document.getElementById('cite-copy-btn');
  var citeTabs    = document.querySelectorAll('.cite-tab');
  var citeData    = document.getElementById('cite-data');

  if (citeBtn && citeModal && citeData) {
    var citeInfo = {
      title:       citeData.dataset.title       || '',
      author:      citeData.dataset.author      || '',
      date:        citeData.dataset.date        || '',
      publication: citeData.dataset.publication || '',
      url:         citeData.dataset.url         || window.location.href
    };

    function parseName(full) {
      var parts = full.trim().split(/\s+/);
      var last  = parts.pop() || '';
      return { first: parts.join(' '), last: last };
    }

    function citeDate(isoStr, style) {
      var d     = new Date(isoStr);
      var year  = d.getUTCFullYear();
      var month = d.toLocaleString('en-US', { month: 'long',  timeZone: 'UTC' });
      var day   = d.getUTCDate();
      if (style === 'apa')     return year + ', ' + month + ' ' + day;
      if (style === 'mla')     return day + ' ' + month + ' ' + year;
      if (style === 'chicago') return month + ' ' + day + ', ' + year;
      return String(year);
    }

    function buildCitation(format) {
      var n   = parseName(citeInfo.author);
      var url = citeInfo.url;
      var pub = citeInfo.publication;
      var t   = citeInfo.title;
      var hasAuthor = !!(n.last);

      if (format === 'apa') {
        var init = n.first ? n.first.split(/\s+/).map(function(w){ return w[0] + '.'; }).join(' ') : '';
        var auth = hasAuthor ? (n.last + (init ? ', ' + init : '') + ' ') : '';
        return auth + '(' + citeDate(citeInfo.date, 'apa') + '). ' + t + '. ' + pub + '. ' + url;
      }
      if (format === 'mla') {
        var auth = hasAuthor ? (n.last + (n.first ? ', ' + n.first : '') + '. ') : '';
        return auth + '\u201c' + t + '.\u201d ' + pub + ', ' + citeDate(citeInfo.date, 'mla') + ', ' + url + '.';
      }
      if (format === 'chicago') {
        var auth = hasAuthor ? (n.last + (n.first ? ', ' + n.first : '') + '. ') : '';
        return auth + '\u201c' + t + '.\u201d ' + pub + ', ' + citeDate(citeInfo.date, 'chicago') + '. ' + url + '.';
      }
      return '';
    }

    /* Populate print citations with all three formats on page load */
    var printCiteEl = document.getElementById('print-citations');
    if (printCiteEl) {
      var cHeading = document.createElement('p');
      cHeading.className = 'print-citations__heading';
      cHeading.textContent = 'How to Cite This Article';
      printCiteEl.appendChild(cHeading);

      [['apa', 'APA 7th'], ['mla', 'MLA 9th'], ['chicago', 'Chicago 17th']].forEach(function (pair) {
        var item = document.createElement('div');
        item.className = 'print-citations__item';

        var fmt = document.createElement('p');
        fmt.className = 'print-citations__format';
        fmt.textContent = pair[1];

        var text = document.createElement('p');
        text.className = 'print-citations__text';
        text.textContent = buildCitation(pair[0]);

        item.appendChild(fmt);
        item.appendChild(text);
        printCiteEl.appendChild(item);
      });
    }

    var currentCiteFormat = 'apa';

    function showCitation(format) {
      currentCiteFormat = format;
      if (citeText) citeText.textContent = buildCitation(format);
      citeTabs.forEach(function(tab) {
        var active = tab.dataset.format === format;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
      });
    }

    function openCite() {
      showCitation(currentCiteFormat);
      citeModal.hidden   = false;
      citeOverlay.hidden = false;
      citeBtn.setAttribute('aria-expanded', 'true');
      if (citeClose) citeClose.focus();
    }

    function closeCite() {
      citeModal.hidden   = true;
      citeOverlay.hidden = true;
      citeBtn.setAttribute('aria-expanded', 'false');
      citeBtn.focus();
    }

    citeBtn.addEventListener('click', function() {
      if (!citeModal.hidden) { closeCite(); } else { openCite(); }
    });

    if (citeClose)   citeClose.addEventListener('click', closeCite);
    if (citeOverlay) citeOverlay.addEventListener('click', closeCite);

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !citeModal.hidden) closeCite();
    });

    citeTabs.forEach(function(tab) {
      tab.addEventListener('click', function() { showCitation(tab.dataset.format); });
    });

    if (citeCopyBtn) {
      citeCopyBtn.addEventListener('click', function() {
        var text = citeText ? citeText.textContent : '';
        if (!text) return;
        var restore = function() {
          setTimeout(function() { citeCopyBtn.textContent = 'Copy citation'; }, 2000);
        };
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function() {
            citeCopyBtn.textContent = 'Copied!';
            restore();
          }).catch(function() { fallbackCopy(text); });
        } else {
          fallbackCopy(text);
        }
        function fallbackCopy(t) {
          var ta = document.createElement('textarea');
          ta.value = t;
          ta.style.cssText = 'position:fixed;opacity:0';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); citeCopyBtn.textContent = 'Copied!'; } catch(e) {}
          document.body.removeChild(ta);
          restore();
        }
      });
    }
  }

}());
