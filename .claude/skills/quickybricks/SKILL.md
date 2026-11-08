---
name: quickybricks
description: Context, workflow and recipes for QuickyBricks (folder QuickyBricks-forms), the user's Anvil app built as native Anvil Forms (Python + HTML templates, a layout, custom components, RepeatingPanels) around a three.js engine. A silly kids' 3D cube game: roll cubes, doodle faces, hold hands in a shared World to breed cube babies. Load this before any feature request, bug fix, restyle, content change or deploy for this app.
---

# QuickyBricks: working on the app

**What it is:** a browser game for kids (with a grown-up; accounts 16+). Each character is a rounded 3D cube with a
colour, 1 of 10 eyes, 1 of 10 mouths, a face doodle and a name; rolling it lands a side on top and one of six silly
events happens. Players make 10 cubes by hand, then get more by holding hands with other players' cubes in the World
(both get a baby). Areas: landing playground (no account), Cubby, Maker, cube card, World (+ 3-letter chat), Shop,
Champs, admin moderation. README.md has every rule and number.

**Where it lives:**
- Folder `C:\Users\arkvi\Documents\CLAUDE\QuickyBricks-forms\` = the git clone of
  **github.com/arkulinskis/quickybricks**, branch `master`. "git" layout: the folder *is* the Anvil app. Anvil pulls
  master; pushing is the deploy. Live: https://quickybricks.com.
- Native Forms since 2026-11-08 (forms branch merged that day). The old source folder `..\QuickyBricks` is retired
  (RETIRED.md; its deploy.py refuses to run): never deploy from it.
- Made like `APP_MAKER\template-forms`; its guide has the general Forms patterns, accessibility and design-kit rules.
- **README.md** lists every feature. **APP_MAP.md** is the code map: read it first, regenerate after changes
  (`python -I C:/Users/arkvi/Documents/CLAUDE/APP_MAKER/standard/app_map.py quickybricks`).

**What the user wants:** "Bubblegum Toybox": very silly, for kids. Vanilla #fff4e0 page with sprinkles, grape ink
#3b2a5a, bubblegum #f0428c, mint #19bfae, lemon #ffd23f; dark bg #241a3a. Lilita One (headings, buttons) + Baloo 2
(body). Thick 3px grape outlines, hard offset "sticker" shadows, wobbly hovers, confetti, emoji. They insisted on:
three.js at the core, everything in the browser, landing page playable before sign-up, 10 hand-made cubes max, babies
take one parent's eyes and one parent's mouth + a merged colour, chat ephemeral and 3 letters with 30 s between
messages enforced on page AND server. Claude assumes details and builds; Claude deploys. Every page fits 390 px.

## Workflow for any change

1. `git pull --ff-only` (Anvil commits "Edited ..." when the user changes something in the IDE).
2. Edit a page's template and Python side by side (`client_code/Pages/X/`), or the engine (`theme/assets/qb.js`,
   `qb-play.js`).
3. `python tools/check.py` (no -I) -> **ALL CHECKS PASSED**: `anvil validate`, JS syntax, asset hashes
   (`tools/assets.py`), server tests.
4. `python -I tools/ui_test.py` (Docker Desktop running) -> the smoke test (tools/ui/smoke.js: every page as guest /
   member / admin at desktop + phone width; rolls the playground cube, rolls on the server, sends a cube to the World).
   Server edits need `--restart`; `--stop` at the end.
5. Commit as arkulinskis with the Co-Authored-By line; `git push origin master`. New tables/columns: tell the user to
   accept the **Schema Mismatch** alert ("The schema of the source code is correct"). Regenerate APP_MAP.md.

## Architecture

```
client_code/
  startup.py, router.py, state.py, auth.py, legal.py   as template-forms (legal.py = the kit: don't edit);
                 router.show() calls leave() on the old page
  qb.py          Python <-> engine: window.QB_BRIDGE (whitelist roll_cube, get_faces), qb.store_get (browser storage)
  Layouts/Shell  header, account menu, footer (4 links), phone tab bar
  Pages/         Landing (playground), Auth, Cubby, Make, Cube, World, Shop, Champs, Profile, Admin
  Components/    Stage (mounts a 3D controller), DrawPad, Thumb, Cubedex, LoveBar, Rainbow
  Dialogs/       Baby, CubeCard, Doodle, Report, SendOut, Surprise        Items/  lists
server_code/     rules.py (every number, the six roll events, shop items, world map, names, colours, chat),
                 Cubes.py, World.py, Shop.py, Champs.py, Quests.py, Safety.py, DemoData.py, Accounts, Admin,
                 Feedback, common.py, SchemaCheck, legal_server, seo_routes
theme/assets/    qb.js (the old _qb.html, unchanged: game data, faces/thumbnails, sounds, d-pad, draw pad, three.js
                 Stage/Actor, the roller), qb-play.js (glue: UI.api/UI.toast via QB_BRIDGE; controllers QBP.hero,
                 QBP.cubby, QBP.world; QBP.thumb/face/cubedex/poster/chatClean), three.min.js (r158 UMD),
                 ark-music.js (shared player, generated), app.css, app-kit.js, theme.css
```

## How things are done here

- Pages, lists, dialogs, buttons, server calls: the template-forms patterns (its guide).
- **Components/Stage** mounts a controller: `self.stage.mount(kind, data, hooks, pad=dom_node)`; it starts on the
  component's `show` and is destroyed on `hide` (it holds a WebGL context; browsers allow ~16). Hooks are Python
  functions the engine calls with JSON text (`onResult`, `onSelect`, `onPickOther`, `onChat`, `onNews`); the page
  calls back through `self.stage.ctl` (`setData`, `select`, `sync`, `celebrate`, `findEgg` ...). Check
  `self.stage.live()` first.
- **World:** Pages/World polls `get_world` every 3 s and hands each reply to `ctl.sync(json)`; `leave()` stops the poll
  and the chat clock. "Can they hold hands?" text = `why_not()` there (same order as `World.hand_problem` on the
  server, which decides for real).
- **Browser storage keys** are the JS version's (`quickybricks.draft` = the landing cube the Cubby adopts after
  sign-up, `sel`, `wsel`, `pos.<user id>`, `mute`, `theme`). Read them with `qb.store_get`.
- `QB.keys` ignores arrow keys while an Anvil dialog is open (`body.modal-open`).

## Recipes

- **New page / server function / table:** template-forms recipes; add the address to tools/ui/smoke.js.
- **Change a game number** (limits, rewards, chat timing): `server_code/rules.py`; if the page shows it, also `QB.*` in
  qb.js (QB.guestReward, QB.GROW_ROLLS) and the copy in Landing/Shop/README.
- **New hat:** `HATS` in rules.py (key, name, price), `QB.HATS` (name, emoji) and a branch in `buildHat()` in qb.js (the
  hat sits on the cube top at y=0). **Seasonal hat:** `SEASONAL_HATS` (months) too; decorations in
  `Stage.prototype.decorate` and `QB.season()` dates.
- **New Cubby toy:** `TOYS` in rules.py, `QB.TOYS`, and a branch in `Stage.prototype.prop` (max 6, `cubbyGround` spots).
- **New World prop:** `PROPS` in rules.py (blocks its tiles on server and page) + draw it in `Stage.prototype.prop`.
- **New eyes/mouth:** `eyes()` / `mouth()` in qb.js (canvas 256, eyes at y≈108, mouth at y≈168), the names in
  QB.EYES/QB.MOUTHS, and raise the 0..9 checks in Cubes.create_cube (and the Cubedex grid).
- **Change an event's effect:** `Actor.prototype.play` in qb.js (animate `squash`, never `mesh.quaternion`); its face
  expression is `EXPR`. **Idle animations:** `Actor.prototype.idle`.
- **Sticker:** `STICKERS` + the `got` dict in Champs.py. **New quest:** `QUESTS` in rules.py + `Q.bump(user, "<key>")`
  where it happens (event quests use the event name, no code).
- **Demo content:** DemoData.py (`is_demo=True`, `DEMO_TABLES`, children first).

## Gotchas

- `QB.roll` (qb.js) and `rules.roll` (server) must stay identical: the roller predicts, the server confirms (and
  reverts on "Bonk!"). Face id 4 (+z) is the face with eyes; BoxGeometry group order = face ids.
- **three.min.js** is the r158 UMD build. Its first line starts with `0,` (was a `console.warn(...),`): don't strip it
  or the file becomes a syntax error.
- Headless Chrome draws WebGL with SwiftShader (drive.mjs flags), so screenshots show 3D.
- Hero stages (landing, Maker, cube card) are a 5x5 grid inside the round mat: put the cube at x 2, z 2 and give the
  roller `move: true`, or it only tips over in place.
- Rolling never lands the same side on top twice in a row, so "combo" ideas use other patterns (the Rainbow Roll uses
  the last six tops).
- Demo users are `enabled=False`: count them in leaderboards with `o["is_demo"]`; demo owners never get twin babies.
  Removing demo data unlinks real babies from demo parents first.
- Server type annotations exist only for `anvil validate` (Accounts `changes: dict`, rules `PROPS: list`).
- Email confirmation is off: whoever first signs up with an ADMIN_EMAILS address (Accounts.py) becomes admin.
- Never write Anvil's theme-colour token pattern (percent, `color:`, name, percent) in theme.css.

## Music

`QB.music` in qb.js counts live 3D stages (add in the Stage constructor, remove in destroy with a short delay) and
follows `QB.muted()`. Player = `window.ArkMusic` in theme/assets/ark-music.js, written by
`APP_MAKER/tools/music_sync.py`: edit `APP_MAKER/media/public/ark-music.js` and re-sync, never the copy.

## Privacy & Terms (legal kit)

From `C:/Users/arkvi/Documents/CLAUDE/APP_MAKER/legal-kit` (`apps/quickybricks.json`): `python -I build.py
quickybricks && python -I install.py quickybricks` there (writes theme/assets/legal-kit.js, client_code/legal.py,
server_code/legal_server.py, the head_html tag), then `python tools/assets.py` and deploy. Sign-up keeps the tick box
(Pages/Auth). Continue with Google: `login_with_google()` returns None for someone without an account, so auth.py then
calls `signup_with_google()` (needs the tick first). Consent is stored in `users.legal_version`, `legal_accepted_at`,
`legal_source`. Feedback = Prepsto only ("Submit feedback").
