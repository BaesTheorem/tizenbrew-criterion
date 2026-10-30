/* TizenBrew module: the Criterion Channel site on a Samsung TV remote.
 *
 * Spatial navigation, no pointer. The arrows move a highlight between the
 * real links and buttons on screen (nearest element in that direction, rows
 * and the page scroll to follow), Enter activates, Return goes back or closes
 * a dialog. When the JW Player is up, the remote drives it: Enter toggles
 * play, Left/Right seek 10 s, Up/Down seek 60 s, the media keys do what they
 * say, Return leaves the player. Blue toggles a pointer as a fallback for
 * anything the engine cannot reach.
 *
 * Injected by TizenBrew into every document of the site after navigation.
 */
(function () {
  'use strict';
  if (window.__tbCriterion) return;
  window.__tbCriterion = true;

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, RETURN: 10009,
    PLAYPAUSE: 10252, PLAY: 415, PAUSE: 19, STOP: 413, REW: 412, FF: 417,
    CHUP: 427, CHDOWN: 428, RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406 };
  var SELECTOR = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"], [role="tab"], [role="menuitem"]';
  var FOCUS_CLASS = 'tbfocus';
  var current = null, lastRect = null, cursorMode = false;

  // ---------- helpers ----------
  function rect(el) { return el.getBoundingClientRect(); }
  function typing() {
    var a = document.activeElement;
    return !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable));
  }
  function visible(el) {
    var r = rect(el);
    if (r.width < 4 || r.height < 4) return false;
    var W = window.innerWidth, H = window.innerHeight;
    if (r.bottom < -H || r.top > 2 * H || r.right < -W || r.left > 2 * W) return false;  // keep one screen beyond each edge for rows
    if (r.width * r.height > 0.5 * W * H) return false;  // full-bleed hero overlays
    var s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none' || s.opacity === '0') return false;
    if (el.getAttribute('aria-hidden') === 'true' || el.disabled) return false;
    if (el.closest && el.closest('[aria-hidden="true"]')) return false;
    return true;
  }
  function candidates() {
    var all = document.querySelectorAll(SELECTOR), out = [];
    for (var i = 0; i < all.length; i++) if (visible(all[i])) out.push(all[i]);
    return out;
  }
  function center(r) { return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 }; }
  function overlap(a0, a1, b0, b1) { return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0)); }

  function score(dir, from, to) {
    var fc = center(from), tc = center(to), dx, dy, main, cross, ov;
    if (dir === 'right' || dir === 'left') {
      main = dir === 'right' ? to.left - from.right : from.left - to.right;
      if (main < -Math.min(from.width, to.width) * 0.4) return Infinity;
      if (dir === 'right' ? tc.x <= fc.x : tc.x >= fc.x) return Infinity;
      cross = Math.abs(tc.y - fc.y);
      ov = overlap(from.top, from.bottom, to.top, to.bottom);
      return Math.max(main, 0) + cross * 2.5 + (ov > 0 ? 0 : 600);
    }
    main = dir === 'down' ? to.top - from.bottom : from.top - to.bottom;
    if (main < -Math.min(from.height, to.height) * 0.4) return Infinity;
    if (dir === 'down' ? tc.y <= fc.y : tc.y >= fc.y) return Infinity;
    cross = Math.abs(tc.x - fc.x);
    ov = overlap(from.left, from.right, to.left, to.right);
    return Math.max(main, 0) + cross * 1.2 + (ov > 0 ? 0 : 400);
  }

  function setFocus(el, fromKey) {
    if (current && current !== el) { current.classList.remove(FOCUS_CLASS); current.removeAttribute('data-tbfocus'); }
    current = el; lastRect = rect(el);
    el.classList.add(FOCUS_CLASS); el.setAttribute('data-tbfocus', '1');
    try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: fromKey ? 'smooth' : 'auto' }); } catch (e) { el.scrollIntoView(); }
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') { try { el.focus({ preventScroll: true }); } catch (e) {} }
    ['mouseover', 'mouseenter'].forEach(function (t) { el.dispatchEvent(new MouseEvent(t, { bubbles: t === 'mouseover' })); });
    lastRect = rect(el);
  }

  function firstFocus() {
    var list = candidates(), best = null, bestD = Infinity, W = window.innerWidth, H = window.innerHeight;
    // prefer content links (films, collections) on screen, then anything in the main area, then the nav
    var tiers = [function (el) { return el.tagName === 'A' && /\/(films|discover|collections|series|browse)\//.test(el.getAttribute('href') || ''); },
                 function (el) { return !!el.closest('main, [role="main"], article'); },
                 function () { return true; }];
    for (var t = 0; t < tiers.length && !best; t++) {
      for (var i = 0; i < list.length; i++) {
        var el = list[i]; if (!tiers[t](el)) continue;
        var r = rect(el); if (r.top < 60 || r.bottom > H || r.left < 0 || r.right > W) continue;
        var c = center(r), d = Math.abs(c.x - W * 0.25) + (c.y - 100) * 1.5;
        if (d < bestD) { bestD = d; best = el; }
      }
    }
    if (!best && list.length) best = list[0];
    if (best) setFocus(best, false);
  }

  function move(dir) {
    if (!current || !document.contains(current) || !visible(current)) {
      if (lastRect) { current = null; } else { firstFocus(); return; }
    }
    var from = current ? rect(current) : lastRect;
    var list = candidates(), best = null, bestS = Infinity;
    for (var i = 0; i < list.length; i++) {
      if (list[i] === current) continue;
      var s = score(dir, from, rect(list[i]));
      if (s < bestS) { bestS = s; best = list[i]; }
    }
    if (best) { setFocus(best, true); return; }
    // nothing that way: scroll and keep the highlight where it is
    var step = Math.round(window.innerHeight * 0.6);
    if (dir === 'down') window.scrollBy(0, step); else if (dir === 'up') window.scrollBy(0, -step);
    else if (current) { var p = current.parentElement; while (p && p.scrollWidth <= p.clientWidth) p = p.parentElement; if (p) p.scrollBy({ left: dir === 'right' ? 600 : -600, behavior: 'smooth' }); }
  }

  function activate() {
    if (!current) { firstFocus(); return; }
    var el = current;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') { el.focus(); el.click(); return; }
    el.click();
  }

  // ---------- player (JW Player) ----------
  function jw() {
    try {
      if (!window.jwplayer) return null;
      var p = window.jwplayer();
      if (!p || typeof p.getState !== 'function') return null;
      var st = p.getState();
      if (st === 'playing' || st === 'paused' || st === 'buffering') return p;
    } catch (e) {}
    return null;
  }
  function playerKey(p, c) {
    switch (c) {
      case KEY.ENTER: case KEY.PLAYPAUSE: p.getState() === 'playing' ? p.pause() : p.play(); return true;
      case KEY.PLAY: p.play(); return true;
      case KEY.PAUSE: p.pause(); return true;
      case KEY.STOP: p.stop(); return true;
      case KEY.LEFT: case KEY.REW: p.seek(Math.max(0, p.getPosition() - 10)); return true;
      case KEY.RIGHT: case KEY.FF: p.seek(p.getPosition() + 10); return true;
      case KEY.DOWN: p.seek(Math.max(0, p.getPosition() - 60)); return true;
      case KEY.UP: p.seek(p.getPosition() + 60); return true;
      case KEY.RETURN:
        if (document.fullscreenElement && document.exitFullscreen) { document.exitFullscreen(); return true; }
        p.stop(); history.back(); return true;
    }
    return false;
  }
  function mediaFallback(c) {
    var v = document.querySelector('video'); if (!v) return false;
    switch (c) {
      case KEY.PLAYPAUSE: v.paused ? v.play() : v.pause(); return true;
      case KEY.PLAY: v.play(); return true;
      case KEY.PAUSE: v.pause(); return true;
      case KEY.STOP: v.pause(); v.currentTime = 0; return true;
      case KEY.REW: v.currentTime = Math.max(0, v.currentTime - 10); return true;
      case KEY.FF: v.currentTime += 10; return true;
    }
    return false;
  }

  // ---------- dialogs ----------
  function openDialog() {
    var d = document.querySelector('[role="dialog"], [aria-modal="true"], dialog[open]');
    return d && visible(d) ? d : null;
  }
  function closeDialog(d) {
    var btn = d.querySelector('button[aria-label*="lose" i], button[class*="close" i], [data-dismiss], button[title*="lose" i]');
    if (btn) { btn.click(); return true; }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    return true;
  }

  // ---------- pointer fallback (Blue) ----------
  var cur = null, cx = 0, cy = 0, vel = 0, lastKey = 0, lastDir = 0;
  function cursorEl() {
    if (cur) return cur;
    cur = document.createElement('div');
    cur.style.cssText = 'position:fixed;z-index:2147483647;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:3px solid #fff;background:rgba(0,0,0,.45);box-shadow:0 0 6px rgba(0,0,0,.8);pointer-events:none;display:none;';
    document.body.appendChild(cur); cx = window.innerWidth / 2; cy = window.innerHeight / 2;
    return cur;
  }
  function cursorKey(c) {
    var el = cursorEl(), now = Date.now(), dx = 0, dy = 0;
    if (c === KEY.LEFT) dx = -1; else if (c === KEY.RIGHT) dx = 1; else if (c === KEY.UP) dy = -1; else if (c === KEY.DOWN) dy = 1;
    else if (c === KEY.ENTER) {
      var t = document.elementFromPoint(cx, cy);
      if (t) ['mousedown', 'mouseup', 'click'].forEach(function (n) { t.dispatchEvent(new MouseEvent(n, { bubbles: true, cancelable: true, clientX: cx, clientY: cy })); });
      return true;
    } else return false;
    vel = (c === lastDir && now - lastKey < 180) ? Math.min(vel + 6, 60) : 14; lastKey = now; lastDir = c;
    cx = Math.max(4, Math.min(window.innerWidth - 4, cx + dx * vel)); cy = Math.max(4, Math.min(window.innerHeight - 4, cy + dy * vel));
    if (cy > window.innerHeight - 40) window.scrollBy(0, vel * 2); if (cy < 40) window.scrollBy(0, -vel * 2);
    el.style.left = cx + 'px'; el.style.top = cy + 'px'; el.style.display = 'block';
    return true;
  }

  // ---------- keys ----------
  document.addEventListener('keydown', function (e) {
    var c = e.keyCode;
    if (typing() && c !== KEY.RETURN) return;          // the on-screen keyboard owns the keys
    if (c === KEY.BLUE) { cursorMode = !cursorMode; cursorEl().style.display = cursorMode ? 'block' : 'none'; e.preventDefault(); return; }
    if (cursorMode && cursorKey(c)) { e.preventDefault(); e.stopPropagation(); return; }
    var p = jw();
    if (p && playerKey(p, c)) { e.preventDefault(); e.stopPropagation(); return; }
    if (mediaFallback(c)) { e.preventDefault(); return; }
    switch (c) {
      case KEY.LEFT: move('left'); break;
      case KEY.UP: move('up'); break;
      case KEY.RIGHT: move('right'); break;
      case KEY.DOWN: move('down'); break;
      case KEY.ENTER: activate(); break;
      case KEY.RETURN: {
        if (typing()) { document.activeElement.blur(); break; }
        var d = openDialog(); if (d) { closeDialog(d); break; }
        if (document.fullscreenElement && document.exitFullscreen) { document.exitFullscreen(); break; }
        history.back(); break;
      }
      case KEY.CHUP: window.scrollBy(0, -window.innerHeight * 0.8); break;
      case KEY.CHDOWN: window.scrollBy(0, window.innerHeight * 0.8); break;
      case KEY.RED: location.href = 'https://www.criterionchannel.com/'; break;
      case KEY.GREEN: location.href = 'https://www.criterionchannel.com/all-films'; break;
      case KEY.YELLOW: location.href = 'https://www.criterionchannel.com/search'; break;
      default: return;
    }
    e.preventDefault(); e.stopPropagation();
  }, true);

  // ---------- styles + startup ----------
  function init() {
    if (!document.head) return setTimeout(init, 50);
    var st = document.createElement('style');
    st.textContent = '.' + FOCUS_CLASS + '{outline:5px solid #fff !important;outline-offset:4px !important;box-shadow:0 0 0 9px rgba(0,0,0,.55) !important;border-radius:6px;transition:none !important}' +
      '.' + FOCUS_CLASS + ' img{filter:brightness(1.1)}';
    document.head.appendChild(st);
    setTimeout(firstFocus, 800);
    setTimeout(function () { if (!current) firstFocus(); }, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('popstate', function () { setTimeout(firstFocus, 600); });
  // single-page navigation: when the highlighted element leaves the DOM, pick a new one
  setInterval(function () {
    if (cursorMode || typing()) return;
    if (!current || !document.contains(current) || !visible(current)) {
      if (jw()) return;  // the player owns the keys
      firstFocus();
    }
  }, 700);
})();
