/**
 * Freethought Music — persistent background YouTube player.
 * Uses YouTube IFrame API. Player persists across page navigation
 * by saving state to localStorage and resuming on each page load.
 */
(function () {
  'use strict';

  var _p = window.__PREFIX || 'tft';
  var K = {
    playlist: _p + '-music-playlist',
    name: _p + '-music-name',
    playing: _p + '-music-playing',
    volume: _p + '-music-volume',
    index: _p + '-music-index',
    time: _p + '-music-time'
  };

  var player = null;
  var ready = false;
  var currentName = '';
  var targetVolume = 80;

  // DOM elements (created dynamically)
  var bar, nameEl, titleEl, playIcon, pauseIcon, volSlider;

  function createPlayerBar() {
    if (document.getElementById('tft-music-bar')) return;

    bar = document.createElement('div');
    bar.id = 'tft-music-bar';
    bar.className = 'music-bar';
    bar.hidden = true;
    bar.innerHTML =
      '<div class="music-bar__info">' +
        '<span class="music-bar__name" id="mb-name"></span>' +
        '<span class="music-bar__title" id="mb-title">Loading...</span>' +
      '</div>' +
      '<div class="music-bar__controls">' +
        '<button type="button" id="mb-prev" class="music-bar__btn" aria-label="Previous">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2"/></svg>' +
        '</button>' +
        '<button type="button" id="mb-play" class="music-bar__btn music-bar__btn--play" aria-label="Play/Pause">' +
          '<svg id="mb-play-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>' +
          '<svg id="mb-pause-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' +
        '</button>' +
        '<button type="button" id="mb-next" class="music-bar__btn" aria-label="Next">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg>' +
        '</button>' +
        '<input type="range" id="mb-vol" min="0" max="100" value="80" class="music-bar__vol" aria-label="Volume">' +
        '<button type="button" id="mb-close" class="music-bar__btn" aria-label="Stop" onclick="window.musicPlayer.stop();">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>';

    document.body.appendChild(bar);

    nameEl = document.getElementById('mb-name');
    titleEl = document.getElementById('mb-title');
    playIcon = document.getElementById('mb-play-icon');
    pauseIcon = document.getElementById('mb-pause-icon');
    volSlider = document.getElementById('mb-vol');

    document.getElementById('mb-play').addEventListener('click', function () {
      if (!player) return;
      var s = player.getPlayerState();
      if (s === YT.PlayerState.PLAYING) player.pauseVideo();
      else player.playVideo();
    });

    document.getElementById('mb-prev').addEventListener('click', function () {
      if (player) { player.previousVideo(); setTimeout(updateNowPlaying, 500); }
    });

    document.getElementById('mb-next').addEventListener('click', function () {
      if (player) { player.nextVideo(); setTimeout(updateNowPlaying, 500); }
    });

    volSlider.addEventListener('input', function () {
      targetVolume = parseInt(this.value, 10);
      if (player) player.setVolume(targetVolume);
      try { localStorage.setItem(K.volume, String(targetVolume)); } catch (e) {}
    });

    // Restore volume
    var savedVol = localStorage.getItem(K.volume);
    if (savedVol) { targetVolume = parseInt(savedVol, 10); volSlider.value = targetVolume; }

    // Create player container
    var wrap = document.createElement('div');
    wrap.id = 'tft-yt-wrap';
    wrap.style.cssText = 'position:fixed;bottom:0;right:0;width:1px;height:1px;overflow:hidden;';
    wrap.innerHTML = '<div id="tft-yt-player"></div>';
    document.body.appendChild(wrap);
  }

  function initPlayer(playlistId, cb, resumeIndex, resumeTime) {
    createPlayerBar();

    if (player) {
      try { player.destroy(); } catch (e) {}
      player = null;
    }

    // Recreate container
    var wrap = document.getElementById('tft-yt-wrap');
    wrap.innerHTML = '<div id="tft-yt-player"></div>';

    player = new YT.Player('tft-yt-player', {
      height: '1',
      width: '1',
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        mute: 1,
        list: playlistId,
        listType: 'playlist'
      },
      events: {
        onReady: function () {
          ready = true;
          player.setVolume(0);
          player.unMute();

          // Resume at saved track and time if provided
          if (resumeIndex > 0 || resumeTime > 0) {
            setTimeout(function () {
              if (player && resumeIndex > 0) player.playVideoAt(resumeIndex);
              setTimeout(function () {
                if (player && resumeTime > 0) player.seekTo(resumeTime, true);
                // Fade in after seeking
                fadeIn();
              }, 500);
            }, 1000);
          } else {
            fadeIn();
          }

          if (cb) cb();
          setTimeout(updateNowPlaying, 2000);
        },
        onStateChange: function (e) {
          if (e.data === YT.PlayerState.PLAYING) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = '';
            saveState();
          } else {
            playIcon.style.display = '';
            pauseIcon.style.display = 'none';
          }
          updateNowPlaying();
        },
        onError: function () {
          titleEl.textContent = 'Could not load playlist';
        }
      }
    });
  }

  function updateNowPlaying() {
    if (!player || !player.getVideoData) return;
    var d = player.getVideoData();
    if (titleEl) titleEl.textContent = d.title || 'Loading...';
    if (nameEl) nameEl.textContent = currentName;
    saveState();
  }

  function saveState() {
    try {
      if (currentName) localStorage.setItem(K.name, currentName);
      if (player && player.getPlaylist) {
        var pl = player.getPlaylist();
        if (pl) localStorage.setItem(K.playlist, localStorage.getItem(K.playlist) || '');
        localStorage.setItem(K.index, String(player.getPlaylistIndex()));
        localStorage.setItem(K.time, String(Math.floor(player.getCurrentTime())));
        localStorage.setItem(K.playing, '1');
      }
    } catch (e) {}
  }

  function fadeIn() {
    if (!player || !player.setVolume) return;
    // On mobile, skip fade — setVolume in intervals can fail
    var isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobile) {
      player.unMute();
      player.setVolume(targetVolume);
      return;
    }
    var vol = 0;
    var step = targetVolume / 20;
    var iv = setInterval(function () {
      vol += step;
      if (vol >= targetVolume) { vol = targetVolume; clearInterval(iv); }
      if (player && player.setVolume) player.setVolume(Math.round(vol));
    }, 50);
  }

  // Save state frequently so page navigation can resume
  setInterval(function () { if (player && ready) { updateNowPlaying(); saveState(); } }, 2000);

  // Save on page unload
  window.addEventListener('beforeunload', saveState);

  // Public API
  window.musicPlayer = {
    loadPlaylist: function (id, name) {
      currentName = name || 'Playlist';
      createPlayerBar();
      bar.hidden = false;
      if (nameEl) nameEl.textContent = currentName;
      if (titleEl) titleEl.textContent = 'Loading...';

      try {
        localStorage.setItem(K.playlist, id);
        localStorage.setItem(K.name, currentName);
        localStorage.setItem(K.playing, '1');
      } catch (e) {}

      if (ready || (window.YT && window.YT.Player)) {
        ready = true;
        initPlayer(id);
      } else {
        // Wait for API
        var wait = setInterval(function () {
          if (window.YT && window.YT.Player) {
            clearInterval(wait);
            ready = true;
            initPlayer(id);
          }
        }, 200);
        // Timeout after 10s
        setTimeout(function () { clearInterval(wait); }, 10000);
      }
    },

    stop: function () {
      if (player) {
        try { player.stopVideo(); player.destroy(); } catch (e) {}
        player = null;
      }
      if (bar) bar.hidden = true;
      try {
        localStorage.removeItem(K.playing);
        localStorage.removeItem(K.playlist);
      } catch (e) {}
    }
  };

  // Auto-resume on page load if was playing
  var wasPlaying = localStorage.getItem(K.playing) === '1';
  var savedPlaylist = localStorage.getItem(K.playlist);
  var savedName = localStorage.getItem(K.name);
  var savedIndex = parseInt(localStorage.getItem(K.index), 10) || 0;
  var savedTime = parseInt(localStorage.getItem(K.time), 10) || 0;

  if (wasPlaying && savedPlaylist) {
    var resumeCheck = setInterval(function () {
      if (window.YT && window.YT.Player) {
        clearInterval(resumeCheck);
        ready = true;
        currentName = savedName || 'Playlist';
        createPlayerBar();
        bar.hidden = false;
        if (nameEl) nameEl.textContent = currentName;
        if (titleEl) titleEl.textContent = 'Resuming...';
        initPlayer(savedPlaylist, null, savedIndex, savedTime);
      }
    }, 300);
    setTimeout(function () { clearInterval(resumeCheck); }, 10000);
  }
})();
