/**
 * Shared calendar engine — drives both /editorial-calendar/ and
 * /reading-calendar/. Owns:
 *
 *   - data loading from #cal-articles-data (the inline JSON block
 *     emitted by the partials/calendar-data.njk include)
 *   - day / week / month / year views with prev/next + today nav
 *   - article-card rendering that mirrors partials/article-card.njk
 *     (section badge, dateline, headline, dek, listen pill, byline)
 *
 * Each page mounts the engine via window.TFTCalendar.mount({ root,
 * mode, history }) where:
 *
 *   root      - DOM element to render into
 *   mode      - "editorial" (show every article on its publish date)
 *               or "reading" (show only articles the reader has read,
 *               on the date they read them)
 *   history   - for reading mode: { url -> 'yyyy-mm-dd' } map of read
 *               dates pulled from localStorage by the page wrapper
 */
(function () {
  'use strict';

  var DAY_NAMES_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var DAY_NAMES_LONG  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  var MONTH_NAMES     = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  // ── Helpers ────────────────────────────────────────────────────
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function parseISODay(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }
  function startOfWeek(d) {
    var x = new Date(d);
    x.setDate(x.getDate() - x.getDay()); // Sunday-start
    x.setHours(0,0,0,0);
    return x;
  }
  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
  function startOfYear(d)  { return new Date(d.getFullYear(), 0, 1); }
  function addDays(d, n)   { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { var x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
  function addYears(d, n)  { var x = new Date(d); x.setFullYear(x.getFullYear() + n); return x; }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function slugify(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/&/g, '-and-')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  function readableDate(d) {
    return DAY_NAMES_LONG[d.getDay()] + ', ' + MONTH_NAMES[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }
  function readingTimeText(words) {
    var mins = Math.max(1, Math.ceil((+words || 0) / 200));
    return mins + ' min read';
  }
  function wordCountText(words) {
    var n = +words || 0;
    return n.toLocaleString('en-US') + ' words';
  }

  // ── Article card renderer (mirrors partials/article-card.njk) ──
  function renderCard(a, opts) {
    opts = opts || {};
    var sectionKey = slugify(a.section);
    var dateObj = parseISODay(a.date);
    var dateAttr = a.date;
    var dateShort = dateObj ? (MONTH_NAMES[dateObj.getMonth()].slice(0,3) + ' ' + dateObj.getDate() + ', ' + dateObj.getFullYear()) : '';
    var html = '<article class="article-card article-card--cal">';
    html += '<div class="article-card__eyebrow">';
    if (a.section) {
      html += '<a href="/' + sectionKey + '/" class="section-badge section-badge--' + sectionKey + '">' + escapeHtml(a.section) + '</a>';
    }
    if (a.subsection && a.section) {
      html += '<a href="/' + sectionKey + '/?s=' + slugify(a.subsection) + '" class="dateline dateline--link">' + escapeHtml(a.subsection) + '</a>';
    }
    if (dateObj) {
      html += '<a href="/archives/#' + dateAttr + '" class="dateline"><time datetime="' + dateAttr + '">' + escapeHtml(dateShort) + '</time></a>';
    }
    html += '</div>';
    html += '<a class="article-card__headline article-card__headline--md" href="' + a.url + '">' + escapeHtml(a.title) + '</a>';
    if (a.description) {
      html += '<p class="article-card__dek">' + escapeHtml(a.description) + '</p>';
    }
    if (a.hasAudio) {
      html += '<div class="article-card__listen">'
            + '<button type="button" class="listen-btn listen-btn--sm" '
            + 'data-tft-audio-trigger="' + a.url + '" '
            + 'data-tft-audio-title="' + escapeHtml(a.title) + '" '
            + 'aria-label="Listen to this article">'
            + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>'
            + '<span class="listen-btn__label">Listen</span>'
            + '</button></div>';
    }
    html += '<p class="article-card__byline">';
    if (a.authorName || a.author) {
      var authorSlug = slugify(a.author || a.authorName);
      html += '<span class="article-card__byline-item">By <a href="/author/' + authorSlug + '/">'
            + escapeHtml(a.authorName || a.author) + '</a></span>';
    }
    if (a.wordCount) {
      html += '<span class="article-card__byline-item">' + readingTimeText(a.wordCount) + '</span>';
      html += '<span class="article-card__byline-item">' + wordCountText(a.wordCount) + '</span>';
    }
    html += '</p>';
    html += '</article>';
    return html;
  }

  // ── Index articles by date ─────────────────────────────────────
  function indexByDate(articles, history) {
    var byDate = Object.create(null);
    var counts = Object.create(null);
    articles.forEach(function (a) {
      var d = history ? history[a.url] : a.date;
      if (!d) return;
      d = String(d).slice(0, 10);
      (byDate[d] = byDate[d] || []).push({ article: a, day: d });
      counts[d] = (counts[d] || 0) + 1;
    });
    // Sort each day newest-section-first by article date desc
    Object.keys(byDate).forEach(function (k) {
      byDate[k].sort(function (a, b) { return b.article.date.localeCompare(a.article.date); });
    });
    return { byDate: byDate, counts: counts };
  }

  // ── View renderers ─────────────────────────────────────────────
  function renderDayView(state) {
    var d = state.cursor;
    var iso = isoOf(d);
    var entries = state.byDate[iso] || [];
    var html = '<header class="cal-view__header">'
             + '<h2 class="cal-view__title">' + readableDate(d) + '</h2>'
             + '<p class="cal-view__sub">' + entries.length + ' article' + (entries.length === 1 ? '' : 's') + '</p>'
             + '</header>';
    if (!entries.length) {
      html += '<p class="cal-view__empty">Nothing on this day.</p>';
    } else {
      html += '<div class="cal-view__cards">';
      entries.forEach(function (e) { html += renderCard(e.article); });
      html += '</div>';
    }
    return html;
  }

  function renderWeekView(state) {
    var start = startOfWeek(state.cursor);
    var end = addDays(start, 6);
    var html = '<header class="cal-view__header">'
             + '<h2 class="cal-view__title">Week of ' + MONTH_NAMES[start.getMonth()] + ' ' + start.getDate() + ', ' + start.getFullYear() + '</h2>'
             + '<p class="cal-view__sub">' + isoOf(start) + ' to ' + isoOf(end) + '</p>'
             + '</header>';
    html += '<div class="cal-view__week">';
    for (var i = 0; i < 7; i++) {
      var d = addDays(start, i);
      var iso = isoOf(d);
      var entries = state.byDate[iso] || [];
      html += '<section class="cal-view__day' + (entries.length ? ' cal-view__day--has' : '') + '">';
      html += '<header class="cal-view__day-head">'
            + '<span class="cal-view__day-name">' + DAY_NAMES_LONG[d.getDay()] + '</span>'
            + '<span class="cal-view__day-num">' + MONTH_NAMES[d.getMonth()].slice(0,3) + ' ' + d.getDate() + '</span>'
            + '<span class="cal-view__day-count">' + entries.length + '</span>'
            + '</header>';
      if (entries.length) {
        html += '<div class="cal-view__cards">';
        entries.forEach(function (e) { html += renderCard(e.article); });
        html += '</div>';
      }
      html += '</section>';
    }
    html += '</div>';
    return html;
  }

  function renderMonthView(state) {
    var first = startOfMonth(state.cursor);
    var lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    var leading = first.getDay();
    var monthLabel = MONTH_NAMES[first.getMonth()] + ' ' + first.getFullYear();

    var html = '<header class="cal-view__header">'
             + '<h2 class="cal-view__title">' + monthLabel + '</h2>'
             + '</header>';

    html += '<div class="cal-view__month-grid">'
          + '<div class="cal-view__weekdays" aria-hidden="true">'
          + DAY_NAMES_SHORT.map(function (n) { return '<span>' + n + '</span>'; }).join('')
          + '</div>'
          + '<div class="cal-view__grid" role="grid">';

    for (var p = 0; p < leading; p++) {
      html += '<div class="cal-view__cell cal-view__cell--blank" role="gridcell" aria-hidden="true"></div>';
    }
    for (var d = 1; d <= lastDay; d++) {
      var date = new Date(first.getFullYear(), first.getMonth(), d);
      var iso = isoOf(date);
      var count = (state.counts[iso] || 0);
      var has = count > 0;
      html += '<button type="button" class="cal-view__cell' + (has ? ' cal-view__cell--has' : '') + '" role="gridcell" data-jump-day="' + iso + '">'
            + '<span class="cal-view__cell-num">' + d + '</span>'
            + (has ? '<span class="cal-view__cell-count">' + count + '</span>' : '')
            + '</button>';
    }
    html += '</div></div>';

    // List all articles for the month below the grid
    var monthEntries = [];
    Object.keys(state.byDate).forEach(function (k) {
      if (k.slice(0, 7) === isoOf(first).slice(0, 7)) {
        monthEntries = monthEntries.concat(state.byDate[k]);
      }
    });
    monthEntries.sort(function (a, b) { return b.day.localeCompare(a.day); });
    if (monthEntries.length) {
      html += '<div class="cal-view__month-list"><h3 class="cal-view__month-list-title">All articles &middot; ' + monthLabel + '</h3>';
      html += '<div class="cal-view__cards cal-view__cards--list">';
      monthEntries.forEach(function (e) { html += renderCard(e.article); });
      html += '</div></div>';
    }
    return html;
  }

  function renderYearView(state) {
    var year = state.cursor.getFullYear();
    var html = '<header class="cal-view__header">'
             + '<h2 class="cal-view__title">' + year + '</h2>'
             + '</header>';
    html += '<div class="cal-view__year-grid">';
    for (var m = 0; m < 12; m++) {
      var first = new Date(year, m, 1);
      var lastDay = new Date(year, m + 1, 0).getDate();
      var leading = first.getDay();
      var monthCount = 0;
      Object.keys(state.byDate).forEach(function (k) {
        if (k.slice(0, 7) === year + '-' + pad2(m + 1)) monthCount += state.byDate[k].length;
      });
      html += '<button type="button" class="cal-view__year-month" data-jump-month="' + year + '-' + pad2(m + 1) + '-01">';
      html += '<header class="cal-view__year-month-head">'
            + '<span>' + MONTH_NAMES[m] + '</span>'
            + '<span class="cal-view__year-month-count">' + monthCount + '</span>'
            + '</header>';
      html += '<div class="cal-view__mini-grid">';
      for (var p = 0; p < leading; p++) html += '<span class="cal-view__mini cal-view__mini--blank"></span>';
      for (var d = 1; d <= lastDay; d++) {
        var iso = year + '-' + pad2(m + 1) + '-' + pad2(d);
        var c = state.counts[iso] || 0;
        var heat = c >= 5 ? 4 : c >= 3 ? 3 : c >= 2 ? 2 : c >= 1 ? 1 : 0;
        html += '<span class="cal-view__mini' + (heat ? ' cal-view__mini--heat-' + heat : '') + '" title="' + iso + ': ' + c + '"></span>';
      }
      html += '</div></button>';
    }
    html += '</div>';
    return html;
  }

  // ── Engine ────────────────────────────────────────────────────
  function mount(opts) {
    var root = opts.root;
    if (!root) return;
    var dataNode = document.getElementById('cal-articles-data');
    var raw = { articles: [] };
    if (dataNode) {
      try { raw = JSON.parse(dataNode.textContent.trim()); } catch (e) {}
    }
    var articles = raw.articles || [];

    if (opts.mode === 'reading') {
      var hist = opts.history || {};
      // Filter to articles the user has read
      var readUrls = Object.keys(hist);
      if (!readUrls.length) {
        root.innerHTML = '<p class="cal-view__empty">'
          + 'No reading history on this device yet. Mark articles as read on the article page to populate this calendar.'
          + '</p>';
        return;
      }
      articles = articles.filter(function (a) { return hist[a.url]; });
      var state = {
        view: 'month',
        cursor: new Date(),
        articles: articles,
      };
      var idx = indexByDate(articles, hist);
      state.byDate = idx.byDate;
      state.counts = idx.counts;
      attachShell(root, state, opts);
    } else {
      // editorial mode: every published article on its publish date
      var idx2 = indexByDate(articles, null);
      var state2 = {
        view: 'month',
        cursor: new Date(),
        articles: articles,
        byDate: idx2.byDate,
        counts: idx2.counts,
      };
      attachShell(root, state2, opts);
    }
  }

  function attachShell(root, state, opts) {
    function nav(direction) {
      if (state.view === 'day')   state.cursor = addDays(state.cursor, direction);
      else if (state.view === 'week')  state.cursor = addDays(state.cursor, direction * 7);
      else if (state.view === 'month') state.cursor = addMonths(state.cursor, direction);
      else if (state.view === 'year')  state.cursor = addYears(state.cursor, direction);
      paint();
    }
    function setView(v) { state.view = v; paint(); }
    function jumpToday() { state.cursor = new Date(); paint(); }

    function shellHTML(body) {
      return ''
        + '<div class="cal-toolbar" role="toolbar" aria-label="Calendar navigation">'
          + '<div class="cal-toolbar__nav">'
            + '<button type="button" class="cal-toolbar__btn" data-cal-nav="prev"  aria-label="Previous">&larr;</button>'
            + '<button type="button" class="cal-toolbar__btn cal-toolbar__btn--today" data-cal-today>Today</button>'
            + '<button type="button" class="cal-toolbar__btn" data-cal-nav="next"  aria-label="Next">&rarr;</button>'
          + '</div>'
          + '<div class="cal-toolbar__views" role="tablist">'
            + ['day','week','month','year'].map(function (v) {
                return '<button type="button" role="tab" class="cal-toolbar__view' + (state.view === v ? ' is-active' : '') + '" data-cal-view="' + v + '" aria-selected="' + (state.view === v) + '">' + v.charAt(0).toUpperCase() + v.slice(1) + '</button>';
              }).join('')
          + '</div>'
        + '</div>'
        + '<div class="cal-view cal-view--' + state.view + '">' + body + '</div>';
    }

    function paint() {
      var body = '';
      if (state.view === 'day')   body = renderDayView(state);
      else if (state.view === 'week')  body = renderWeekView(state);
      else if (state.view === 'month') body = renderMonthView(state);
      else if (state.view === 'year')  body = renderYearView(state);
      root.innerHTML = shellHTML(body);
    }

    paint();

    root.addEventListener('click', function (e) {
      var navBtn = e.target.closest('[data-cal-nav]');
      if (navBtn) { nav(navBtn.dataset.calNav === 'prev' ? -1 : 1); return; }
      var today = e.target.closest('[data-cal-today]');
      if (today) { jumpToday(); return; }
      var viewBtn = e.target.closest('[data-cal-view]');
      if (viewBtn) { setView(viewBtn.dataset.calView); return; }
      var jumpDay = e.target.closest('[data-jump-day]');
      if (jumpDay) {
        state.cursor = parseISODay(jumpDay.dataset.jumpDay);
        state.view = 'day';
        paint();
        return;
      }
      var jumpMonth = e.target.closest('[data-jump-month]');
      if (jumpMonth) {
        state.cursor = parseISODay(jumpMonth.dataset.jumpMonth);
        state.view = 'month';
        paint();
        return;
      }
    });
  }

  window.TFTCalendar = { mount: mount };
})();
