/* Smoke test (tools/ui_test.py runs it at 1280 px and at 390 px): every page address opens without errors, is not
   empty and doesn't scroll sideways, signed out (incl. a playground roll and the doodle dialog), then as a new member
   (the landing cube is adopted into the Cubby, so the 3D pages have a cube: Cubby, Maker, cube card, World with the
   send-out dialog), then as admin (every Admin tab). Python/JS errors are also caught by ui_test.py from the browser
   log. Resolves to {ok, log}. */
(async function () {
  const log = [], bad = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function until(fn, what, ms) {
    const end = Date.now() + (ms || 20000);
    while (Date.now() < end) { try { const v = fn(); if (v) return v; } catch (e) {} await sleep(150); }
    throw new Error('timed out waiting for: ' + what);
  }
  const q = (s) => document.querySelector(s), qq = (s) => Array.from(document.querySelectorAll(s));
  const errs = [];
  window.addEventListener('error', (e) => { if (e.message) errs.push(String(e.message)); });
  function type(input, value) {
    input.focus(); input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function button(re, root) { return qq((root || '') + ' button').find((b) => re.test(b.textContent) && b.offsetParent !== null); }
  const modalOpen = () => qq('.anvil-modal, .modal').some((m) => m.offsetParent !== null && getComputedStyle(m).display !== 'none' && m.classList.contains('in'));
  async function open(hash, expect, landed) {
    if (location.hash !== hash) window.UI_READY = false;
    location.hash = hash;
    await until(() => window.UI_READY && (landed ? landed() : location.hash === hash), hash, 30000);
    await sleep(1200);
    const main = q('.ui-main');
    const text = main ? main.innerText.trim() : '';
    const w = document.documentElement.scrollWidth, vw = screen.width <= 500 ? screen.width : window.innerWidth;
    const problems = [];
    if (text.length < 40) problems.push('empty page');
    if (expect && !new RegExp(expect.source, 'i').test(text)) problems.push('missing ' + expect);
    if (w > vw + 1) {
      const wide = qq('body *').filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > vw + 1; })
        .slice(0, 3).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ').slice(0, 2).join('.'));
      problems.push('scrolls sideways (' + w + ' > ' + vw + ') ' + wide.join(' '));
    }
    if (errs.length) problems.push('errors: ' + errs.splice(0).join(' / '));
    if (problems.length) bad.push(hash + ': ' + problems.join('; '));
    log.push((problems.length ? 'BAD  ' : 'ok   ') + hash);
  }
  async function stage(hash) {   // a 3D stage drew a canvas (SwiftShader in headless Chrome)
    try { await until(() => q('.qb-stage canvas'), 'the 3D stage', 25000); log.push('ok   ' + hash + ' 3D stage drawn'); }
    catch (e) { bad.push(hash + ': no 3D stage'); }
  }
  async function signUp(name, email, password) {
    location.hash = '#auth/signup';
    await until(() => window.UI_READY && qq('.au-card input').length >= 3, 'sign-up form');
    await sleep(400);
    const inputs = qq('.au-card input[type=text], .au-card input[type=email], .au-card input[type=password]');
    type(inputs[0], name); type(inputs[1], email); type(inputs[2], password);
    const tick = q('.au-card input[type=checkbox]'); if (tick && !tick.checked) tick.click();
    button(/Create account/, '.au-card .anvil-role-btn-block').click();
    const end = Date.now() + 40000;
    while (Date.now() < end) {
      if (location.hash.indexOf('#cubby') === 0 && window.UI_READY) return true;
      const msg = q('.au-card .anvil-role-msg-error');
      if (msg && msg.offsetParent !== null && msg.textContent.trim()) { log.push('sign-up said: ' + msg.textContent.trim()); return false; }
      await sleep(200);
    }
    log.push('sign-up: still on ' + location.hash);
    return false;
  }
  async function signIn(email, password) {
    location.hash = '#auth';
    await until(() => window.UI_READY && qq('.au-card input[type=password]').length, 'sign-in form');
    await sleep(400);
    type(q('.au-card input[type=email]'), email); type(q('.au-card input[type=password]'), password);
    button(/Sign in/, '.au-card .anvil-role-btn-block').click();
    await until(() => location.hash.indexOf('#cubby') === 0 && window.UI_READY, 'signed in as ' + email, 40000);
  }
  async function signOut() {
    location.hash = '#profile';
    await until(() => window.UI_READY && location.hash === '#profile', 'profile');
    await sleep(400);
    button(/Sign out/, '.pf-links').click();
    await until(() => {
      const a = q('.anvil-role-avatar button');
      return location.hash === '#landing' && window.UI_READY && (!a || a.offsetParent === null);
    }, 'signed out');
    await sleep(600);
  }
  try {
    // ---- signed out: the playground
    localStorage.removeItem('quickybricks.draft');
    await open('#landing', /Roll a cube/);
    await stage('#landing');
    button(/🎲/, '.lp-namebar').click();                     // a new name: the draft is saved for after sign-up
    await sleep(300);
    const next = button(/›/, '.lp-picker'); if (next) next.click();
    await sleep(300);
    if (!localStorage.getItem('quickybricks.draft')) bad.push('#landing: the playground cube was not kept');
    const dpad = q('.qb-dpad button[data-dir="E"]'); if (dpad) dpad.click();
    try { await until(() => /✨/.test((q('.lp-keep') || {}).innerText || ''), 'the roll to finish', 20000); }
    catch (e) { bad.push('#landing: rolling the playground cube did nothing'); }
    button(/Doodle/, '.lp-pickers').click();
    await until(() => q('.qb-pad-canvas'), 'the doodle dialog');
    await sleep(500);
    button(/Done/, '.qb-dialog').click();
    await sleep(800);
    log.push('ok   playground: rolled, renamed, doodle dialog');
    await open('#auth', /Sign in/);
    await open('#auth/signup', /Create account/);

    // ---- a new member: the landing cube moves into the Cubby
    const ok = await signUp('Smoke Tester', 'smoke' + Date.now() + '@example.com', 'Qb-' + Math.random().toString(36).slice(2) + '-Kq7');
    if (!ok) throw new Error('sign-up failed');
    await open('#cubby', /Cubby/, () => location.hash === '#cubby' && qq('.cb-cube[data-key]').length > 0);
    await stage('#cubby');
    const id = (q('.cb-cube[data-key]') || { getAttribute: () => '' }).getAttribute('data-key');
    if (!id) bad.push('#cubby: the landing cube was not adopted');
    const spark = () => (q('.anvil-role-qb-sparkles') || {}).innerText || '';
    const before = spark();
    await until(() => q('.cb-pad .qb-dpad button[data-dir="E"]') && window.QB.lastStage && Object.keys(window.QB.lastStage.actors).length, 'the Cubby mat', 25000);
    q('.cb-pad .qb-dpad button[data-dir="E"]').click();
    try { await until(() => spark() !== before, 'a server roll (sparkles change)', 25000); log.push('ok   #cubby: rolled on the server (' + before + ' -> ' + spark() + ')'); }
    catch (e) { bad.push('#cubby: the roll did not reach the server'); }
    await open('#make', /Cube Maker/);
    const eyes = qq('.mk-opt'); if (eyes.length !== 20) bad.push('#make: ' + eyes.length + ' face options (want 20)');
    if (eyes[3]) { eyes[3].click(); await sleep(500); }
    await open('#make/' + encodeURIComponent(id), /Fix up/);
    await open('#cube/' + encodeURIComponent(id), /Wardrobe/);
    await stage('#cube');
    await open('#world', /cubes here/);
    await stage('#world');
    const send = button(/Send a cube/, '.wd-hud');
    if (send) {
      send.click();
      await until(() => q('.wd-pick-btn'), 'the send-out dialog');
      q('.wd-pick-btn').click();
      await until(() => qq('.wd-me').length > 0, 'my cube in the World', 30000);
      log.push('ok   #world: sent a cube out to play');
    } else bad.push('#world: no Send a cube button');
    await open('#shop', /Sparkle Shop/);
    await open('#champs', /Cubedex/);
    if (!qq('.ch-dex canvas').length) bad.push('#champs: Cubedex has no painted face');
    await open('#profile', /Your name/);
    await open('#landing', /Open my Cubby/);
    await signOut();

    // ---- admin (ADMIN_EMAILS in Accounts.py): sign up the first time, sign in after that
    const adminPw = 'Qb-smoke-adm-93Kx-7q';
    if (!(await signUp('Admin Tester', 'arkulinskis@gmail.com', adminPw))) await signIn('arkulinskis@gmail.com', adminPw);
    for (const t of ['overview', 'reports', 'chat', 'feedback', 'users', 'demo']) await open('#admin/' + t, /Admin/);
    await signOut();
    log.push(bad.length ? 'PROBLEMS: ' + bad.join(' | ') : 'PASSED');
    return { ok: !bad.length, log: log };
  } catch (e) {
    log.push(String(e && e.message || e));
    if (bad.length) log.push('PROBLEMS: ' + bad.join(' | '));
    return { ok: false, log: log };
  }
})();
