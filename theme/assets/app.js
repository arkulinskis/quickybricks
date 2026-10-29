/* core.js: the shared front-end engine (window.UI). Same in every app made from APP_MAKER/template;
   app-specific things live in web/app.js (brand, nav, footer) and web/pages/*.html (the pages).

   Pages:   UI.page(name, {title, nav, icon, auth, order, chrome}, mount)
              auth: null (anyone) | 'guest' (signed-out only) | 'user' | 'admin'
              nav: label for the header / phone tab bar (omit to keep it out of the menus)
              mount(view, ctx) draws into `view`; ctx = {args, me, go, api}. Return a Promise (the page
              is "ready" when it resolves) or {ready, destroy}. URLs are #name/arg1/arg2.
   Server:  UI.api(fn, ...args) -> Promise of the server function's return value. A reply of
              {ok: false, error} rejects with that message (shown as a toast unless you .catch it).
            UI.apiQuiet(fn, ...args) is the same without Anvil's loading spinner.
   Auth:    UI.auth('login'|'signup'|'reset'|'logout', {...}) -> Promise of {ok, me, message}
   Helpers: UI.esc, UI.icon, UI.toast, UI.modal, UI.confirm, UI.busy, UI.formData, UI.fmtDate, UI.ago,
            UI.store, UI.setTheme, UI.feedback, UI.go, UI.refresh
   Tests:   window.UI_READY is true when the current page has finished loading. */
(function () {
  'use strict';
  if (window.UI && window.UI.__v) return;
  var UI = window.UI = { __v: 1, pages: {}, me: null, config: { name: 'App', key: 'app', home: 'home', landing: 'landing' } };
  window.UI_READY = false;

  UI.configure = function (cfg) { Object.keys(cfg).forEach(function (k) { UI.config[k] = cfg[k]; }); };

  /* ------------------------------------------------------------------ small helpers */
  UI.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  UI.plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); };
  UI.initials = function (name) {
    var p = String(name || '?').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
  };
  UI.fmtDate = function (iso, opts) {
    if (!iso) return '';
    var d = iso.length <= 10 ? new Date(iso + 'T12:00:00') : new Date(iso);
    return d.toLocaleDateString(undefined, opts || { day: 'numeric', month: 'short', year: 'numeric' });
  };
  UI.fmtDateTime = function (iso) {
    return iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  };
  UI.ago = function (iso) {
    if (!iso) return '';
    var s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    var steps = [[60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']], n = s / 60;
    for (var i = 0; i < steps.length; i++) {
      if (n < steps[i][0]) { n = Math.floor(n); return UI.plural(n, steps[i][1]) + ' ago'; }
      n = n / steps[i][0];
    }
    return '';
  };
  UI.store = {
    get: function (k, dflt) { try { var v = localStorage.getItem(UI.config.key + '.' + k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } },
    set: function (k, v) { try { localStorage.setItem(UI.config.key + '.' + k, JSON.stringify(v)); } catch (e) {} }
  };
  UI.formData = function (form) {
    var out = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.disabled) return;
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value;
    });
    return out;
  };
  /* Disable a button while a Promise runs; returns the Promise. */
  UI.busy = function (btn, promise) {
    if (!btn) return promise;
    btn.disabled = true; btn.classList.add('is-busy');
    var done = function () { btn.disabled = false; btn.classList.remove('is-busy'); };
    promise.then(done, done);
    return promise;
  };

  var ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.7c2.2.6 3.5 2.4 3.5 5.3"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/>',
    bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    bug: '<rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 8V5M9 5.5 7.5 4M15 5.5 16.5 4M7 13H3M21 13h-4M7.5 18l-3 2M16.5 18l3 2M7.5 9.5l-3-2M16.5 9.5l3-2"/>',
    bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    database: '<ellipse cx="12" cy="5.5" rx="7.5" ry="2.5"/><path d="M4.5 5.5v13c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-13"/><path d="M4.5 12c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    pin: '<path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    filter: '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>',
    more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'
  };
  UI.ICONS = ICONS;
  UI.icon = function (name, cls) {
    return '<svg class="ui-ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.sparkle) + '</svg>';
  };

  /* ------------------------------------------------------------------ toasts, modals */
  UI.toast = function (msg, kind) {
    var box = document.querySelector('.ui-toasts');
    if (!box) { box = document.createElement('div'); box.className = 'ui ui-toasts'; box.setAttribute('aria-live', 'polite'); document.body.appendChild(box); }
    var t = document.createElement('div');
    t.className = 'ui-toast' + (kind ? ' ' + kind : '');
    t.innerHTML = (kind === 'error' ? UI.icon('info') : kind === 'ok' ? UI.icon('check') : '') + '<span>' + UI.esc(msg) + '</span>';
    box.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, kind === 'error' ? 6500 : 3200);
  };
  UI.modal = function (html, opts) {
    opts = opts || {};
    var prev = document.activeElement;
    var wrap = document.createElement('div');
    wrap.className = 'ui ui-modal-wrap';
    wrap.innerHTML = '<div class="ui-modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
      '<button class="ui-btn ghost icon ui-modal-x" data-close aria-label="Close">' + UI.icon('x') + '</button>' + html + '</div>';
    document.body.appendChild(wrap);
    document.documentElement.classList.add('ui-modal-open');
    function key(e) { if (e.key === 'Escape') close(); }
    function close() {
      if (!wrap.parentNode) return;
      wrap.remove(); document.removeEventListener('keydown', key);
      if (!document.querySelector('.ui-modal-wrap')) document.documentElement.classList.remove('ui-modal-open');
      if (opts.onclose) opts.onclose();
      if (prev && prev.focus) prev.focus();
    }
    document.addEventListener('keydown', key);
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
    wrap.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) close(); });
    var first = wrap.querySelector('input, textarea, select');
    setTimeout(function () { (first || wrap.querySelector('.ui-modal')).focus && (first || wrap.querySelector('.ui-modal')).focus(); }, 30);
    return { el: wrap.querySelector('.ui-modal'), close: close };
  };
  UI.confirm = function (o) {
    o = typeof o === 'string' ? { title: o } : (o || {});
    return new Promise(function (resolve) {
      var answered = false;
      var m = UI.modal('<h2>' + UI.esc(o.title || 'Are you sure?') + '</h2>' + (o.text ? '<p class="muted">' + UI.esc(o.text) + '</p>' : '') +
        '<div class="ui-row end" style="margin-top:20px"><button class="ui-btn ghost" data-close>' + UI.esc(o.cancel || 'Cancel') + '</button>' +
        '<button class="ui-btn ' + (o.danger ? 'danger solid' : 'primary') + '" data-ok>' + UI.esc(o.ok || 'OK') + '</button></div>',
      { onclose: function () { if (!answered) resolve(false); } });
      m.el.querySelector('[data-ok]').onclick = function () { answered = true; m.close(); resolve(true); };
    });
  };

  /* ------------------------------------------------------------------ theme */
  UI.theme = function () { return UI.store.get('theme', 'auto'); };
  UI.applyTheme = function (t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    var dark = t === 'dark' || (t !== 'light' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('ui-dark', !!dark);
  };
  UI.setTheme = function (t) { UI.store.set('theme', t); UI.applyTheme(t); };
  UI.applyTheme(UI.theme());
  if (window.matchMedia) {
    try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { UI.applyTheme(UI.theme()); }); } catch (e) {}
  }

  /* ------------------------------------------------------------------ server bridge */
  var bridge = null;
  function send(kind, payload) {
    if (!bridge) return Promise.reject(new Error('The app is still starting.'));
    var out;
    try { out = bridge(kind, JSON.stringify(payload || {})); } catch (e) { return Promise.reject(e); }
    return Promise.resolve(out).then(function (r) {
      r = typeof r === 'string' ? JSON.parse(r) : (r || {});
      if (r.error) {
        var err = new Error(r.error); err.uiApi = true; err.denied = !!r.denied;
        if (r.detail) console.error(kind, payload && payload.fn, r.detail);
        if (r.reload) setTimeout(function () { location.reload(); }, 2500);
        throw err;
      }
      return r.result;
    });
  }
  function apiCall(quiet, fn, args) {
    return send('call', { fn: fn, args: args, quiet: quiet }).then(function (res) {
      if (res && typeof res === 'object' && res.ok === false) {
        var err = new Error(res.error || 'That didn\'t work.'); err.uiApi = true; err.expected = true; err.result = res;
        throw err;
      }
      return res;
    });
  }
  UI.api = function (fn) { return apiCall(false, fn, Array.prototype.slice.call(arguments, 1)); };
  UI.apiQuiet = function (fn) { return apiCall(true, fn, Array.prototype.slice.call(arguments, 1)); };
  /* Errors nobody caught become a toast, so a failed action is never silent. */
  window.addEventListener('unhandledrejection', function (e) {
    if (e.reason && e.reason.uiApi) { e.preventDefault(); UI.toast(e.reason.message, 'error'); }
  });

  /* Sign in / up / out. On success it navigates: to where the visitor was heading (UI.after) or home
     after signing in, to the landing page after signing out. */
  UI.auth = function (kind, payload) {
    return send(kind, payload || {}).then(function (r) {
      if (r && r.ok === false) { var err = new Error(r.error); err.uiApi = true; err.expected = true; throw err; }
      if (r && 'me' in r && (r.me || kind === 'logout')) {
        UI.me = r.me || null;
        var target = r.me ? (UI.after || '#' + UI.config.home) : '#' + UI.config.landing;
        UI.after = null;
        if (location.hash === target) route(); else location.hash = target;
      }
      return r;
    });
  };
  /* Update the signed-in user's details (e.g. a new name) and redraw the header, without reloading the page. */
  UI.setMe = function (me) {
    UI.me = me || null;
    if (shellRoot) renderChrome(current.name);
  };

  /* ------------------------------------------------------------------ pages and routing */
  UI.page = function (name, opts, mount) {
    if (typeof opts === 'function') { mount = opts; opts = {}; }
    opts.name = name; opts.mount = mount;
    UI.pages[name] = opts;
  };
  UI.allowed = function (p) {
    if (!p) return false;
    if (p.auth === 'user') return !!UI.me;
    if (p.auth === 'admin') return !!(UI.me && UI.me.is_admin);
    if (p.auth === 'guest') return !UI.me;
    return true;
  };
  UI.navPages = function () {
    return Object.keys(UI.pages).map(function (k) { return UI.pages[k]; })
      .filter(function (p) { return p.nav && UI.allowed(p) && (!p.when || p.when()); })
      .sort(function (a, b) { return (a.order || 50) - (b.order || 50); });
  };
  UI.parseHash = function () {
    var h = (location.hash || '').replace(/^#!?\/?/, '');
    var parts = h.split('?')[0].split('/').filter(function (x) { return x !== ''; }).map(decodeURIComponent);
    return { name: parts[0] || '', args: parts.slice(1) };
  };
  UI.hashFor = function (name) {
    var args = Array.prototype.slice.call(arguments, 1).filter(function (a) { return a != null && a !== ''; });
    return '#' + [name].concat(args.map(encodeURIComponent)).join('/');
  };
  UI.go = function (name) {
    var h = UI.hashFor.apply(null, arguments);
    if (location.hash === h) route(); else location.hash = h;
  };
  UI.refresh = function () { route(); };
  UI.after = null;  // where to go after signing in

  var shellRoot = null, view = null, current = { name: null, destroy: null }, routeSeq = 0;

  function defaultPage() { return UI.me ? UI.config.home : UI.config.landing; }

  function route() {
    var r = UI.parseHash(), name = r.name || defaultPage(), p = UI.pages[name];
    if (!p) { name = defaultPage(); p = UI.pages[name]; r.args = []; }
    if (p.auth === 'guest' && UI.me) { p = UI.pages[UI.config.home]; name = UI.config.home; r.args = []; }
    if ((p.auth === 'user' || p.auth === 'admin') && !UI.me) {
      UI.after = location.hash && location.hash !== '#' ? location.hash : null;
      p = UI.pages.auth; name = 'auth'; r.args = [];
    }
    if (p.auth === 'admin' && !(UI.me && UI.me.is_admin)) {
      UI.toast('That page is for admins only.', 'error');
      p = UI.pages[UI.config.home]; name = UI.config.home; r.args = [];
    }
    var seq = ++routeSeq;
    window.UI_READY = false;
    if (current.destroy) { try { current.destroy(); } catch (e) { console.error(e); } }
    current = { name: name, args: r.args, destroy: null };
    if (shellRoot) {
      shellRoot.className = 'ui ui-shell page-' + name + (UI.me ? ' signed-in' : ' signed-out') + (p.chrome === false ? ' no-chrome' : '');
      renderChrome(name);
    }
    // A fresh element for every page, so listeners a page adds to `view` never pile up.
    var fresh = view.cloneNode(false);
    view.parentNode.replaceChild(fresh, view);
    view = fresh;
    window.scrollTo(0, 0);
    document.title = (p.title ? (typeof p.title === 'function' ? p.title(r.args) : p.title) + ' · ' : '') + UI.config.name;
    var ctx = { name: name, args: r.args, me: UI.me, go: UI.go, api: UI.api, page: p };
    var out;
    try { out = p.mount(view, ctx); } catch (e) { console.error(e); out = Promise.reject(e); }
    var ready = out && typeof out.then === 'function' ? out : (out && out.ready) || Promise.resolve();
    if (out && out.destroy) current.destroy = out.destroy;
    Promise.resolve(ready).then(function () { if (seq === routeSeq) window.UI_READY = true; },
      function (e) {
        if (seq !== routeSeq) return;
        console.error(e);
        if (!view.innerHTML) view.innerHTML = '<div class="ui-wrap"><div class="ui-empty">' + UI.icon('info') +
          '<h3>This page didn\'t load</h3><p class="muted">' + UI.esc(e && e.message || 'Something went wrong.') + '</p>' +
          '<button class="ui-btn" onclick="UI.refresh()">Try again</button></div></div>';
        window.UI_READY = true;
      });
  }
  UI.current = function () { return current; };

  /* The shell's parts come from web/app.js: UI.shell = {header(me, active), footer(me), tabbar(me, active)} */
  function renderChrome(active) {
    var S = UI.shell || {};
    var hd = shellRoot.querySelector('[data-ui-header]'), ft = shellRoot.querySelector('[data-ui-footer]'), tb = shellRoot.querySelector('[data-ui-tabbar]');
    if (hd) hd.innerHTML = S.header ? S.header(UI.me, active) : '';
    if (ft) ft.innerHTML = S.footer ? S.footer(UI.me, active) : '';
    if (tb) tb.innerHTML = S.tabbar ? S.tabbar(UI.me, active) : '';
  }
  UI.renderChrome = function () { if (shellRoot) renderChrome(current.name); };

  /* Called by client_code/Main.py (and by the local harness) once the page is up. */
  UI.start = function (node, bridgeFn, bootJson) {
    bridge = bridgeFn;
    var boot = typeof bootJson === 'string' ? JSON.parse(bootJson || '{}') : (bootJson || {});
    UI.me = boot.me || null;
    var host = node && node.matches && node.matches('[data-ui-app]') ? node : (node && node.querySelector('[data-ui-app]')) || node || document.body;
    host.innerHTML = '<div class="ui ui-shell">' +
      '<header class="ui-header" data-ui-header></header>' +
      '<main class="ui-main" data-ui-view></main>' +
      '<footer class="ui-footer" data-ui-footer></footer>' +
      '<nav class="ui-tabbar" data-ui-tabbar aria-label="Main"></nav></div>';
    shellRoot = host.firstChild;
    view = host.querySelector('[data-ui-view]');
    if (UI.shell && UI.shell.wire) UI.shell.wire(shellRoot);
    window.addEventListener('hashchange', route);
    route();
  };

  /* ------------------------------------------------------------------ feedback form (footer + menu) */
  UI.feedback = function (kind) {
    var kinds = [['bug', 'Something\'s broken', 'bug'], ['idea', 'An idea', 'bulb'], ['question', 'A question', 'info'], ['other', 'Something else', 'chat']];
    var m = UI.modal('<h2>Send feedback</h2><p class="muted">Found a bug or have an idea? It goes straight to the people who make ' + UI.esc(UI.config.name) + '.</p>' +
      '<form class="ui-stack" data-fb>' +
      '<div class="ui-choices">' + kinds.map(function (k) {
        return '<label class="ui-choice"><input type="radio" name="kind" value="' + k[0] + '"' + ((kind || 'bug') === k[0] ? ' checked' : '') + '>' +
          '<span>' + UI.icon(k[2]) + UI.esc(k[1]) + '</span></label>';
      }).join('') + '</div>' +
      '<label class="ui-field"><span>What happened, or what would you like?</span><textarea name="message" rows="5" required minlength="5" placeholder="The more detail, the better."></textarea></label>' +
      (UI.me ? '' : '<label class="ui-field"><span>Your email <em>(optional, if you\'d like a reply)</em></span><input type="email" name="email" autocomplete="email"></label>') +
      '<p class="ui-hint">We also send the page you were on, your screen size and browser, to help us fix bugs.</p>' +
      '<div class="ui-row end"><button type="button" class="ui-btn ghost" data-close>Cancel</button><button class="ui-btn primary" type="submit">' + UI.icon('arrow') + 'Send</button></div></form>');
    var form = m.el.querySelector('[data-fb]');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = UI.formData(form);
      var ctx = { page: location.hash || '#', screen: innerWidth + 'x' + innerHeight, browser: navigator.userAgent.slice(0, 280), theme: UI.theme() };
      UI.busy(form.querySelector('[type=submit]'), UI.api('submit_feedback', v.kind, v.message, v.email || null, ctx)).then(function () {
        m.close(); UI.toast('Thank you! Your message was sent.', 'ok');
      });
    });
    return m;
  };

  /* Shared clicks: [data-go="page/arg"], [data-feedback], [data-theme-set] anywhere in the app. */
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('[data-go],[data-feedback],[data-theme-set]');
    if (!el) return;
    if (el.hasAttribute('data-go')) { e.preventDefault(); UI.go.apply(null, el.getAttribute('data-go').split('/')); }
    else if (el.hasAttribute('data-feedback')) { e.preventDefault(); UI.feedback(el.getAttribute('data-feedback') || null); }
    else if (el.hasAttribute('data-theme-set')) { e.preventDefault(); UI.setTheme(el.getAttribute('data-theme-set')); if (UI.shell && UI.shell.onTheme) UI.shell.onTheme(); }
  });
})();


/* app.js: this app's identity and frame: name, header, footer, phone tab bar.
   Pages live in web/pages/*.html. The engine (window.UI) is web/core.js. */
(function () {
  'use strict';
  UI.configure({
    name: 'QuickyBricks',
    key: 'quickybricks',          // prefix for this app's browser storage
    tagline: 'Squishy cubes, silly surprises. Roll, doodle, hatch!',   // footer line
    home: 'cubby',               // first page after signing in
    landing: 'landing'           // first page for visitors who aren't signed in
  });

  var esc = UI.esc;
  // extra icons for the nav
  UI.ICONS.cube = '<path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>';
  UI.ICONS.trophy = '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8.5 20h7M10 17h4"/>';
  UI.ICONS.bag = '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>';

  function brand() {
    return '<a class="ui-brand" href="#" data-go="' + (UI.me ? UI.config.home : UI.config.landing) + '" aria-label="' + esc(UI.config.name) + ' home">' +
      '<img src="_/theme/icon.svg" alt="" width="32" height="32"><span>' + esc(UI.config.name) + '</span></a>';
  }

  function themeSwitch() {
    var t = UI.theme();
    return '<div class="ui-seg" role="group" aria-label="Appearance">' + [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(function (o) {
      return '<button type="button" data-theme-set="' + o[0] + '" class="' + (t === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }

  function userMenu(me) {
    return '<div class="ui-menu" data-menu hidden>' +
      '<div class="ui-menu-head"><strong>' + esc(me.name) + '</strong><span class="muted small">' + esc(me.email) + '</span></div>' +
      '<a href="#profile" data-go="profile">' + UI.icon('user') + 'Your profile</a>' +
      (me.is_admin ? '<a href="#admin" data-go="admin">' + UI.icon('shield') + 'Admin</a>' : '') +
      '<div class="ui-menu-block"><span class="small muted">Appearance</span>' + themeSwitch() + '</div>' +
      '<button type="button" data-feedback>' + UI.icon('chat') + 'Send feedback</button>' +
      '<button type="button" data-lk-open="overview">' + UI.icon('lock') + 'Privacy &amp; Terms</button>' +
      '<button type="button" data-signout>' + UI.icon('logout') + 'Sign out</button></div>';
  }

  UI.shell = {
    header: function (me, active) {
      var nav = UI.navPages();
      return '<div class="ui-header-in">' + brand() +
        (me ? '<nav class="ui-nav" aria-label="Main">' + nav.map(function (p) {
          return '<a href="#' + p.name + '" class="' + (p.name === active ? 'on' : '') + '">' + UI.icon(p.icon) + '<span>' + esc(p.nav) + '</span></a>';
        }).join('') + '</nav>' : '') +
        '<div class="ui-header-right">' +
        (me ? '<button type="button" class="ui-avatar-btn" data-menu-toggle aria-label="Your account" aria-haspopup="true">' + esc(UI.initials(me.name)) + '</button>' + userMenu(me)
          : (active === 'auth' ? '' : '<a class="ui-btn ghost" href="#auth" data-go="auth">Sign in</a><a class="ui-btn primary" href="#auth/signup" data-go="auth/signup">Get started</a>')) +
        '</div></div>';
    },
    footer: function (me) {
      return '<div class="ui-footer-in"><div class="ui-footer-brand">' + brand() + '<p class="muted small">' + esc(UI.config.tagline) + '</p></div>' +
        '<div class="ui-footer-links">' +
        '<a href="#landing" data-go="landing">About</a>' +
        '<button type="button" data-feedback>Send feedback</button>' +
        '<button type="button" data-lk-open="overview">Privacy &amp; Terms</button>' +
        '</div><p class="ui-footer-legal small muted">© ' + new Date().getFullYear() + ' ' + esc(UI.config.name) + '</p></div>';
    },
    tabbar: function (me, active) {
      var nav = UI.navPages();
      if (!me || nav.length < 2) return '';
      return nav.slice(0, 4).map(function (p) {
        return '<a href="#' + p.name + '" class="' + (p.name === active ? 'on' : '') + '">' + UI.icon(p.icon) + '<span>' + esc(p.nav) + '</span></a>';
      }).join('') + '<a href="#profile" class="' + (active === 'profile' ? 'on' : '') + '">' + UI.icon('user') + '<span>You</span></a>';
    },
    wire: function (root) {
      root.addEventListener('click', function (e) {
        var t = e.target.closest('[data-menu-toggle]');
        var menu = root.querySelector('[data-menu]');
        if (t && menu) { menu.hidden = !menu.hidden; t.setAttribute('aria-expanded', String(!menu.hidden)); return; }
        if (e.target.closest('[data-signout]')) { UI.auth('logout').then(function () { UI.toast('Signed out. See you soon!'); }); }
        if (menu && !menu.hidden && !e.target.closest('[data-menu] .ui-seg')) menu.hidden = true;
      });
      document.addEventListener('keydown', function (e) {
        var menu = root.querySelector('[data-menu]');
        if (e.key === 'Escape' && menu) menu.hidden = true;
      });
    },
    onTheme: function () {  // redraw the menu's Auto/Light/Dark buttons and keep the menu open
      var menu = document.querySelector('[data-menu]'), open = menu && !menu.hidden;
      UI.renderChrome();
      if (open) document.querySelector('[data-menu]').hidden = false;
    }
  };
})();


/* ===== _qb.html ===== */
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
  QB.setMuted = function (m) { UI.store.set('mute', !!m); };
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
      var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) || document.querySelector('.ui-modal-wrap')) return;
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
    this.W = opts.w || 1; this.D = opts.d || 1; this.tile = 1;
    this.actors = {}; this.anims = []; this.parts = []; this.tags = true;
    container.classList.add('qb-stage');
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
    if (opts.sound !== false) {
      var sb = document.createElement('button'); sb.type = 'button'; sb.className = 'qb-sound'; sb.setAttribute('aria-label', 'Sound on or off');
      var paint = function () { sb.textContent = QB.muted() ? '🔇' : '🔊'; }; paint();
      sb.addEventListener('click', function (e) { e.stopPropagation(); QB.setMuted(!QB.muted()); paint(); if (!QB.muted()) QB.sfx('pop'); });
      container.appendChild(sb);
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
    if (this.kind === 'hero') { var d = (a < 0.9 ? 6.1 : 4.9) * (this.opts.dist || 1); this.camGoal.set(0, d * .52, d); this.look.set(0, .42, 0); }
    else if (this.kind === 'cubby') { var span = Math.max(this.W, this.D / Math.max(a, .6) * 1.25), dd = span * 1.02 + 1.6; this.camGoal.set(0, dd * .85, dd * .78); this.look.set(0, 0, .3); }
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
    if (this.kind === 'hero') { var sw = Math.sin(this.time * .35) * .5; this.camGoal.x = sw; }
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
    (props || []).forEach(function (p) { var c = self.tileToWorld(p.x + (p.w - 1) / 2, p.z + (p.d - 1) / 2); self.prop(p, c.x, c.z); });
    // sky things (no tiles): clouds, a smiling sun, a rainbow
    for (var i = 0; i < 7; i++) {
      var cl = new T.Group(); var cm = mat(T, '#ffffff', { roughness: .9 });
      for (var j = 0; j < 4; j++) { var b = new T.Mesh(new T.SphereGeometry(.7 + Math.random() * .5, 16, 12), cm); b.position.set(j * .9 - 1.3, Math.random() * .3, Math.random() * .4); cl.add(b); }
      cl.position.set((Math.random() - .5) * W * 1.6, 7 + Math.random() * 3, -D * .2 - Math.random() * D * .9); cl.userData.drift = .2 + Math.random() * .3;
      this.scene.add(cl); (this.clouds = this.clouds || []).push(cl);
    }
    var sunS = new T.Sprite(sprite(T, '🌞')); sunS.scale.set(4, 4, 4); sunS.position.set(W * .45, 11, -D * .9); this.scene.add(sunS);
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
  QB.roller = function (stage, o) {
    var queue = null;
    function go(dir) {
      var a = o.getActor();
      if (!a) { if (o.noActor) o.noActor(); return; }
      if (a.rolling || a.busy || a.waiting) { queue = dir; return; }
      var move = o.move != null ? o.move : o.where === 'world';
      if (move && o.blocked && o.blocked(a, dir)) { a.bonk(dir); return; }
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

/* ===== admin.html ===== */
(function () {
  var esc = UI.esc;
  var TABS = [['overview', 'Overview', 'grid'], ['reports', 'Reports', 'shield'], ['chat', 'Chat', 'chat'], ['feedback', 'Feedback', 'inbox'], ['users', 'Users', 'users'], ['demo', 'Demo data', 'database']];

  UI.page('admin', { title: 'Admin', auth: 'admin' }, function (view, ctx) {
    var tab = TABS.some(function (t) { return t[0] === ctx.args[0]; }) ? ctx.args[0] : 'overview';
    var fbFilter = 'new';
    view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head"><div><h1>Admin</h1><p class="muted">Only admins see this page.</p></div></div>' +
      '<nav class="ui-tabs">' + TABS.map(function (t) {
        return '<a href="#admin/' + t[0] + '" class="' + (t[0] === tab ? 'on' : '') + '">' + UI.icon(t[2]) + t[1] + '</a>';
      }).join('') + '</nav><div data-body><div class="ui-skel"></div></div></div>';
    var body = view.querySelector('[data-body]');

    function overview() {
      return UI.api('admin_overview').then(function (d) {
        var stat = function (n, label, go) { return '<a class="ui-card ui-stat" href="#admin/' + go + '" style="text-decoration:none;color:inherit"><b>' + n + '</b><span>' + label + '</span></a>'; };
        body.innerHTML = '<div class="ad-stats">' + stat(d.users, 'people signed up', 'users') + stat(d.admins, UI.plural(d.admins, 'admin').replace(/^\d+ /, ''), 'users') +
          stat(d.feedback_new, 'new feedback', 'feedback') + stat(d.reports, 'open reports', 'reports') + stat(d.cubes, 'cubes', 'overview') +
          stat(d.babies, 'babies born', 'overview') + stat(d.in_world, 'cubes in the World', 'overview') + '</div>' +
          '<p class="muted small" style="margin-top:18px">Demo data is <b>' + esc(d.demo.state) + '</b> (' + d.demo.counts.users + ' demo people). Manage it in the Demo data tab.</p>';
      });
    }

    function feedback() {
      return UI.api('list_feedback', null).then(function (d) {
        var items = d.items.filter(function (i) { return fbFilter === 'all' || i.status === fbFilter; });
        body.innerHTML = '<div class="ui-row" style="margin-bottom:16px"><div class="ui-seg">' + [['new', 'New'], ['read', 'Read'], ['done', 'Done'], ['all', 'All']].map(function (f) {
          var n = f[0] === 'all' ? d.items.length : d.counts[f[0]];
          return '<button data-filter="' + f[0] + '" class="' + (fbFilter === f[0] ? 'on' : '') + '">' + f[1] + ' (' + n + ')</button>';
        }).join('') + '</div></div>' +
          (items.length ? '<div class="ad-fb">' + items.map(function (i) {
            var c = i.context || {};
            return '<div class="ui-item" data-id="' + esc(i.id) + '"><div class="meta"><span class="ui-badge ' + (i.kind === 'bug' ? 'bad' : i.kind === 'idea' ? 'brand' : '') + '">' + esc(i.kind_label) + '</span>' +
              '<b>' + esc(i.name) + '</b>' + (i.email ? '<a href="mailto:' + esc(i.email) + '">' + esc(i.email) + '</a>' : '') + '<span>' + esc(UI.fmtDateTime(i.created)) + '</span></div>' +
              '<p class="msg">' + esc(i.message) + '</p>' +
              '<div class="ctx">' + esc([c.page, c.screen, c.theme, c.browser].filter(Boolean).join(' · ')) + '</div>' +
              '<textarea data-note placeholder="Private note (only admins see it)">' + esc(i.note) + '</textarea>' +
              '<div class="ui-row" style="margin-top:10px">' + ['new', 'read', 'done'].map(function (s) {
                return '<button class="ui-btn sm' + (i.status === s ? ' primary' : '') + '" data-status="' + s + '">' + s[0].toUpperCase() + s.slice(1) + '</button>';
              }).join('') + '<span class="ui-spacer"></span><button class="ui-btn sm danger" data-del-fb>' + UI.icon('trash') + 'Delete</button></div></div>';
          }).join('') + '</div>'
            : '<div class="ui-empty">' + UI.icon('inbox') + '<h3>No ' + (fbFilter === 'all' ? '' : fbFilter + ' ') + 'messages</h3><p>Messages from the "Send feedback" form show up here.</p></div>');
      });
    }

    function users(query) {
      return UI.api('list_users', query || null).then(function (d) {
        body.innerHTML = '<form class="ui-row" data-search style="margin-bottom:14px"><input type="search" name="q" placeholder="Search by name or email" value="' + esc(query || '') + '" style="max-width:360px">' +
          '<button class="ui-btn" type="submit">' + UI.icon('search') + 'Search</button><span class="muted small">' + UI.plural(d.total, 'person', 'people') + '</span></form>' +
          '<table class="ad-users"><thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Admin</th><th>Active</th></tr></thead><tbody>' +
          d.users.map(function (u) {
            return '<tr data-id="' + esc(u.id) + '"><td><b>' + esc(u.name) + '</b></td><td class="email">' + esc(u.email) + '</td><td class="joined muted">' + esc(UI.fmtDate(u.joined)) + '</td>' +
              '<td><label class="ui-check"><input type="checkbox" data-admin' + (u.is_admin ? ' checked' : '') + '> Admin</label></td>' +
              '<td><label class="ui-check"><input type="checkbox" data-enabled' + (u.enabled ? ' checked' : '') + '> Active</label></td></tr>';
          }).join('') + '</tbody></table>';
      });
    }

    function demo() {
      return UI.api('admin_overview').then(function (d) {
        var c = d.demo.counts;
        body.innerHTML = '<div class="ui-card ui-narrow" style="margin:0"><h3>Demo data</h3>' +
          '<p class="muted">Example people and content, so the app never looks empty for the first visitors. Demo rows are flagged, so removing them never touches real data. Once removed, it stays removed until you load it again.</p>' +
          '<p>Status: <b>' + esc(d.demo.state) + '</b> · ' + Object.keys(c).map(function (k) { return c[k] + ' ' + esc(k); }).join(', ') + '</p>' +
          '<div class="ui-row"><button class="ui-btn primary" data-demo="load">' + UI.icon('refresh') + (d.demo.state === 'loaded' ? 'Reload demo data' : 'Load demo data') + '</button>' +
          '<button class="ui-btn danger" data-demo="remove">' + UI.icon('trash') + 'Remove demo data</button></div></div>';
      });
    }

    function reports() {
      return UI.api('admin_reports').then(function (d) {
        body.innerHTML = d.reports.length ? '<div class="ad-fb">' + d.reports.map(function (r) {
          var c = r.cube;
          return '<div class="ui-item" data-rep="' + esc(r.id) + '"><div class="ui-row top">' + QB.thumbHtml(c, 96) + '<div class="grow" style="flex:1;min-width:0">' +
            '<div class="meta"><span class="ui-badge bad">' + esc(r.reason) + '</span><span>by ' + esc(r.reporter) + ' · ' + esc(UI.fmtDateTime(r.created)) + '</span></div>' +
            '<h3><a href="#cube/' + esc(c.id) + '">' + esc(c.name) + '</a></h3><p class="small muted">Owner: ' + esc(c.owner) + ' (' + esc(c.owner_email) + ')' + (c.in_world ? ' · in the World' : '') + '</p>' +
            '<div class="ui-row" style="margin-top:10px"><button class="ui-btn sm" data-act="wipe">🧽 Wipe drawing</button><button class="ui-btn sm" data-act="rename">🔤 Random name</button>' +
            '<button class="ui-btn sm" data-act="home">🏠 Send home + close hands</button><button class="ui-btn sm ghost" data-act="dismiss">Dismiss</button></div></div></div></div>';
        }).join('') + '</div>' : '<div class="ui-empty">' + UI.icon('shield') + '<h3>No open reports</h3><p>When a player reports a cube\'s drawing or name, it shows up here.</p></div>';
        QB.hydrate(body);
      });
    }

    function chat() {
      return UI.api('admin_chats').then(function (d) {
        body.innerHTML = '<p class="muted small">Chat is 1 to 3 symbols, one message per 30 seconds per player, and every message is deleted after ' + Math.round(d.keep / 60) + ' minutes. These are the ones still around.</p>' +
          (d.chats.length ? '<table class="ad-users"><thead><tr><th>Message</th><th>Who</th><th>When</th><th></th></tr></thead><tbody>' + d.chats.map(function (m) {
            return '<tr data-chat="' + esc(m.id) + '"><td><b style="font-size:1.2rem">' + esc(m.text) + '</b></td><td class="email">' + esc(m.who) + ' <span class="muted small">' + esc(m.email) + '</span></td>' +
              '<td class="joined muted">' + esc(UI.ago(m.at)) + '</td><td><button class="ui-btn sm danger" data-del-chat>' + UI.icon('trash') + '</button></td></tr>';
          }).join('') + '</tbody></table>' : '<div class="ui-empty">' + UI.icon('chat') + '<h3>All quiet</h3><p>No chat messages in the last few minutes.</p></div>');
      });
    }

    var DRAW = { overview: overview, reports: reports, chat: chat, feedback: feedback, users: users, demo: demo };

    view.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (act) {
        UI.busy(act, UI.api('admin_resolve', act.closest('[data-rep]').getAttribute('data-rep'), act.getAttribute('data-act'))).then(function () { UI.toast('Done', 'ok'); reports(); });
        return;
      }
      var dc = e.target.closest('[data-del-chat]');
      if (dc) { UI.api('admin_delete_chat', dc.closest('[data-chat]').getAttribute('data-chat')).then(chat); return; }
      var f = e.target.closest('[data-filter]');
      if (f) { fbFilter = f.getAttribute('data-filter'); feedback(); return; }
      var st = e.target.closest('[data-status]');
      if (st) {
        var card = st.closest('[data-id]');
        UI.api('set_feedback_status', card.getAttribute('data-id'), st.getAttribute('data-status'), card.querySelector('[data-note]').value).then(function () { UI.toast('Saved', 'ok'); feedback(); });
        return;
      }
      var del = e.target.closest('[data-del-fb]');
      if (del) {
        UI.confirm({ title: 'Delete this message?', ok: 'Delete', danger: true }).then(function (yes) {
          if (yes) UI.api('delete_feedback', del.closest('[data-id]').getAttribute('data-id')).then(feedback);
        });
        return;
      }
      var dm = e.target.closest('[data-demo]');
      if (dm) {
        var load = dm.getAttribute('data-demo') === 'load';
        UI.confirm({ title: load ? 'Load the demo data?' : 'Remove the demo data?', text: load ? 'Demo people and content are added (any old demo rows are replaced).' : 'Every demo row is deleted. Real data stays.', ok: load ? 'Load' : 'Remove', danger: !load })
          .then(function (yes) { if (yes) UI.busy(dm, UI.api(load ? 'demo_load' : 'demo_remove')).then(function () { UI.toast('Done', 'ok'); demo(); }); });
      }
    });
    view.addEventListener('change', function (e) {
      var row = e.target.closest('tr[data-id]');
      if (!row) return;
      var id = row.getAttribute('data-id'), box = e.target;
      var fn = box.hasAttribute('data-admin') ? 'set_admin' : box.hasAttribute('data-enabled') ? 'set_enabled' : null;
      if (fn) UI.api(fn, id, box.checked).then(function () { UI.toast('Saved', 'ok'); }, function (err) { box.checked = !box.checked; UI.toast(err.message, 'error'); });
    });
    view.addEventListener('submit', function (e) {
      if (e.target.matches('[data-search]')) { e.preventDefault(); users(UI.formData(e.target).q); }
    });
    return DRAW[tab]();
  });
})();

/* ===== auth.html ===== */
(function () {
  var esc = UI.esc;
  function pw(name, auto) {
    return '<div class="au-pw"><input type="password" name="' + name + '" autocomplete="' + auto + '" required minlength="8">' +
      '<button type="button" data-show>Show</button></div>';
  }
  UI.page('auth', { title: 'Sign in', auth: 'guest' }, function (view, ctx) {
    var mode = ['signup', 'reset'].indexOf(ctx.args[0]) >= 0 ? ctx.args[0] : 'login';
    function draw(msg, isErr) {
      var heading = { login: 'Welcome back', signup: 'Create your account', reset: 'Reset your password' }[mode];
      var sub = { login: 'Sign in to continue to ' + esc(UI.config.name) + '.', signup: 'It\'s free and takes a few seconds.',
        reset: 'We\'ll email you a link to choose a new password.' }[mode];
      view.innerHTML = '<div class="au-wrap"><div class="ui-card au-card">' +
        '<h1>' + heading + '</h1><p class="muted">' + sub + '</p>' +
        (mode !== 'reset' ? '<div class="ui-seg" role="tablist"><button type="button" data-mode="login" class="' + (mode === 'login' ? 'on' : '') + '">Sign in</button>' +
          '<button type="button" data-mode="signup" class="' + (mode === 'signup' ? 'on' : '') + '">Create account</button></div>' : '<div style="height:14px"></div>') +
        '<form class="ui-stack" data-form="' + mode + '" novalidate>' +
        (mode === 'signup' ? '<label class="ui-field"><span>Your name</span><input type="text" name="name" autocomplete="name" required maxlength="60"></label>' : '') +
        '<label class="ui-field"><span>Email</span><input type="email" name="email" autocomplete="email" required></label>' +
        (mode === 'login' ? '<label class="ui-field"><span>Password</span>' + pw('password', 'current-password') + '</label>' : '') +
        (mode === 'signup' ? '<label class="ui-field"><span>Password <em>(at least 8 characters)</em></span>' + pw('password', 'new-password') + '</label>' +
          (window.LegalKit ? '<div>' + LegalKit.consentField() + '</div>' : '') : '') +
        '<div data-msg role="alert"' + (msg ? ' class="' + (isErr ? 'ui-error' : 'ui-note') + '">' + esc(msg) : ' hidden>') + '</div>' +
        '<button class="ui-btn primary block" type="submit">' + { login: 'Sign in', signup: 'Create account', reset: 'Send the link' }[mode] + '</button></form>' +
        '<div class="au-links">' + (mode === 'login' ? '<a data-mode="reset">Forgot your password?</a>' : '<a data-mode="login">' + UI.icon('back') + ' Back to sign in</a>') +
        '<a href="#landing" data-go="landing">About ' + esc(UI.config.name) + '</a></div></div></div>';
      var first = view.querySelector('input');
      if (first && !msg) first.focus();
    }
    view.addEventListener('click', function (e) {
      var m = e.target.closest('[data-mode]');
      if (m) { e.preventDefault(); mode = m.getAttribute('data-mode'); history.replaceState(null, '', '#auth' + (mode === 'login' ? '' : '/' + mode)); draw(); return; }
      var s = e.target.closest('[data-show]');
      if (s) { var i = s.parentNode.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; s.textContent = i.type === 'password' ? 'Show' : 'Hide'; }
    });
    view.addEventListener('submit', function (e) {
      e.preventDefault();
      var form = e.target, v = UI.formData(form);
      var problem = !/^\S+@\S+\.\S+$/.test(v.email || '') ? 'Please enter a valid email address.'
        : mode !== 'reset' && (v.password || '').length < (mode === 'signup' ? 8 : 1) ? (mode === 'signup' ? 'Please choose a password of at least 8 characters.' : 'Please enter your password.')
        : mode === 'signup' && (v.name || '').trim().length < 2 ? 'Please tell us your name.' : null;
      if (problem) { say(problem, true); return; }
      if (mode === 'signup' && window.LegalKit && !LegalKit.consentChecked(form)) return;  // the kit shows its own message
      UI.busy(form.querySelector('[type=submit]'), UI.auth(mode, v)).then(function (r) {
        if (mode === 'reset' || (r && !r.me)) { mode = 'login'; draw(r && r.message, false); restore({ email: v.email }); }
        else UI.toast(mode === 'signup' ? 'Welcome to ' + UI.config.name + '!' : 'Welcome back!', 'ok');
      }, function (err) { say(err.message, true); });
    });
    function say(msg, isErr) {
      var box = view.querySelector('[data-msg]');
      box.className = isErr ? 'ui-error' : 'ui-note'; box.textContent = msg; box.hidden = false;
    }
    function restore(v) {
      ['name', 'email'].forEach(function (k) { var i = view.querySelector('[name=' + k + ']'); if (i && v[k]) i.value = v[k]; });
    }
    draw();
  });
})();

/* ===== champs.html ===== */
(function () {
  var esc = UI.esc;
  UI.page('champs', { title: 'Cube Champs', nav: 'Champs', icon: 'trophy', auth: 'user', order: 40 }, function (view) {
    return UI.api('get_champs').then(function (d) {
      var medal = function (i) { return ['🥇', '🥈', '🥉'][i] || (i + 1); };
      var row = function (b, i, val) {
        return '<div class="ch-row' + (b.me ? ' me' : '') + '"><span class="rk">' + medal(i) + '</span>' + QB.thumbHtml(b.star, 40) +
          '<span class="nm">' + esc(b.name) + (b.me ? ' (you!)' : '') + '</span><span class="n">' + val + '</span></div>';
      };
      var got = d.stickers.filter(function (s) { return s.got; }).length, have = {};
      d.faces.forEach(function (f) { have[f] = 1; });
      var dex = '<div class="ch-dex"><span></span>' + QB.MOUTHS.map(function (m) { return '<span class="h">' + esc(m) + '</span>'; }).join('');
      for (var e = 0; e < 10; e++) {
        dex += '<span class="h v">' + esc(QB.EYES[e]) + '</span>';
        for (var m = 0; m < 10; m++) dex += have[e + '-' + m] ? '<canvas width="96" height="96" data-dex="' + e + '-' + m + '" title="' + esc(QB.EYES[e] + ' + ' + QB.MOUTHS[m]) + '"></canvas>' : '<span class="q">?</span>';
      }
      dex += '</div>';
      view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head"><div><h1>Cube Champs 🏆</h1><p class="muted" style="font-weight:700">Who has the most cubes? ' +
        (d.rank ? 'You\'re number <b>' + d.rank + '</b> of ' + d.players + '!' : 'Make a cube to join in!') + '</p></div></div>' +
        '<div class="ch-top"><div class="ui-card"><h2>Most cubes</h2>' + (d.most.length ? d.most.map(function (b, i) { return row(b, i, '🧊 ' + b.cubes); }).join('') : '<p class="muted">Nobody yet!</p>') + '</div>' +
        '<div class="ui-stack"><div class="ui-card"><h2>My numbers</h2><div class="ch-me">' +
          [['🧊', d.me.cubes, 'cubes'], ['🎲', d.me.rolls, 'rolls'], ['🌳', 'Gen ' + d.me.gen, 'oldest family'], ['🌟', d.me.golden, 'golden moments']].map(function (x) {
            return '<div class="ui-stat ui-card flat tight"><b>' + x[0] + ' ' + x[1] + '</b><span>' + x[2] + '</span></div>'; }).join('') + '</div></div>' +
        '<div class="ui-card"><h2>Biggest families</h2>' + d.families.map(function (b, i) { return row(b, i, 'Gen ' + b.gen); }).join('') + '</div></div></div>' +
        '<div class="ch-sec"><h2>My stickers <span class="ui-badge brand">' + got + '/' + d.stickers.length + '</span></h2><div class="ch-stick">' +
          d.stickers.map(function (s) { return '<div class="ch-s ' + (s.got ? 'yes' : 'no') + '"><span class="em">' + s.emoji + '</span><b>' + esc(s.name) + '</b><small>' + esc(s.how) + '</small></div>'; }).join('') + '</div></div>' +
        '<div class="ch-sec ui-card"><h2>Cubedex <span class="ui-badge brand">' + d.faces.length + '/100 faces</span></h2>' +
          '<p class="muted" style="font-weight:700">Every eyes + mouth combo you own. Babies mix their parents\' faces: hold hands with new cubes to fill it in!</p>' + dex + '</div></div>';
      QB.hydrate(view);
      view.querySelectorAll('[data-dex]').forEach(function (cv) {
        var p = cv.getAttribute('data-dex').split('-');
        QB.paintFace(cv.getContext('2d'), 96, { color: '#ff9cc8', eyes: +p[0], mouth: +p[1] });
      });
    });
  });
})();

/* ===== cubby.html ===== */
(function () {
  var esc = UI.esc, MAT_W = 8, MAT_D = 6, ON_MAT = 16;
  // default spots: a loose checkerboard from the middle outwards, so cubes have room to roll
  var SPOTS = [];
  for (var sx = 0; sx < MAT_W; sx++) for (var sz = 0; sz < MAT_D; sz++) SPOTS.push([sx, sz]);
  SPOTS.sort(function (a, b) { var pa = (a[0] + a[1]) % 2, pb = (b[0] + b[1]) % 2; if (pa !== pb) return pa - pb;
    return (Math.abs(a[0] - 3.5) + Math.abs(a[1] - 2.5)) - (Math.abs(b[0] - 3.5) + Math.abs(b[1] - 2.5)); });

  UI.page('cubby', { title: 'My Cubby', nav: 'Cubby', icon: 'home', auth: 'user', order: 10 }, function (view, ctx) {
    var data = null, stage = null, sel = null, offKeys = null, alive = true, go = null;
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:420px"></div></div>';

    function positions() { return UI.store.get('pos.' + ctx.me.id, {}); }
    function savePos() {
      var p = {};
      if (stage) Object.keys(stage.actors).forEach(function (k) { var a = stage.actors[k]; p[k] = [a.d.x, a.d.z]; });
      UI.store.set('pos.' + ctx.me.id, p);
    }
    function onMat() { return data.cubes.slice().reverse().slice(0, ON_MAT); }

    function selCard() {
      var c = sel ? sel.d : null, box = view.querySelector('[data-sel]');
      if (!box) return;
      if (!c) { box.innerHTML = '<p class="muted" style="font-weight:700">Tap a cube to pick it, then roll it!</p>'; return; }
      var hint = !c.grown ? '🍼 Baby! Roll ' + c.grow_left + ' more time' + (c.grow_left === 1 ? '' : 's') + ' to grow up.'
        : c.love >= 100 ? '💖 Full of love! Take it to the World to hold hands.' : 'Roll to land the 💖 heart side on top!';
      box.innerHTML = QB.thumbHtml(c, 96) + '<h2>' + esc(c.name) + '</h2><div class="meta">' + esc(c.color_name) + ' · Gen ' + c.gen + (c.in_world ? ' · 🏝️ in the World' : '') + '</div>' +
        QB.loveBar(c.love) + '<p class="hint">' + esc(hint) + '</p>' +
        '<div class="ui-row" style="justify-content:center"><a class="ui-btn sm" href="#cube/' + esc(c.id) + '" data-go="cube/' + esc(c.id) + '">🪪 Card</a>' +
        '<button class="ui-btn sm mint" data-world>' + (c.in_world ? '🏠 Bring home' : '🏝️ To the World') + '</button></div>';
      QB.hydrate(box);
    }
    function listHtml() {
      var left = data.me.handmade_max - data.me.handmade;
      return (left > 0 ? '<a class="cb-cube cb-new" href="#make" data-go="make"><span class="plus">+</span><b>Make a cube</b><small>' + left + ' hand-made left</small></a>' : '') +
        data.cubes.slice().reverse().map(function (c) {
          return '<button type="button" class="cb-cube' + (sel && sel.d.id === c.id ? ' on' : '') + '" data-pick="' + esc(c.id) + '">' + QB.thumbHtml(c, 74) +
            '<b>' + esc(c.name) + '</b><small>' + (c.grown ? 'Gen ' + c.gen : '🍼 baby') + (c.in_world ? ' · 🏝️' : '') + (c.nap ? ' · 💤' : '') + '</small></button>';
        }).join('');
    }
    function drawList() { var l = view.querySelector('[data-list]'); if (l) { l.innerHTML = listHtml(); QB.hydrate(l); } }
    function chips() {
      var g = data.me.gift;
      return '<span class="qb-sparkles" data-spark>✨ ' + data.me.sparkles + '</span>' +
        '<span class="ui-badge">🧊 ' + data.me.total + ' cubes</span><span class="ui-badge">✋ ' + data.me.handmade + '/' + data.me.handmade_max + ' hand-made</span>' +
        (g.ready ? '<button class="ui-btn sm lemon cb-gift" data-gift>🎁 Daily gift!</button>' : '<span class="ui-badge" title="Daily streak">🔥 ' + g.streak + '-day streak</span>');
    }
    function updateChips() { var c = view.querySelector('[data-chips]'); if (c) c.innerHTML = chips(); }

    function select(a) {
      if (sel) sel.select(false);
      sel = a || null;
      if (sel) { sel.select(true); UI.store.set('sel', sel.d.id); }
      selCard(); drawList();
    }
    function blocked(a, dir) {
      var v = QB.DIRS[dir], x = a.d.x + v[0], z = a.d.z + v[1];
      if (x < 0 || z < 0 || x >= MAT_W || z >= MAT_D) return true;
      return Object.keys(stage.actors).some(function (k) { var o = stage.actors[k]; return o !== a && o.d.x === x && o.d.z === z; });
    }

    function draw() {
      var empty = !data.cubes.length;
      view.innerHTML = '<div class="ui-wrap"><div class="cb-top"><h1>' + esc(ctx.me.name.split(' ')[0]) + '\'s Cubby</h1><div class="cb-chips" data-chips>' + chips() + '</div></div>' +
        (empty ? '<div class="ui-empty"><div style="font-size:3rem">🧊</div><h3>Your Cubby is empty!</h3><p style="font-weight:700">Make your very first cube: pick a colour, eyes, a mouth, and doodle a face.</p>' +
          '<a class="ui-btn primary lg" href="#make" data-go="make">Make my first cube ✨</a></div>'
          : '<div class="cb-play"><div class="cb-stage" data-stage></div><div class="cb-side"><div class="ui-card cb-sel" data-sel></div><div class="cb-pad" data-pad></div></div></div>') +
        '<div class="cb-sec"><h2>My cubes <span class="ui-badge brand">' + data.cubes.length + '</span></h2><div class="cb-list" data-list>' + listHtml() + '</div></div>' +
        (data.happenings.length ? '<div class="cb-sec"><h2>Meanwhile in the World</h2><div class="cb-news">' + data.happenings.map(function (h) {
          return '<div><i style="background:' + esc((h.data && h.data.color) || '#ff5fa2') + '"></i><span>' + esc(h.text) + '</span><span class="ui-spacer"></span><small class="muted">' + esc(UI.ago(h.at)) + '</small></div>';
        }).join('') + '</div></div>' : '') + '</div>';
      QB.hydrate(view);
      if (empty) return Promise.resolve();
      var pad = QB.dpad(function (d) { pad.hit(d); if (go) go(d); });
      view.querySelector('[data-pad]').appendChild(pad);
      selCard();
      if (!QB.glOK()) { view.querySelector('[data-stage]').innerHTML = '<div class="qb-nogl">Your browser can\'t show 3D. Your cubes are below!</div>'; return Promise.resolve(); }
      return QB.three().then(function () {
        if (!alive) return;
        stage = new QB.Stage(view.querySelector('[data-stage]'), { kind: 'cubby', w: MAT_W, d: MAT_D });
        stage.cubbyGround(data.me.inventory.toys);
        var pos = positions(), taken = {};
        onMat().forEach(function (c) {
          var p = pos[c.id];
          if (!p || taken[p[0] + ',' + p[1]] || p[0] >= MAT_W || p[1] >= MAT_D) {
            p = null;
            for (var i = 0; i < SPOTS.length && !p; i++) if (!taken[SPOTS[i][0] + ',' + SPOTS[i][1]]) p = SPOTS[i];
          }
          taken[p[0] + ',' + p[1]] = 1;
          var a = stage.add(Object.assign({}, c, { x: p[0], z: p[1] }));
          a.tag(esc(c.name) + (c.grown ? '' : ' 🍼'), 'mine');
        });
        savePos();
        var want = UI.store.get('sel', null);
        select(stage.actors[want] || stage.actors[onMat()[0].id]);
        go = QB.roller(stage, { where: 'home', move: true, blocked: blocked, getActor: function () { return sel; },
          noActor: function () { UI.toast('Tap a cube first!'); },
          onResult: function (a, res) {
            savePos();
            if (!res || res.ok === false || !res.cube) return;
            var c = data.cubes.filter(function (x) { return x.id === a.d.id; })[0];
            if (c) { ['orient', 'love', 'rolls', 'grown', 'grow_left'].forEach(function (k) { c[k] = res.cube[k]; }); a.d.love = c.love; a.d.grown = c.grown; a.d.grow_left = c.grow_left; }
            data.me.sparkles = res.sparkles; updateChips(); selCard();
            if (res.reward && res.reward.grew) { a.tag(esc(a.d.name), 'mine'); drawList(); }
          } });
        stage.onSwipe = function (d) { pad.hit(d); go(d); };
        stage.onPick = function (a) { if (a) { select(a); a.express('love', 700); QB.sfx('pop'); } };
        offKeys = QB.keys(function (d) { pad.hit(d); go(d); });
      });
    }

    function adoptDraft() {
      var d = UI.store.get('draft', null);
      if (!d || !d.color || data.me.handmade >= data.me.handmade_max) return Promise.resolve(false);
      var name = (d.name || '').trim().length >= 2 ? d.name : QB.randomName();
      return UI.apiQuiet('create_cube', name, d.color, d.eyes || 0, d.mouth || 0, d.drawing || '').then(function (r) {
        UI.store.set('draft', null);
        UI.toast(r.cube.name + ' from the front page moved into your Cubby! 🎉', 'ok');
        UI.store.set('sel', r.cube.id);
        return true;
      }, function () { UI.store.set('draft', null); return false; });
    }

    view.addEventListener('click', function (e) {
      var p = e.target.closest('[data-pick]');
      if (p) {
        var id = p.getAttribute('data-pick');
        if (stage && stage.actors[id]) { select(stage.actors[id]); stage.actors[id].express('love', 700); QB.sfx('pop'); }
        else UI.go('cube', id);
        return;
      }
      if (e.target.closest('[data-gift]')) {
        UI.api('claim_gift').then(function (r) {
          data.me.sparkles = r.sparkles; data.me.gift = { ready: false, streak: r.streak };
          updateChips(); QB.confetti(90); QB.sfx('golden');
          UI.toast('🎁 +' + r.amount + ' sparkles! ' + r.streak + '-day streak 🔥', 'ok');
        });
        return;
      }
      var w = e.target.closest('[data-world]');
      if (w && sel) {
        var c = sel.d, out = !c.in_world;
        UI.busy(w, UI.api('send_to_world', c.id, out)).then(function (r) {
          c.in_world = r.cube.in_world;
          var dc = data.cubes.filter(function (x) { return x.id === c.id; })[0]; if (dc) dc.in_world = c.in_world;
          selCard(); drawList();
          if (out) UI.toast(c.name + ' is off to play in the World! 🏝️', 'ok');
        });
      }
    });

    function load() {
      return UI.api('get_cubby').then(function (d) {
        data = d;
        return adoptDraft().then(function (adopted) { return adopted ? UI.api('get_cubby').then(function (d2) { data = d2; }) : null; });
      }).then(draw);
    }
    return { ready: load(), destroy: function () { alive = false; if (offKeys) offKeys(); if (stage) stage.destroy(); } };
  });
})();

/* ===== cube.html ===== */
(function () {
  var esc = UI.esc;
  function fam(list) {
    return '<div class="cu-fam">' + list.map(function (c) {
      return '<a href="#cube/' + esc(c.id) + '" data-go="cube/' + esc(c.id) + '">' + QB.thumbHtml(c, 70) + esc(c.name) + '<small>' + esc(c.owner) + ' · Gen ' + c.gen + '</small></a>';
    }).join('') + '</div>';
  }

  UI.page('cube', { title: 'Cube card', auth: 'user' }, function (view, ctx) {
    var id = ctx.args[0], c = null, me = null, stage = null, actor = null, go = null, offKeys = null, alive = true;
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:420px"></div></div>';

    function info() {
      var status = !c.grown ? '🍼 Baby: roll ' + c.grow_left + ' more' : c.nap ? '💤 Resting ' + QB.napText(c.nap) : c.love >= 100 ? '💖 Ready to hold hands' : '🙂 Happy';
      var inv = me ? me.inventory : null;
      return '<div class="ui-row between top"><div><div class="eyebrow">' + (c.mine ? 'Your cube' : esc(c.owner) + '\'s cube') + (c.demo ? ' · demo' : '') + '</div><h1>' + esc(c.name) + '</h1></div>' +
        (c.mine ? '<a class="ui-btn sm" href="#make/' + esc(c.id) + '" data-go="make/' + esc(c.id) + '">✏️ Doodle / rename</a>' : '<button class="ui-btn sm danger" data-report>🚩 Report</button>') + '</div>' +
        '<div class="cu-facts"><div class="cu-fact"><b>' + esc(c.color_name) + '</b><span>colour</span></div><div class="cu-fact"><b>Gen ' + c.gen + '</b><span>' + (c.handmade ? 'hand-made' : 'born from hand-holding') + '</span></div>' +
        '<div class="cu-fact"><b>' + c.rolls + '</b><span>rolls</span></div><div class="cu-fact"><b>' + esc(UI.ago(c.born).replace(' ago', '')) + '</b><span>old</span></div>' +
        '<div class="cu-fact"><b>' + esc(QB.EYES[c.eyes]) + '</b><span>eyes</span></div><div class="cu-fact"><b>' + esc(QB.MOUTHS[c.mouth]) + '</b><span>mouth</span></div></div>' +
        '<p style="font-weight:800;margin:0 0 6px">' + esc(status) + ' · Love ' + c.love + '/100</p>' + QB.loveBar(c.love) +
        (c.mine ? '<div class="cu-sec"><h3>Wardrobe</h3><div class="cu-hats" data-hats><button type="button" data-hat="" class="' + (c.hat ? '' : 'on') + '" title="No hat">🚫</button>' +
            inv.hats.map(function (h) { return '<button type="button" data-hat="' + h + '" class="' + (c.hat === h ? 'on' : '') + '" title="' + esc(QB.HATS[h][0]) + '">' + QB.HATS[h][1] + '</button>'; }).join('') +
            '</div>' + (inv.hats.length ? '' : '<p class="ui-hint">No hats yet. Get some in the <a href="#shop" data-go="shop">Sparkle Shop</a>!</p>') + '</div>' +
          '<div class="cu-sec"><h3>Play</h3><div class="ui-row">' +
            '<button class="ui-btn sm mint" data-world>' + (c.in_world ? '🏠 Bring home' : '🏝️ Send to the World') + '</button>' +
            '<label class="ui-check"><input type="checkbox" data-open' + (c.open ? ' checked' : '') + '> ✋ Other cubes can hold hands with ' + esc(c.name) + '</label></div>' +
            '<div class="ui-row" style="margin-top:10px"><button class="ui-btn sm" data-use="potion"' + (inv.potion ? '' : ' disabled') + '>🧪 Love Potion (' + inv.potion + ')</button>' +
            '<button class="ui-btn sm" data-use="whistle"' + (inv.whistle ? '' : ' disabled') + '>📯 Wake-Up Whistle (' + inv.whistle + ')</button></div></div>' : '');
    }
    function family() {
      return (c.parents.length ? '<div class="cu-sec"><h3>Parents</h3>' + fam(c.parents) + '</div>' : '<div class="cu-sec"><h3>Parents</h3><p class="muted" style="font-weight:700">Hand-made with love by ' + esc(c.owner) + '.</p></div>') +
        (c.grandparents.length ? '<div class="cu-sec"><h3>Grandparents</h3>' + fam(c.grandparents) + '</div>' : '') +
        '<div class="cu-sec"><h3>Babies <span class="ui-badge">' + c.children_total + '</span></h3>' + (c.children.length ? fam(c.children) : '<p class="muted" style="font-weight:700">No babies yet.' + (c.mine ? ' Fill the heart, then hold hands in the World!' : '') + '</p>') + '</div>';
    }
    function redraw() { var b = view.querySelector('[data-info]'); b.innerHTML = info(); }

    function draw() {
      view.innerHTML = '<div class="ui-wrap"><a class="ui-btn ghost sm" href="#cubby" data-go="cubby" style="margin-bottom:12px">' + UI.icon('back') + 'My Cubby</a>' +
        '<div class="cu"><div><div class="cu-stage" data-stage></div><div class="cu-under" data-under></div></div>' +
        '<div class="ui-card"><div data-info>' + info() + '</div></div></div>' +
        '<div class="ui-card" style="margin-top:22px">' + family() + '</div></div>';
      QB.hydrate(view);
      if (!QB.glOK()) { view.querySelector('[data-stage]').innerHTML = '<div class="qb-nogl">' + QB.thumbHtml(c, 150) + '</div>'; QB.hydrate(view); return Promise.resolve(); }
      return QB.three().then(function () {
        if (!alive) return;
        stage = new QB.Stage(view.querySelector('[data-stage]'), { kind: 'hero', dist: c.grown ? .85 : .7 });
        stage.heroGround();
        actor = stage.add(Object.assign({}, c, { x: 0, z: 0 }));
        if (c.mine) {
          var pad = QB.dpad(function (d) { pad.hit(d); go(d); }, true);
          view.querySelector('[data-under]').appendChild(pad);
          var t = document.createElement('p'); t.className = 'muted small'; t.style.fontWeight = 700; t.style.margin = 0; t.textContent = 'Roll ' + c.name + ' right here!';
          view.querySelector('[data-under]').appendChild(t);
          go = QB.roller(stage, { where: 'home', move: false, getActor: function () { return actor; }, onResult: function (a, res) {
            if (!res || res.ok === false || !res.cube) return;
            ['orient', 'love', 'rolls', 'grown', 'grow_left'].forEach(function (k) { c[k] = res.cube[k]; });
            if (me) me.sparkles = res.sparkles;
            redraw();
          } });
          stage.onSwipe = function (d) { pad.hit(d); go(d); };
          offKeys = QB.keys(function (d) { pad.hit(d); go(d); });
        }
        stage.onPick = function (a) { if (a && !a.busy && !a.rolling) a.play('love', null); };
      });
    }

    view.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-hat]'))) {
        var h = b.getAttribute('data-hat');
        UI.api('update_cube', c.id, { hat: h }).then(function (r) { c.hat = r.cube.hat; redraw(); if (actor) actor.setData({ hat: c.hat }); QB.sfx('pop'); });
        return;
      }
      if ((b = e.target.closest('[data-world]'))) {
        UI.busy(b, UI.api('send_to_world', c.id, !c.in_world)).then(function (r) { c.in_world = r.cube.in_world; redraw(); UI.toast(c.in_world ? c.name + ' is off to the World! 🏝️' : c.name + ' came home.', 'ok'); });
        return;
      }
      if ((b = e.target.closest('[data-use]'))) {
        var item = b.getAttribute('data-use');
        UI.busy(b, UI.api('use_item', item, c.id)).then(function (r) {
          Object.assign(c, { love: r.cube.love, nap: r.cube.nap }); me = r.me; redraw();
          if (actor) actor.play(item === 'potion' ? 'love' : 'boing', null);
          UI.toast(item === 'potion' ? c.name + ' is full of love! 💖' : c.name + ' is wide awake! 📯', 'ok');
        });
        return;
      }
      if (e.target.closest('[data-report]')) {
        var m = UI.modal('<h2>Report ' + esc(c.name) + '?</h2><p class="muted" style="font-weight:700">A grown-up moderator will take a look. Thanks for keeping QuickyBricks kind!</p>' +
          '<div class="ui-stack">' + [['drawing', '🎨 A rude drawing'], ['name', '🔤 A rude name'], ['other', '❓ Something else']].map(function (r) {
            return '<button class="ui-btn block" data-reason="' + r[0] + '">' + r[1] + '</button>'; }).join('') + '</div>');
        m.el.addEventListener('click', function (ev) {
          var rb = ev.target.closest('[data-reason]'); if (!rb) return;
          UI.api('report_cube', c.id, rb.getAttribute('data-reason')).then(function () { m.close(); UI.toast('Thanks! A moderator will check it.', 'ok'); });
        });
      }
    });
    view.addEventListener('change', function (e) {
      if (!e.target.matches('[data-open]')) return;
      var on = e.target.checked;
      UI.api('update_cube', c.id, { open: on }).then(function () { c.open = on; UI.toast(on ? 'Hands open ✋' : 'Hands closed', 'ok'); });
    });

    var ready = UI.api('get_cube', id).then(function (r) { c = r.cube; me = r.me || null; document.title = c.name + ' · QuickyBricks'; return draw(); });
    return { ready: ready, destroy: function () { alive = false; if (offKeys) offKeys(); if (stage) stage.destroy(); } };
  });
})();

/* ===== landing.html ===== */
(function () {
  var esc = UI.esc;
  var COPY = {
    title: 'Roll a cube. <em>Hatch</em> <span>a family!</span>',
    lead: 'QuickyBricks are squishy little cubes with doodled faces. Roll them over and something silly happens. Hold hands with other cubes and, POP, a cube baby!',
    proof: ['✨ Free', '📱 Phones + tablets', '🙊 Super-short chat', '🚫 No ads'],
    faq: [['Is it free?', 'Yes! Making cubes, rolling, the World and holding hands are all free. The shop only takes sparkles, which you earn by rolling.'],
          ['Who is it for?', 'Silly people of all ages. A grown-up (16 or older) makes the account and little ones play along. You can try the cube on this page without an account.'],
          ['Why only 3 letters in the chat?', 'So it stays friendly! You can say HI!, YAY or send a 💖, one message every 30 seconds, and messages vanish after a minute or two.'],
          ['How do I get more than 10 cubes?', 'You can make 10 cubes by hand. After that, send cubes to the World and hold hands with other players\' cubes: each time, a baby is born. Babies get one parent\'s eyes, one parent\'s mouth and a mixed-up colour.'],
          ['What if someone draws something rude?', 'Tap their cube and press Report. A grown-up moderator can wipe the drawing, change the name or send the cube home.'],
          ['Does it work on my phone or tablet?', 'Yes. Swipe on a cube or use the big arrow buttons. It runs in the browser, nothing to install.']]
  };

  function draft() {
    var d = UI.store.get('draft', null);
    if (!d || !d.color) d = { name: QB.randomName(), color: QB.pick(['#ff5fa2', '#34d6c4', '#ffd23f', '#a07bff', '#6cc6ff', '#ff8a3d']), eyes: 1, mouth: 0, drawing: '', orient: QB.START, sparkles: 0, rolls: 0 };
    d.id = 'draft'; d.grown = true; d.x = 0; d.z = 0;
    return d;
  }
  function saveDraft(d) { UI.store.set('draft', { name: d.name, color: d.color, eyes: d.eyes, mouth: d.mouth, drawing: d.drawing || '', orient: d.orient, sparkles: d.sparkles || 0, rolls: d.rolls || 0 }); }

  /* the doodle modal (landing playground; the Maker has the pad inline) */
  QB.drawModal = function (cube, onDone) {
    var m = UI.modal('<h2>Doodle on the face</h2><p class="muted" style="font-weight:600">Draw freckles, a mustache, stars... anything! The eyes and mouth stay on top.</p><div data-pad></div>' +
      '<div class="ui-row end" style="margin-top:14px"><button class="ui-btn ghost" data-close>Cancel</button><button class="ui-btn primary" data-ok>Done!</button></div>');
    var pad = QB.drawPad({ cube: cube });
    m.el.querySelector('[data-pad]').appendChild(pad.el);
    m.el.querySelector('[data-ok]').onclick = function () { onDone(pad.toDataURL()); m.close(); };
  };

  UI.page('landing', { title: 'Roll a cube, hatch a family' }, function (view, ctx) {
    var me = ctx.me, C = COPY, d = draft(), stage = null, offKeys = null, alive = true;
    var primary = me ? '<a class="ui-btn primary lg" href="#cubby" data-go="cubby">Open my Cubby 🏠</a>'
      : '<a class="ui-btn primary lg" href="#auth/signup" data-go="auth/signup">Start my cube family! 🎉</a><a class="ui-btn lg" href="#auth" data-go="auth">I have an account</a>';
    var sides = QB.FACE_EVENT.map(function (k) { var E = QB.EVENTS[k]; return '<div class="ui-card lp-side"><span class="em" style="background:' + E.color + '">' + E.emoji + '</span>' +
      '<span class="k">' + esc(E.side) + '</span><h3>' + esc(E.label) + '</h3><p>' + esc(E.text) + '</p></div>'; }).join('');
    var mom = { name: 'Sprinkle', color: '#ff5fa2', eyes: 5, mouth: 0 }, dad = { name: 'Blueberry', color: '#2f8cff', eyes: 1, mouth: 4 }, kid = { name: 'Sprinberry', color: '#a35cf0', eyes: 5, mouth: 4 };
    view.innerHTML =
      '<section class="lp-hero"><div class="ui-wrap"><div>' +
        '<div class="eyebrow">Squishy cubes · silly surprises</div><h1>' + C.title + '</h1><p class="lp-lead">' + esc(C.lead) + '</p>' +
        '<div class="lp-cta">' + primary + '</div>' +
        '<div class="lp-proof">' + C.proof.map(function (p) { return '<span class="ui-badge">' + esc(p) + '</span>'; }).join('') + '</div>' +
      '</div><div class="lp-play">' +
        '<div class="lp-stage" data-stage></div>' +
        '<div class="lp-under"><div data-dpad></div><div class="lp-tune">' +
          '<div class="lp-swatches" data-sw>' + QB.COLORS.slice(0, 14).map(function (c) { return '<button type="button" data-color="' + c[0] + '" style="background:' + c[0] + '" aria-label="' + esc(c[1]) + '"></button>'; }).join('') + '</div>' +
          '<div class="lp-pickers"><span class="lp-picker"><button type="button" data-step="eyes" data-by="-1" aria-label="Previous eyes">‹</button><span data-lab="eyes"></span><button type="button" data-step="eyes" data-by="1" aria-label="Next eyes">›</button></span>' +
          '<span class="lp-picker"><button type="button" data-step="mouth" data-by="-1" aria-label="Previous mouth">‹</button><span data-lab="mouth"></span><button type="button" data-step="mouth" data-by="1" aria-label="Next mouth">›</button></span>' +
          '<button type="button" class="ui-btn sm lemon" data-draw>✏️ Doodle</button></div>' +
          '<div class="lp-namebar"><input type="text" maxlength="14" data-name aria-label="Cube name" value="' + esc(d.name) + '"><button type="button" class="ui-btn sm" data-dice aria-label="Random name">🎲</button></div>' +
        '</div></div>' +
        '<div class="lp-legend" data-legend>' + QB.FACE_EVENT.map(function (k) { return '<span data-ev="' + k + '">' + QB.EVENTS[k].emoji + ' ' + esc(QB.EVENTS[k].label.replace(/!$/, '')) + '</span>'; }).join('') + '</div>' +
        '<div class="lp-keep"><span><b data-earn>Roll me with the arrows, your arrow keys, or a swipe!</b></span>' +
          (me ? '<a class="ui-btn sm primary" href="#make" data-go="make">Make it for real</a>' : '<a class="ui-btn sm primary" href="#auth/signup" data-go="auth/signup">Keep this cube 💾</a>') + '</div>' +
      '</div></div></section>' +
      '<section class="lp-section" id="sides"><div class="ui-wrap"><div class="lp-head"><h2>Six sides, six silly surprises</h2><p>Every cube has a face and five picture sides. Whatever lands on top when it rolls... happens!</p></div>' +
        '<div class="lp-sides">' + sides + '</div></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-head"><h2>How to grow a cube family</h2><p>The goal: as many cubes as you can squeeze into your Cubby.</p></div>' +
        '<div class="lp-steps">' +
          '<div class="ui-card lp-step"><h3>Make a cube</h3><p>Pick a colour, 1 of 10 eyes, 1 of 10 mouths, doodle on its face and give it a name. You can make 10.</p></div>' +
          '<div class="ui-card lp-step"><h3>Roll it!</h3><p>Every roll does something silly and earns sparkles ✨ and love 💖.</p></div>' +
          '<div class="ui-card lp-step"><h3>Hold hands</h3><p>In the World, a cube with a full heart holds hands with another player\'s cube. Both players get a baby!</p></div>' +
          '<div class="ui-card lp-step"><h3>Watch them grow</h3><p>Roll a baby 10 times and it grows up, ready to make babies of its own. Grandcubes!</p></div>' +
        '</div>' +
        '<div class="lp-recipe" aria-label="A pink cube and a blue cube make a purple baby">' +
          '<figure>' + QB.thumbHtml(mom, 92) + 'Sprinkle</figure><span class="op">+</span><figure>' + QB.thumbHtml(dad, 92) + 'Blueberry</figure><span class="op">=</span>' +
          '<figure>' + QB.thumbHtml(kid, 110) + 'Sprinberry!</figure></div>' +
        '<p class="muted" style="text-align:center;font-weight:700;margin-top:8px">Heart eyes from one parent, a kitty mouth from the other, and pink + blue = purple.</p></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-head"><h2>So much to do</h2></div><div class="ui-grid">' +
        [['🏝️', 'The World', 'A candy island where everyone\'s cubes roll around: lollipop trees, a jelly pond, a giant donut.'],
         ['💬', '3-letter chat', 'Say HI!, LOL or 💖 with a speech bubble over your cube. One message every 30 seconds.'],
         ['🎩', 'Sparkle Shop', 'Crowns, propeller caps, cat ears and a halo. Plus toys for your Cubby.'],
         ['🎁', 'Daily gift', 'Come back every day for a present. The longer your streak, the bigger the gift.'],
         ['📖', 'Cubedex', '10 eyes × 10 mouths = 100 faces to collect. Can you find them all?'],
         ['🌳', 'Family trees', 'See every cube\'s parents, grandparents and babies. Who has the biggest family?']].map(function (f) {
          return '<div class="ui-card lp-feature"><span class="em">' + f[0] + '</span><h3>' + esc(f[1]) + '</h3><p>' + esc(f[2]) + '</p></div>'; }).join('') +
      '</div></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-head"><h2>Questions</h2></div><div class="lp-faq">' +
        C.faq.map(function (q) { return '<details><summary>' + esc(q[0]) + '</summary><p>' + esc(q[1]) + '</p></details>'; }).join('') + '</div></div></section>' +
      '<section class="lp-section"><div class="ui-wrap"><div class="lp-band"><div><h2>Ready to roll?</h2><p>Your first cube is waiting. It takes a minute.</p></div>' +
        (me ? '<a class="ui-btn lg lemon" href="#cubby" data-go="cubby">Open my Cubby</a>' : '<a class="ui-btn lg lemon" href="#auth/signup" data-go="auth/signup">Make my account</a>') +
      '</div></div></section>';
    QB.hydrate(view);

    var host = view.querySelector('[data-stage]'), actor = null;
    function labels() {
      view.querySelector('[data-lab="eyes"]').textContent = QB.EYES[d.eyes] + ' eyes';
      view.querySelector('[data-lab="mouth"]').textContent = QB.MOUTHS[d.mouth];
      view.querySelectorAll('[data-color]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-color') === d.color); });
    }
    labels();
    function changed() { saveDraft(d); labels(); if (actor) actor.setData({ color: d.color, eyes: d.eyes, mouth: d.mouth, drawing: d.drawing, name: d.name }); }

    var roll = function () {};
    var dp = QB.dpad(function (dir) { roll(dir); });
    view.querySelector('[data-dpad]').appendChild(dp);
    var ready = Promise.resolve();
    if (QB.glOK()) {
      ready = QB.three().then(function () {
        if (!alive) return;
        stage = new QB.Stage(host, { kind: 'hero' });
        stage.heroGround();
        actor = stage.add(d);
        var go = QB.roller(stage, { guest: true, getActor: function () { return actor; }, onResult: function (a, res) {
          d.orient = a.d.orient; d.sparkles = (d.sparkles || 0) + (res.reward.sparkles || 0); d.rolls = (d.rolls || 0) + 1; saveDraft(d);
          var leg = view.querySelector('[data-ev="' + res.event + '"]');
          if (leg) { leg.classList.add('hit'); setTimeout(function () { leg.classList.remove('hit'); }, 1400); }
          view.querySelector('[data-earn]').textContent = me ? 'Nice roll! ' + d.sparkles + ' ✨ practice sparkles' : 'You\'d have ' + d.sparkles + ' ✨ by now. Sign up to keep them!';
        } });
        roll = function (dir) { dp.hit(dir); go(dir); };
        stage.onSwipe = roll;
        stage.onPick = function (a) { if (a && !a.busy && !a.rolling) a.play(QB.pick(['love', 'sunny']), null); };
        offKeys = QB.keys(roll, function () { var r = host.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; });
      }).catch(function (err) { console.error('3D', err && err.stack || err); host.innerHTML = '<div class="qb-nogl">The 3D cube couldn\'t load. Check your connection and refresh!</div>'; });
    } else {
      host.innerHTML = '<div class="qb-nogl"><div>' + QB.thumbHtml(d, 160) + '<p>Your browser can\'t show 3D, but you can still make cubes!</p></div></div>';
      QB.hydrate(host);
    }

    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-color]');
      if (b) { d.color = b.getAttribute('data-color'); changed(); QB.sfx('pop'); return; }
      var s = e.target.closest('[data-step]');
      if (s) { var k = s.getAttribute('data-step'); d[k] = (d[k] + (+s.getAttribute('data-by')) + 10) % 10; changed(); QB.sfx('pop'); return; }
      if (e.target.closest('[data-dice]')) { d.name = QB.randomName(); view.querySelector('[data-name]').value = d.name; changed(); return; }
      if (e.target.closest('[data-draw]')) { QB.drawModal(d, function (url) { d.drawing = url; changed(); }); }
    });
    view.querySelector('[data-name]').addEventListener('input', function (e) { d.name = e.target.value.slice(0, 14); saveDraft(d); });
    return { ready: ready, destroy: function () { alive = false; if (offKeys) offKeys(); if (stage) stage.destroy(); } };
  });
})();

/* ===== make.html ===== */
(function () {
  var esc = UI.esc;
  function optCanvas(cube, o) {
    var cv = document.createElement('canvas'); cv.width = cv.height = 128;
    QB.paintFace(cv.getContext('2d'), 128, cube, o);
    return cv;
  }

  UI.page('make', { title: 'Cube Maker', auth: 'user' }, function (view, ctx) {
    var id = ctx.args[0] || null, cube = null, stage = null, actor = null, pad = null, alive = true;
    view.innerHTML = '<div class="ui-wrap"><div class="ui-skel" style="height:420px"></div></div>';

    function opts(kind) {
      var names = kind === 'eyes' ? QB.EYES : QB.MOUTHS, box = view.querySelector('[data-opts="' + kind + '"]');
      box.innerHTML = '';
      names.forEach(function (n, i) {
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-' + kind, i); b.className = cube[kind] === i ? 'on' : '';
        var c = Object.assign({}, cube, { drawing: '' }); c[kind] = i;
        b.appendChild(optCanvas(c, kind === 'eyes' ? { mouth: 0 } : { eyes: 0 }));
        b.appendChild(document.createTextNode(n));
        box.appendChild(b);
      });
    }
    function refresh(all) {
      if (actor) actor.setData({ color: cube.color, eyes: cube.eyes, mouth: cube.mouth, drawing: cube.drawing });
      if (pad) pad.setCube(cube);
      if (all && !id) { opts('eyes'); opts('mouth'); view.querySelectorAll('[data-color]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-color') === cube.color); }); }
    }

    function draw(me) {
      var left = me ? me.handmade_max - me.handmade : 0;
      if (!id && left <= 0) {
        view.innerHTML = '<div class="ui-wrap ui-narrow"><div class="ui-empty"><div style="font-size:3rem">✋✋</div><h3>You\'ve made all 10 hand-made cubes!</h3>' +
          '<p style="font-weight:700">More cubes come from holding hands. Send a cube with a full heart to the World and find a friend.</p>' +
          '<div class="ui-row" style="justify-content:center"><a class="ui-btn primary" href="#world" data-go="world">🏝️ Go to the World</a><a class="ui-btn" href="#cubby" data-go="cubby">My Cubby</a></div></div></div>';
        return Promise.resolve();
      }
      var n = 0, step = function (t) { n++; return '<h3><span class="n">' + n + '</span>' + t + '</h3>'; };
      view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head"><div><h1>' + (id ? 'Fix up ' + esc(cube.name) : 'Cube Maker') + '</h1>' +
        '<p class="muted" style="font-weight:700">' + (id ? 'Doodle a new face or change the name. Colour, eyes and mouth are how ' + esc(cube.name) + ' was born!' : 'You can make ' + left + ' more hand-made cube' + (left === 1 ? '' : 's') + '. Every choice shows up on the cube right away.') + '</p></div></div>' +
        '<div class="mk"><div class="mk-preview"><div class="mk-stage" data-stage></div><p class="muted small" style="text-align:center;font-weight:700;margin-top:10px">Tap the cube to make it giggle!</p></div><div>' +
        (id ? '' : '<div class="ui-card mk-step">' + step('Pick a colour') + '<div class="mk-colors">' + QB.COLORS.map(function (c) {
          return '<button type="button" data-color="' + c[0] + '" style="background:' + c[0] + '" title="' + esc(c[1]) + '" aria-label="' + esc(c[1]) + '"></button>'; }).join('') + '</div></div>' +
          '<div class="ui-card mk-step">' + step('Pick eyes') + '<div class="mk-opts" data-opts="eyes"></div></div>' +
          '<div class="ui-card mk-step">' + step('Pick a mouth') + '<div class="mk-opts" data-opts="mouth"></div></div>') +
        '<div class="ui-card mk-step">' + step('Doodle on the face <span class="muted small">(optional)</span>') + '<div data-pad></div></div>' +
        '<div class="ui-card mk-step">' + step('Name it') + '<div class="mk-name"><input type="text" maxlength="14" data-name value="' + esc(cube.name) + '" aria-label="Name">' +
          '<button type="button" class="ui-btn" data-dice aria-label="Random name">🎲</button></div><p class="ui-hint">2 to 14 letters. Be nice!</p></div>' +
        '<div class="mk-go"><a class="ui-btn ghost" href="#' + (id ? 'cube/' + esc(id) : 'cubby') + '" data-go="' + (id ? 'cube/' + esc(id) : 'cubby') + '">Cancel</a>' +
          '<button type="button" class="ui-btn primary lg" data-save>' + (id ? 'Save ✨' : 'Hatch my cube! 🐣') + '</button></div>' +
        '</div></div></div>';
      if (!id) { opts('eyes'); opts('mouth'); refresh(true); }
      pad = QB.drawPad({ cube: cube, onChange: function () { cube.drawing = pad.toDataURL(); refresh(); } });
      view.querySelector('[data-pad]').appendChild(pad.el);
      if (!QB.glOK()) { view.querySelector('[data-stage]').innerHTML = '<div class="qb-nogl">' + QB.thumbHtml(cube, 150) + '</div>'; QB.hydrate(view); return Promise.resolve(); }
      return QB.three().then(function () {
        if (!alive) return;
        stage = new QB.Stage(view.querySelector('[data-stage]'), { kind: 'hero', dist: .82 });
        stage.heroGround();
        actor = stage.add(Object.assign({}, cube, { id: 'preview', orient: QB.START, grown: true }));
        stage.onPick = function (a) { if (a && !a.busy) a.play(QB.pick(['love', 'sunny', 'boing']), null); };
        stage.onSwipe = function (d) { if (actor && !actor.rolling && !actor.busy) actor.roll(d, false, function (o) { actor.play(QB.topEvent(o), null); }); };
      });
    }

    view.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-color]'))) { cube.color = b.getAttribute('data-color'); refresh(true); QB.sfx('pop'); return; }
      if ((b = e.target.closest('[data-eyes]'))) { cube.eyes = +b.getAttribute('data-eyes'); refresh(true); if (actor) actor.express('love', 400); QB.sfx('pop'); return; }
      if ((b = e.target.closest('[data-mouth]'))) { cube.mouth = +b.getAttribute('data-mouth'); refresh(true); QB.sfx('pop'); return; }
      if (e.target.closest('[data-dice]')) { view.querySelector('[data-name]').value = QB.randomName(); return; }
      var s = e.target.closest('[data-save]');
      if (s) {
        var name = view.querySelector('[data-name]').value.trim(), drawing = pad ? pad.toDataURL() : '';
        if (name.length < 2) { UI.toast('Give your cube a name (2 letters or more)!', 'error'); return; }
        var p = id ? UI.api('update_cube', id, { name: name, drawing: drawing }) : UI.api('create_cube', name, cube.color, cube.eyes, cube.mouth, drawing);
        UI.busy(s, p).then(function (r) {
          QB.confetti(id ? 50 : 120); QB.sfx('baby');
          UI.toast(id ? 'Saved!' : r.cube.name + ' hatched! 🐣', 'ok');
          if (!id) UI.store.set('sel', r.cube.id);
          UI.go(id ? 'cube' : 'cubby', id || undefined);
        });
      }
    });

    var ready = id ? UI.api('get_cube', id).then(function (r) {
      if (!r.cube.mine) { UI.toast('You can only change your own cubes.', 'error'); UI.go('cube', id); return; }
      cube = r.cube; return draw(null);
    }) : UI.api('get_cubby').then(function (d) {
      cube = { name: QB.randomName(), color: QB.pick(QB.COLORS)[0], eyes: Math.floor(Math.random() * 10), mouth: Math.floor(Math.random() * 10), drawing: '' };
      return draw(d.me);
    });
    return { ready: ready, destroy: function () { alive = false; if (stage) stage.destroy(); } };
  });
})();

/* ===== profile.html ===== */
(function () {
  var esc = UI.esc;
  UI.page('profile', { title: 'Your profile', auth: 'user' }, function (view, ctx) {
    var me = ctx.me;
    view.innerHTML = '<div class="ui-wrap ui-narrow"><div class="pf-head"><span class="ui-avatar">' + esc(UI.initials(me.name)) + '</span>' +
      '<div><h1>' + esc(me.name) + '</h1><div class="muted">' + esc(me.email) + (me.joined ? ' · member since ' + esc(UI.fmtDate(me.joined, { month: 'long', year: 'numeric' })) : '') + '</div></div></div>' +
      '<div class="pf-grid"><form class="ui-card ui-stack" data-name><h3>Your name</h3><label class="ui-field"><span>Shown to other people</span>' +
      '<input type="text" name="name" value="' + esc(me.name) + '" maxlength="60" required></label><button class="ui-btn primary" type="submit">Save</button></form>' +
      '<div class="ui-card ui-stack"><h3>Appearance</h3><p class="muted small">Follow your device, or pick one.</p><div data-theme-box></div>' +
      '<h3 style="margin-top:22px">Password</h3><p class="muted small">We\'ll email you a link to choose a new one.</p>' +
      '<button class="ui-btn" data-reset>' + UI.icon('mail') + 'Email me a reset link</button></div></div>' +
      '<div class="ui-card" style="margin-top:16px"><div class="pf-links">' +
      (me.is_admin ? '<a href="#admin" data-go="admin">' + UI.icon('shield') + 'Admin</a>' : '') +
      '<button data-feedback>' + UI.icon('chat') + 'Send feedback</button>' +
      '<button data-lk-open="overview">' + UI.icon('lock') + 'Privacy &amp; Terms, and your data</button>' +
      '<button data-signout-here>' + UI.icon('logout') + 'Sign out</button></div></div></div>';
    function themeBox() {
      var t = UI.theme();
      view.querySelector('[data-theme-box]').innerHTML = '<div class="ui-seg">' + [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']].map(function (o) {
        return '<button type="button" data-theme-pick="' + o[0] + '" class="' + (t === o[0] ? 'on' : '') + '">' + o[1] + '</button>';
      }).join('') + '</div>';
    }
    themeBox();
    view.addEventListener('click', function (e) {
      var t = e.target.closest('[data-theme-pick]');
      if (t) { UI.setTheme(t.getAttribute('data-theme-pick')); themeBox(); UI.renderChrome(); return; }
      if (e.target.closest('[data-reset]')) {
        UI.busy(e.target.closest('[data-reset]'), UI.auth('reset', { email: me.email })).then(function (r) { UI.toast(r.message, 'ok'); });
      }
      if (e.target.closest('[data-signout-here]')) UI.auth('logout');
    });
    view.querySelector('[data-name]').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = UI.formData(e.target);
      UI.busy(e.target.querySelector('[type=submit]'), UI.api('update_profile', v.name)).then(function (r) {
        UI.setMe(r.me); ctx.me = r.me; UI.toast('Saved', 'ok');
        view.querySelector('.pf-head h1').textContent = r.me.name;
      });
    });
  });
})();

/* ===== shop.html ===== */
(function () {
  var esc = UI.esc, BG = ['#ffe0ee', '#d4f7f2', '#fff0c2', '#e3f1ff', '#efe6ff'];
  UI.page('shop', { title: 'Sparkle Shop', nav: 'Shop', icon: 'bag', auth: 'user', order: 30 }, function (view) {
    var data = null;
    function item(it, i) {
      var meta = it.kind === 'hat' ? QB.HATS[it.key] : it.kind === 'toy' ? QB.TOYS[it.key] : QB.SUPPLIES[it.key];
      var owned = it.kind === 'supply' ? false : it.owned, afford = data.sparkles >= it.price;
      return '<div class="ui-card sh-item"><span class="em" style="background:' + BG[i % BG.length] + '">' + meta[1] + '</span><h3>' + esc(it.name) + '</h3>' +
        '<p>' + (it.kind === 'hat' ? 'Any of your cubes can wear it' : it.kind === 'toy' ? 'Goes in your Cubby' : esc(meta[2]) + ' You have ' + it.owned + '.') + '</p>' +
        (owned ? '<span class="ui-badge good">✓ Yours!</span>' : '<button class="ui-btn sm ' + (afford ? 'lemon' : '') + '" data-buy="' + it.key + '"' + (afford ? '' : ' title="Not enough sparkles yet"') + '>✨ ' + it.price + '</button>') + '</div>';
    }
    function draw() {
      var sec = function (kind, title, lead) {
        return '<div class="sh-sec"><h2>' + title + '</h2><p class="muted" style="font-weight:700;margin-top:-4px">' + lead + '</p><div class="sh-grid">' +
          data.items.filter(function (i) { return i.kind === kind; }).map(item).join('') + '</div></div>';
      };
      view.innerHTML = '<div class="ui-wrap"><div class="ui-page-head"><div><h1>Sparkle Shop</h1><p class="muted" style="font-weight:700">Spend the sparkles your cubes earn by rolling.</p></div>' +
        '<span class="qb-sparkles" style="font-size:1.3rem">✨ ' + data.sparkles + '</span></div>' +
        '<div class="ui-card tight"><b style="font-family:var(--font-display);font-weight:400;letter-spacing:.02em">How to earn sparkles</b><div class="sh-earn">' +
          QB.FACE_EVENT.map(function (k) { var r = QB.guestReward(k); return '<span>' + QB.EVENTS[k].emoji + ' ' + esc(QB.EVENTS[k].label.replace(/!$/, '')) + ': +' + r.sparkles + '</span>'; }).join('') +
          '<span>🎁 Daily gift: +15 or more</span><span>🍼 A new baby: +10</span><span>🌱 A baby grows up: +10</span></div></div>' +
        sec('hat', '🎩 Hats', 'Buy once, then dress up any cube on its card.') + sec('toy', '🧸 Cubby toys', 'They show up around your play mat.') + sec('supply', '🧪 Supplies', 'Use them from a cube\'s card.') + '</div>';
    }
    view.addEventListener('click', function (e) {
      var b = e.target.closest('[data-buy]'); if (!b) return;
      var key = b.getAttribute('data-buy');
      UI.busy(b, UI.api('buy', key)).then(function (r) {
        data.sparkles = r.sparkles; data.items = r.items; draw(); QB.confetti(50); QB.sfx('golden');
        UI.toast('Yay! You got it! 🎉', 'ok');
      });
    });
    return UI.api('get_shop').then(function (d) { data = d; draw(); });
  });
})();

/* ===== world.html ===== */
(function () {
  var esc = UI.esc, CHATTER = ['HI!', 'YAY', 'LOL', '😀', '💖', 'WOW', '🎉', 'BOO', 'HEY', '🍕', 'OOH', '👋'];

  UI.page('world', { title: 'The World', nav: 'World', icon: 'globe', auth: 'user', order: 20 }, function (view, ctx) {
    var W = null, stage = null, sel = null, go = null, alive = true, timers = [], offKeys = null, seenChats = {}, faces = {}, chatWait = 0, lastNews = '';
    view.innerHTML = '<div class="wd"><div class="wd-stage" data-stage></div>' +
      '<div class="wd-hud" data-hud></div><div class="wd-mine" data-mine></div>' +
      '<div class="wd-bottom"><div data-pad></div><div class="wd-chat"><form data-chat autocomplete="off"><input type="text" name="t" maxlength="6" placeholder="HI!" aria-label="Chat (3 letters)">' +
      '<button class="ui-btn primary" type="submit" data-send>Say</button><button class="ui-btn icon" type="button" data-emo aria-label="Emoji">😀</button></form>' +
      '<div class="wd-emoji" data-emojis hidden>' + QB.CHAT_EMOJI.map(function (e) { return '<button type="button" data-e="' + e + '">' + e + '</button>'; }).join('') + '</div>' +
      '<div class="wd-log" data-log>3 letters at a time · one message every 30 seconds</div></div></div></div>';

    function mine() { return W ? W.cubes.filter(function (c) { return c.mine; }) : []; }
    function hud() {
      view.querySelector('[data-hud]').innerHTML = '<span class="qb-sparkles">✨ ' + W.me.sparkles + '</span><span class="ui-badge">🏝️ ' + W.cubes.length + ' cubes here</span>' +
        '<button class="ui-btn sm mint" data-send-out>+ Send a cube (' + W.me.out + '/' + W.me.max_out + ')</button>';
      var m = mine();
      view.querySelector('[data-mine]').innerHTML = m.map(function (c) {
        return '<button type="button" class="wd-me' + (sel && sel.d.id === c.id ? ' on' : '') + '" data-me="' + esc(c.id) + '">' + QB.thumbHtml(c, 42) + '<span class="grow"><b>' + esc(c.name) + '</b>' +
          (c.grown ? QB.loveBar(c.love) : '<small class="muted" style="font-weight:800">🍼 baby</small>') + '</span>' + (c.nap ? '💤' : c.love >= 100 && c.grown ? '💖' : '') + '</button>';
      }).join('') || '<div class="ui-card tight" style="font-weight:800;font-size:.9rem">None of your cubes are here yet. Press <b>Send a cube</b>!</div>';
      QB.hydrate(view.querySelector('[data-mine]'));
    }
    function tagFor(a) {
      var c = a.d, icon = !c.grown ? ' 🍼' : c.nap ? ' 💤' : (!c.mine && c.open) ? ' ✋' : (c.mine && c.love >= 100) ? ' 💖' : '';
      a.tag(esc(c.name) + icon, c.mine ? 'mine' : '');
    }
    function select(a) {
      if (sel) sel.select(false);
      sel = a; if (a) { a.select(true); UI.store.set('wsel', a.d.id); }
      if (stage) stage.follow = a ? a.root.position : null;
      hud();
    }
    function blocked(a, dir) {
      var v = QB.DIRS[dir], x = a.d.x + v[0], z = a.d.z + v[1];
      if (x < 0 || z < 0 || x >= W.w || z >= W.d) return true;
      if (W.props.some(function (p) { return x >= p.x && x < p.x + p.w && z >= p.z && z < p.z + p.d; })) return true;
      return Object.keys(stage.actors).some(function (k) { var o = stage.actors[k]; return o !== a && o.d.x === x && o.d.z === z; });
    }
    function needFaces(list) {
      var ids = list.filter(function (c) { return c.dv && faces[c.id] !== c.dv; }).map(function (c) { return c.id; });
      if (!ids.length) return;
      ids.forEach(function (i) { faces[i] = -1; });
      UI.apiQuiet('get_faces', ids).then(function (r) {
        Object.keys(r).forEach(function (i) { faces[i] = r[i].dv; var a = stage && stage.actors[i]; if (a) a.setData({ drawing: r[i].drawing }); });
      }, function () {});
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
          if (dir && QB.roll(a.d.orient, dir) === c.orient) a.roll(dir, true, function (o) { if (!c.mine) a.play(QB.topEvent(o), null); });
          else a.hopTo(c.x, c.z, c.orient);
        } else if (a.d.orient !== c.orient) a.setOrient(c.orient);
        var drawing = a.d.drawing;
        a.setData(Object.assign({}, c, { drawing: drawing, x: a.d.x, z: a.d.z, orient: a.d.orient }));
        tagFor(a);
      });
      Object.keys(stage.actors).forEach(function (k) { if (!keep[k]) { if (sel && sel.d.id === k) select(null); stage.remove(k); } });
      needFaces(W.cubes);
      W.chats.slice().reverse().forEach(function (m) {
        if (seenChats[m.id]) return; seenChats[m.id] = 1;
        var a = m.cube && stage.actors[m.cube];
        if (a) { a.say(m.text); QB.sfx('chat'); }
        view.querySelector('[data-log]').textContent = m.who + ': ' + m.text;
      });
      var news = W.happenings[0];
      if (news && news.text !== lastNews) {
        if (lastNews) { var n = document.createElement('div'); n.className = 'wd-news'; n.textContent = '📣 ' + news.text; view.querySelector('.wd').appendChild(n); setTimeout(function () { n.remove(); }, 6000); }
        lastNews = news.text;
      }
      if (!sel || !stage.actors[sel.d.id]) {
        var want = stage.actors[UI.store.get('wsel', '')], m0 = mine()[0];
        select(want && want.d.mine ? want : m0 ? stage.actors[m0.id] : null);
      } else hud();
    }
    function poll() {
      if (!alive) return;
      UI.apiQuiet('get_world').then(function (r) { if (alive) sync(r); }, function () {}).then(function () { if (alive) timers.push(setTimeout(poll, 3000)); });
    }
    function chatTick() {
      var b = view.querySelector('[data-send]'); if (!b) return;
      if (chatWait > 0) { chatWait--; b.disabled = true; b.textContent = chatWait + 's'; } else { b.disabled = false; b.textContent = 'Say'; }
    }
    function ambient() {
      if (!alive || !stage) return;
      var demo = Object.keys(stage.actors).map(function (k) { return stage.actors[k]; }).filter(function (a) { return a.d.demo; });
      if (demo.length && !document.hidden) { var a = QB.pick(demo); a.say(QB.pick(CHATTER)); if (Math.random() < .5) a.play(QB.pick(QB.FACE_EVENT), null); }
    }

    function card(a) {
      var c = a.d, m = sel ? sel.d : null, why = '';
      var dist = m ? Math.max(Math.abs(m.x - c.x), Math.abs(m.z - c.z)) : 99;
      if (!m) why = 'Pick one of your cubes first (the list on the right).';
      else if (!c.open) why = c.name + ' isn\'t holding hands right now.';
      else if (!c.grown) why = c.name + ' is still a baby.';
      else if (c.nap) why = c.name + ' is resting (' + QB.napText(c.nap) + ').';
      else if (!m.grown) why = m.name + ' is still a baby. Roll it to grow up!';
      else if (m.nap) why = m.name + ' is resting (' + QB.napText(m.nap) + '). A Wake-Up Whistle helps!';
      else if (m.love < 100) why = m.name + '\'s heart is ' + m.love + '/100 full. Roll to land 💖 on top!';
      else if (dist > W.rules.hand_dist) why = 'Too far! Roll ' + m.name + ' closer (' + dist + ' tiles away, need ' + W.rules.hand_dist + ').';
      var md = UI.modal('<div class="wd-card">' + QB.thumbHtml(c, 120) + '<h2>' + esc(c.name) + '</h2><p class="muted" style="text-align:center;font-weight:800;margin:0">' + esc(c.owner) + '\'s cube · Gen ' + c.gen + '</p>' +
        (why ? '<p class="wd-why">' + esc(why) + '</p>' : '<p class="ui-note" style="font-weight:800;margin-top:12px">💞 ' + esc(m.name) + ' and ' + esc(c.name) + ' can hold hands! You\'ll both get a baby' + (c.demo ? '' : ' (twins!)') + '.</p>') +
        '<div class="ui-row" style="justify-content:center;margin-top:16px"><a class="ui-btn sm" href="#cube/' + esc(c.id) + '" data-go="cube/' + esc(c.id) + '" data-close>🪪 Card</a>' +
        '<button class="ui-btn primary" data-hold' + (why ? ' disabled' : '') + '>🤝 Hold hands!</button></div></div>');
      QB.hydrate(md.el);
      var hb = md.el.querySelector('[data-hold]');
      hb.onclick = function () {
        UI.busy(hb, UI.api('hold_hands', m.id, c.id)).then(function (r) { md.close(); celebrate(sel, a, r); });
      };
    }
    function celebrate(ma, ta, r) {
      [ma, ta].forEach(function (x) { if (x) { x.play('love', null); } });
      QB.sfx('baby'); QB.confetti(140);
      ma.d.love = 0; ma.d.nap = 7200; ta.d.nap = 7200; tagFor(ma); tagFor(ta);
      W.me.sparkles = r.sparkles; hud();
      var b = r.baby;
      setTimeout(function () {
        var md = UI.modal('<div class="wd-baby"><div class="eyebrow">POP! A new cube!</div><h2 style="padding:0">It\'s ' + esc(b.name) + '!</h2>' + QB.thumbHtml(b, 150) +
          '<p style="font-weight:800">' + esc(QB.EYES[b.eyes]) + ' eyes, ' + esc(QB.MOUTHS[b.mouth]).toLowerCase() + ' mouth, ' + esc(b.color_name) + ' colour. Generation ' + b.gen + '!</p>' +
          (r.twin ? '<p class="ui-note" style="font-weight:800">👯 Twins! ' + esc(r.partner_owner) + ' got a baby too.</p>' : '') +
          '<p class="muted" style="font-weight:700">It\'s in your Cubby. Roll it ' + QB.GROW_ROLLS + ' times to grow it up. +10 ✨</p>' +
          '<div class="ui-row" style="justify-content:center"><button class="ui-btn" data-close>Keep playing</button><a class="ui-btn primary" href="#cube/' + esc(b.id) + '" data-go="cube/' + esc(b.id) + '" data-close>Meet ' + esc(b.name) + '</a></div></div>');
        QB.hydrate(md.el);
      }, 900);
    }
    function sendOut() {
      if (!W.home.length) { UI.toast('All your cubes are already here!'); return; }
      var md = UI.modal('<h2>Who\'s going out to play?</h2><p class="muted" style="font-weight:700">' + W.me.out + ' of ' + W.me.max_out + ' of your cubes are in the World.</p><div class="wd-pick">' +
        W.home.map(function (c) { return '<button type="button" data-out="' + esc(c.id) + '">' + QB.thumbHtml(c, 70) + esc(c.name) + '</button>'; }).join('') + '</div>', { wide: true });
      QB.hydrate(md.el);
      md.el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-out]'); if (!b) return;
        UI.api('send_to_world', b.getAttribute('data-out'), true).then(function (r) {
          md.close(); UI.store.set('wsel', r.cube.id); QB.sfx('pop');
          return UI.apiQuiet('get_world').then(function (w) { sync(w); var a = stage && stage.actors[r.cube.id]; if (a) { select(a); a.play('boing', null); } });
        });
      });
    }

    view.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-me]'))) { var a = stage && stage.actors[b.getAttribute('data-me')]; if (a) { select(a); a.express('love', 600); QB.sfx('pop'); } return; }
      if (e.target.closest('[data-send-out]')) { sendOut(); return; }
      if (e.target.closest('[data-emo]')) { var em = view.querySelector('[data-emojis]'); em.hidden = !em.hidden; return; }
      if ((b = e.target.closest('[data-e]'))) {
        var inp = view.querySelector('[name=t]'), cur = Array.from(inp.value);
        if (cur.length < 3) inp.value = cur.concat([b.getAttribute('data-e')]).join('');
      }
    });
    view.querySelector('[name=t]').addEventListener('input', function (e) {
      var ok = Array.from(e.target.value.toUpperCase()).filter(function (ch) { return /[A-Z0-9!?]/.test(ch) || QB.CHAT_EMOJI.indexOf(ch) >= 0; });
      e.target.value = ok.slice(0, 3).join('');
    });
    view.querySelector('[data-chat]').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = e.target.querySelector('[name=t]'), t = inp.value.trim();
      if (!t) return;
      if (chatWait > 0) { UI.toast('Wait ' + chatWait + ' more seconds!'); return; }
      UI.apiQuiet('send_chat', t, sel ? sel.d.id : null).then(function (r) {
        inp.value = ''; chatWait = r.wait; chatTick(); view.querySelector('[data-emojis]').hidden = true;
        (r.chats || []).forEach(function (m) { if (!seenChats[m.id]) { seenChats[m.id] = 1; var a = m.cube && stage && stage.actors[m.cube]; if (a) a.say(m.text); view.querySelector('[data-log]').textContent = m.who + ': ' + m.text; } });
        QB.sfx('chat');
      }, function (err) { if (err.result && err.result.wait) { chatWait = err.result.wait; chatTick(); } UI.toast(err.message, 'error'); });
    });

    var ready = UI.api('get_world').then(function (w) {
      W = w; chatWait = w.chat_wait || 0;
      (w.chats || []).forEach(function (m) { seenChats[m.id] = 1; });
      lastNews = w.happenings[0] ? w.happenings[0].text : '';
      hud(); chatTick();
      timers.push(setInterval(chatTick, 1000));
      if (!QB.glOK()) { view.querySelector('[data-stage]').innerHTML = '<div class="qb-nogl">Your browser can\'t show 3D, so the World can\'t open here. Try another browser!</div>'; return; }
      return QB.three().then(function () {
        if (!alive) return;
        stage = new QB.Stage(view.querySelector('[data-stage]'), { kind: 'world', w: w.w, d: w.d });
        stage.worldGround(w.props);
        sync(w);
        var pad = QB.dpad(function (d) { pad.hit(d); go(d); }, innerWidth < 760);
        view.querySelector('[data-pad]').appendChild(pad);
        go = QB.roller(stage, { where: 'world', blocked: blocked, getActor: function () { return sel; },
          noActor: function () { UI.toast('Send one of your cubes to the World first!'); },
          onResult: function (a, res) {
            if (!res || !res.cube) return;
            var c = W.cubes.filter(function (x) { return x.id === a.d.id; })[0];
            if (c) { c.x = a.d.x; c.z = a.d.z; c.orient = a.d.orient; ['love', 'grown'].forEach(function (k) { c[k] = res.cube[k]; a.d[k] = res.cube[k]; }); }
            if (res.sparkles != null) W.me.sparkles = res.sparkles;
            tagFor(a); hud();
          } });
        stage.onSwipe = function (d) { pad.hit(d); go(d); };
        stage.onPick = function (a) {
          if (!a) return;
          if (a.d.mine) { select(a); a.express('love', 600); QB.sfx('pop'); } else { a.express('snack', 600); QB.sfx('pop'); card(a); }
        };
        offKeys = QB.keys(function (d) { pad.hit(d); go(d); });
        timers.push(setTimeout(poll, 3000));
        timers.push(setInterval(ambient, 6500));
      });
    });
    return { ready: ready, destroy: function () { alive = false; timers.forEach(function (t) { clearTimeout(t); clearInterval(t); }); if (offKeys) offKeys(); if (stage) stage.destroy(); } };
  });
})();
