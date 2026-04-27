/**
 * Editorial calendar — renders publish dates from the JSON in
 * #ed-cal-data into a month-by-month grid. Each day cell shows the
 * count of articles published; clicking the cell expands a list of
 * those articles. Public read surface, no localStorage.
 */
(function () {
  'use strict';

  function init() {
    var dataNode = document.getElementById('ed-cal-data');
    var mount    = document.getElementById('ed-cal-mount');
    if (!dataNode || !mount) return;

    var items = [];
    try { items = JSON.parse(dataNode.textContent.trim()); } catch (e) { items = []; }
    if (!items.length) {
      mount.innerHTML = '<p class="ed-cal__empty">No articles to display yet.</p>';
      return;
    }

    // Index articles by ISO date (yyyy-mm-dd) and by month (yyyy-mm).
    var byDate  = Object.create(null);
    var monthSet = new Set();
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it.date) continue;
      var d = it.date.slice(0, 10);
      var ym = d.slice(0, 7);
      monthSet.add(ym);
      (byDate[d] = byDate[d] || []).push(it);
    }
    var months = [...monthSet].sort().reverse(); // newest first

    var monthFmt = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' });
    var dayFmt   = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

    function buildMonthGrid(ym) {
      var parts = ym.split('-');
      var year  = +parts[0];
      var month = +parts[1] - 1; // 0-indexed
      var first = new Date(year, month, 1);
      var lastDay = new Date(year, month + 1, 0).getDate();
      var leading = first.getDay(); // 0 = Sunday

      var html = '<section class="ed-cal__month" aria-labelledby="ed-cal-' + ym + '">';
      html += '<h2 class="ed-cal__month-title" id="ed-cal-' + ym + '">' + monthFmt.format(first) + '</h2>';
      html += '<div class="ed-cal__weekdays" aria-hidden="true">'
            + ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(function (d) {
                return '<span>' + d + '</span>';
              }).join('')
            + '</div>';
      html += '<div class="ed-cal__grid" role="grid">';

      for (var p = 0; p < leading; p++) {
        html += '<div class="ed-cal__cell ed-cal__cell--blank" role="gridcell" aria-hidden="true"></div>';
      }
      for (var d = 1; d <= lastDay; d++) {
        var iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        var dayItems = byDate[iso] || [];
        var count = dayItems.length;
        var hasItems = count > 0;
        html += '<div class="ed-cal__cell' + (hasItems ? ' ed-cal__cell--has-items' : '') + '" role="gridcell" data-day="' + iso + '">'
              + '<div class="ed-cal__day-num">' + d + '</div>'
              + (hasItems
                  ? '<button class="ed-cal__day-trigger" type="button" aria-expanded="false" aria-controls="ed-cal-list-' + iso + '" aria-label="' + dayFmt.format(new Date(year, month, d)) + ', ' + count + ' article' + (count > 1 ? 's' : '') + '"><span class="ed-cal__day-count">' + count + '</span></button>'
                  : '')
              + '</div>';
      }
      html += '</div>'; // /grid

      // Day-list popouts (rendered once per month at the bottom; the cell
      // button toggles them via aria-controls + a small click handler).
      var dates = Object.keys(byDate).filter(function (k) { return k.slice(0, 7) === ym; }).sort();
      if (dates.length) {
        html += '<div class="ed-cal__lists">';
        dates.forEach(function (iso) {
          var dayItems = byDate[iso];
          html += '<div class="ed-cal__list" id="ed-cal-list-' + iso + '" hidden>';
          html += '<p class="ed-cal__list-head">' + dayFmt.format(new Date(iso + 'T00:00:00')) + '</p>';
          html += '<ul role="list">' + dayItems.map(function (it) {
            return '<li><a href="' + it.url + '">'
                 + (it.section ? '<span class="ed-cal__list-kicker">' + it.section + '</span>' : '')
                 + '<span class="ed-cal__list-title">' + it.title + '</span>'
                 + (it.author ? '<span class="ed-cal__list-byline">' + it.author + '</span>' : '')
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

    // Wire up day-trigger toggles
    mount.addEventListener('click', function (e) {
      var btn = e.target.closest('.ed-cal__day-trigger');
      if (!btn) return;
      var cell = btn.closest('.ed-cal__cell');
      var iso = cell && cell.dataset.day;
      if (!iso) return;
      var list = document.getElementById('ed-cal-list-' + iso);
      if (!list) return;
      var open = !list.hidden;
      // Close any other open list in this month
      var month = cell.closest('.ed-cal__month');
      if (month) {
        month.querySelectorAll('.ed-cal__list').forEach(function (l) { l.hidden = true; });
        month.querySelectorAll('.ed-cal__day-trigger').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
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
