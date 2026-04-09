/**
 * Ticker strip — rotating stock market, world time, and weather feeds.
 * Fades between feeds every 8 seconds. No scrolling.
 */
(function () {
  'use strict';

  var content = document.getElementById('ticker-content');
  var label   = document.getElementById('ticker-label');
  if (!content || !label) return;

  var ROTATE_MS      = 8000;
  var STOCK_REFRESH   = 300000;
  var WEATHER_REFRESH = 1800000;
  var TIME_REFRESH    = 60000;

  var FEEDS = ['stocks', 'time', 'weather'];
  var LABELS = { stocks: 'MARKETS', time: 'WORLD TIME', weather: 'WEATHER' };
  var currentFeed = 0;
  var rotateTimer = null;

  // ── Stock config ─────────────────────────────────────────────

  var SYMBOLS = [
    { id: 'GSPC',  label: 'S&P 500' },
    { id: 'DJI',   label: 'DOW' },
    { id: 'IXIC',  label: 'NASDAQ' },
    { id: 'RUT',   label: 'R2000' },
    { id: 'FTSE',  label: 'FTSE' },
    { id: 'GDAXI', label: 'DAX' },
    { id: 'N225',  label: 'NIKKEI' },
    { id: 'HSI',   label: 'HANG SENG' }
  ];

  var CRYPTO = [
    { id: 'bitcoin',  label: 'BTC' },
    { id: 'ethereum', label: 'ETH' }
  ];

  var COMMODITIES = [
    { id: 'GC=F', label: 'GOLD' },
    { id: 'CL=F', label: 'OIL' }
  ];

  // ── Cities ───────────────────────────────────────────────────

  var CITIES = [
    { name: 'New York',    tz: 'America/New_York',    lat: 40.71, lon: -74.01 },
    { name: 'London',      tz: 'Europe/London',       lat: 51.51, lon: -0.13 },
    { name: 'Paris',       tz: 'Europe/Paris',        lat: 48.86, lon: 2.35 },
    { name: 'Berlin',      tz: 'Europe/Berlin',       lat: 52.52, lon: 13.41 },
    { name: 'Dubai',       tz: 'Asia/Dubai',          lat: 25.20, lon: 55.27 },
    { name: 'Mumbai',      tz: 'Asia/Kolkata',        lat: 19.08, lon: 72.88 },
    { name: 'Hong Kong',   tz: 'Asia/Hong_Kong',      lat: 22.32, lon: 114.17 },
    { name: 'Singapore',   tz: 'Asia/Singapore',      lat: 1.35,  lon: 103.82 },
    { name: 'Tokyo',       tz: 'Asia/Tokyo',          lat: 35.68, lon: 139.69 },
    { name: 'Sydney',      tz: 'Australia/Sydney',    lat: -33.87, lon: 151.21 },
    { name: 'São Paulo',   tz: 'America/Sao_Paulo',   lat: -23.55, lon: -46.63 },
    { name: 'Los Angeles', tz: 'America/Los_Angeles', lat: 34.05, lon: -118.24 }
  ];

  // ── Weather icons (WMO codes) ────────────────────────────────

  function weatherIcon(code) {
    if (code === 0) return '\u2600\uFE0F';
    if (code <= 3) return '\u26C5';
    if (code <= 48) return '\uD83C\uDF2B\uFE0F';
    if (code <= 57) return '\uD83C\uDF26\uFE0F';
    if (code <= 67) return '\uD83C\uDF27\uFE0F';
    if (code <= 77) return '\uD83C\uDF28\uFE0F';
    if (code <= 82) return '\uD83C\uDF27\uFE0F';
    if (code <= 86) return '\uD83C\uDF28\uFE0F';
    return '\u26C8\uFE0F';
  }

  // ── Data caches ──────────────────────────────────────────────

  var stockData   = null;
  var weatherData = null;

  // ── Fetch crypto via CoinGecko (CORS-friendly) ───────────────

  function fetchCrypto() {
    var ids = CRYPTO.map(function (c) { return c.id; }).join(',');
    return fetch('https://api.coingecko.com/api/v3/simple/price?ids=' + ids + '&vs_currencies=usd&include_24hr_change=true')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        return CRYPTO.map(function (c) {
          var d = data[c.id];
          if (!d) return null;
          var price = d.usd || 0;
          var pct = d.usd_24h_change || 0;
          return {
            label: c.label,
            price: '$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 }),
            change: pct >= 0 ? 1 : -1,
            pct: pct
          };
        }).filter(Boolean);
      })
      .catch(function () { return []; });
  }

  // ── Fetch stock indexes via CORS proxy ───────────────────────

  function fetchStockIndexes() {
    var symbols = SYMBOLS.map(function (s) { return '%5E' + s.id; })
      .concat(COMMODITIES.map(function (c) { return c.id; }))
      .join(',');
    var yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/spark?symbols=' + symbols + '&range=1d&interval=1d';
    var proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(yahooUrl);

    return fetch(proxyUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var results = [];
        var allItems = SYMBOLS.concat(COMMODITIES);
        allItems.forEach(function (s) {
          var sym = s.id.indexOf('=') !== -1 ? s.id : '^' + s.id;
          var info = data.spark && data.spark.result
            ? data.spark.result.find(function (r) { return r.symbol === sym; })
            : null;
          if (info && info.response && info.response[0] && info.response[0].meta) {
            var meta = info.response[0].meta;
            var price = meta.regularMarketPrice || 0;
            var prev  = meta.previousClose || meta.chartPreviousClose || price;
            var change = price - prev;
            var pct = prev > 0 ? (change / prev) * 100 : 0;
            results.push({
              label: s.label,
              price: price > 1000 ? price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : price.toFixed(2),
              change: change >= 0 ? 1 : -1,
              pct: pct
            });
          }
        });
        return results;
      })
      .catch(function () { return []; });
  }

  function fetchAllStocks() {
    return Promise.all([fetchStockIndexes(), fetchCrypto()])
      .then(function (results) {
        var combined = results[0].concat(results[1]);
        stockData = combined.length ? combined : null;
        return stockData;
      });
  }

  // ── Generate times ───────────────────────────────────────────

  function generateTimes() {
    return CITIES.map(function (city) {
      try {
        return {
          city: city.name,
          time: new Intl.DateTimeFormat('en-US', {
            timeZone: city.tz, hour: 'numeric', minute: '2-digit', hour12: true
          }).format(new Date())
        };
      } catch (e) {
        return { city: city.name, time: '--:--' };
      }
    });
  }

  // ── Fetch weather ────────────────────────────────────────────

  function fetchWeather() {
    try {
      var raw = sessionStorage.getItem('tft-weather');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed.ts && Date.now() - parsed.ts < WEATHER_REFRESH) {
          weatherData = parsed.data;
          return Promise.resolve(parsed.data);
        }
      }
    } catch (e) {}

    var lats = CITIES.map(function (c) { return c.lat; }).join(',');
    var lons = CITIES.map(function (c) { return c.lon; }).join(',');

    return fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lats + '&longitude=' + lons + '&current=temperature_2m,weather_code&temperature_unit=fahrenheit')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var entries = Array.isArray(data) ? data : [data];
        var results = CITIES.map(function (city, i) {
          var e = entries[i];
          if (e && e.current) {
            return {
              city: city.name,
              temp: Math.round(e.current.temperature_2m) + '\u00B0F',
              icon: weatherIcon(e.current.weather_code)
            };
          }
          return { city: city.name, temp: '--', icon: '\u2601\uFE0F' };
        });
        weatherData = results;
        try { sessionStorage.setItem('tft-weather', JSON.stringify({ ts: Date.now(), data: results })); } catch (e) {}
        return results;
      })
      .catch(function () { weatherData = null; return null; });
  }

  // ── Render helpers ───────────────────────────────────────────

  function renderStocks(data) {
    if (!data || !data.length) return '<span class="ticker-item" style="color:var(--color-ink-faint)">Market data loading\u2026</span>';
    return data.map(function (s) {
      var arrow = s.change >= 0 ? '\u25B2' : '\u25BC';
      var cls = s.change >= 0 ? 'ticker-item__change--up' : 'ticker-item__change--down';
      return '<span class="ticker-item">' +
        '<span class="ticker-item__symbol">' + s.label + '</span> ' +
        '<span class="ticker-item__price">' + s.price + '</span> ' +
        '<span class="' + cls + '">' + arrow + ' ' + Math.abs(s.pct).toFixed(2) + '%</span>' +
        '</span>';
    }).join('<span class="ticker-sep">\u00B7</span>');
  }

  function renderTimes(data) {
    return data.map(function (t) {
      return '<span class="ticker-item">' +
        '<span class="ticker-item__symbol">' + t.city + '</span> ' +
        '<span class="ticker-item__price">' + t.time + '</span>' +
        '</span>';
    }).join('<span class="ticker-sep">\u00B7</span>');
  }

  function renderWeather(data) {
    if (!data || !data.length) return '<span class="ticker-item" style="color:var(--color-ink-faint)">Weather loading\u2026</span>';
    return data.map(function (w) {
      return '<span class="ticker-item">' +
        '<span class="ticker-item__icon">' + w.icon + '</span> ' +
        '<span class="ticker-item__symbol">' + w.city + '</span> ' +
        '<span class="ticker-item__price">' + w.temp + '</span>' +
        '</span>';
    }).join('<span class="ticker-sep">\u00B7</span>');
  }

  // ── Feed display (fade in/out) ───────────────────────────────

  function showFeed(feedName) {
    var html;
    if (feedName === 'stocks') html = renderStocks(stockData);
    else if (feedName === 'time') html = renderTimes(generateTimes());
    else html = renderWeather(weatherData);

    content.classList.add('is-fading');
    label.style.opacity = '0';

    setTimeout(function () {
      label.textContent = LABELS[feedName];
      content.innerHTML = html;
      content.classList.remove('is-fading');
      label.style.opacity = '1';
    }, 400);
  }

  function rotateFeed() {
    currentFeed = (currentFeed + 1) % FEEDS.length;
    showFeed(FEEDS[currentFeed]);
  }

  // ── Init ─────────────────────────────────────────────────────

  // Show times immediately (no API call needed)
  label.textContent = LABELS.time;
  content.innerHTML = renderTimes(generateTimes());
  currentFeed = 1;

  // Fetch stocks + weather, then start rotation
  Promise.all([fetchAllStocks(), fetchWeather()]).then(function () {
    rotateTimer = setInterval(rotateFeed, ROTATE_MS);
  });

  // Periodic refreshes
  setInterval(fetchAllStocks, STOCK_REFRESH);
  setInterval(fetchWeather, WEATHER_REFRESH);
  setInterval(function () {
    if (FEEDS[currentFeed] === 'time') {
      content.innerHTML = renderTimes(generateTimes());
    }
  }, TIME_REFRESH);

})();
