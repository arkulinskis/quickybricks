/* qb.js: QuickyBricks' engine (window.QB), moved unchanged from the JavaScript version's web/pages/_qb.html.
   Game data, 2D faces + thumbnails, sounds, confetti, d-pad, draw pad, three.js stages and actors, the roller.
   Python reaches it through client_code/qb.py; the page glue (stage controllers) is theme/assets/qb-play.js. */
(function () {
  'use strict';
  var QB = window.QB = {};

  /* ------------------------------------------------------------------ game data (see server_code/rules.py) */
  QB.START = '235401';            // [top, bottom, north, south, east, west] face ids
  QB.FACE_EVENT = ['boing', 'toot', 'love', 'snack', 'sunny', 'disco'];
  QB.EVENTS = {
    boing: { label: 'BOING!', emoji: '🌀', side: 'Spring side', text: 'A super-duper bounce. Sometimes there\'s a present!', color: '#4cd964' },
    toot:  { label: 'TOOT-TOOT!', emoji: '💨', side: 'Cloud side', text: 'A rainbow toot. Pardon me!', color: '#6cc6ff' },
    love:  { label: 'LOVEY-DOVEY!', emoji: '💖', side: 'Heart side', text: 'Hearts everywhere: lots of love for holding hands.', color: '#ff5fa2' },
    snack: { label: 'SNACK ATTACK!', emoji: '🧁', side: 'Cupcake side', text: 'A cupcake falls from the sky. Chomp chomp!', color: '#ffb36b' },
    sunny: { label: 'SUNNY SMILE!', emoji: '😎', side: 'Face up', text: 'Looking at the sky: sunglasses on, sparkles out.', color: '#ffd23f' },
    disco: { label: 'DIZZY DISCO!', emoji: '🪩', side: 'Swirl side', text: 'Spin spin spin! Once in a while it turns GOLDEN.', color: '#a07bff' }
  };
  QB.EYES = ['Dots', 'Googly', 'Happy', 'Sleepy', 'Starry', 'Hearts', 'Sparkly', 'Cyclops', 'Shades', 'Swirly'];
  QB.MOUTHS = ['Smile', 'Ha-ha', 'Tongue', 'Ooh', 'Kitty', 'Toothy', 'Wobbly', 'Fangs', 'Kissy', 'Eek'];
  QB.HATS = { party: ['Party Hat', '🎉'], flower: ['Daisy', '🌼'], bow: ['Big Bow', '🎀'], propeller: ['Propeller Cap', '🧢'], chef: ['Chef Hat', '👨‍🍳'],
    cat: ['Cat Ears', '🐱'], tophat: ['Top Hat', '🎩'], viking: ['Viking Helmet', '🪖'], crown: ['Crown', '👑'], halo: ['Halo', '😇'] };
  QB.TOYS = { lolly: ['Lollipop Tree', '🍭'], trampoline: ['Trampoline', '🤸'], jelly: ['Jelly Pool', '🍮'], rainbow: ['Rainbow', '🌈'],
    discoball: ['Disco Ball', '🪩'], house: ['Cupcake House', '🧁'] };
  Object.assign(QB.HATS, { pumpkin: ['Pumpkin Head', '🎃'], witch: ['Witch Hat', '🧙'], santa: ['Santa Hat', '🎅'], antlers: ['Reindeer Antlers', '🦌'],
    bunny: ['Bunny Ears', '🐰'], sunhat: ['Sun Hat', '👒'] });
  QB.season = function (d) {
    d = d || new Date(); var m = d.getMonth() + 1, day = d.getDate();
    if ((m === 10 && day >= 15) || (m === 11 && day <= 3)) return 'halloween';
    if (m === 12 || m === 1) return 'winter';
    if (m === 3 || m === 4) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    return '';
  };
  QB.isNight = function () { var h = new Date().getHours(); return h >= 20 || h < 7; };
  QB.SUPPLIES = { potion: ['Love Potion', '🧪', 'Fills one cube\'s heart to the top.'], whistle: ['Wake-Up Whistle', '📯', 'Wakes a resting cube right away.'] };
  QB.COLORS = [['#ff5fa2', 'Bubblegum'], ['#f0428c', 'Pink Fizz'], ['#ff9cc8', 'Cotton Candy'], ['#ff3b3b', 'Cherry Bomb'], ['#ff8a3d', 'Tangerine'],
    ['#ffb36b', 'Peach Pie'], ['#ffd23f', 'Lemon Zing'], ['#fff07a', 'Banana Split'], ['#b6e84a', 'Lime Fizz'], ['#4cd964', 'Slime'], ['#19bfae', 'Minty'],
    ['#34d6c4', 'Mint Chip'], ['#6cc6ff', 'Sky Splash'], ['#2f8cff', 'Blueberry'], ['#4a5bff', 'Ocean Blob'], ['#7b4dff', 'Grape Soda'], ['#a07bff', 'Lavender Puff'],
    ['#c86bff', 'Purple Pop'], ['#e96bff', 'Unicorn'], ['#8b5a3c', 'Chocolate Chip'], ['#c79a6b', 'Cookie Dough'], ['#ffffff', 'Marshmallow'], ['#c8c8d8', 'Cloudy'], ['#4a4458', 'Licorice']];
  QB.CHAT_EMOJI = ['😀', '😂', '😍', '🥳', '😮', '😴', '👋', '👍', '💖', '⭐', '🌈', '🎉', '🍕', '🐱', '💩', '🧁'];
  QB.GROW_ROLLS = 10;
  QB.SYL_A = ['Wob', 'Squi', 'Boo', 'Zig', 'Noo', 'Pip', 'Fluf', 'Bon', 'Jel', 'Mo', 'Tic', 'Gub', 'Bim', 'Lol', 'Pud', 'Snu', 'Wig', 'Dop', 'Fiz', 'Kip'];
  QB.SYL_B = ['ble', 'shy', 'po', 'gle', 'dle', 'bo', 'zy', 'ster', 'kins', 'ly', 'mo', 'pop', 'nut', 'boo', 'doodle', 'berry', 'sprout', 'wump'];
  QB.randomName = function () { return pick(QB.SYL_A) + pick(QB.SYL_B); };
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  QB.pick = pick;

  function rgb(h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; }); }
  QB.colorName = function (h) {
    var c = rgb(h || '#ff5fa2'), best = null, bd = 9;
    QB.COLORS.forEach(function (n) { var o = rgb(n[0]), d = 0; for (var i = 0; i < 3; i++) d += (c[i] - o[i]) * (c[i] - o[i]); if (d < bd) { bd = d; best = n[1]; } });
    return best;
  };
  QB.lum = function (h) { var c = rgb(h || '#888888'); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  QB.shade = function (h, amt) {   // amt -1..1: darker..lighter
    var c = rgb(h || '#888888').map(function (v) { return amt < 0 ? v * (1 + amt) : v + (1 - v) * amt; });
    return '#' + c.map(function (v) { return ('0' + Math.round(v * 255).toString(16)).slice(-2); }).join('');
  };
  QB.roll = function (o, d) {
    var a = o.split('').map(Number), t = a[0], b = a[1], n = a[2], s = a[3], e = a[4], w = a[5], x;
    if (d === 'E') { x = [w, t, e, b]; t = x[0]; e = x[1]; b = x[2]; w = x[3]; }
    else if (d === 'W') { x = [e, t, w, b]; t = x[0]; w = x[1]; b = x[2]; e = x[3]; }
    else if (d === 'S') { x = [n, t, s, b]; t = x[0]; s = x[1]; b = x[2]; n = x[3]; }
    else if (d === 'N') { x = [s, t, n, b]; t = x[0]; n = x[1]; b = x[2]; s = x[3]; }
    return [t, b, n, s, e, w].join('');
  };
  QB.topEvent = function (o) { return QB.FACE_EVENT[+String(o || QB.START)[0]]; };
  QB.DIRS = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
  /* What a roll gives when nobody is signed in (the landing page); the server decides for real players. */
  QB.guestReward = function (ev) {
    var r = { sparkles: 0, love: 5 };
    if (ev === 'sunny') r.sparkles = 5; else if (ev === 'love') { r.sparkles = 1; r.love = 30; } else if (ev === 'snack') { r.sparkles = 2; r.love = 12; }
    else if (ev === 'boing') r.sparkles = 3; else if (ev === 'toot') r.sparkles = 1; else if (ev === 'disco') r.sparkles = 4;
    return r;
  };

  /* ------------------------------------------------------------------ images (drawings) */
  var IMGS = {};
  QB.img = function (src, onload) {
    if (!src) return null;
    var im = IMGS[src];
    if (!im) {
      im = IMGS[src] = new Image();
      im._wait = [];
      im.onload = function () { var w = im._wait; im._wait = []; w.forEach(function (f) { f(); }); };
      im.src = src;
    }
    if (!im.complete && onload) im._wait.push(onload);
    return im;
  };

  /* ------------------------------------------------------------------ the face (2D) */
  var INK = '#2b1d45';
  function heart(c, x, y, s) {
    c.beginPath(); c.moveTo(x, y + s * .35);
    c.bezierCurveTo(x - s * 1.1, y - s * .45, x - s * .5, y - s * 1.15, x, y - s * .45);
    c.bezierCurveTo(x + s * .5, y - s * 1.15, x + s * 1.1, y - s * .45, x, y + s * .35); c.closePath();
  }
  function star(c, x, y, r, rot) {
    c.beginPath();
    for (var i = 0; i < 10; i++) { var a = (rot || 0) - Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath();
  }
  function rrect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  QB.rrect = rrect;

  function eyes(c, kind, ink, o) {
    var L = [88, 108], R = [168, 108];
    c.save(); c.fillStyle = ink; c.strokeStyle = ink; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round';
    var lk = o.look || { x: 0, y: 0 };
    if (o.blink && kind !== 8 && kind !== 7) kind = 11;
    if (kind === 11) {   // closed
      [L, R].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1] - 6, 16, .15 * Math.PI, .85 * Math.PI); c.stroke(); });
    } else if (kind === 10) {   // squeezed > <
      c.beginPath(); c.moveTo(72, 96); c.lineTo(98, 108); c.lineTo(72, 120); c.stroke();
      c.beginPath(); c.moveTo(184, 96); c.lineTo(158, 108); c.lineTo(184, 120); c.stroke();
    } else if (kind === 0) {
      [L, R].forEach(function (p) {
        c.beginPath(); c.ellipse(p[0], p[1], 14, 20, 0, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(p[0] - 4, p[1] - 8, 5, 0, 7); c.fill(); c.fillStyle = ink;
      });
    } else if (kind === 1) {   // googly
      [L, R].forEach(function (p, i) {
        c.fillStyle = '#fff'; c.beginPath(); c.arc(p[0], p[1], 27, 0, 7); c.fill(); c.lineWidth = 5; c.stroke();
        c.fillStyle = INK; c.beginPath(); c.arc(p[0] + lk.x * 12 + (i ? -2 : 2), p[1] + 4 + lk.y * 12, 12, 0, 7); c.fill();
      });
    } else if (kind === 2) {   // happy ^ ^
      [L, R].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1] + 10, 18, 1.15 * Math.PI, 1.85 * Math.PI); c.stroke(); });
    } else if (kind === 3) {   // sleepy
      [L, R].forEach(function (p) {
        c.beginPath(); c.arc(p[0], p[1], 17, 0, Math.PI); c.fill();
        c.lineWidth = 7; c.beginPath(); c.moveTo(p[0] - 22, p[1]); c.lineTo(p[0] + 22, p[1]); c.stroke();
      });
    } else if (kind === 4) {   // starry
      [L, R].forEach(function (p) { star(c, p[0], p[1], 24, .2); c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 5; c.stroke(); });
    } else if (kind === 5) {   // hearts
      [L, R].forEach(function (p) { heart(c, p[0], p[1] + 8, 22); c.fillStyle = '#ff3b7a'; c.fill(); c.lineWidth = 5; c.stroke(); });
    } else if (kind === 6) {   // sparkly big
      [L, R].forEach(function (p) {
        c.fillStyle = ink; c.beginPath(); c.ellipse(p[0], p[1], 20, 27, 0, 0, 7); c.fill();
        c.fillStyle = '#6a8cff'; c.beginPath(); c.ellipse(p[0], p[1] + 8, 13, 14, 0, 0, 7); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(p[0] - 7, p[1] - 10, 8, 0, 7); c.fill(); c.beginPath(); c.arc(p[0] + 7, p[1] + 9, 3.5, 0, 7); c.fill();
      });
    } else if (kind === 7) {   // cyclops
      var cx = 128 + lk.x * 6, cy = 104;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(128, 104, 40, 0, 7); c.fill(); c.lineWidth = 6; c.stroke();
      if (o.blink) { c.beginPath(); c.moveTo(90, 104); c.lineTo(166, 104); c.stroke(); }
      else { c.fillStyle = INK; c.beginPath(); c.arc(cx, cy + 6 + lk.y * 8, 19, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(cx - 6, cy - 2, 6, 0, 7); c.fill(); }
    } else if (kind === 8) {   // shades
      c.fillStyle = '#1a1226'; rrect(c, 52, 88, 68, 42, 16); c.fill(); rrect(c, 136, 88, 68, 42, 16); c.fill();
      c.lineWidth = 8; c.strokeStyle = '#1a1226'; c.beginPath(); c.moveTo(116, 100); c.lineTo(140, 100); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 6; c.beginPath(); c.moveTo(64, 120); c.lineTo(84, 96); c.moveTo(148, 120); c.lineTo(168, 96); c.stroke();
    } else if (kind === 9) {   // swirly
      c.lineWidth = 6;
      [L, R].forEach(function (p, j) {
        c.beginPath();
        for (var i = 0; i < 60; i++) { var a = i * .32 * (j ? -1 : 1) + (o.spin || 0), r = 2 + i * .42; c.lineTo(p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r); }
        c.stroke();
      });
    }
    c.restore();
  }

  function mouth(c, kind, ink) {
    var x = 128, y = 168;
    c.save(); c.fillStyle = ink; c.strokeStyle = ink; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round';
    if (kind === 0) { c.beginPath(); c.arc(x, y - 18, 32, .2 * Math.PI, .8 * Math.PI); c.stroke(); }
    else if (kind === 1) {
      c.beginPath(); c.moveTo(x - 34, y - 8); c.quadraticCurveTo(x, y - 14, x + 34, y - 8); c.quadraticCurveTo(x + 30, y + 38, x, y + 38); c.quadraticCurveTo(x - 30, y + 38, x - 34, y - 8); c.fill();
      c.fillStyle = '#ff6f91'; c.beginPath(); c.ellipse(x, y + 26, 16, 9, 0, 0, 7); c.fill();
    } else if (kind === 2) {
      c.fillStyle = '#ff6f91'; rrect(c, x - 2, y - 2, 30, 34, 14); c.fill(); c.lineWidth = 5; c.stroke();
      c.lineWidth = 9; c.beginPath(); c.moveTo(x - 36, y - 6); c.quadraticCurveTo(x, y + 10, x + 36, y - 6); c.stroke();
    } else if (kind === 3) { c.beginPath(); c.ellipse(x, y + 6, 15, 21, 0, 0, 7); c.fill(); }
    else if (kind === 4) {
      c.lineWidth = 8; c.beginPath(); c.arc(x - 14, y - 4, 14, .1 * Math.PI, .95 * Math.PI); c.stroke(); c.beginPath(); c.arc(x + 14, y - 4, 14, .05 * Math.PI, .9 * Math.PI); c.stroke();
    } else if (kind === 5) {
      c.beginPath(); c.moveTo(x - 38, y - 10); c.quadraticCurveTo(x, y + 44, x + 38, y - 10); c.closePath(); c.fill();
      c.fillStyle = '#fff'; c.fillRect(x - 15, y - 9, 13, 15); c.fillRect(x + 2, y - 9, 13, 15);
    } else if (kind === 6) {
      c.beginPath(); for (var i = 0; i <= 40; i++) { var t = i / 40; c.lineTo(x - 40 + t * 80, y + Math.sin(t * Math.PI * 3) * 8); } c.stroke();
    } else if (kind === 7) {
      c.beginPath(); c.arc(x, y - 22, 32, .25 * Math.PI, .75 * Math.PI); c.stroke();
      c.fillStyle = '#fff'; c.lineWidth = 3;
      [[x - 16, y + 2], [x + 16, y + 2]].forEach(function (p) { c.beginPath(); c.moveTo(p[0] - 7, p[1] - 3); c.lineTo(p[0] + 7, p[1] - 3); c.lineTo(p[0], p[1] + 14); c.closePath(); c.fill(); c.stroke(); });
    } else if (kind === 8) {
      c.fillStyle = '#ff3b7a'; heart(c, x, y + 10, 20); c.fill(); c.lineWidth = 4; c.stroke();
    } else if (kind === 9) {
      c.fillStyle = '#fff'; rrect(c, x - 36, y - 12, 72, 30, 10); c.fill(); c.lineWidth = 6; c.stroke();
      c.lineWidth = 4; c.beginPath(); c.moveTo(x - 36, y + 3); c.lineTo(x + 36, y + 3);
      for (var k = -24; k <= 24; k += 12) { c.moveTo(x + k, y - 12); c.lineTo(x + k, y + 18); } c.stroke();
    }
    c.restore();
  }

  /* Paint a cube's face into a square of size S. o: {blink, eyes, mouth, look, spin, noBg} (eyes/mouth override). */
  QB.paintFace = function (c, S, cube, o) {
    o = o || {};
    c.save(); c.scale(S / 256, S / 256);
    if (!o.noBg) { c.fillStyle = cube.color || '#ff5fa2'; c.fillRect(0, 0, 256, 256); }
    var ink = QB.lum(cube.color) < 0.3 ? '#fff4e0' : INK;
    c.fillStyle = 'rgba(255, 120, 170, .35)';
    c.beginPath(); c.ellipse(56, 150, 18, 11, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(200, 150, 18, 11, 0, 0, 7); c.fill();
    if (cube.drawing) { var im = QB.img(cube.drawing, o.onImg); if (im && im.complete && im.naturalWidth) c.drawImage(im, 0, 0, 256, 256); }
    eyes(c, o.eyes != null ? o.eyes : (+cube.eyes || 0), ink, o);
    mouth(c, o.mouth != null ? o.mouth : (+cube.mouth || 0), ink);
    c.restore();
  };

  /* 2D thumbnail: a little 3/4-view cube. QB.thumbHtml(cube, px) then QB.hydrate(root) draws them. */
  var THUMBS = {}, thumbSeq = 0;
  QB.thumbHtml = function (cube, px, extra) {
    var k = 't' + (++thumbSeq);
    THUMBS[k] = cube;
    return '<canvas class="qb-thumb ' + (extra || '') + '" data-thumb="' + k + '" width="' + (px * 2) + '" height="' + (px * 2) + '" style="width:' + px + 'px;height:' + px + 'px" aria-label="' + UI.esc(cube.name || 'cube') + '"></canvas>';
  };
  QB.drawThumb = function (cv, cube) {
    var S = cv.width, c = cv.getContext('2d'), col = cube.color || '#ff5fa2';
    c.clearRect(0, 0, S, S);
    var f = { x: S * .05, y: S * .25, s: S * .68 }, d = S * .2, r = S * .12, lw = Math.max(2, S * .035);
    c.lineJoin = 'round'; c.lineWidth = lw; c.strokeStyle = '#3b2a5a';
    c.beginPath(); c.moveTo(f.x + r, f.y); c.lineTo(f.x + d + r * .6, f.y - d); c.lineTo(f.x + f.s + d, f.y - d); c.lineTo(f.x + f.s, f.y); c.closePath();
    c.fillStyle = QB.shade(col, .35); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(f.x + f.s, f.y); c.lineTo(f.x + f.s + d, f.y - d); c.lineTo(f.x + f.s + d, f.y + f.s - d - r * .6); c.lineTo(f.x + f.s, f.y + f.s - r * .3); c.closePath();
    c.fillStyle = QB.shade(col, -.22); c.fill(); c.stroke();
    c.save(); rrect(c, f.x, f.y, f.s, f.s, r); c.clip(); c.translate(f.x, f.y);
    QB.paintFace(c, f.s, cube, { onImg: function () { QB.drawThumb(cv, cube); } });
    c.restore(); rrect(c, f.x, f.y, f.s, f.s, r); c.stroke();
    if (cube.hat && QB.HATS[cube.hat]) { c.font = (S * .3) + 'px serif'; c.textAlign = 'center'; c.fillText(QB.HATS[cube.hat][1], f.x + f.s * .62, f.y + S * .02); }
  };
  QB.hydrate = function (root) {
    Array.prototype.forEach.call((root || document).querySelectorAll('canvas[data-thumb]'), function (cv) {
      var cube = THUMBS[cv.getAttribute('data-thumb')];
      if (cube) QB.drawThumb(cv, cube);
      delete THUMBS[cv.getAttribute('data-thumb')];
      cv.removeAttribute('data-thumb');
    });
  };
  QB.loveBar = function (love) { return '<div class="qb-love" title="Love ' + love + '/100"><i style="width:' + Math.max(0, Math.min(100, love)) + '%"></i></div>'; };
  QB.napText = function (s) { if (s <= 0) return ''; var m = Math.ceil(s / 60); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + ' min'; };

  /* ------------------------------------------------------------------ sounds (tiny synth, no files) */
  var AC = null;
  QB.muted = function () { return !!UI.store.get('mute', false); };
  QB.setMuted = function (m) { UI.store.set('mute', !!m); QB.music.sync(); };
  /* Music: bouncy tracks streamed by ArkMusic (web/pages/_arkmusic.html) while a 3D stage with a sound button is
     on screen. The 🔊/🔇 button mutes music and sounds together. The short wait before stopping lets one stage
     page hand over to the next without the song restarting. */
  QB.MUSIC = ['dont-stress-out', 'my-love-for-you'];
  QB.music = {
    live: 0,
    sync: function () {
      var M = window.ArkMusic;
      if (!M) return;
      if (QB.music.live > 0 && !QB.muted()) M.play(QB.MUSIC, { volume: 0.32, shuffle: true });
      else M.stop();
    },
    add: function () { QB.music.live++; QB.music.sync(); },
    remove: function () { QB.music.live = Math.max(0, QB.music.live - 1); setTimeout(QB.music.sync, 600); }
  };
  function ac() {
    if (QB.muted()) return null;
    try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { return null; }
    return AC;
  }
  function tone(type, f0, f1, dur, vol, when) {
    var a = ac(); if (!a) return;
    var t = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || .15, t + .015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .05);
  }
  QB.sfx = function (name) {
    if (name === 'roll') tone('triangle', 180, 90, .12, .12);
    else if (name === 'bonk') { tone('square', 140, 70, .12, .08); }
    else if (name === 'boing') tone('sine', 160, 900, .45, .18);
    else if (name === 'toot') { tone('sawtooth', 110, 70, .35, .1); tone('sawtooth', 95, 60, .3, .07, .12); }
    else if (name === 'love') { tone('sine', 660, 660, .18, .12); tone('sine', 880, 880, .3, .12, .14); }
    else if (name === 'snack') { [0, .12, .24].forEach(function (w) { tone('square', 300, 120, .07, .06, w); }); }
    else if (name === 'sunny') { [523, 659, 784, 1047].forEach(function (f, i) { tone('triangle', f, f, .14, .1, i * .07); }); }
    else if (name === 'disco') { [392, 494, 587, 784, 587, 494].forEach(function (f, i) { tone('square', f, f, .09, .05, i * .08); }); }
    else if (name === 'golden') { [784, 988, 1175, 1568].forEach(function (f, i) { tone('sine', f, f, .25, .12, i * .09); }); }
    else if (name === 'pop') tone('sine', 500, 1200, .1, .14);
    else if (name === 'baby') { [523, 659, 784, 659, 1047].forEach(function (f, i) { tone('triangle', f, f, .2, .12, i * .13); }); }
    else if (name === 'chat') tone('sine', 900, 1300, .08, .08);
    else if (name === 'snap') { tone('square', 1800, 900, .05, .06); tone('square', 1200, 600, .06, .05, .07); }
  };

  QB.confetti = function (n) {
    var box = document.createElement('div'); box.className = 'qb-confetti';
    var cols = ['#ff5fa2', '#ffd23f', '#34d6c4', '#6cc6ff', '#a07bff', '#ff8a3d'];
    for (var i = 0; i < (n || 80); i++) {
      var p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw'; p.style.background = pick(cols);
      p.style.animationDuration = (1.6 + Math.random() * 1.8) + 's'; p.style.animationDelay = (Math.random() * .4) + 's';
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(function () { box.remove(); }, 4200);
  };

  /* ------------------------------------------------------------------ D-pad */
  QB.dpad = function (onDir, small) {
    var el = document.createElement('div');
    el.className = 'qb-dpad' + (small ? ' sm' : '');
    el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Roll the cube');
    el.innerHTML = '<button type="button" class="n" data-dir="N" aria-label="Roll up">▲</button><button type="button" class="w" data-dir="W" aria-label="Roll left">◀</button>' +
      '<span class="mid" aria-hidden="true">🎲</span><button type="button" class="e" data-dir="E" aria-label="Roll right">▶</button><button type="button" class="s" data-dir="S" aria-label="Roll down">▼</button>';
    el.addEventListener('click', function (e) { var b = e.target.closest('[data-dir]'); if (b) onDir(b.getAttribute('data-dir')); });
    el.hit = function (d) { var b = el.querySelector('[data-dir="' + d + '"]'); if (b) { b.classList.add('hit'); setTimeout(function () { b.classList.remove('hit'); }, 120); } };
    return el;
  };
  /* Arrow keys / WASD while `active()` is true. Returns a function that removes the listener. */
  QB.keys = function (onDir, active) {
    var map = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E', w: 'N', s: 'S', a: 'W', d: 'E', W: 'N', S: 'S', A: 'W', D: 'E' };
    function k(e) {
      if (!map[e.key] || (active && !active())) return;
      var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) || document.querySelector('.ui-modal-wrap') || document.body.classList.contains('modal-open')) return;
      e.preventDefault(); onDir(map[e.key]);
    }
    document.addEventListener('keydown', k);
    return function () { document.removeEventListener('keydown', k); };
  };

  /* ------------------------------------------------------------------ draw pad */
  QB.drawPad = function (opts) {
    var N = 160, el = document.createElement('div');
    el.className = 'qb-pad';
    var cols = ['#2b1d45', '#ffffff', '#ff3b3b', '#ff8a3d', '#ffd23f', '#4cd964', '#2f8cff', '#a07bff', '#ff5fa2', '#8b5a3c'];
    el.innerHTML = '<div class="qb-pad-canvas"><canvas class="base" width="' + N + '" height="' + N + '"></canvas><canvas class="ink" width="' + N + '" height="' + N + '"></canvas>' +
      '<canvas class="feat" width="256" height="256"></canvas></div>' +
      '<div class="qb-pad-tools" data-cols>' + cols.map(function (c, i) {
        return '<button type="button" data-col="' + c + '" class="' + (i === 0 ? 'on' : '') + '" style="background:' + c + '" aria-label="Crayon colour"></button>';
      }).join('') + '<button type="button" data-col="rainbow" class="rainbow" aria-label="Rainbow crayon"></button></div>' +
      '<div class="qb-pad-tools"><button type="button" data-size="3" aria-label="Thin">•</button><button type="button" data-size="6" class="on" aria-label="Medium" style="font-size:1.4rem">•</button>' +
      '<button type="button" data-size="11" aria-label="Thick" style="font-size:2rem">•</button><span class="sep"></span>' +
      ['⭐', '💖', '🌸', '✨'].map(function (s) { return '<button type="button" data-stamp="' + s + '" aria-label="Stamp">' + s + '</button>'; }).join('') +
      '<span class="sep"></span><button type="button" data-erase aria-label="Eraser">🧽</button><button type="button" data-undo aria-label="Undo">↩️</button><button type="button" data-clear aria-label="Clear">🗑️</button></div>';
    var base = el.querySelector('.base'), ink = el.querySelector('.ink'), feat = el.querySelector('.feat');
    var bc = base.getContext('2d'), ic = ink.getContext('2d'), fc = feat.getContext('2d');
    var state = { col: cols[0], size: 6, erase: false, stamp: null, hue: 0, cube: opts.cube }, undo = [], dirty = false;
    function paintBase() {
      bc.fillStyle = state.cube.color || '#ff5fa2'; bc.fillRect(0, 0, N, N);
      fc.clearRect(0, 0, 256, 256);
      QB.paintFace(fc, 256, { color: state.cube.color, eyes: state.cube.eyes, mouth: state.cube.mouth }, { noBg: true });
    }
    paintBase();
    if (opts.cube.drawing) { var im = QB.img(opts.cube.drawing, function () { ic.drawImage(im, 0, 0, N, N); }); if (im && im.complete) ic.drawImage(im, 0, 0, N, N); }
    function pos(e) { var r = ink.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * N, (e.clientY - r.top) / r.height * N]; }
    function save() { try { undo.push(ic.getImageData(0, 0, N, N)); if (undo.length > 25) undo.shift(); } catch (e) {} }
    var last = null;
    function stroke(p) {
      ic.globalCompositeOperation = state.erase ? 'destination-out' : 'source-over';
      if (state.col === 'rainbow' && !state.erase) { state.hue = (state.hue + 7) % 360; ic.strokeStyle = 'hsl(' + state.hue + ',95%,60%)'; } else ic.strokeStyle = state.col;
      ic.lineWidth = state.erase ? state.size * 2.2 : state.size; ic.lineCap = 'round'; ic.lineJoin = 'round';
      ic.beginPath(); ic.moveTo(last[0], last[1]); ic.lineTo(p[0] + .01, p[1]); ic.stroke();
      last = p; dirty = true;
    }
    var area = el.querySelector('.qb-pad-canvas');
    area.addEventListener('pointerdown', function (e) {
      e.preventDefault(); save(); var p = pos(e);
      if (state.stamp) {
        ic.globalCompositeOperation = 'source-over'; ic.font = (state.size * 3 + 10) + 'px serif'; ic.textAlign = 'center'; ic.textBaseline = 'middle';
        ic.fillText(state.stamp, p[0], p[1]); dirty = true; if (opts.onChange) opts.onChange(); return;
      }
      last = p; stroke(p);
      try { area.setPointerCapture(e.pointerId); } catch (x) {}
      area._down = true;
    });
    area.addEventListener('pointermove', function (e) { if (area._down) stroke(pos(e)); });
    function up() { if (area._down) { area._down = false; if (opts.onChange) opts.onChange(); } }
    area.addEventListener('pointerup', up); area.addEventListener('pointercancel', up); area.addEventListener('pointerleave', up);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var group = b.parentNode;
      if (b.hasAttribute('data-col')) { state.col = b.getAttribute('data-col'); state.erase = false; state.stamp = null; el.querySelectorAll('[data-erase],[data-stamp]').forEach(function (x) { x.classList.remove('on'); }); }
      if (b.hasAttribute('data-size')) state.size = +b.getAttribute('data-size');
      if (b.hasAttribute('data-erase')) { state.erase = !state.erase; state.stamp = null; b.classList.toggle('on', state.erase); return; }
      if (b.hasAttribute('data-stamp')) { var s = b.getAttribute('data-stamp'); state.stamp = state.stamp === s ? null : s; state.erase = false; el.querySelectorAll('[data-stamp],[data-erase]').forEach(function (x) { x.classList.toggle('on', x === b && !!state.stamp); }); return; }
      if (b.hasAttribute('data-undo')) { var u = undo.pop(); if (u) { ic.putImageData(u, 0, 0); dirty = true; if (opts.onChange) opts.onChange(); } return; }
      if (b.hasAttribute('data-clear')) { save(); ic.clearRect(0, 0, N, N); dirty = true; if (opts.onChange) opts.onChange(); return; }
      group.querySelectorAll(b.hasAttribute('data-col') ? '[data-col]' : '[data-size]').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
    function empty() { try { var d = ic.getImageData(0, 0, N, N).data; for (var i = 3; i < d.length; i += 4) if (d[i]) return false; } catch (e) { return false; } return true; }
    return {
      el: el,
      setCube: function (cube) { state.cube = cube; paintBase(); },
      toDataURL: function () { return empty() ? '' : ink.toDataURL('image/png'); },
      dirty: function () { return dirty; }
    };
  };

  /* ================================================================== 3D (three.js) */
  var threeP = null;
  QB.three = function () {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (!threeP) threeP = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = '_/theme/three.min.js'; s.async = true;
      s.onload = function () { window.THREE ? res(window.THREE) : rej(new Error('3D failed to load')); };
      s.onerror = function () { threeP = null; rej(new Error('3D failed to load')); };
      document.head.appendChild(s);
    });
    return threeP;
  };
  var glOk = null;
  QB.glOK = function () {
    if (glOk === null) { try { var c = document.createElement('canvas'); glOk = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { glOk = false; } }
    return glOk;
  };

  var GEO = {}, ICON_TEX = null, SPRITES = {};
  /* A rounded box whose UVs cover each face evenly (so the face texture isn't squashed). */
  function roundedBox(T, size) {
    if (GEO[size]) return GEO[size];
    var k = 4, seg = 2 * k + 2, h = size / 2, r = size * .2;
    var g = new T.BoxGeometry(size, size, size, seg, seg, seg);
    var pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, step = size / seg;
    function remap(c) {
      var i = Math.round((c + h) / step);
      if (i <= k) return -h + r * (1 - Math.cos(i / k * Math.PI / 2));
      if (i >= seg - k) return h - r * (1 - Math.cos((seg - i) / k * Math.PI / 2));
      return -h + r + (i - k) / (seg - 2 * k) * (size - 2 * r);
    }
    function frac(f) { return (remap(-h + f * size) + h) / size; }
    var v = new T.Vector3(), inner = new T.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v.set(remap(pos.getX(i)), remap(pos.getY(i)), remap(pos.getZ(i)));
      inner.set(Math.max(-h + r, Math.min(h - r, v.x)), Math.max(-h + r, Math.min(h - r, v.y)), Math.max(-h + r, Math.min(h - r, v.z)));
      var d = v.clone().sub(inner), len = d.length();
      if (len > 1e-6) { d.divideScalar(len); v.copy(inner).addScaledVector(d, r); nor.setXYZ(i, d.x, d.y, d.z); }
      pos.setXYZ(i, v.x, v.y, v.z);
      uv.setXY(i, frac(uv.getX(i)), frac(uv.getY(i)));
    }
    g.computeBoundingSphere();
    return (GEO[size] = g);
  }
  function iconTextures(T) {
    if (ICON_TEX) return ICON_TEX;
    ICON_TEX = [0, 1, 2, 3, 4, 5].map(function (f) {
      var cv = document.createElement('canvas'); cv.width = cv.height = 128;
      var c = cv.getContext('2d');
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#d2d2d2'; c.strokeStyle = '#bdbdbd'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
      if (f === 0) { c.beginPath(); for (var i = 0; i <= 8; i++) c.lineTo(i % 2 ? 84 : 44, 30 + i * 8.5); c.lineWidth = 9; c.strokeStyle = '#c4c4c4'; c.stroke(); }
      else if (f === 1) { c.beginPath(); c.arc(48, 72, 20, 0, 7); c.arc(66, 58, 24, 0, 7); c.arc(86, 72, 18, 0, 7); c.fill(); c.fillRect(48, 70, 40, 22); }
      else if (f === 2) { heart(c, 64, 78, 40); c.fill(); }
      else if (f === 3) { c.beginPath(); c.moveTo(38, 66); c.lineTo(90, 66); c.lineTo(82, 100); c.lineTo(46, 100); c.closePath(); c.fill(); c.beginPath(); c.arc(64, 64, 28, Math.PI, 0); c.fill(); c.beginPath(); c.arc(64, 30, 8, 0, 7); c.fill(); }
      else if (f === 5) { c.beginPath(); for (var j = 0; j < 70; j++) { var a = j * .3, rr = 3 + j * .5; c.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } c.lineWidth = 8; c.strokeStyle = '#c4c4c4'; c.stroke(); }
      var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
    });
    return ICON_TEX;
  }
  function sprite(T, ch) {
    if (SPRITES[ch]) return SPRITES[ch];
    var cv = document.createElement('canvas'); cv.width = cv.height = 96;
    var c = cv.getContext('2d'); c.font = '72px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 48, 54);
    var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
    return (SPRITES[ch] = new T.SpriteMaterial({ map: t, transparent: true, depthWrite: false }));
  }
  function mat(T, color, o) { return new T.MeshStandardMaterial(Object.assign({ color: color, roughness: .5, metalness: 0 }, o || {})); }
  QB.mat = mat;

  /* ------------------------------------------------------------------ hats (built from simple shapes, at the cube's top) */
  function stripes(T, a, b) {
    var cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; var c = cv.getContext('2d');
    for (var i = 0; i < 8; i++) { c.fillStyle = i % 2 ? a : b; c.fillRect(0, i * 8, 64, 8); }
    var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function buildHat(T, key) {
    var g = new T.Group(), m;
    function add(geo, material, x, y, z) { var me = new T.Mesh(geo, material); me.position.set(x || 0, y || 0, z || 0); me.castShadow = true; g.add(me); return me; }
    if (key === 'party') {
      var cone = add(new T.ConeGeometry(.24, .55, 28), mat(T, '#ffffff', { map: stripes(T, '#ff5fa2', '#ffd23f') }), 0, .28, 0);
      cone.rotation.z = -.18; add(new T.SphereGeometry(.08, 16, 12), mat(T, '#34d6c4'), .05, .56, 0);
    } else if (key === 'flower') {
      add(new T.CylinderGeometry(.02, .025, .3, 8), mat(T, '#4cd964'), 0, .15, 0);
      var head = new T.Group(); head.position.y = .34; head.rotation.x = .5; g.add(head);
      for (var i = 0; i < 8; i++) { var p = new T.Mesh(new T.SphereGeometry(.07, 12, 8), mat(T, '#ffffff')); p.scale.set(1.5, .5, .8); p.position.set(Math.cos(i / 8 * 6.283) * .1, 0, Math.sin(i / 8 * 6.283) * .1); p.rotation.y = -i / 8 * 6.283; head.add(p); }
      var mid = new T.Mesh(new T.SphereGeometry(.065, 14, 10), mat(T, '#ffd23f')); mid.scale.y = .6; head.add(mid);
    } else if (key === 'bow') {
      m = mat(T, '#ff3b7a');
      var l = add(new T.ConeGeometry(.12, .24, 4), m, -.13, .1, 0); l.rotation.z = -Math.PI / 2;
      var r = add(new T.ConeGeometry(.12, .24, 4), m, .13, .1, 0); r.rotation.z = Math.PI / 2;
      add(new T.SphereGeometry(.06, 12, 10), m, 0, .1, 0); g.position.x = .14; g.rotation.y = .3;
    } else if (key === 'propeller') {
      add(new T.SphereGeometry(.3, 24, 12, 0, 6.283, 0, Math.PI / 2), mat(T, '#ffffff', { map: stripes(T, '#2f8cff', '#ffd23f') }), 0, 0, 0);
      add(new T.CylinderGeometry(.02, .02, .14, 8), mat(T, '#3b2a5a'), 0, .36, 0);
      var prop = new T.Group(); prop.position.y = .43; g.add(prop);
      prop.add(new T.Mesh(new T.BoxGeometry(.5, .015, .07), mat(T, '#ff3b3b'))); var b2 = new T.Mesh(new T.BoxGeometry(.07, .015, .5), mat(T, '#34d6c4')); prop.add(b2);
      g.userData.spin = prop;
    } else if (key === 'chef') {
      m = mat(T, '#ffffff', { roughness: .8 });
      add(new T.CylinderGeometry(.22, .22, .22, 24), m, 0, .11, 0);
      [[0, .32, 0, .2], [-.13, .28, .05, .13], [.13, .28, -.03, .14], [.04, .3, .14, .12], [-.05, .3, -.13, .13]].forEach(function (s) { add(new T.SphereGeometry(s[3], 16, 12), m, s[0], s[1], s[2]); });
    } else if (key === 'cat') {
      [-1, 1].forEach(function (s) {
        var e = add(new T.ConeGeometry(.13, .26, 3), mat(T, '#3b2a5a'), s * .22, .11, 0); e.rotation.z = -s * .25;
        var e2 = add(new T.ConeGeometry(.07, .15, 3), mat(T, '#ff9cc8'), s * .21, .1, .05); e2.rotation.z = -s * .25;
      });
    } else if (key === 'tophat') {
      m = mat(T, '#1f1730', { roughness: .35 });
      add(new T.CylinderGeometry(.34, .34, .03, 32), m, 0, .015, 0);
      add(new T.CylinderGeometry(.21, .21, .4, 32), m, 0, .22, 0);
      add(new T.CylinderGeometry(.215, .215, .07, 32), mat(T, '#ff3b3b'), 0, .07, 0);
      g.rotation.z = .12;
    } else if (key === 'viking') {
      add(new T.SphereGeometry(.3, 24, 12, 0, 6.283, 0, Math.PI / 2), mat(T, '#c3cad8', { metalness: .2, roughness: .35 }), 0, 0, 0);
      [-1, 1].forEach(function (s) { var h = add(new T.ConeGeometry(.07, .32, 16), mat(T, '#fff4e0'), s * .3, .2, 0); h.rotation.z = -s * .7; });
    } else if (key === 'crown') {
      m = mat(T, '#ffd23f', { metalness: .15, roughness: .3, emissive: '#7a5200', emissiveIntensity: .35 });
      add(new T.CylinderGeometry(.26, .26, .14, 28, 1, true), m, 0, .07, 0).material.side = T.DoubleSide;
      for (var j = 0; j < 6; j++) { var a = j / 6 * 6.283; add(new T.ConeGeometry(.06, .16, 10), m, Math.cos(a) * .24, .2, Math.sin(a) * .24); add(new T.SphereGeometry(.035, 10, 8), mat(T, j % 2 ? '#ff3b7a' : '#34d6c4'), Math.cos(a) * .262, .07, Math.sin(a) * .262); }
    } else if (key === 'pumpkin') {
      m = mat(T, '#ff8a1f');
      for (var pk = 0; pk < 6; pk++) { var seg = add(new T.SphereGeometry(.2, 16, 12), m, Math.cos(pk / 6 * 6.283) * .1, .2, Math.sin(pk / 6 * 6.283) * .1); seg.scale.set(.8, 1, .8); }
      add(new T.CylinderGeometry(.03, .045, .14, 8), mat(T, '#4c8a2a'), 0, .42, 0).rotation.z = .3;
      var face = new T.Sprite(sprite(T, '😈')); face.scale.set(.22, .22, .22); face.position.set(0, .22, .27); g.add(face);
    } else if (key === 'witch') {
      add(new T.CylinderGeometry(.36, .36, .03, 32), mat(T, '#2a1f3d'), 0, .015, 0);
      var wc = add(new T.ConeGeometry(.2, .6, 24), mat(T, '#2a1f3d'), 0, .32, 0); wc.rotation.z = -.25;
      add(new T.CylinderGeometry(.205, .205, .07, 24), mat(T, '#a07bff'), 0, .06, 0);
    } else if (key === 'santa') {
      var sc = add(new T.ConeGeometry(.23, .5, 24), mat(T, '#e8303a'), .04, .27, 0); sc.rotation.z = -.35;
      add(new T.TorusGeometry(.23, .06, 10, 28), mat(T, '#ffffff', { roughness: .9 }), 0, .04, 0).rotation.x = Math.PI / 2;
      add(new T.SphereGeometry(.08, 12, 10), mat(T, '#ffffff', { roughness: .9 }), .2, .48, 0);
    } else if (key === 'antlers') {
      m = mat(T, '#8b5a3c');
      [-1, 1].forEach(function (s2) {
        var b1 = add(new T.CylinderGeometry(.025, .035, .36, 8), m, s2 * .2, .17, 0); b1.rotation.z = -s2 * .4;
        var b2 = add(new T.CylinderGeometry(.02, .025, .16, 8), m, s2 * .3, .26, 0); b2.rotation.z = s2 * .6;
      });
      add(new T.SphereGeometry(.07, 12, 10), mat(T, '#ff2b2b', { emissive: '#ff0000', emissiveIntensity: .4 }), 0, -.38, .47);
    } else if (key === 'bunny') {
      [-1, 1].forEach(function (s3) {
        var ear = add(new T.SphereGeometry(.09, 14, 12), mat(T, '#ffffff'), s3 * .14, .26, 0); ear.scale.set(.8, 2.6, .5); ear.rotation.z = -s3 * .15;
        var inn = add(new T.SphereGeometry(.05, 12, 10), mat(T, '#ffb3d0'), s3 * .14, .26, .03); inn.scale.set(.8, 3.2, .4); inn.rotation.z = -s3 * .15;
      });
    } else if (key === 'sunhat') {
      add(new T.CylinderGeometry(.48, .48, .03, 36), mat(T, '#f5d27a', { roughness: .9 }), 0, .015, 0);
      add(new T.SphereGeometry(.22, 20, 12, 0, 6.283, 0, Math.PI / 2), mat(T, '#f5d27a', { roughness: .9 }), 0, .02, 0);
      add(new T.CylinderGeometry(.225, .225, .06, 24), mat(T, '#ff5fa2'), 0, .05, 0);
    } else if (key === 'halo') {
      var halo = add(new T.TorusGeometry(.26, .04, 12, 36), mat(T, '#ffe36b', { emissive: '#ffd23f', emissiveIntensity: .8 }), 0, .32, 0);
      halo.rotation.x = Math.PI / 2; g.userData.bob = halo;
    }
    return g;
  }
  QB.buildHat = buildHat;

  /* ------------------------------------------------------------------ the stage */
  function Stage(container, opts) {
    var T = window.THREE, self = this;
    this.T = T; this.opts = opts = opts || {};
    this.kind = opts.kind || 'hero';
    this.W = opts.w || (this.kind === 'hero' ? 5 : 1); this.D = opts.d || (this.kind === 'hero' ? 5 : 1); this.tile = 1;
    this.blockedTiles = {}; this.nextIdle = 2;
    this.actors = {}; this.anims = []; this.parts = []; this.tags = true;
    container.classList.add('qb-stage');
    QB.lastStage = this;   // handy for tests and the console
    this.el = container;
    var r = this.renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: !!opts.keep });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
    container.appendChild(r.domElement);
    this.overlay = document.createElement('div'); this.overlay.className = 'qb-overlay'; container.appendChild(this.overlay);
    var sc = this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(opts.fov || 34, 1, .1, 400);
    sc.add(new T.HemisphereLight('#fff7ea', '#c7a6ff', 1.25));
    var sun = this.sun = new T.DirectionalLight('#ffffff', 2.1);
    var big = Math.max(this.W, this.D) * .75 + 3;
    sun.position.set(big * .6, big * 1.6, big * .9); sun.castShadow = true;
    sun.shadow.mapSize.set(this.kind === 'world' ? 2048 : 1024, this.kind === 'world' ? 2048 : 1024);
    var sh = sun.shadow.camera; sh.left = -big; sh.right = big; sh.top = big; sh.bottom = -big; sh.near = .5; sh.far = big * 5;
    sun.shadow.bias = -0.0008; sun.shadow.normalBias = .02;
    sc.add(sun); sc.add(sun.target);
    this.look = new T.Vector3(0, .3, 0); this.camGoal = new T.Vector3(); this.zoom = 1;
    this.ray = new T.Raycaster(); this.clock = new T.Clock();
    this._resize = function () { self.resize(); };
    if (window.ResizeObserver) { this._ro = new ResizeObserver(this._resize); this._ro.observe(container); } else window.addEventListener('resize', this._resize);
    this.resize();
    this._input();
    this._loop = function () { if (self.dead) return; self.raf = requestAnimationFrame(self._loop); self.frame(); };
    this.raf = requestAnimationFrame(this._loop);
    if (opts.snap) {
      var snap = document.createElement('button'); snap.type = 'button'; snap.className = 'qb-sound qb-snap'; snap.setAttribute('aria-label', 'Take a photo'); snap.textContent = '📸';
      snap.addEventListener('click', function (e) { e.stopPropagation(); self.snapshot(); });
      container.appendChild(snap);
    }
    if (opts.sound !== false) {
      var sb = document.createElement('button'); sb.type = 'button'; sb.className = 'qb-sound'; sb.setAttribute('aria-label', 'Sound on or off');
      var paint = function () { sb.textContent = QB.muted() ? '🔇' : '🔊'; }; paint();
      sb.addEventListener('click', function (e) { e.stopPropagation(); QB.setMuted(!QB.muted()); paint(); if (!QB.muted()) QB.sfx('pop'); });
      container.appendChild(sb);
      this._music = true; QB.music.add();
    }
  }
  QB.Stage = Stage;
  Stage.prototype.tileToWorld = function (x, z) { return { x: (x - (this.W - 1) / 2) * this.tile, z: (z - (this.D - 1) / 2) * this.tile }; };
  Stage.prototype.resize = function () {
    var w = this.el.clientWidth || 300, h = this.el.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.aspect = w / h;
    this.placeCamera(true);
  };
  Stage.prototype.placeCamera = function (snap) {
    var a = this.aspect || 1, c = this.camera;
    if (this.kind === 'hero') { var d = (a < 0.9 ? 7.2 : 5.9) * (this.opts.dist || 1); this.heroD = d; this.camGoal.set(0, d * .58, d); this.look.set(0, .3, 0); }
    else if (this.kind === 'cubby') { var span = Math.max(this.W, this.D / Math.max(a, .6) * 1.25), dd = Math.max(span * 1.02 + 1.6, (this.W / 2 + .7) / (Math.tan(this.camera.fov * Math.PI / 360) * a) / 1.154); this.camGoal.set(0, dd * .85, dd * .78); this.look.set(0, 0, .3); }
    else if (this.kind === 'world') { var z = (a < 0.9 ? 13.5 : 11.5) * this.zoom, tg = this.follow || new this.T.Vector3(); this.camGoal.set(tg.x, z * .95, tg.z + z * .8); this.look.set(tg.x, 0, tg.z - .5); }
    if (snap) { c.position.copy(this.camGoal); c.lookAt(this.look); }
  };
  Stage.prototype.frame = function () {
    var dt = Math.min(.05, this.clock.getDelta()), now = performance.now(), T = this.T, self = this;
    this.time = (this.time || 0) + dt;
    // animations
    for (var i = this.anims.length - 1; i >= 0; i--) {
      var a = this.anims[i], p = Math.min(1, (now - a.t0) / a.dur);
      try { a.fn(p); } catch (e) { console.error(e); }
      if (p >= 1) { this.anims.splice(i, 1); if (a.done) a.done(); }
    }
    // particles
    for (var j = this.parts.length - 1; j >= 0; j--) {
      var s = this.parts[j]; s.userData.life -= dt;
      var v = s.userData.v; v.y -= (s.userData.g || 0) * dt;
      s.position.addScaledVector(v, dt);
      s.material.opacity = Math.max(0, Math.min(1, s.userData.life / .4));
      if (s.userData.life <= 0) { this.scene.remove(s); s.material.dispose(); this.parts.splice(j, 1); }
    }
    Object.keys(this.actors).forEach(function (k) { self.actors[k].tick(dt, now); });
    if (this.onFrame) this.onFrame(dt);
    if (this.kind === 'world' && this.follow) this.placeCamera(false);
    if (this.kind === 'hero') {   // gently follow the cube around the mat
      var first = this.actors[Object.keys(this.actors)[0]], fx = first ? first.root.position.x : 0, fz = first ? first.root.position.z : 0;
      this.camGoal.x = Math.sin(this.time * .35) * .5 + fx * .45; this.camGoal.z = (this.heroD || 5) + fz * .4;
      this.look.x += (fx * .55 - this.look.x) * .06; this.look.z += (fz * .5 - this.look.z) * .06;
    }
    if (this.opts.idle && this.time > this.nextIdle) {   // cubes do little things on their own
      this.nextIdle = this.time + 1.4 + Math.random() * 2.2;
      var idle = Object.keys(this.actors).map(function (k) { return self.actors[k]; }).filter(function (x) { return !x.selected && !x.busy && !x.rolling && !x.waiting; });
      if (idle.length) pick(idle).idle();
    }
    if (this.egg) { this.egg.position.y = Math.sin(this.time * 3) * .1; this.egg.children[1].rotation.z += dt * 2; }
    if (this.weather) this.weather(dt);
    this.camera.position.lerp(this.camGoal, this.kind === 'world' ? .08 : .06);
    this.camera.lookAt(this.look);
    this.renderer.render(this.scene, this.camera);
    this.updateOverlay();
  };
  Stage.prototype.anim = function (dur, fn, done) { this.anims.push({ t0: performance.now(), dur: dur, fn: fn, done: done }); };
  Stage.prototype.burst = function (pos, chars, n, o) {
    var T = this.T; o = o || {};
    for (var i = 0; i < n; i++) {
      var s = new T.Sprite(sprite(T, Array.isArray(chars) ? pick(chars) : chars).clone());
      var sz = (o.size || .32) * (.7 + Math.random() * .6);
      s.scale.set(sz, sz, sz); s.position.copy(pos);
      s.position.x += (Math.random() - .5) * (o.spread || .5); s.position.z += (Math.random() - .5) * (o.spread || .5);
      var ang = Math.random() * 6.283, sp = (o.speed || 1.4) * (.5 + Math.random());
      s.userData = { v: new T.Vector3(Math.cos(ang) * sp * (o.flat || 1), (o.up || 2.2) * (.6 + Math.random() * .7), Math.sin(ang) * sp * (o.flat || 1)), life: (o.life || 1.2) * (.7 + Math.random() * .5), g: o.g == null ? 2.5 : o.g };
      this.scene.add(s); this.parts.push(s);
    }
  };
  Stage.prototype.screen = function (v3) {
    var p = v3.clone().project(this.camera);
    return { x: (p.x + 1) / 2 * this.el.clientWidth, y: (1 - p.y) / 2 * this.el.clientHeight, behind: p.z > 1 };
  };
  Stage.prototype.pop = function (actor, text, cls, color) {
    var el = document.createElement('div'); el.className = 'qb-pop ' + (cls || ''); el.textContent = text;
    if (color) el.style.color = color;
    el._actor = actor; el._dy = cls === 'small' ? 1.9 : 1.45;
    this.overlay.appendChild(el); this.place(el);
    setTimeout(function () { el.remove(); }, 1650);
  };
  Stage.prototype.place = function (el) {
    var a = el._actor; if (!a) return;
    var v = a.root.position.clone(); v.y += a.size * (el._dy || 1.2) + (a.squash.position.y || 0);
    var s = this.screen(v);
    el.style.display = s.behind ? 'none' : '';
    el.style.left = s.x + 'px'; el.style.top = s.y + 'px';
  };
  Stage.prototype.updateOverlay = function () {
    var kids = this.overlay.children;
    for (var i = 0; i < kids.length; i++) this.place(kids[i]);
  };
  /* Can a cube stand on tile x, z? (inside the mat / map, not a prop, nobody else there) */
  Stage.prototype.free = function (x, z, except) {
    if (x < 0 || z < 0 || x >= this.W || z >= this.D) return false;
    if (this.kind === 'hero') { var c = this.tileToWorld(x, z); if (Math.sqrt(c.x * c.x + c.z * c.z) > 2.05) return false; }
    if (this.blockedTiles[x + ',' + z]) return false;
    var self = this;
    return !Object.keys(this.actors).some(function (k) { var o = self.actors[k]; return o !== except && o.d.x === x && o.d.z === z; });
  };
  /* Tapping a cube pushes it: it tumbles away from where the finger touched it. */
  Stage.prototype.pushDir = function (a, e) {
    if (!e) return pick(['N', 'S', 'E', 'W']);
    var s = this.screen(a.root.position), r = this.el.getBoundingClientRect();
    var dx = e.clientX - r.left - s.x, dy = e.clientY - r.top - s.y;
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return pick(['N', 'S', 'E', 'W']);
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'W' : 'E') : (dy > 0 ? 'N' : 'S');
  };
  Stage.prototype.snapshot = function () {
    this.renderer.render(this.scene, this.camera);
    var url = this.renderer.domElement.toDataURL('image/png');
    var a = document.createElement('a'); a.href = url; a.download = 'quickybricks-' + new Date().toISOString().slice(0, 10) + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    var f = document.createElement('div'); f.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:.9;transition:opacity .5s;pointer-events:none;z-index:5';
    this.el.appendChild(f); setTimeout(function () { f.style.opacity = 0; }, 30); setTimeout(function () { f.remove(); }, 600);
    QB.sfx('snap'); UI.toast('📸 Snap! Saved to your downloads.', 'ok');
  };
  /* The Surprise Egg in the World: {x, z} or null */
  Stage.prototype.setEgg = function (pos) {
    var T = this.T;
    if (!pos) { if (this.eggG) { this.scene.remove(this.eggG); this.eggG = null; this.egg = null; } return; }
    if (!this.eggG) {
      var g = this.eggG = new T.Group(), inner = this.egg = new T.Group();
      var s = new T.Sprite(sprite(T, '🥚')); s.scale.set(.75, .75, .75); s.position.y = .55; inner.add(s);
      var ring = new T.Mesh(new T.TorusGeometry(.42, .05, 8, 32), mat(T, '#ffd23f', { emissive: '#ffb000', emissiveIntensity: .9 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = .06; inner.add(ring);
      var glow = new T.Sprite(sprite(T, '✨')); glow.scale.set(.5, .5, .5); glow.position.set(.3, 1, 0); inner.add(glow);
      g.add(inner); this.scene.add(g);
    }
    var c = this.tileToWorld(pos.x, pos.z); this.eggG.position.set(c.x, 0, c.z); this.eggPos = pos;
  };
  /* Seasonal decorations around the edge (no tiles) and weather. */
  Stage.prototype.decorate = function (season) {
    var T = this.T, self = this, set = { halloween: ['🎃', '🎃', '👻', '🕸️'], winter: ['⛄', '🎄', '🎁', '❄️'], spring: ['🌷', '🌸', '🐣', '🌼'], summer: ['🌴', '⛱️', '🍉', '🌻'] }[season];
    if (!set) return;
    var R = this.kind === 'world' ? Math.max(this.W, this.D) * .62 : Math.max(this.W, this.D) * .62 + .6, n = this.kind === 'world' ? 16 : 7;
    for (var i = 0; i < n; i++) {
      var a = i / n * 6.283 + .2, s = new T.Sprite(sprite(T, set[i % set.length]));
      var sz = this.kind === 'world' ? 1.3 : .8; s.scale.set(sz, sz, sz);
      s.position.set(Math.cos(a) * R, sz / 2 - .1, Math.sin(a) * R * (this.kind === 'world' ? 1 : .8));
      this.scene.add(s);
    }
    var flyers = [], ch = { halloween: '🦇', winter: '❄️', spring: '🦋', summer: '🦋' }[season];
    var count = season === 'winter' ? 60 : 8;
    for (var j = 0; j < count; j++) {
      var f = new T.Sprite(sprite(T, ch)); var z = season === 'winter' ? .25 : .55; f.scale.set(z, z, z);
      f.userData = { a: Math.random() * 6.283, r: 2 + Math.random() * this.W * .45, h: 2 + Math.random() * 4, sp: .3 + Math.random() * .5 };
      f.position.set((Math.random() - .5) * this.W * 1.2, Math.random() * 9, (Math.random() - .5) * this.D * 1.2);
      this.scene.add(f); flyers.push(f);
    }
    this.weather = function (dt) {
      flyers.forEach(function (f) {
        var u = f.userData;
        if (season === 'winter') { f.position.y -= dt * (.6 + u.sp); f.position.x += Math.sin(self.time + u.a) * dt * .3; if (f.position.y < 0) f.position.y = 9; }
        else { u.a += dt * u.sp; f.position.set(Math.cos(u.a) * u.r, u.h + Math.sin(self.time * 3 + u.a) * .3, Math.sin(u.a) * u.r * .7); }
      });
    };
  };
  Stage.prototype.setNight = function () {
    var T = this.T;
    this.night = true;
    this.scene.children.forEach(function (o) { if (o.isHemisphereLight) { o.intensity = .6; o.color.set('#9fa8ff'); } });
    this.sun.intensity = .9; this.sun.color.set('#c3ccff');
    if (this.sunSprite) this.sunSprite.material = sprite(T, '🌙');
    var g = new T.BufferGeometry(), pts = [];
    for (var i = 0; i < 400; i++) { var a = Math.random() * 6.283, e = .15 + Math.random() * 1.2, r = 70; pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r - 20); }
    g.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    this.scene.add(new T.Points(g, new T.PointsMaterial({ color: '#ffffff', size: .5 })));
    if (this.sea) this.sea.material.color.set('#3b4c9a');
    this.el.classList.add('qb-night');
  };
  Stage.prototype.add = function (d) {
    var a = new Actor(this, d); this.actors[d.id] = a; return a;
  };
  Stage.prototype.remove = function (id) {
    var a = this.actors[id]; if (!a) return;
    a.dispose(); delete this.actors[id];
  };
  Stage.prototype.pickAt = function (cx, cy) {
    var r = this.renderer.domElement.getBoundingClientRect();
    var m = new this.T.Vector2((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(m, this.camera);
    var self = this, meshes = Object.keys(this.actors).map(function (k) { return self.actors[k].mesh; });
    var hit = this.ray.intersectObjects(meshes, false)[0];
    return hit ? hit.object.userData.actor : null;
  };
  Stage.prototype._input = function () {
    var self = this, el = this.renderer.domElement, start = null;
    el.addEventListener('pointerdown', function (e) { start = { x: e.clientX, y: e.clientY, t: Date.now() }; });
    el.addEventListener('pointerup', function (e) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y, dist = Math.sqrt(dx * dx + dy * dy);
      start = null;
      if (dist > 28 && self.onSwipe) self.onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N'));
      else if (dist <= 12 && self.onPick) self.onPick(self.pickAt(e.clientX, e.clientY), e);
    });
    el.addEventListener('wheel', function (e) {
      if (self.kind !== 'world') return;
      e.preventDefault(); self.zoom = Math.max(.55, Math.min(1.8, self.zoom * (e.deltaY > 0 ? 1.08 : .92)));
    }, { passive: false });
  };
  Stage.prototype.destroy = function () {
    this.dead = true; cancelAnimationFrame(this.raf);
    if (this._music) { this._music = false; QB.music.remove(); }
    if (this._ro) this._ro.disconnect(); else window.removeEventListener('resize', this._resize);
    var self = this;
    Object.keys(this.actors).forEach(function (k) { self.actors[k].dispose(); });
    this.scene.traverse(function (o) { if (o.geometry && !o.geometry._shared) o.geometry.dispose(); });
    this.renderer.dispose();
    try { this.renderer.forceContextLoss(); } catch (e) {}
    this.renderer.domElement.remove(); this.overlay.remove();
  };

  /* ------------------------------------------------------------------ grounds and props */
  function checker(T, n, a, b, px) {
    var cv = document.createElement('canvas'); cv.width = cv.height = n * (px || 32); var c = cv.getContext('2d'), s = px || 32;
    for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) { c.fillStyle = (i + j) % 2 ? a : b; c.fillRect(i * s, j * s, s, s); }
    var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }
  Stage.prototype.heroGround = function () {
    var T = this.T;
    var mat1 = new T.Mesh(new T.CylinderGeometry(2.3, 2.45, .24, 48), [mat(T, '#ffd23f'), mat(T, '#fff', { map: checker(T, 8, '#ffe0ee', '#fff6fb') }), mat(T, '#ffd23f')]);
    mat1.position.y = -.12; mat1.receiveShadow = true; this.scene.add(mat1);
    var ring = new T.Mesh(new T.TorusGeometry(2.3, .09, 12, 64), mat(T, '#ff5fa2'));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0; this.scene.add(ring);
    for (var i = 0; i < 14; i++) {
      var a = i / 14 * 6.283, s = new T.Mesh(new T.SphereGeometry(.07, 10, 8), mat(T, ['#34d6c4', '#ffd23f', '#a07bff', '#6cc6ff'][i % 4]));
      s.position.set(Math.cos(a) * 2.3, .08, Math.sin(a) * 2.3); this.scene.add(s);
    }
  };
  Stage.prototype.cubbyGround = function (toys) {
    var T = this.T, W = this.W, D = this.D;
    var floor = new T.Mesh(new T.BoxGeometry(W + .6, .3, D + .6), [mat(T, '#ff9cc8'), mat(T, '#ff9cc8'), mat(T, '#fff', { map: checker(T, Math.max(W, D) + 1, '#ffe9c9', '#fff6e6') }), mat(T, '#ff9cc8'), mat(T, '#ff9cc8'), mat(T, '#ff9cc8')]);
    floor.material[2].map.repeat.set((W + .6) / (Math.max(W, D) + 1), (D + .6) / (Math.max(W, D) + 1));
    floor.position.y = -.15; floor.receiveShadow = true; this.scene.add(floor);
    var rim = mat(T, '#f0428c');
    [[0, -(D + .6) / 2, W + .9, .3], [0, (D + .6) / 2, W + .9, .3]].forEach(function (b) { var m = new T.Mesh(new T.BoxGeometry(b[2], .36, b[3]), rim); m.position.set(b[0], -.05, b[1]); m.receiveShadow = true; this.scene.add(m); }, this);
    [[-(W + .6) / 2, 0, .3, D + .9], [(W + .6) / 2, 0, .3, D + .9]].forEach(function (b) { var m = new T.Mesh(new T.BoxGeometry(b[2], .36, b[3]), rim); m.position.set(b[0], -.05, b[1]); this.scene.add(m); }, this);
    var spots = [[-W / 2 - 1.3, -D / 2 + .5], [W / 2 + 1.3, -D / 2 + .5], [-W / 2 - 1.3, D / 2 - .8], [W / 2 + 1.3, D / 2 - .8], [0, -D / 2 - 1.4], [-W / 2 - 1.3, 0]];
    var self = this;
    (toys || []).forEach(function (t, i) { if (spots[i]) self.prop({ kind: t }, spots[i][0], spots[i][1]); });
  };
  Stage.prototype.worldGround = function (props) {
    var T = this.T, W = this.W, D = this.D, self = this;
    var grass = new T.Mesh(new T.BoxGeometry(W, .4, D), [mat(T, '#ffd9a0'), mat(T, '#ffd9a0'), mat(T, '#fff', { map: checker(T, W, '#9df0c8', '#b6f5d6', 16) }), mat(T, '#ffd9a0'), mat(T, '#ffd9a0'), mat(T, '#ffd9a0')]);
    grass.position.y = -.2; grass.receiveShadow = true; this.scene.add(grass);
    var sand = new T.Mesh(new T.CylinderGeometry(W * .82, W * .86, .5, 64), mat(T, '#ffe2b0'));
    sand.position.y = -.42; sand.receiveShadow = true; this.scene.add(sand);
    var sea = new T.Mesh(new T.CircleGeometry(W * 3, 64), mat(T, '#7fd3ff', { roughness: .2 }));
    sea.rotation.x = -Math.PI / 2; sea.position.y = -.6; this.scene.add(sea);
    this.sea = sea;
    (props || []).forEach(function (p) {
      var c = self.tileToWorld(p.x + (p.w - 1) / 2, p.z + (p.d - 1) / 2); self.prop(p, c.x, c.z);
      for (var dx = 0; dx < p.w; dx++) for (var dz = 0; dz < p.d; dz++) self.blockedTiles[(p.x + dx) + ',' + (p.z + dz)] = 1;
    });
    // sky things (no tiles): clouds, a smiling sun, a rainbow
    for (var i = 0; i < 7; i++) {
      var cl = new T.Group(); var cm = mat(T, '#ffffff', { roughness: .9 });
      for (var j = 0; j < 4; j++) { var b = new T.Mesh(new T.SphereGeometry(.7 + Math.random() * .5, 16, 12), cm); b.position.set(j * .9 - 1.3, Math.random() * .3, Math.random() * .4); cl.add(b); }
      cl.position.set((Math.random() - .5) * W * 1.6, 7 + Math.random() * 3, -D * .2 - Math.random() * D * .9); cl.userData.drift = .2 + Math.random() * .3;
      this.scene.add(cl); (this.clouds = this.clouds || []).push(cl);
    }
    var sunS = this.sunSprite = new T.Sprite(sprite(T, '🌞')); sunS.scale.set(4, 4, 4); sunS.position.set(W * .45, 11, -D * .9); this.scene.add(sunS);
    var cols = ['#ff5f5f', '#ff9a3d', '#ffd23f', '#4cd964', '#6cc6ff', '#a07bff'];
    cols.forEach(function (c, k) { var rb = new T.Mesh(new T.TorusGeometry(W * .55 - k * .45, .22, 10, 64, Math.PI), mat(T, c, { roughness: .6 })); rb.position.set(-W * .15, -.4, -D * .78); self.scene.add(rb); });
  };
  /* One prop at world x, z: gazebo, lolly, jelly, mushroom, donut, gumdrop, pinwheel, and the Cubby toys. */
  Stage.prototype.prop = function (p, x, z) {
    var T = this.T, g = new T.Group(), self = this;
    function add(geo, m, px, py, pz) { var me = new T.Mesh(geo, m); me.position.set(px || 0, py || 0, pz || 0); me.castShadow = true; me.receiveShadow = true; g.add(me); return me; }
    var k = p.kind;
    if (k === 'lolly') {
      add(new T.CylinderGeometry(.06, .06, 1.6, 10), mat(T, '#ffffff'), 0, .8, 0);
      var cv = document.createElement('canvas'); cv.width = cv.height = 128; var c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 128);
      c.strokeStyle = p.color || '#ff5fa2'; c.lineWidth = 14; c.beginPath(); for (var i = 0; i < 80; i++) { var a = i * .25, r = i * .8; c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } c.stroke();
      var tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
      var head = add(new T.CylinderGeometry(.55, .55, .18, 32), [mat(T, p.color || '#ff5fa2'), mat(T, '#fff', { map: tx }), mat(T, '#fff', { map: tx })], 0, 1.75, 0);
      head.rotation.x = Math.PI / 2; g.userData.wob = head;
    } else if (k === 'gazebo') {
      var post = mat(T, '#ffffff');
      [[-.8, -.8], [.8, -.8], [-.8, .8], [.8, .8]].forEach(function (q) { add(new T.CylinderGeometry(.08, .08, 1.5, 10), post, q[0], .75, q[1]); });
      add(new T.CylinderGeometry(1.15, 1.2, .14, 32), mat(T, '#ffe0ee'), 0, .07, 0);
      add(new T.ConeGeometry(1.45, .9, 4), mat(T, '#ff5fa2'), 0, 1.95, 0).rotation.y = Math.PI / 4;
      var hs = new T.Sprite(sprite(T, '💞')); hs.scale.set(.9, .9, .9); hs.position.y = 2.75; g.add(hs); g.userData.bob = hs;
    } else if (k === 'jelly') {
      var j = add(new T.BoxGeometry(2.8, .45, 1.8), mat(T, '#6cc6ff', { transparent: true, opacity: .75, roughness: .1 }), 0, .2, 0); g.userData.jiggle = j;
      add(new T.BoxGeometry(3, .2, 2), mat(T, '#ffffff'), 0, .05, 0);
    } else if (k === 'mushroom') {
      add(new T.CylinderGeometry(.18, .24, .6, 14), mat(T, '#fff4e0'), 0, .3, 0);
      add(new T.SphereGeometry(.5, 24, 12, 0, 6.283, 0, Math.PI / 2), mat(T, '#ff3b3b'), 0, .55, 0);
      for (var d = 0; d < 6; d++) { var an = d / 6 * 6.283; add(new T.SphereGeometry(.07, 10, 8), mat(T, '#ffffff'), Math.cos(an) * .32, .82, Math.sin(an) * .32); }
    } else if (k === 'donut') {
      var dn = add(new T.TorusGeometry(.38, .2, 16, 32), mat(T, '#e8a96a'), 0, .45, 0);
      var gl = add(new T.TorusGeometry(.38, .17, 16, 32, Math.PI * 2), mat(T, '#ff9cc8'), 0, .5, 0); dn.rotation.y = gl.rotation.y = 0;
      g.rotation.x = 0; g.children.forEach(function (ch) { ch.rotation.x = -.2; });
      for (var s = 0; s < 14; s++) { var a2 = s / 14 * 6.283; var sp = add(new T.BoxGeometry(.08, .025, .025), mat(T, ['#ffd23f', '#34d6c4', '#ffffff', '#a07bff'][s % 4]), Math.cos(a2) * .38, .68, Math.sin(a2) * .38); sp.rotation.y = Math.random() * 3; }
      g.userData.spinY = .4;
    } else if (k === 'gumdrop') {
      add(new T.SphereGeometry(.42, 24, 14, 0, 6.283, 0, Math.PI / 2), mat(T, p.color || '#34d6c4', { roughness: .25 }), 0, 0, 0).scale.y = 1.3;
    } else if (k === 'pinwheel') {
      add(new T.CylinderGeometry(.05, .05, 1.8, 8), mat(T, '#ffffff'), 0, .9, 0);
      var wheel = new T.Group(); wheel.position.set(0, 1.8, .1); g.add(wheel);
      ['#ff5fa2', '#ffd23f', '#34d6c4', '#a07bff'].forEach(function (c2, i2) { var bl = new T.Mesh(new T.ConeGeometry(.3, .6, 3), mat(T, c2)); bl.rotation.z = i2 * Math.PI / 2; bl.position.set(Math.cos(i2 * Math.PI / 2 + Math.PI / 2) * .28, Math.sin(i2 * Math.PI / 2 + Math.PI / 2) * .28, 0); wheel.add(bl); });
      g.userData.spinZ = wheel;
    } else if (k === 'trampoline') {
      add(new T.CylinderGeometry(.7, .7, .08, 28), mat(T, '#2f8cff'), 0, .35, 0);
      add(new T.TorusGeometry(.7, .06, 10, 32), mat(T, '#ffd23f'), 0, .36, 0).rotation.x = Math.PI / 2;
      for (var l = 0; l < 4; l++) { var al = l / 4 * 6.283 + .7; add(new T.CylinderGeometry(.04, .04, .36, 8), mat(T, '#3b2a5a'), Math.cos(al) * .6, .18, Math.sin(al) * .6); }
    } else if (k === 'rainbow') {
      ['#ff5f5f', '#ff9a3d', '#ffd23f', '#4cd964', '#6cc6ff', '#a07bff'].forEach(function (c3, i3) { add(new T.TorusGeometry(1 - i3 * .12, .07, 8, 32, Math.PI), mat(T, c3), 0, 0, 0); });
      var cl1 = add(new T.SphereGeometry(.25, 12, 10), mat(T, '#ffffff'), -.95, .05, 0); var cl2 = add(new T.SphereGeometry(.25, 12, 10), mat(T, '#ffffff'), .95, .05, 0); cl1.scale.x = cl2.scale.x = 1.4;
    } else if (k === 'discoball') {
      add(new T.CylinderGeometry(.015, .015, .8, 6), mat(T, '#cccccc'), 0, 2.1, 0);
      var ball = add(new T.IcosahedronGeometry(.4, 1), mat(T, '#e8e8f8', { metalness: .9, roughness: .15, flatShading: true }), 0, 1.5, 0); g.userData.spinBall = ball;
    } else if (k === 'house') {
      add(new T.CylinderGeometry(.55, .45, .7, 20), mat(T, '#ffb36b'), 0, .35, 0);
      add(new T.SphereGeometry(.62, 22, 14, 0, 6.283, 0, Math.PI / 2), mat(T, '#ff9cc8'), 0, .7, 0);
      add(new T.SphereGeometry(.12, 12, 10), mat(T, '#ff3b3b'), 0, 1.36, 0);
      add(new T.BoxGeometry(.24, .34, .05), mat(T, '#8b5a3c'), 0, .2, .5);
    }
    g.position.set(x, 0, z);
    g.rotation.y = g.rotation.y || (p.kind === 'lolly' ? Math.random() * .6 - .3 : 0);
    this.scene.add(g);
    (this.props = this.props || []).push(g);
    if (!this._propTick) {
      this._propTick = true;
      var prev = this.onFrame;
      this.onFrame = function (dt) {
        if (prev) prev(dt);
        var t = self.time;
        self.props.forEach(function (q) {
          var u = q.userData;
          if (u.spinZ) u.spinZ.rotation.z += dt * 2;
          if (u.spinY) q.rotation.y += dt * u.spinY;
          if (u.spinBall) u.spinBall.rotation.y += dt * 1.2;
          if (u.bob) u.bob.position.y = 2.75 + Math.sin(t * 2) * .12;
          if (u.jiggle) { var s2 = 1 + Math.sin(t * 5) * .03; u.jiggle.scale.set(s2, 1 / s2, s2); }
          if (u.wob) u.wob.rotation.z = Math.sin(t * 1.5) * .06;
        });
        (self.clouds || []).forEach(function (cl) { cl.position.x += dt * cl.userData.drift; if (cl.position.x > self.W) cl.position.x = -self.W; });
      };
    }
    return g;
  };

  /* ------------------------------------------------------------------ one cube */
  var EXPR = { boing: [6, 3], toot: [10, 6], love: [5, 0], snack: [2, 1], sunny: [8, 5], disco: [9, 2] };
  function Actor(stage, d) {
    var T = stage.T;
    this.stage = stage; this.d = d;
    this.size = (d.grown === false ? .6 : .9) * (d.scale || 1);
    this.root = new T.Group(); this.squash = new T.Group(); this.root.add(this.squash);
    this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = 256;
    this.tex = new T.CanvasTexture(this.cv); this.tex.colorSpace = T.SRGBColorSpace; this.tex.anisotropy = 4;
    var icons = iconTextures(T), col = d.color || '#ff5fa2';
    this.mats = [0, 1, 2, 3, 4, 5].map(function (f) { return f === 4 ? mat(T, '#ffffff', { map: this.tex, roughness: .45 }) : mat(T, col, { map: icons[f], roughness: .45 }); }, this);
    var geo = roundedBox(T, this.size); geo._shared = true;
    this.mesh = new T.Mesh(geo, this.mats); this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.userData.actor = this;
    this.squash.add(this.mesh);
    this.mesh.position.y = 0;
    this.squash.position.y = 0;
    this.root.position.y = this.size / 2;
    stage.scene.add(this.root);
    this.look = { x: 0, y: 0, vx: 0, vy: 0 };
    this.nextBlink = performance.now() + 1500 + Math.random() * 3000;
    this.setOrient(d.orient || QB.START);
    this.place(d.x || 0, d.z || 0);
    this.setHat(d.hat);
    this.repaint();
    this.tagEl = null;
  }
  QB.Actor = Actor;
  Actor.prototype.setOrient = function (o) {
    var T = this.stage.T, N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    var a = new T.Vector3().fromArray(N[+o[0]]), b = new T.Vector3().fromArray(N[+o[3]]), c = new T.Vector3().crossVectors(a, b);
    var m = new T.Matrix4().makeBasis(c, a, b).transpose();
    this.mesh.quaternion.setFromRotationMatrix(m);
    this.d.orient = o;
  };
  Actor.prototype.place = function (x, z) {
    this.d.x = x; this.d.z = z;
    var p = this.stage.tileToWorld(x, z);
    this.root.position.x = p.x; this.root.position.z = p.z;
  };
  Actor.prototype.setHat = function (key) {
    if (this.hat) { this.squash.remove(this.hat); this.hat = null; }
    this.d.hat = key || '';
    if (!key) return;
    var h = buildHat(this.stage.T, key);
    var s = this.size / .9; h.scale.set(s, s, s);
    h.position.y = this.size / 2 - .02 * s; h.rotation.y = (Math.random() - .5) * .5;
    this.hat = h; this.squash.add(h);
  };
  Actor.prototype.setData = function (d) {
    var self = this, oldGrown = this.d.grown;
    Object.keys(d).forEach(function (k) { self.d[k] = d[k]; });
    this.mats.forEach(function (m, i) { if (i !== 4) m.color.set(self.d.color || '#ff5fa2'); });
    if ((d.hat || '') !== (this._hatKey || '')) { this._hatKey = d.hat || ''; this.setHat(d.hat); }
    if (d.grown && oldGrown === false) this.growUp();
    this.repaint();
  };
  Actor.prototype.repaint = function () {
    var c = this.cv.getContext('2d'), self = this;
    c.clearRect(0, 0, 256, 256);
    var ex = this.expr;
    QB.paintFace(c, 256, this.d, { blink: this.blinking, look: this.look, eyes: ex ? ex[0] : null, mouth: ex ? ex[1] : null, spin: this.stage.time * 6,
      onImg: function () { self.repaint(); } });
    this.tex.needsUpdate = true;
  };
  Actor.prototype.tick = function (dt, now) {
    var need = false;
    if (!this.blinking && now > this.nextBlink) { this.blinking = true; this.blinkEnd = now + 140; need = true; }
    else if (this.blinking && now > this.blinkEnd) { this.blinking = false; this.nextBlink = now + 2200 + Math.random() * 4000; need = true; }
    if (+this.d.eyes === 1 && !this.expr) {   // googly pupils wobble
      var L = this.look; L.vx += (-L.x * 40 - L.vx * 3) * dt; L.vy += (-L.y * 40 - L.vy * 3) * dt; L.x += L.vx * dt; L.y += L.vy * dt;
      if (Math.abs(L.vx) + Math.abs(L.vy) > .02) need = true;
    }
    if (this.expr && this.expr[0] === 9) need = true;
    if (need) this.repaint();
    if (this.hat && this.hat.userData.spin) this.hat.userData.spin.rotation.y += dt * (this.rolling ? 22 : 6);
    if (this.hat && this.hat.userData.bob) this.hat.userData.bob.position.y = .32 + Math.sin(this.stage.time * 3) * .04;
    if (!this.busy && !this.rolling) { var br = Math.sin(this.stage.time * 2.2 + this.root.position.x) * .015; this.squash.scale.set(1 - br, 1 + br, 1 - br); }
    if (this.ring) { this.ring.position.set(this.root.position.x, .02, this.root.position.z); this.ring.scale.setScalar(1 + Math.sin(this.stage.time * 5) * .06); }
  };
  Actor.prototype.select = function (on) {
    var T = this.stage.T;
    if (on && !this.ring) {
      this.ring = new T.Mesh(new T.RingGeometry(this.size * .72, this.size * .9, 40), new T.MeshBasicMaterial({ color: '#f0428c', transparent: true, opacity: .85, side: T.DoubleSide }));
      this.ring.rotation.x = -Math.PI / 2; this.stage.scene.add(this.ring);
    } else if (!on && this.ring) { this.stage.scene.remove(this.ring); this.ring.geometry.dispose(); this.ring = null; }
    this.selected = !!on;
    if (this.tagEl) this.tagEl.classList.toggle('sel', !!on);
  };
  Actor.prototype.tag = function (html, cls) {
    if (!this.tagEl) { this.tagEl = document.createElement('div'); this.tagEl._actor = this; this.tagEl._dy = 1.25; this.stage.overlay.appendChild(this.tagEl); }
    this.tagEl.className = 'qb-tag ' + (cls || '') + (this.selected ? ' sel' : '');
    this.tagEl.innerHTML = html;
  };
  Actor.prototype.say = function (text) {
    if (this.bubble) this.bubble.remove();
    var b = this.bubble = document.createElement('div'); b.className = 'qb-bubble'; b.textContent = text; b._actor = this; b._dy = this.tagEl ? 1.85 : 1.4;
    this.stage.overlay.appendChild(b);
    var self = this; clearTimeout(this._sayT);
    this._sayT = setTimeout(function () { b.remove(); if (self.bubble === b) self.bubble = null; }, 7000);
  };
  /* Tip over towards dir (N/S/E/W). move: also go one tile that way. */
  Actor.prototype.roll = function (dir, move, done) {
    var T = this.stage.T, self = this, h = this.size / 2;
    var axis = { E: [0, 0, -1], W: [0, 0, 1], S: [1, 0, 0], N: [-1, 0, 0] }[dir], dv = QB.DIRS[dir];
    var q0 = this.mesh.quaternion.clone(), ax = new T.Vector3().fromArray(axis), qr = new T.Quaternion();
    var start = this.root.position.clone(), dist = move ? this.stage.tile : 0;
    this.rolling = true;
    this.look.vx += dv[0] * 3; this.look.vy += dv[1] * 3;
    QB.sfx('roll');
    var newO = QB.roll(this.d.orient, dir);
    this.stage.anim(380, function (p) {
      var e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, a = e * Math.PI / 2;
      qr.setFromAxisAngle(ax, a); self.mesh.quaternion.copy(qr).multiply(q0);
      var off = -h * Math.cos(a) + h * Math.sin(a) + h;     // 0 .. 2h along the roll
      var along = move ? off / (2 * h) * dist : Math.sin(a * 2) * h * .25;
      self.root.position.x = start.x + dv[0] * along; self.root.position.z = start.z + dv[1] * along;
      self.root.position.y = h * Math.sin(a) + h * Math.cos(a);
    }, function () {
      self.root.position.y = h;
      if (move) self.place(self.d.x + dv[0], self.d.z + dv[1]); else { self.root.position.x = start.x; self.root.position.z = start.z; }
      self.setOrient(newO);
      self.rolling = false;
      self.stage.anim(160, function (p) { var s = Math.sin(p * Math.PI) * .12; self.squash.scale.set(1 + s, 1 - s, 1 + s); });
      if (done) done(newO);
    });
    return newO;
  };
  Actor.prototype.bonk = function (dir) {
    var self = this, dv = QB.DIRS[dir], sx = this.root.position.x, sz = this.root.position.z;
    QB.sfx('bonk');
    this.stage.anim(260, function (p) { var o = Math.sin(p * Math.PI) * .18; self.root.position.x = sx + dv[0] * o; self.root.position.z = sz + dv[1] * o; self.squash.rotation.z = Math.sin(p * Math.PI * 3) * .1; },
      function () { self.root.position.x = sx; self.root.position.z = sz; self.squash.rotation.z = 0; });
    this.stage.pop(this, 'BONK!', 'small', '#ffd23f');
  };
  Actor.prototype.hopTo = function (x, z, o) {
    var self = this, s = this.stage.tileToWorld(this.d.x, this.d.z), t = this.stage.tileToWorld(x, z), h = this.size / 2;
    this.d.x = x; this.d.z = z;
    this.stage.anim(500, function (p) {
      self.root.position.x = s.x + (t.x - s.x) * p; self.root.position.z = s.z + (t.z - s.z) * p; self.root.position.y = h + Math.sin(p * Math.PI) * 1.2;
    }, function () { self.root.position.y = h; if (o) self.setOrient(o); });
  };
  Actor.prototype.face = function (eyes, mouth, ms) {
    var self = this; this.expr = [eyes, mouth]; this.repaint();
    clearTimeout(this._exT); this._exT = setTimeout(function () { self.expr = null; self.repaint(); }, ms || 1200);
  };
  /* A little thing a cube does on its own (Cubby, World): hop, wiggle, yawn, giggle, look around, spin, blow a kiss. */
  Actor.prototype.idle = function () {
    var st = this.stage, self = this, top = this.root.position.clone(), kind = pick(['hop', 'wiggle', 'yawn', 'giggle', 'look', 'spin', 'kiss']);
    top.y += this.size * .7;
    this.busy = true;
    var end = function () { self.busy = false; self.squash.position.y = 0; self.squash.rotation.set(0, 0, 0); };
    if (kind === 'hop') st.anim(520, function (p) { self.squash.position.y = Math.abs(Math.sin(p * Math.PI * 2)) * .28; }, end);
    else if (kind === 'wiggle') st.anim(600, function (p) { self.squash.rotation.z = Math.sin(p * Math.PI * 4) * .12; }, end);
    else if (kind === 'spin') st.anim(700, function (p) { self.squash.rotation.y = (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2) * Math.PI * 2; }, end);
    else {
      if (kind === 'yawn') { this.face(3, 3, 1500); st.burst(top, '💤', 2, { up: .8, g: -.3, speed: .2, life: 1.6 }); }
      else if (kind === 'giggle') { this.face(2, 1, 1200); st.burst(top, ['🎵', '🎶'], 2, { up: 1, g: 0, speed: .3 }); }
      else if (kind === 'kiss') { this.face(2, 8, 1200); st.burst(top, '💕', 2, { up: .9, g: 0, speed: .4 }); }
      else { this.look.vx += (Math.random() - .5) * 8; this.look.vy += (Math.random() - .5) * 5; }
      setTimeout(end, 500);
    }
  };
  Actor.prototype.express = function (ev, ms) {
    var self = this; this.expr = EXPR[ev] || null; this.repaint();
    clearTimeout(this._exT); this._exT = setTimeout(function () { self.expr = null; self.repaint(); }, ms || 1600);
  };
  /* Play one of the six events (reward is optional: what the server gave). */
  Actor.prototype.play = function (ev, reward) {
    var st = this.stage, self = this, T = st.T, h = this.size / 2, top = this.root.position.clone();
    top.y += h;
    var E = QB.EVENTS[ev] || {};
    this.busy = true;
    this.express(ev, 1700);
    st.pop(this, E.label || ev, '', E.color);
    QB.sfx(ev);
    var end = function () { self.busy = false; self.squash.position.y = 0; self.squash.rotation.set(0, 0, 0); self.squash.scale.set(1, 1, 1); self.mats.forEach(function (m) { m.emissive && m.emissive.set('#000000'); }); };
    if (ev === 'boing') {
      st.anim(1000, function (p) {
        if (p < .15) { var s = p / .15 * .3; self.squash.scale.set(1 + s * .5, 1 - s, 1 + s * .5); return; }
        var q = (p - .15) / .85; self.squash.scale.set(1, 1, 1);
        self.squash.position.y = Math.sin(q * Math.PI) * 2.4; self.squash.rotation.y = q * Math.PI * 2;
      }, end);
      st.burst(top, '✨', 8, { up: 3 });
      if (reward && reward.present) setTimeout(function () { st.burst(top, '🎁', 1, { up: 4, g: 4, size: .7, life: 1.4 }); st.pop(self, 'A PRESENT!', 'small', '#ffd23f'); }, 600);
    } else if (ev === 'toot') {
      st.anim(800, function (p) { self.squash.rotation.z = Math.sin(p * Math.PI * 6) * .12 * (1 - p); self.squash.position.y = Math.abs(Math.sin(p * Math.PI * 3)) * .25; }, end);
      var back = top.clone(); back.y -= h * 1.2; back.z -= h * 1.4;
      st.burst(back, ['💨', '🌈', '☁️'], 9, { up: .6, g: -.5, speed: .8, size: .4, life: 1.4 });
    } else if (ev === 'love') {
      st.anim(1100, function (p) { var s = Math.sin(p * Math.PI * 4) * .08 * (1 - p); self.squash.scale.set(1 + s, 1 + s, 1 + s); }, end);
      st.burst(top, ['💖', '💕', '💗'], 14, { up: 2.4, g: .6, speed: .9, life: 1.6 });
    } else if (ev === 'snack') {
      var cup = new T.Sprite(sprite(T, '🧁').clone()); cup.scale.set(.6, .6, .6); st.scene.add(cup);
      st.anim(1300, function (p) {
        if (p < .35) { var q = p / .35; cup.position.set(top.x, top.y + 4 * (1 - q * q) + .3, top.z); }
        else if (p < .7) { var q2 = (p - .35) / .35, c = Math.abs(Math.sin(q2 * Math.PI * 3)) * .15; self.squash.scale.set(1 + c, 1 - c, 1 + c); cup.scale.setScalar(.6 * (1 - q2)); cup.position.y = top.y + .25; }
        else { cup.visible = false; var q3 = (p - .7) / .3, f = 1 + Math.sin(q3 * Math.PI) * .18; self.squash.scale.set(f, 1, f); }
      }, function () { st.scene.remove(cup); cup.material.dispose(); end(); });
      setTimeout(function () { st.burst(top, ['🟫', '✨'], 6, { up: 1.2, size: .14 }); }, 500);
    } else if (ev === 'sunny') {
      st.anim(1200, function (p) { self.squash.position.y = Math.sin(p * Math.PI) * .3; self.squash.rotation.y = Math.sin(p * Math.PI * 2) * .25; }, end);
      st.burst(top, ['✨', '⭐', '🌟'], 12, { up: 1.6, speed: 1.8, g: .4 });
    } else if (ev === 'disco') {
      var gold = reward && reward.golden;
      st.anim(1400, function (p) {
        self.squash.rotation.y = p * Math.PI * 4;
        var hue = (p * 4) % 1, col = new T.Color().setHSL(hue, 1, .5);
        self.mats.forEach(function (m, i) { if (i !== 4) m.emissive.copy(gold ? new T.Color('#ffc400') : col).multiplyScalar(.45 * Math.sin(p * Math.PI)); });
      }, end);
      st.burst(top, gold ? ['🌟', '✨', '💰'] : ['🎵', '🎶', '✨'], gold ? 20 : 10, { up: 2.2, speed: 1.6, g: 1 });
      if (gold) setTimeout(function () { st.pop(self, 'GOLDEN!', '', '#ffd23f'); QB.sfx('golden'); }, 700);
    } else setTimeout(end, 600);
    if (reward) {
      setTimeout(function () {
        var bits = [];
        if (reward.sparkles) bits.push('+' + reward.sparkles + ' ✨');
        if (reward.love) bits.push('+' + reward.love + ' 💖');
        if (bits.length) st.pop(self, bits.join('  '), 'small');
        if (reward.grew) { self.growUp(); st.pop(self, 'ALL GROWN UP!', '', '#34d6c4'); QB.sfx('baby'); }
      }, 900);
    }
  };
  Actor.prototype.growUp = function () {
    if (this.size >= .9) return;
    var T = this.stage.T, self = this, from = this.size, to = .9;
    this.d.grown = true;
    var geo = roundedBox(T, to); geo._shared = true;
    this.stage.anim(700, function (p) {
      var s = (from + (to - from) * (p < .7 ? p / .7 * 1.15 : 1.15 - (p - .7) / .3 * .15)) / from;
      self.squash.scale.set(s, s, s);
    }, function () {
      self.mesh.geometry = geo; self.size = to; self.squash.scale.set(1, 1, 1); self.root.position.y = to / 2;
      self.setHat(self.d.hat);
    });
  };
  Actor.prototype.dispose = function () {
    this.stage.scene.remove(this.root);
    if (this.ring) this.select(false);
    this.mats.forEach(function (m) { m.dispose(); });
    this.tex.dispose();
    if (this.tagEl) this.tagEl.remove();
    if (this.bubble) this.bubble.remove();
    clearTimeout(this._sayT); clearTimeout(this._exT);
  };

  /* ------------------------------------------------------------------ rolling controller
     QB.roller(stage, {where, guest, blocked(actor, dir), getActor(), onResult(actor, res)}) -> roll(dir) */
  /* Bonus things a roll can bring (Rainbow Roll, Surprise Egg) and finished quests. */
  QB.extras = function (stage, a, res) {
    var rw = res.reward || {}, top = a.root.position.clone(); top.y += a.size;
    if (rw.rainbow) setTimeout(function () { stage.pop(a, 'RAINBOW ROLL!', '', '#ff5fa2'); stage.burst(top, ['🌈', '✨', '⭐'], 18, { up: 3 }); QB.sfx('golden'); QB.confetti(70); }, 1100);
    if (rw.egg) setTimeout(function () {
      stage.pop(a, 'SURPRISE EGG!', '', '#ffd23f'); stage.burst(top, ['🐣', '✨', '🎉'], 14, { up: 3 }); QB.confetti(110); QB.sfx('baby');
      UI.toast('🥚 Surprise Egg! +' + rw.egg.sparkles + ' sparkles' + (rw.egg.hat && QB.HATS[rw.egg.hat] ? ' and a free ' + QB.HATS[rw.egg.hat][0] + '!' : '!'), 'ok');
    }, 500);
    QB.questToasts(res);
  };
  QB.questToasts = function (res) {
    ((res && res.quests_done) || []).forEach(function (t, i) { setTimeout(function () { UI.toast('✅ Quest done: ' + t + '! Claim it in your Cubby.', 'ok'); QB.sfx('sunny'); }, 1200 + i * 700); });
  };
  QB.rainbowHtml = function (recent) {
    var have = String(recent || '');
    return '<div class="qb-rainbow" title="Rainbow Roll: land all six sides in six rolls">' + QB.FACE_EVENT.map(function (k, i) {
      return '<span class="' + (have.indexOf(String(i)) >= 0 ? 'on' : '') + '">' + QB.EVENTS[k].emoji + '</span>'; }).join('') + '</div>';
  };
  QB.roller = function (stage, o) {
    var queue = null;
    function go(dir) {
      var a = o.getActor();
      if (!a) { if (o.noActor) o.noActor(); return; }
      if (a.rolling || a.busy || a.waiting) { queue = dir; return; }
      var move = o.move != null ? o.move : o.where === 'world';
      var dv = QB.DIRS[dir];
      if (move && (o.blocked ? o.blocked(a, dir) : !stage.free(a.d.x + dv[0], a.d.z + dv[1], a))) { a.bonk(dir); return; }
      var before = { orient: a.d.orient, x: a.d.x, z: a.d.z };
      var ev = null, res = null, rolled = false, server = null;
      a.waiting = true;
      function finish() {
        if (!rolled || (!res && server)) return;
        a.waiting = false;
        if (res && res.ok === false) {
          // the server said no: put it back
          a.setOrient(before.orient); a.place(before.x, before.z);
          if (res.blocked) a.bonk(dir); else if (res.error) UI.toast(res.error, 'error');
          if (res.cube && o.onResult) o.onResult(a, res);
        } else {
          a.play(ev, res ? res.reward : QB.guestReward(ev));
          if (res) QB.extras(stage, a, res);
          if (o.onResult) o.onResult(a, res || { ok: true, event: ev, reward: QB.guestReward(ev), guest: true });
        }
        if (queue) { var q = queue; queue = null; setTimeout(function () { go(q); }, a.busy ? 900 : 60); }
      }
      if (!o.guest) {
        server = UI.apiQuiet('roll_cube', a.d.id, dir, o.where || 'home').then(function (r) { res = r; finish(); },
          function (err) { res = (err && err.result) || { ok: false, error: err && err.message }; finish(); });
      }
      a.roll(dir, move, function (newO) { ev = QB.topEvent(newO); rolled = true; finish(); });
    }
    return go;
  };
})();
