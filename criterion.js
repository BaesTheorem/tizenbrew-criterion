/* TizenBrew module: Criterion Channel on a Samsung TV remote.
 *
 * The site is built for a mouse, so the remote drives a cursor: arrows move
 * it, Enter clicks what is under it, Return goes back. Media keys reach the
 * <video> directly. The script is injected into every document, including
 * the player iframe, so a click over an iframe is forwarded to the script
 * running inside that iframe, which clicks at the same point in its own
 * coordinates. Only the top document draws the cursor.
 */
(function () {
  'use strict';
  if (window.__tbCriterion) return;
  window.__tbCriterion = true;

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, RETURN: 10009,
    PLAYPAUSE: 10252, PLAY: 415, PAUSE: 19, STOP: 413, REW: 412, FF: 417,
    CHUP: 427, CHDOWN: 428, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406 };
  var isTop = (window === window.top);
  var SEEK = 10;

  function video() { return document.querySelector('video'); }

  function media(action) {
    var v = video();
    if (v) {
      if (action === 'toggle') { if (v.paused) { v.play(); } else { v.pause(); } }
      else if (action === 'play') { v.play(); }
      else if (action === 'pause') { v.pause(); }
      else if (action === 'stop') { v.pause(); v.currentTime = 0; }
      else if (action === 'rew') { v.currentTime = Math.max(0, v.currentTime - SEEK); }
      else if (action === 'ff') { v.currentTime = v.currentTime + SEEK; }
      return true;
    }
    return false;
  }

  function broadcast(msg) {
    var frames = document.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i++) {
      try { frames[i].contentWindow.postMessage(msg, '*'); } catch (e) {}
    }
  }

  function clickAt(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) return;
    if (el.tagName === 'IFRAME') {
      var r = el.getBoundingClientRect();
      try { el.contentWindow.postMessage({ tbc: 'click', x: x - r.left, y: y - r.top }, '*'); } catch (e) {}
      return;
    }
    var opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
    ['mouseover', 'mousemove', 'mousedown', 'mouseup', 'click'].forEach(function (t) {
      el.dispatchEvent(new MouseEvent(t, opts));
    });
    if (el.focus && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) el.focus();
  }

  function typingTarget() {
    var a = document.activeElement;
    return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable);
  }

  // Every frame: answer forwarded clicks and media commands.
  window.addEventListener('message', function (ev) {
    var d = ev.data;
    if (!d || !d.tbc) return;
    if (d.tbc === 'click') clickAt(d.x, d.y);
    else if (d.tbc === 'media') media(d.action);
  });

  if (!isTop) return;

  // Top frame only: the cursor.
  var cur = null, x = window.innerWidth / 2, y = window.innerHeight / 2;
  var vel = 0, lastKey = 0, lastDir = 0, hideTimer = null;

  function ensureCursor() {
    if (cur || !document.body) return;
    cur = document.createElement('div');
    cur.id = 'tb-cursor';
    cur.style.cssText = 'position:fixed;z-index:2147483647;width:30px;height:30px;margin:-15px 0 0 -15px;' +
      'border-radius:50%;border:3px solid #fff;background:rgba(0,0,0,.45);box-shadow:0 0 6px rgba(0,0,0,.8);' +
      'pointer-events:none;transition:opacity .2s;';
    document.body.appendChild(cur);
    place();
  }

  function place() {
    if (!cur) return;
    cur.style.left = x + 'px';
    cur.style.top = y + 'px';
    cur.style.opacity = '1';
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { if (cur) cur.style.opacity = '0'; }, 4000);
  }

  function move(dx, dy, code) {
    var now = Date.now();
    vel = (code === lastDir && now - lastKey < 180) ? Math.min(vel + 6, 60) : 14;
    lastKey = now; lastDir = code;
    x += dx * vel; y += dy * vel;
    var W = window.innerWidth, H = window.innerHeight, edge = 40;
    if (y > H - edge) { window.scrollBy(0, vel * 2); y = H - edge; }
    if (y < edge) { window.scrollBy(0, -vel * 2); y = edge; }
    x = Math.max(4, Math.min(W - 4, x));
    y = Math.max(4, Math.min(H - 4, y));
    ensureCursor(); place();
    var el = document.elementFromPoint(x, y);
    if (el) el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: x, clientY: y }));
  }

  function press() {
    ensureCursor();
    if (cur) { cur.style.transform = 'scale(.7)'; setTimeout(function () { cur.style.transform = ''; }, 120); }
    clickAt(x, y);
  }

  document.addEventListener('keydown', function (e) {
    var c = e.keyCode;
    if (typingTarget() && c !== KEY.RETURN) return;  // let the on-screen keyboard own the keys
    switch (c) {
      case KEY.LEFT: move(-1, 0, c); break;
      case KEY.UP: move(0, -1, c); break;
      case KEY.RIGHT: move(1, 0, c); break;
      case KEY.DOWN: move(0, 1, c); break;
      case KEY.ENTER: press(); break;
      case KEY.RETURN:
        if (typingTarget()) { document.activeElement.blur(); break; }
        if (document.fullscreenElement && document.exitFullscreen) { document.exitFullscreen(); break; }
        history.back(); break;
      case KEY.PLAYPAUSE: if (!media('toggle')) broadcast({ tbc: 'media', action: 'toggle' }); break;
      case KEY.PLAY: if (!media('play')) broadcast({ tbc: 'media', action: 'play' }); break;
      case KEY.PAUSE: if (!media('pause')) broadcast({ tbc: 'media', action: 'pause' }); break;
      case KEY.STOP: if (!media('stop')) broadcast({ tbc: 'media', action: 'stop' }); break;
      case KEY.REW: if (!media('rew')) broadcast({ tbc: 'media', action: 'rew' }); break;
      case KEY.FF: if (!media('ff')) broadcast({ tbc: 'media', action: 'ff' }); break;
      case KEY.CHUP: window.scrollBy(0, -window.innerHeight * 0.8); break;
      case KEY.CHDOWN: window.scrollBy(0, window.innerHeight * 0.8); break;
      case KEY.RED: location.href = 'https://www.criterionchannel.com/'; break;
      case KEY.GREEN: location.href = 'https://www.criterionchannel.com/browse'; break;
      case KEY.YELLOW: location.href = 'https://www.criterionchannel.com/search'; break;
      case KEY.BLUE: location.href = 'https://www.criterionchannel.com/my-list'; break;
      default: return;
    }
    e.preventDefault(); e.stopPropagation();
  }, true);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureCursor);
  else ensureCursor();
})();
