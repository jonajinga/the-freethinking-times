/* ============================================================
   THE FREETHINKING TIMES — Interactive Events Calendar
   Month / Week / Day / List views with filtering and popups
   ============================================================ */
(function () {
  'use strict';

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let allEvents = [];
  let currentView = 'month';
  let currentDate = new Date();
  let filterType = '';
  let filterRegion = '';
  let showPast = false;

  /* ── Init ──────────────────────────────────────────────────── */
  function init() {
    const container = document.getElementById('cal-root');
    if (!container) return;

    const dataEl = document.getElementById('cal-data');
    if (dataEl) {
      try {
        allEvents = JSON.parse(dataEl.textContent);
      } catch (e) {
        allEvents = [];
      }
    }

    // Detect mobile — default to list view
    if (window.innerWidth <= 768) {
      currentView = 'list';
    }

    render();
  }

  /* ── Helpers ───────────────────────────────────────────────── */
  function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function fmtDateShort(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function dateKey(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function isToday(d) {
    const t = new Date();
    return d.getFullYear() === t.getFullYear() &&
           d.getMonth() === t.getMonth() &&
           d.getDate() === t.getDate();
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  function startOfWeek(d) {
    const r = new Date(d);
    r.setDate(r.getDate() - r.getDay());
    return r;
  }

  function eventOnDate(evt, d) {
    const key = dateKey(d);
    if (evt.date === key) return true;
    if (evt.endDate) {
      return evt.date <= key && key <= evt.endDate;
    }
    return false;
  }

  function filteredEvents() {
    const today = dateKey(new Date());
    return allEvents.filter(function (e) {
      if (filterType && e.type !== filterType) return false;
      if (filterRegion && e.region !== filterRegion) return false;
      if (!showPast && e.date < today && (!e.endDate || e.endDate < today)) return false;
      if (showPast && (e.date >= today || (e.endDate && e.endDate >= today))) return false;
      return true;
    });
  }

  function eventsForDate(d) {
    return filteredEvents().filter(function (e) { return eventOnDate(e, d); });
  }

  function typeName(t) {
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
  }

  function dateRange(evt) {
    var s = fmtDate(evt.date);
    if (evt.endDate && evt.endDate !== evt.date) {
      s += ' — ' + fmtDate(evt.endDate);
    }
    return s;
  }

  /* ── Popup ─────────────────────────────────────────────────── */
  function showPopup(evt) {
    // Remove any existing popup
    closePopup();

    var overlay = document.createElement('div');
    overlay.className = 'cal-popup-overlay';
    overlay.onclick = function (e) { if (e.target === overlay) closePopup(); };

    var popup = document.createElement('div');
    popup.className = 'cal-popup';
    if (evt.type) {
      popup.style.borderTopColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-' + typeColor(evt.type)).trim() || '';
    }

    popup.innerHTML =
      '<button class="cal-popup__close" onclick="document.querySelector(\'.cal-popup-overlay\').remove()" aria-label="Close">&times;</button>' +
      '<p class="cal-popup__type cal-popup__type--' + (evt.type || '') + '">' + typeName(evt.type) + '</p>' +
      '<h2 class="cal-popup__name">' + esc(evt.name) + '</h2>' +
      '<p class="cal-popup__detail"><strong>Date:</strong> ' + dateRange(evt) + '</p>' +
      '<p class="cal-popup__detail"><strong>Location:</strong> ' + esc(evt.location) + '</p>' +
      (evt.region ? '<p class="cal-popup__detail"><strong>Region:</strong> ' + esc(evt.region) + '</p>' : '') +
      '<p class="cal-popup__desc">' + esc(evt.description) + '</p>' +
      (evt.url && evt.url !== '#' ? '<a class="cal-popup__link" href="' + esc(evt.url) + '" target="_blank" rel="noopener noreferrer">Visit website &rarr;</a>' : '');

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Close on Escape
    document.addEventListener('keydown', escHandler);
  }

  function closePopup() {
    var existing = document.querySelector('.cal-popup-overlay');
    if (existing) existing.remove();
    document.removeEventListener('keydown', escHandler);
  }

  function escHandler(e) {
    if (e.key === 'Escape') closePopup();
  }

  function typeColor(type) {
    var map = {
      conference: 'opinion',
      convention: 'accent',
      meetup: 'science',
      online: 'arts-culture',
      observance: 'history'
    };
    return map[type] || 'accent';
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  /* ── Render ────────────────────────────────────────────────── */
  function render() {
    var container = document.getElementById('cal-root');
    if (!container) return;

    var html = renderControls();

    switch (currentView) {
      case 'month': html += renderMonth(); break;
      case 'week':  html += renderWeek(); break;
      case 'day':   html += renderDay(); break;
      case 'list':  html += renderList(); break;
    }

    html += renderLegend();
    container.innerHTML = html;
    bindControls();
  }

  /* ── Controls ──────────────────────────────────────────────── */
  function renderControls() {
    var viewBtns = ['month', 'week', 'day', 'list'].map(function (v) {
      return '<button class="cal-controls__btn' + (currentView === v ? ' cal-controls__btn--active' : '') +
        '" data-view="' + v + '">' + v.charAt(0).toUpperCase() + v.slice(1) + '</button>';
    }).join('');

    var title = '';
    if (currentView === 'month') {
      title = MONTHS[currentDate.getMonth()] + ' ' + currentDate.getFullYear();
    } else if (currentView === 'week') {
      var ws = startOfWeek(currentDate);
      var we = new Date(ws);
      we.setDate(we.getDate() + 6);
      title = fmtDateShort(dateKey(ws)) + ' — ' + fmtDateShort(dateKey(we)) + ', ' + we.getFullYear();
    } else if (currentView === 'day') {
      title = fmtDate(dateKey(currentDate));
    } else {
      title = showPast ? 'Past Events' : 'Upcoming Events';
    }

    // Build type options from data
    var types = [];
    allEvents.forEach(function (e) {
      if (e.type && types.indexOf(e.type) === -1) types.push(e.type);
    });
    var typeOpts = '<option value="">All Types</option>' + types.map(function (t) {
      return '<option value="' + t + '"' + (filterType === t ? ' selected' : '') + '>' + typeName(t) + '</option>';
    }).join('');

    // Build region options
    var regions = [];
    allEvents.forEach(function (e) {
      if (e.region && regions.indexOf(e.region) === -1) regions.push(e.region);
    });
    regions.sort();
    var regionOpts = '<option value="">All Regions</option>' + regions.map(function (r) {
      return '<option value="' + r + '"' + (filterRegion === r ? ' selected' : '') + '>' + r + '</option>';
    }).join('');

    return '<div class="cal-controls">' +
      '<div class="cal-controls__nav">' +
        '<button class="cal-controls__btn" data-nav="prev">&laquo; Prev</button>' +
        '<button class="cal-controls__btn" data-nav="today">Today</button>' +
        '<button class="cal-controls__btn" data-nav="next">Next &raquo;</button>' +
      '</div>' +
      '<div class="cal-controls__title">' + title + '</div>' +
      '<div class="cal-controls__views">' + viewBtns + '</div>' +
      '<div class="cal-controls__filters">' +
        '<select class="cal-controls__select" id="cal-filter-type">' + typeOpts + '</select>' +
        '<select class="cal-controls__select" id="cal-filter-region">' + regionOpts + '</select>' +
        '<div class="cal-controls__toggle">' +
          '<button class="cal-controls__btn' + (!showPast ? ' cal-controls__btn--active' : '') + '" data-time="upcoming">Upcoming</button>' +
          '<button class="cal-controls__btn' + (showPast ? ' cal-controls__btn--active' : '') + '" data-time="past">Past</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function bindControls() {
    var container = document.getElementById('cal-root');

    // View buttons
    container.querySelectorAll('[data-view]').forEach(function (btn) {
      btn.onclick = function () {
        currentView = btn.dataset.view;
        // On mobile, force list if month/week selected
        if (window.innerWidth <= 768 && (currentView === 'month' || currentView === 'week')) {
          currentView = 'list';
        }
        render();
      };
    });

    // Nav buttons
    container.querySelectorAll('[data-nav]').forEach(function (btn) {
      btn.onclick = function () {
        if (btn.dataset.nav === 'today') {
          currentDate = new Date();
        } else if (btn.dataset.nav === 'prev') {
          navigate(-1);
        } else {
          navigate(1);
        }
        render();
      };
    });

    // Time toggle
    container.querySelectorAll('[data-time]').forEach(function (btn) {
      btn.onclick = function () {
        showPast = btn.dataset.time === 'past';
        render();
      };
    });

    // Filters
    var typeSelect = document.getElementById('cal-filter-type');
    if (typeSelect) {
      typeSelect.onchange = function () {
        filterType = typeSelect.value;
        render();
      };
    }

    var regionSelect = document.getElementById('cal-filter-region');
    if (regionSelect) {
      regionSelect.onchange = function () {
        filterRegion = regionSelect.value;
        render();
      };
    }

    // Event clicks (list/day view)
    container.querySelectorAll('[data-evt-idx]').forEach(function (el) {
      el.onclick = function () {
        var idx = parseInt(el.dataset.evtIdx, 10);
        if (allEvents[idx]) showPopup(allEvents[idx]);
      };
    });

    // Day cell clicks (month view)
    container.querySelectorAll('[data-day-key]').forEach(function (el) {
      el.onclick = function (e) {
        // If clicking an event label, show popup instead
        if (e.target.dataset.evtIdx !== undefined) {
          var idx = parseInt(e.target.dataset.evtIdx, 10);
          if (allEvents[idx]) showPopup(allEvents[idx]);
          return;
        }
        var parts = el.dataset.dayKey.split('-');
        currentDate = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        currentView = 'day';
        render();
      };
    });
  }

  function navigate(dir) {
    if (currentView === 'month') {
      currentDate.setMonth(currentDate.getMonth() + dir);
    } else if (currentView === 'week') {
      currentDate.setDate(currentDate.getDate() + dir * 7);
    } else if (currentView === 'day') {
      currentDate.setDate(currentDate.getDate() + dir);
    } else {
      // List view — navigate months
      currentDate.setMonth(currentDate.getMonth() + dir);
    }
  }

  /* ── Month View ────────────────────────────────────────────── */
  function renderMonth() {
    var year = currentDate.getFullYear();
    var month = currentDate.getMonth();
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var prevMonthDays = new Date(year, month, 0).getDate();

    var html = '<div class="cal-month">';

    // Headers
    for (var i = 0; i < 7; i++) {
      html += '<div class="cal-month__header">' + DAYS[i] + '</div>';
    }

    // Previous month fill
    for (var p = firstDay - 1; p >= 0; p--) {
      var pDay = prevMonthDays - p;
      var pDate = new Date(year, month - 1, pDay);
      html += '<div class="cal-month__day cal-month__day--outside">' +
        '<span class="cal-month__num">' + pDay + '</span>' +
        '</div>';
    }

    // Current month days
    for (var d = 1; d <= daysInMonth; d++) {
      var thisDate = new Date(year, month, d);
      var key = dateKey(thisDate);
      var todayCls = isToday(thisDate) ? ' cal-month__day--today' : '';
      var dayEvents = eventsForDate(thisDate);

      html += '<div class="cal-month__day' + todayCls + '" data-day-key="' + key + '">';
      html += '<span class="cal-month__num">' + d + '</span>';

      dayEvents.forEach(function (evt) {
        var idx = allEvents.indexOf(evt);
        html += '<div class="cal-month__evt-label cal-month__evt-label--' + (evt.type || '') + '" data-evt-idx="' + idx + '" title="' + esc(evt.name) + '">' + esc(evt.name) + '</div>';
      });

      html += '</div>';
    }

    // Next month fill
    var totalCells = firstDay + daysInMonth;
    var remaining = (7 - (totalCells % 7)) % 7;
    for (var n = 1; n <= remaining; n++) {
      html += '<div class="cal-month__day cal-month__day--outside">' +
        '<span class="cal-month__num">' + n + '</span>' +
        '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ── Week View ─────────────────────────────────────────────── */
  function renderWeek() {
    var ws = startOfWeek(currentDate);
    var html = '<div class="cal-week">';

    for (var i = 0; i < 7; i++) {
      var d = new Date(ws);
      d.setDate(d.getDate() + i);
      var dayEvts = eventsForDate(d);

      html += '<div class="cal-week__day">';
      html += '<div class="cal-week__day-header">' + DAYS[i] + '<span>' + d.getDate() + '</span></div>';

      dayEvts.forEach(function (evt) {
        var idx = allEvents.indexOf(evt);
        html += '<div class="cal-week__evt cal-week__evt--' + (evt.type || '') + '" data-evt-idx="' + idx + '">' +
          esc(evt.name) + '</div>';
      });

      html += '</div>';
    }

    html += '</div>';
    return html;
  }

  /* ── Day View ──────────────────────────────────────────────── */
  function renderDay() {
    var dayEvts = eventsForDate(currentDate);
    var html = '<div class="cal-day">';
    html += '<div class="cal-day__header">' + fmtDate(dateKey(currentDate)) + '</div>';

    if (dayEvts.length === 0) {
      html += '<p class="cal-day__empty">No events on this date.</p>';
    } else {
      dayEvts.forEach(function (evt) {
        html += renderEventCard(evt);
      });
    }

    html += '</div>';
    return html;
  }

  /* ── List View ─────────────────────────────────────────────── */
  function renderList() {
    var events = filteredEvents();
    events.sort(function (a, b) {
      if (showPast) return b.date.localeCompare(a.date);
      return a.date.localeCompare(b.date);
    });

    var html = '<div class="cal-list">';

    if (events.length === 0) {
      html += '<p class="cal-day__empty">' + (showPast ? 'No past events match your filters.' : 'No upcoming events match your filters.') + '</p>';
    } else {
      events.forEach(function (evt) {
        html += renderEventCard(evt);
      });
    }

    html += '</div>';
    return html;
  }

  /* ── Event Card (shared) ───────────────────────────────────── */
  function renderEventCard(evt) {
    var idx = allEvents.indexOf(evt);
    return '<div class="cal-event cal-event--' + (evt.type || '') + '" data-evt-idx="' + idx + '">' +
      '<p class="cal-event__meta">' + dateRange(evt) + ' &middot; ' + esc(evt.location) +
        '<span class="cal-event__badge cal-event__badge--' + (evt.type || '') + '">' + typeName(evt.type) + '</span>' +
      '</p>' +
      '<h3 class="cal-event__name">' + esc(evt.name) + '</h3>' +
      '<p class="cal-event__desc">' + esc(evt.description) + '</p>' +
    '</div>';
  }

  /* ── Legend ────────────────────────────────────────────────── */
  function renderLegend() {
    var types = [
      { type: 'conference', label: 'Conference' },
      { type: 'convention', label: 'Convention' },
      { type: 'meetup', label: 'Meetup' },
      { type: 'online', label: 'Online' },
      { type: 'observance', label: 'Observance' }
    ];

    return '<div class="cal-legend">' +
      types.map(function (t) {
        return '<div class="cal-legend__item">' +
          '<span class="cal-legend__dot cal-legend__dot--' + t.type + '"></span>' +
          t.label +
        '</div>';
      }).join('') +
    '</div>';
  }

  /* ── Start ─────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
