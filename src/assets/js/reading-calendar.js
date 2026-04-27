/**
 * Reading calendar — renders a month-by-month grid showing which days
 * the user finished or substantially read articles. Sources:
 *
 *   tft-read-manual  — { url: { title, section, markedAt } }
 *                      The user explicitly marked these as read; the
 *                      ISO timestamp is the canonical "read date".
 *   tft-read-pct     — { url: 0–100 }
 *                      Auto-tracked scroll progress. Has no timestamp,
 *                      so we fall back to "today" only as a last resort
 *                      for any URL with >= 95% but no manual entry —
 *                      gives the user signal that the article was
 *                      finished but the calendar can't place it on a
 *                      historical date without a stamp.
 *
 * Articles in tft-reading-list (saved-for-later, not necessarily read)
 * are intentionally not counted. This is a *read* calendar, not a
 * library log.
 */
(function () {
  'use strict';

  var PREFIX = (window.__PREFIX || 'tft');
  var KEY_MANUAL = PREFIX + '-read-manual';
  var KEY_PCT    = PREFIX + '-read-pct';

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
  }

  function init() {
    var mount   = document.getElementById('reading-cal-mount');
    var summary = document.getElementById('reading-cal-summary');
    if (!mount) return;

    var manual = load(KEY_MANUAL);
    var pct    = load(KEY_PCT);

    // Build entries: [{ date: 'yyyy-mm-dd', url, title, section }]
    var entries = [];
    var todayISO = new Date().toISOString().slice(0, 10);
    Object.keys(manual).forEach(function (url) {
      var rec = manual[url];
      if (!rec) return;
      var d = rec.markedAt ? rec.markedAt.slice(0, 10) : todayISO;
      entries.push({ date: d, url: url, title: rec.title || url, section: rec.section || '' });
    });
    // Add finished pct entries that aren't already counted
    var seen = new Set(Object.keys(manual));
    Object.keys(pct).forEach(function (url) {
      if (seen.has(url)) return;
      if (pct[url] >= 95) {
        entries.push({ date: todayISO, url: url, title: url, section: '', _approx: true });
      }
    });

    if (!entries.length) {
      mount.innerHTML = '<p class="reading-cal__empty">'
        + 'No reading history on this device yet. Mark articles as read on the article page to populate this calendar.'
        + '</p>';
      return;
    }

    // Index by date + collect month set
    var byDate = Object.create(null);
    var monthSet = new Set();
    entries.forEach(function (e) {
      monthSet.add(e.date.slice(0, 7));
      (byDate[e.date] = byDate[e.date] || []).push(e);
    });
    var months = [...monthSet].sort().reverse();

    // Summary stats
    if (summary) {
      var total = entries.length;
      var days  = Object.keys(byDate).length;
      summary.innerHTML =
        '<div class="reading-cal__stat"><span class="reading-cal__stat-num">' + total + '</span> articles read</div>'
      + '<div class="reading-cal__stat"><span class="reading-cal__stat-num">' + days  + '</span> reading days</div>'
      + '<div class="reading-cal__stat"><span class="reading-cal__stat-num">' + months.length + '</span> months active</div>';
    }

    var monthFmt = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
    var dayFmt   = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    // Heat scale: 1, 2, 3, 4+ articles → progressively darker cells
    function heat(n) {
      if (n >= 5) return 4;
      if (n >= 3) return 3;
      if (n >= 2) return 2;
      return 1;
    }

    function buildMonthGrid(ym) {
      var parts = ym.split('-');
      var year  = +parts[0];
      var month = +parts[1] - 1;
      var first = new Date(year, month, 1);
      var lastDay = new Date(year, month + 1, 0).getDate();
      var leading = first.getDay();

      var html = '<section class="reading-cal__month" aria-labelledby="rc-' + ym + '">';
      html += '<h2 class="reading-cal__month-title" id="rc-' + ym + '">' + monthFmt.format(first) + '</h2>';
      html += '<div class="reading-cal__weekdays" aria-hidden="true">'
            + ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function (d) {
                return '<span>' + d + '</span>';
              }).join('')
            + '</div>';
      html += '<div class="reading-cal__grid" role="grid">';

      for (var p = 0; p < leading; p++) {
        html += '<div class="reading-cal__cell reading-cal__cell--blank" role="gridcell" aria-hidden="true"></div>';
      }
      for (var d = 1; d <= lastDay; d++) {
        var iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var dayItems = byDate[iso] || [];
        var count = dayItems.length;
        var cls = 'reading-cal__cell';
        if (count) cls += ' reading-cal__cell--has-items reading-cal__cell--heat-' + heat(count);
        html += '<div class="' + cls + '" role="gridcell" data-day="' + iso + '">'
              + '<div class="reading-cal__day-num">' + d + '</div>'
              + (count
                  ? '<button class="reading-cal__day-trigger" type="button" aria-expanded="false" aria-controls="rc-list-' + iso + '" aria-label="' + dayFmt.format(new Date(year, month, d)) + ', ' + count + ' read"><span class="reading-cal__day-count">' + count + '</span></button>'
                  : '')
              + '</div>';
      }
      html += '</div>';

      var dates = Object.keys(byDate).filter(function (k) { return k.slice(0, 7) === ym; }).sort();
      if (dates.length) {
        html += '<div class="reading-cal__lists">';
        dates.forEach(function (iso) {
          var dayItems = byDate[iso];
          html += '<div class="reading-cal__list" id="rc-list-' + iso + '" hidden>';
          html += '<p class="reading-cal__list-head">' + dayFmt.format(new Date(iso + 'T00:00:00')) + '</p>';
          html += '<ul role="list">' + dayItems.map(function (it) {
            var safeTitle = String(it.title).replace(/[<>&]/g, function (c) {
              return c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;';
            });
            return '<li><a href="' + it.url + '">'
                 + (it.section ? '<span class="reading-cal__list-kicker">' + it.section + '</span>' : '')
                 + '<span class="reading-cal__list-title">' + safeTitle + '</span>'
                 + (it._approx ? '<span class="reading-cal__list-approx">approx. date</span>' : '')
                 + '</a></li>';
          }).join('') + '</ul>';
          html += '</div>';
        });
        html += '</div>';
      }
      html += '</section>';
      return html;
    }

    mount.innerHTML = months.map(buildMonthGrid).join('');

    mount.addEventListener('click', function (e) {
      var btn = e.target.closest('.reading-cal__day-trigger');
      if (!btn) return;
      var cell = btn.closest('.reading-cal__cell');
      var iso = cell && cell.dataset.day;
      if (!iso) return;
      var list = document.getElementById('rc-list-' + iso);
      if (!list) return;
      var open = !list.hidden;
      var month = cell.closest('.reading-cal__month');
      if (month) {
        month.querySelectorAll('.reading-cal__list').forEach(function (l) { l.hidden = true; });
        month.querySelectorAll('.reading-cal__day-trigger').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      }
      if (!open) {
        list.hidden = false;
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
