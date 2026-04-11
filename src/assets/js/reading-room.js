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
  var trysteroLoaded = false;
  var joinRoomFn = null;

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function updatePanel() {
    var peerList = Object.values(peers);
    var count = peerList.length;
    var countText = count === 0 ? 'Just you' : count + ' other' + (count !== 1 ? 's' : '') + ' reading';

    var html = '<div class="rr__header">' +
      '<span class="rr__count">' + countText + '</span>' +
      '<button class="rr__close" type="button" aria-label="Close">&#10005;</button>' +
      '</div>';

    if (!joined) {
      html += '<div class="rr__join">' +
        '<input class="rr__name-input" type="text" id="rr-name" placeholder="Your name (optional)" value="' + esc(myName) + '" maxlength="30">' +
        '<button class="rr__join-btn" type="button" id="rr-join-btn">' + (trysteroLoaded ? 'Join Room' : 'Loading...') + '</button>' +
        '</div>';
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
        joinRoomNow();
      };
    }

    // Bind leave
    var leaveBtn = document.getElementById('rr-leave-btn');
    if (leaveBtn) leaveBtn.onclick = leaveRoom;

    // Update button badge
    btn.dataset.count = joined ? (count + 1) : '';
  }

  function joinRoomNow() {
    if (room || !joinRoomFn) return;

    try {
      room = joinRoomFn({ appId: APP_ID }, roomId);
    } catch (e) {
      console.warn('Reading room: could not join', e);
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

  // Load Trystero lazily on first panel open
  import('https://esm.sh/trystero/torrent').then(function (mod) {
    joinRoomFn = mod.joinRoom;
    trysteroLoaded = true;
    if (!panel.hidden) updatePanel();
  }).catch(function (e) {
    console.warn('Reading room: failed to load Trystero', e);
  });

  updatePanel();
  panel.hidden = true;
}
