/* ============================================================
   THE FREETHINKING TIMES — Reading Room
   Peer-to-peer presence via Trystero (WebRTC/BitTorrent)
   Shows who else is reading the same page in real time.
   ============================================================ */

var btn = document.getElementById('reading-room-btn');
var panel = document.getElementById('reading-room-panel');

if (btn && panel) {
  var APP_ID = 'tft-reading-room';
  var roomId = location.pathname.replace(/\/$/, '') || '/';
  var room = null;
  var peers = {};
  var myName = localStorage.getItem('tft-room-name') || '';
  var joined = false;
  var joinRoomFn = null;
  var loadError = false;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function updatePanel() {
    var peerList = Object.values(peers);
    var count = peerList.length;

    var html = '<div class="rr__header">' +
      '<span class="rr__count">' + (joined ? (count === 0 ? 'Just you' : count + ' other' + (count !== 1 ? 's' : '') + ' reading') : 'Reading Room') + '</span>' +
      '<button class="rr__close" type="button" aria-label="Close">&#10005;</button>' +
      '</div>';

    if (loadError) {
      html += '<p class="rr__empty">Could not connect. Try refreshing the page.</p>';
    } else if (!joined) {
      html += '<div class="rr__join">' +
        '<input class="rr__name-input" type="text" id="rr-name" placeholder="Your name (optional)" value="' + esc(myName) + '" maxlength="30">' +
        '<button class="rr__join-btn" type="button" id="rr-join-btn">Join Room</button>' +
        '</div>' +
        '<p class="rr__empty">See who else is reading this page. Peer-to-peer — no server, no tracking.</p>';
    } else {
      if (peerList.length) {
        html += '<ul class="rr__peers">';
        peerList.forEach(function (p) {
          html += '<li class="rr__peer"><span class="rr__peer-dot"></span>' + esc(p.name || 'Anonymous reader') + '</li>';
        });
        html += '</ul>';
      } else {
        html += '<p class="rr__empty">No one else is here yet. Share this page to read together.</p>';
      }
      html += '<button class="rr__leave" type="button" id="rr-leave-btn">Leave Room</button>';
    }

    panel.innerHTML = html;

    // Bind close
    var closeBtn = panel.querySelector('.rr__close');
    if (closeBtn) closeBtn.onclick = function () { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); };

    // Bind join
    var joinBtn = document.getElementById('rr-join-btn');
    if (joinBtn) {
      joinBtn.onclick = function () {
        var nameInput = document.getElementById('rr-name');
        myName = nameInput ? nameInput.value.trim() : '';
        if (myName) localStorage.setItem('tft-room-name', myName);
        joinBtn.textContent = 'Connecting...';
        joinBtn.disabled = true;
        loadAndJoin();
      };
    }

    // Bind leave
    var leaveBtn = document.getElementById('rr-leave-btn');
    if (leaveBtn) leaveBtn.onclick = leaveRoom;

    // Update button badge
    btn.dataset.count = joined ? (count + 1) : '';
  }

  function loadAndJoin() {
    if (joinRoomFn) {
      joinRoomNow();
      return;
    }

    // Load Trystero only when user clicks Join
    import('/assets/js/trystero-torrent.bundle.mjs').then(function (mod) {
      joinRoomFn = mod.joinRoom;
      joinRoomNow();
    }).catch(function (e) {
      console.warn('Reading room: failed to load', e);
      loadError = true;
      updatePanel();
    });
  }

  function joinRoomNow() {
    if (room || !joinRoomFn) return;

    try {
      room = joinRoomFn({ appId: APP_ID }, roomId);
    } catch (e) {
      console.warn('Reading room: could not join', e);
      loadError = true;
      updatePanel();
      return;
    }

    joined = true;

    var actions = room.makeAction('presence');
    var sendPresence = actions[0];
    var getPresence = actions[1];

    room.onPeerJoin(function (peerId) {
      sendPresence({ name: myName }, peerId);
    });

    getPresence(function (data, peerId) {
      peers[peerId] = { name: data.name || '' };
      updatePanel();
    });

    room.onPeerLeave(function (peerId) {
      delete peers[peerId];
      updatePanel();
    });

    sendPresence({ name: myName });
    updatePanel();
  }

  function leaveRoom() {
    if (room) {
      room.leave();
      room = null;
    }
    joined = false;
    peers = {};
    updatePanel();
  }

  // Toggle panel
  btn.onclick = function () {
    var isHidden = panel.hidden;
    panel.hidden = !isHidden;
    btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
    if (isHidden) updatePanel();
  };

  panel.hidden = true;
}
