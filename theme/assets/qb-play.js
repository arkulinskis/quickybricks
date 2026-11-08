/* qb-play.js: the glue between QuickyBricks' 3D engine (qb.js, window.QB) and the Python Forms.

   1. The window.UI helpers qb.js was written against (loaded after app-kit.js, which has UI.esc / UI.store):
      UI.api / UI.apiQuiet go through window.QB_BRIDGE (a Python function, client_code/qb.py) and UI.toast through
      QB.host.toast, so the engine's server calls and messages look like the rest of the app.
   2. Stage controllers (QBP.*): everything that happens INSIDE a 3D stage on one page: making the Stage, the roller,
      the d-pad and arrow keys, picking cubes, the World's sync of everyone's cubes. Python owns the page around it
      (cards, lists, dialogs) and hears back through hooks (plain callbacks; data as JSON text).
      Components/Stage mounts a controller when its page appears and calls destroy() when it goes.
   3. Small drawings Python asks for: QBP.thumb (a cube thumbnail on a canvas), QBP.face (a flat face),
      QBP.cubedex (the 10x10 face grid), QBP.poster (the family poster PNG). */
(function () {
  'use strict';
  var UI = window.UI = window.UI || {};
  var QB = window.QB;
  QB.host = QB.host || {};
  var QBP = window.QBP = {};

  /* ------------------------------------------------------------------ UI helpers for the engine */
  UI.toast = function (msg, kind) {
    if (QB.host.toast) { try { QB.host.toast(String(msg), kind || ''); return; } catch (e) { /* fall through */ } }
    console.log('[toast]', msg);
  };
  function send(fn, args, quiet) {
    if (!window.QB_BRIDGE) return Promise.reject(new Error('The app is still starting.'));
    var out;
    try { out = window.QB_BRIDGE(fn, JSON.stringify(args || []), !!quiet); } catch (e) { return Promise.reject(e); }
    return Promise.resolve(out).then(function (r) {
      r = typeof r === 'string' ? JSON.parse(r) : (r || {});
      if (r.error) { var err = new Error(r.error); err.uiApi = true; throw err; }
      var res = r.result;
      if (res && typeof res === 'object' && res.ok === false) {
        var e2 = new Error(res.error || 'That didn\'t work.'); e2.uiApi = true; e2.result = res; throw e2;
      }
      return res;
    });
  }
  UI.api = function (fn) { return send(fn, Array.prototype.slice.call(arguments, 1), false); };
  UI.apiQuiet = function (fn) { return send(fn, Array.prototype.slice.call(arguments, 1), true); };
  window.addEventListener('unhandledrejection', function (e) {
    if (e.reason && e.reason.uiApi) { e.preventDefault(); UI.toast(e.reason.message, 'error'); }
  });

  function call(fn) { if (typeof fn === 'function') { try { return fn.apply(null, Array.prototype.slice.call(arguments, 1)); } catch (e) { console.error(e); } } }
  function json(x) { return JSON.stringify(x == null ? null : x); }
  function noGL(host, cube, text) {
    host.classList.add('qb-stage');
    var box = document.createElement('div'); box.className = 'qb-nogl';
    var inner = document.createElement('div');
    if (cube) { var cv = document.createElement('canvas'); QBP.thumb(cv, cube, 150); inner.appendChild(cv); }
    if (text) { var p = document.createElement('p'); p.textContent = text; inner.appendChild(p); }
    box.appendChild(inner); host.appendChild(box);
  }
  function failed(host) {
    return function (err) {
      console.error('3D', err && err.stack || err);
      noGL(host, null, 'The 3D cubes couldn\'t load. Check your connection and refresh!');
    };
  }

  /* ------------------------------------------------------------------ small drawings */
  QBP.thumb = function (cv, cube, px) {
    px = px || 74;
    cv.width = cv.height = px * 2;
    cv.style.width = cv.style.height = px + 'px';
    cv.classList.add('qb-thumb');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', (cube && cube.name) || 'A cube');
    if (cube) QB.drawThumb(cv, cube);
  };
  QBP.face = function (cv, cube, kind, px) {   // a Maker option: eyes only (mouth 0) or mouth only (eyes 0)
    cv.width = cv.height = px || 128;
    var o = kind === 'eyes' ? { mouth: 0 } : kind === 'mouth' ? { eyes: 0 } : {};
    QB.paintFace(cv.getContext('2d'), cv.width, Object.assign({}, cube, { drawing: '' }), o);
  };
  QBP.cubedex = function (el, faces) {
    var have = {}, esc = UI.esc;
    (faces || []).forEach(function (f) { have[f] = 1; });
    var html = '<span></span>' + QB.MOUTHS.map(function (m) { return '<span class="h">' + esc(m) + '</span>'; }).join('');
    for (var e = 0; e < 10; e++) {
      html += '<span class="h v">' + esc(QB.EYES[e]) + '</span>';
      for (var m = 0; m < 10; m++) {
        html += have[e + '-' + m] ? '<canvas width="96" height="96" data-dex="' + e + '-' + m + '" role="img" aria-label="' + esc(QB.EYES[e] + ' eyes and ' + QB.MOUTHS[m] + ' mouth') + '"></canvas>'
          : '<span class="q" aria-hidden="true">?</span>';
      }
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-dex]').forEach(function (cv) {
      var p = cv.getAttribute('data-dex').split('-');
      QB.paintFace(cv.getContext('2d'), 96, { color: '#ff9cc8', eyes: +p[0], mouth: +p[1] });
    });
  };
  /* World chat: 1-3 symbols (A-Z, 0-9, ! ? or a chat emoji), upper case. Counted per symbol, so an emoji is one. */
  QBP.chatClean = function (text) {
    var ok = Array.from(String(text || '').toUpperCase()).filter(function (ch) { return /[A-Z0-9!?]/.test(ch) || QB.CHAT_EMOJI.indexOf(ch) >= 0; });
    return ok.slice(0, 3).join('');
  };
  QBP.symbols = function (text) { return Array.from(String(text || '')).length; };
  /* A shareable PNG: grandparents, parents, the cube (big), its babies. */
  QBP.poster = function (c) {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    function go() {
      g.fillStyle = '#fff4e0'; g.fillRect(0, 0, W, H);
      var cols = ['#ff5fa2', '#34d6c4', '#ffd23f', '#a07bff', '#6cc6ff'];
      for (var i = 0; i < 160; i++) { g.fillStyle = cols[i % 5]; g.globalAlpha = .35; g.beginPath(); g.arc(Math.random() * W, Math.random() * H, 4 + Math.random() * 4, 0, 7); g.fill(); }
      g.globalAlpha = 1; g.lineWidth = 14; g.strokeStyle = '#3b2a5a'; QB.rrect(g, 24, 24, W - 48, H - 48, 48); g.stroke();
      g.textAlign = 'center'; g.fillStyle = '#3b2a5a'; g.font = '84px "Lilita One", sans-serif';
      g.fillText('The ' + c.name + ' Family', W / 2, 140);
      function cube(cd, x, y, px, label) {
        var t = document.createElement('canvas'); t.width = t.height = px; QB.drawThumb(t, cd); g.drawImage(t, x - px / 2, y);
        g.fillStyle = '#3b2a5a'; g.font = Math.round(px / 6.5 + 14) + 'px "Lilita One", sans-serif'; g.fillText(label, x, y + px + px / 6 + 8);
      }
      function row(list, y, px) { list.forEach(function (cd, i) { cube(cd, W / 2 + (i - (list.length - 1) / 2) * (px + 40), y, px, cd.name); }); }
      function cap(t, y) { g.fillStyle = '#f0428c'; g.font = '34px "Lilita One", sans-serif'; g.fillText(t, W / 2, y); }
      var y = 190;
      if (c.grandparents.length) { cap('Grandparents', y + 20); row(c.grandparents.slice(0, 4), y + 40, 150); y += 270; }
      if (c.parents.length) { cap('Parents', y + 20); row(c.parents, y + 40, 190); y += 310; }
      cube(c, W / 2, y + 10, 340, c.name + (c.gen > 1 ? ' · Gen ' + c.gen : ''));
      y += 450;
      if (c.children.length && y < H - 200) { cap('Babies', y + 20); row(c.children.slice(0, 6), y + 40, Math.min(130, (W - 200) / Math.min(6, c.children.length) - 40)); }
      g.fillStyle = '#6e5e8c'; g.font = '30px "Baloo 2", sans-serif'; g.fillText('Made with QuickyBricks · ' + new Date().toLocaleDateString(), W / 2, H - 60);
      var a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = c.name.replace(/\W+/g, '-') + '-family.png';
      document.body.appendChild(a); a.click(); a.remove();
      QB.confetti(40); UI.toast('🖼️ Poster saved to your downloads!', 'ok');
    }
    var im = c.drawing ? QB.img(c.drawing) : null;
    if (im && !im.complete) im._wait.push(go); else go();
  };

  /* ------------------------------------------------------------------ one cube on a round mat (landing, Maker, cube card)
     o: {guest, where, move, dist, pad (element), smallPad, keys, onResult(json), canRoll (false = taps only cheer)} */
  QBP.hero = function (host, cube, o) {
    o = o || {};
    var stage = null, actor = null, offKeys = null, alive = true, pad = null, go = null;
    var d = Object.assign({}, cube, { x: 2, z: 2, grown: cube.grown !== false });
    function roll(dir) { if (pad) pad.hit(dir); if (go) go(dir); }
    if (o.pad && o.canRoll !== false) { pad = QB.dpad(roll, !!o.smallPad); o.pad.appendChild(pad); }
    var ready = Promise.resolve();
    if (!QB.glOK()) noGL(host, d, o.noGlText || 'Your browser can\'t show 3D, but you can still make cubes!');
    else ready = QB.three().then(function () {
      if (!alive) return;
      stage = new QB.Stage(host, { kind: 'hero', dist: o.dist });
      stage.heroGround();
      actor = stage.add(d);
      if (o.canRoll !== false) {
        go = QB.roller(stage, { guest: !!o.guest, where: o.where || 'home', move: true, getActor: function () { return actor; },
          onResult: function (a, res) { if (o.onResult) call(o.onResult, json(Object.assign({ orient: a.d.orient }, res || {}))); } });
        stage.onSwipe = roll;
      }
      stage.onPick = function (a, e) {
        if (!a) return;
        if (go) roll(stage.pushDir(a, e));
        else if (!a.busy && !a.rolling) a.play('love', null);
      };
      if (o.season !== false && QB.season()) stage.decorate(QB.season());
      if (o.keys && go) offKeys = QB.keys(roll, function () { var r = host.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
    }).catch(failed(host));
    return {
      ready: ready,
      setData: function (fields) { Object.assign(d, fields); if (actor) actor.setData(fields); },
      play: function (ev) { if (actor && !actor.busy && !actor.rolling) actor.play(ev, null); },
      express: function (ev, ms) { if (actor) actor.express(ev, ms || 400); },
      destroy: function () { alive = false; if (offKeys) offKeys(); if (stage) stage.destroy(); }
    };
  };

  /* ------------------------------------------------------------------ the Cubby play mat (8x6, up to 16 cubes)
     data: {user, cubes (newest last), toys}; o: {pad, onSelect(id), onResult(json), noActor()} */
  var MAT_W = 8, MAT_D = 6, ON_MAT = 16, SPOTS = [];
  for (var sx = 0; sx < MAT_W; sx++) for (var sz = 0; sz < MAT_D; sz++) SPOTS.push([sx, sz]);
  SPOTS.sort(function (a, b) { var pa = (a[0] + a[1]) % 2, pb = (b[0] + b[1]) % 2; if (pa !== pb) return pa - pb;
    return (Math.abs(a[0] - 3.5) + Math.abs(a[1] - 2.5)) - (Math.abs(b[0] - 3.5) + Math.abs(b[1] - 2.5)); });

  QBP.cubby = function (host, data, o) {
    var esc = UI.esc, stage = null, sel = null, offKeys = null, alive = true, go = null, pad = null;
    var cubes = data.cubes.slice().reverse().slice(0, ON_MAT), posKey = 'pos.' + data.user;
    function roll(dir) { if (pad) pad.hit(dir); if (go) go(dir); }
    if (o.pad) { pad = QB.dpad(roll); o.pad.appendChild(pad); }
    function savePos() {
      var p = {};
      if (stage) Object.keys(stage.actors).forEach(function (k) { var a = stage.actors[k]; p[k] = [a.d.x, a.d.z]; });
      UI.store.set(posKey, p);
    }
    function select(a, quiet) {
      if (sel) sel.select(false);
      sel = a || null;
      if (sel) { sel.select(true); UI.store.set('sel', sel.d.id); }
      if (!quiet) call(o.onSelect, sel ? sel.d.id : null);
    }
    function blocked(a, dir) {
      var v = QB.DIRS[dir], x = a.d.x + v[0], z = a.d.z + v[1];
      if (x < 0 || z < 0 || x >= MAT_W || z >= MAT_D) return true;
      return Object.keys(stage.actors).some(function (k) { var ob = stage.actors[k]; return ob !== a && ob.d.x === x && ob.d.z === z; });
    }
    function tag(a) { a.tag(esc(a.d.name) + (a.d.grown ? '' : ' 🍼'), 'mine'); }
    var ready = Promise.resolve();
    if (!QB.glOK()) noGL(host, null, 'Your browser can\'t show 3D. Your cubes are below!');
    else ready = QB.three().then(function () {
      if (!alive) return;
      stage = new QB.Stage(host, { kind: 'cubby', w: MAT_W, d: MAT_D, idle: true, snap: true });
      if (QB.season()) stage.decorate(QB.season());
      stage.cubbyGround(data.toys || []);
      var pos = UI.store.get(posKey, {}), taken = {};
      cubes.forEach(function (c) {
        var p = pos[c.id];
        if (!p || taken[p[0] + ',' + p[1]] || p[0] >= MAT_W || p[1] >= MAT_D) {
          p = null;
          for (var i = 0; i < SPOTS.length && !p; i++) if (!taken[SPOTS[i][0] + ',' + SPOTS[i][1]]) p = SPOTS[i];
        }
        taken[p[0] + ',' + p[1]] = 1;
        tag(stage.add(Object.assign({}, c, { x: p[0], z: p[1] })));
      });
      savePos();
      var want = UI.store.get('sel', null);
      select(stage.actors[want] || (cubes[0] && stage.actors[cubes[0].id]));
      go = QB.roller(stage, { where: 'home', move: true, blocked: blocked, getActor: function () { return sel; },
        noActor: function () { UI.toast('Tap a cube first!'); },
        onResult: function (a, res) {
          savePos();
          if (!res || res.ok === false || !res.cube) return;
          ['love', 'grown', 'grow_left', 'recent'].forEach(function (k) { a.d[k] = res.cube[k]; });
          if (res.reward && res.reward.grew) tag(a);
          call(o.onResult, json(Object.assign({ id: a.d.id }, res)));
        } });
      stage.onSwipe = roll;
      stage.onPick = function (a, e) {
        if (!a) return;
        if (a === sel) roll(stage.pushDir(a, e));   // tap the picked cube again: push it
        else { select(a); a.express('love', 700); QB.sfx('pop'); }
      };
      offKeys = QB.keys(roll);
    }).catch(failed(host));
    return {
      ready: ready,
      /* pick a cube from the list under the mat; false when it isn't on the mat (only the newest 16 are) */
      select: function (id) {
        var a = stage && stage.actors[id];
        if (!a) return false;
        select(a, true); a.express('love', 700); QB.sfx('pop');
        return true;
      },
      selected: function () { return sel ? sel.d.id : null; },
      destroy: function () { alive = false; if (offKeys) offKeys(); if (stage) stage.destroy(); }
    };
  };

  /* ------------------------------------------------------------------ the World: everyone's cubes on one island
     W = get_world's reply; Python polls get_world and calls sync(json). o: {pad, onSelect(id), onPickOther(json),
     onResult(json), onChat(text), onNews(text)} */
  var CHATTER = ['HI!', 'YAY', 'LOL', '😀', '💖', 'WOW', '🎉', 'BOO', 'HEY', '🍕', 'OOH', '👋'];
  QBP.world = function (host, W, o) {
    var esc = UI.esc, stage = null, sel = null, go = null, alive = true, timers = [], offKeys = null, seenChats = {}, faces = {}, lastNews = '', pad = null;
    (W.chats || []).forEach(function (m) { seenChats[m.id] = 1; });
    lastNews = W.happenings && W.happenings[0] ? W.happenings[0].text : '';
    function roll(dir) { if (pad) pad.hit(dir); if (go) go(dir); }
    if (o.pad) { pad = QB.dpad(roll, innerWidth < 760); o.pad.appendChild(pad); }
    function tagFor(a) {
      var c = a.d, icon = !c.grown ? ' 🍼' : c.nap ? ' 💤' : (!c.mine && c.open) ? ' ✋' : (c.mine && c.love >= 100) ? ' 💖' : '';
      a.tag(esc(c.name) + icon, c.mine ? 'mine' : '');
    }
    function select(a, quiet) {
      if (sel) sel.select(false);
      sel = a || null; if (sel) { sel.select(true); UI.store.set('wsel', sel.d.id); }
      if (stage) stage.follow = sel ? sel.root.position : null;
      if (!quiet) call(o.onSelect, sel ? sel.d.id : null);
    }
    function blocked(a, dir) {
      var v = QB.DIRS[dir], x = a.d.x + v[0], z = a.d.z + v[1];
      if (x < 0 || z < 0 || x >= W.w || z >= W.d) return true;
      if (W.props.some(function (p) { return x >= p.x && x < p.x + p.w && z >= p.z && z < p.z + p.d; })) return true;
      return Object.keys(stage.actors).some(function (k) { var ob = stage.actors[k]; return ob !== a && ob.d.x === x && ob.d.z === z; });
    }
    function needFaces(list) {
      var ids = list.filter(function (c) { return c.dv && faces[c.id] !== c.dv; }).map(function (c) { return c.id; });
      if (!ids.length) return;
      ids.forEach(function (i) { faces[i] = -1; });
      UI.apiQuiet('get_faces', ids).then(function (r) {
        Object.keys(r).forEach(function (i) { faces[i] = r[i].dv; var a = stage && stage.actors[i]; if (a) a.setData({ drawing: r[i].drawing }); });
      }, function () {});
    }
    function chats(list) {
      (list || []).slice().reverse().forEach(function (m) {
        if (seenChats[m.id]) return; seenChats[m.id] = 1;
        var a = m.cube && stage && stage.actors[m.cube];
        if (a) { a.say(m.text); QB.sfx('chat'); }
        call(o.onChat, m.who + ': ' + m.text);
      });
    }
    function sync(fresh) {
      W = fresh;
      if (!stage) return;
      var keep = {};
      W.cubes.forEach(function (c) {
        keep[c.id] = 1;
        var a = stage.actors[c.id];
        if (!a) { a = stage.add(Object.assign({}, c, { drawing: '' })); tagFor(a); return; }
        if (a.rolling || a.busy || a.waiting) return;
        if (a.d.x !== c.x || a.d.z !== c.z) {
          var dir = null; Object.keys(QB.DIRS).forEach(function (k) { var v = QB.DIRS[k]; if (a.d.x + v[0] === c.x && a.d.z + v[1] === c.z) dir = k; });
          if (dir && QB.roll(a.d.orient, dir) === c.orient) a.roll(dir, true, function (or) { if (!c.mine) a.play(QB.topEvent(or), null); });
          else a.hopTo(c.x, c.z, c.orient);
        } else if (a.d.orient !== c.orient) a.setOrient(c.orient);
        a.setData(Object.assign({}, c, { drawing: a.d.drawing, x: a.d.x, z: a.d.z, orient: a.d.orient }));
        tagFor(a);
      });
      Object.keys(stage.actors).forEach(function (k) { if (!keep[k]) { if (sel && sel.d.id === k) select(null); stage.remove(k); } });
      needFaces(W.cubes);
      stage.setEgg(W.egg);
      chats(W.chats);
      var news = W.happenings[0];
      if (news && news.text !== lastNews) { if (lastNews) call(o.onNews, news.text); lastNews = news.text; }
      if (!sel || !stage.actors[sel.d.id]) {
        var want = stage.actors[UI.store.get('wsel', '')], m0 = W.cubes.filter(function (c) { return c.mine; })[0];
        select(want && want.d.mine ? want : m0 ? stage.actors[m0.id] : null);
      }
    }
    function ambient() {
      if (!alive || !stage) return;
      var demo = Object.keys(stage.actors).map(function (k) { return stage.actors[k]; }).filter(function (a) { return a.d.demo; });
      if (demo.length && !document.hidden) { var a = QB.pick(demo); a.say(QB.pick(CHATTER)); if (Math.random() < .5) a.play(QB.pick(QB.FACE_EVENT), null); }
    }
    var ready = Promise.resolve();
    if (!QB.glOK()) noGL(host, null, 'Your browser can\'t show 3D, so the World can\'t open here. Try another browser!');
    else ready = QB.three().then(function () {
      if (!alive) return;
      stage = new QB.Stage(host, { kind: 'world', w: W.w, d: W.d, idle: true, snap: true });
      stage.worldGround(W.props);
      if (QB.season()) stage.decorate(QB.season());
      if (QB.isNight()) { stage.setNight(); host.classList.add('qb-night'); }
      sync(W);
      go = QB.roller(stage, { where: 'world', blocked: blocked, getActor: function () { return sel; },
        noActor: function () { UI.toast('Send one of your cubes to the World first!'); },
        onResult: function (a, res) {
          if (!res || !res.cube) return;
          var c = W.cubes.filter(function (x) { return x.id === a.d.id; })[0];
          if (c) { c.x = a.d.x; c.z = a.d.z; c.orient = a.d.orient; }
          ['love', 'grown'].forEach(function (k) { a.d[k] = res.cube[k]; if (c) c[k] = res.cube[k]; });
          if (res.reward && res.reward.egg) { W.egg = null; stage.setEgg(null); }
          tagFor(a);
          call(o.onResult, json(Object.assign({ id: a.d.id, x: a.d.x, z: a.d.z }, res)));
        } });
      stage.onSwipe = roll;
      stage.onPick = function (a, e) {
        if (!a) return;
        if (a.d.mine && a === sel) { roll(stage.pushDir(a, e)); return; }
        if (a.d.mine) { select(a); a.express('love', 600); QB.sfx('pop'); }
        else { a.express('snack', 600); QB.sfx('pop'); call(o.onPickOther, json({ them: a.d, me: sel ? sel.d : null })); }
      };
      offKeys = QB.keys(roll);
      timers.push(setInterval(ambient, 6500));
    }).catch(failed(host));
    return {
      ready: ready,
      sync: function (text) { if (alive) sync(JSON.parse(text)); },
      chats: function (text) { chats(JSON.parse(text)); },
      select: function (id) { var a = stage && stage.actors[id]; if (!a) return false; select(a, true); a.express('love', 600); QB.sfx('pop'); return true; },
      selected: function () { return sel ? sel.d.id : null; },
      selectedJson: function () { return json(sel ? sel.d : null); },
      play: function (id, ev) { var a = stage && stage.actors[id]; if (a) a.play(ev, null); },
      /* after hold_hands: both cheer, my heart empties, both rest */
      celebrate: function (myId, theirId) {
        var ma = stage && stage.actors[myId], ta = stage && stage.actors[theirId];
        [ma, ta].forEach(function (x) { if (x) x.play('love', null); });
        QB.sfx('baby'); QB.confetti(140);
        if (ma) { ma.d.love = 0; ma.d.nap = 7200; tagFor(ma); }
        if (ta) { ta.d.nap = 7200; tagFor(ta); }
      },
      findEgg: function () {
        if (!stage || !stage.eggG) return false;
        var back = stage.follow; stage.follow = stage.eggG.position; QB.sfx('pop');
        timers.push(setTimeout(function () { if (alive && stage) stage.follow = sel ? sel.root.position : back; }, 2200));
        return true;
      },
      destroy: function () { alive = false; timers.forEach(function (t) { clearTimeout(t); clearInterval(t); }); if (offKeys) offKeys(); if (stage) stage.destroy(); }
    };
  };
})();
