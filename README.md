# QuickyBricks

A silly 3D browser game for kids (played with a grown-up; accounts 16+). Every character is a squishy cube that rolls onto its six sides, and something different happens for each side. Make up to 10 cubes, then grow a family by making cubes hold hands with other players' cubes in a shared World. Three.js at its core. Built on [Anvil](https://anvil.works).

- **App repo:** github.com/arkulinskis/quickybricks (branch `master`). Anvil pulls `master`.
- **Live:** https://quickybricks.com

## What it does

**For visitors (no account):** the landing page *is* the game: a real 3D cube you can roll (arrows, keys, swipe), recolour,
give 1 of 10 eyes and 1 of 10 mouths, doodle on and name. The six roll events fire with sounds and particles. "Keep this
cube" leads to sign-up and the cube moves into the new player's Cubby automatically.

**The core rules:**
- Every character is a rounded 3D cube with a colour, eyes, a mouth, an optional face doodle and a name.
- Rolling tips the cube onto another side; **the side that lands on top decides what happens** (server-checked):
  spring = **BOING!** (+3 ✨, 1 in 6 a present +18), cloud = **TOOT-TOOT!** (+1), heart = **LOVEY-DOVEY!** (+30 love),
  cupcake = **SNACK ATTACK!** (+2 ✨, +12 love), face up = **SUNNY SMILE!** (+5 ✨, sunglasses), swirl = **DIZZY DISCO!**
  (+4, 1 in 10 GOLDEN +29). Every roll also gives at least +5 love.
- A player can make **10 cubes by hand**. Every other cube comes from **holding hands** in the World: a grown-up cube
  with a full heart (100 love), within 3 tiles of another player's grown-up cube with open hands. **Both players get a
  baby** (twins; demo cubes don't get one). A baby has one parent's eyes, one parent's mouth, a blended colour, a
  blended name (Sprinkle + Gummy = Sprinummy) and generation = max(parents) + 1. Babies grow up after 10 rolls.
  Both parents then rest 2 hours. 12 babies a day per player.
- The goal: as many cubes as possible.
- **Rainbow Roll:** land all six sides on top within a cube's last six rolls: +30 ✨ (tracked per cube in `cubes.recent`).
- **Surprise Egg:** one 🥚 hides on a free World tile; the first cube to roll onto it gets +25 ✨ and, 1 time in 3, a free hat.
  A new egg appears 90 s later.
- **Daily quests:** three per player per day (always one easy rolling quest), each worth 10-40 ✨, plus a bonus chest
  (+30 ✨) when all three are claimed.
- **Limited hats:** Pumpkin Head + Witch Hat (Oct-Nov), Santa Hat + Reindeer Antlers (Dec-Jan), Bunny Ears (Mar-Apr),
  Sun Hat (Jun-Aug). Only buyable in season; kept forever.
- **Surprise babies:** when someone's cube holds hands with yours, your twin baby is waiting with a reveal the next time
  you open your Cubby.

**Alive everywhere:** every preview cube (landing, Maker, cube card) really rolls across its round mat; tapping a cube
pushes it (it tumbles away from your finger); cubes in the Cubby and the World hop, wiggle, yawn, giggle and spin by
themselves; seasonal decorations (Halloween pumpkins and bats, winter snow and snowmen, spring flowers, summer palms);
the World turns to night with stars and a moon from 8 pm to 7 am; 📸 snapshots of the Cubby and the World; a family
poster PNG from any cube card; live numbers on the landing page (cubes, babies born today, cubes in the World).

**For players:**
- **Cubby** (`#cubby`, home): a 3D play mat with up to 16 cubes to roll around, every cube as a thumbnail, sparkles,
  the hand-made counter (x/10), the daily gift (gentle streak up to 7 days: 15 → 45 ✨; a missed day doesn't reset it),
  the 💭 Dream gift after a tuck-in, today's quests + chest, the Rainbow Roll
  tracker for the picked cube, surprise-baby reveals and World news. Tap the picked cube again to push it.
- **Cube Maker** (`#make`): colour (24), eyes (10), mouth (10), doodle pad (crayons, rainbow, stamps, eraser, undo),
  name with a 🎲; live 3D preview. `#make/<id>` redraws or renames an existing cube.
- **Cube card** (`#cube/<id>`): roll it, hat wardrobe, open/close hands, send to the World or home, Love Potion,
  Wake-Up Whistle, Rainbow Roll tracker, family tree (parents, grandparents, babies) and a family poster download.
  Other players' cubes: Report.
- **The World** (`#world`): a candy island (lollipop trees, jelly pond, gazebo, mushrooms, donut, pinwheel, rainbow,
  clouds) with everyone's cubes (3 per player at once). Roll yours around, tap others to hold hands, live updates
  every 3 s, demo cubes chatter. **Chat:** 1-3 symbols (A-Z, 0-9, ! ?, 16 emoji), one message per 30 s (page and
  server), shown as a bubble over your cube, deleted within 3 minutes.
- **Sparkle Shop** (`#shop`): 10 hats, 6 Cubby toys, Love Potion and Wake-Up Whistle.
- **Cube Champs** (`#champs`): leaderboard (most cubes, biggest families), 15 stickers, the Cubedex (100 faces).

**Play together, off the screen, and stopping (2026-11-20):**
- **Play together** (under the cube on the landing page, the Cubby and your cube card): every roll pops a Silly Move
  card for the side on top ("BOING! Mia leads: 3 big spring jumps!"; 6 indoor-safe moves per side, special cards for
  golden, present and Rainbow rolls); Done passes the turn between the little one and the grown-up (two editable
  names, kept only in the browser). **Read to me** speaks the cards, messages and quests (🔊) with the browser's voice.
- **Paper cube** (landing page, your own cube cards): a print-and-fold A4/Letter PNG of the cube (colour, face, doodle,
  side pictures, cut/fold lines, glue tabs with quickybricks.com, the six Silly Moves). Folded, the opposite sides
  match the 3D cube.
- **Tuck-in Time:** ⏰ Play timer in the header on every page (10/15/20/30 min; changing or stopping it needs a
  grown-up's 3-second hold, no PIN). 2 minutes before the end the cubes get sleepy (dusk tint); at 0 the child tucks up
  to 6 cubes into bed, the music fades, and a sleep screen covers the game until a grown-up holds Wake up or 30 minutes
  pass. Signed-in players find a 💭 Dream gift in the Cubby the next morning (12-25 ✨ or, 1 in 4, a new hat).
- The landing page says it plainly: no ads, nothing to buy (sparkles are only earned).

**For everyone:** sign-up with email and password or Google, feedback through Prepsto ("Submit feedback" in the footer and menu opens its panel),
and the Privacy & Terms page (footer link, `#legal`).

**For admins** (`#admin`; your admin email (App Secret `admin_emails`) becomes an admin on first sign-in):
- **Overview:** people, cubes, babies, cubes in the World, open reports.
- **Reports:** reported cubes; wipe the doodle, give a random name, send home + close hands, or dismiss.
- **Chat:** the messages still around (with the sender's email); delete one.
- **Feedback inbox:** New / Read / Done, private notes.
- **Users:** search, make admin, disable an account.
- **Demo data:** six silly demo players with cubes in the World (open hands, full love) so a first player can make a
  baby right away; remove or reload it.

## Setting it up in Anvil (once)

1. In the Anvil editor: **Create app → Clone from GitHub**, and paste `https://github.com/arkulinskis/quickybricks`.
2. **Users** service: email + password and "Continue with Google", sign-up allowed (already set in `anvil.yaml`; check it).
3. Open the app in the editor. If it shows a **Schema Mismatch** alert, choose **"The schema of the source code is correct"** so Anvil creates the tables.
4. **Run** it and sign up with **your admin email** (App Secret `admin_emails`) straight away (that account becomes the admin).
5. **Publish** (Publish → public URL, or your own domain).

<!-- libraries:start -->
## Libraries and outside services

What this project uses besides its own code. Generated by `APP_MAKER/tools/libraries.py`; to change it, edit `APP_MAKER/libraries/catalog.py` and re-run the script.

| Name | How it gets in | Used here for |
|---|---|---|
| [three.js](https://threejs.org) r158 | Copied into the app | Draws 3D scenes in the browser: shapes, lights, cameras, textures and VR. |
| [Arkvital music library (ArkMusic)](https://arkvital-media.addanapp.workers.dev) | Outside web service | Background music: the user's licensed Audiio tracks, streamed from our own Cloudflare R2 bucket by a small shared player. |
| [YouTube embeds](https://developers.google.com/youtube/player_parameters) | Outside web service | Plays a YouTube video inside the page (the privacy-friendlier youtube-nocookie address). |
| [Google Fonts](https://fonts.google.com) | Loaded from a CDN | Baloo 2, Lilita One |

**Built into the browser:** Canvas 2D, WebGL, Speech synthesis, Web Audio API, localStorage.

**Anvil platform:** Anvil, Anvil Data Tables, Anvil Email, Anvil JS bridge (anvil.js), Anvil Secrets, Anvil Users, Anvil Google service, Anvil HTTP, Anvil timezones (anvil.tz).

**Build and test tools (not shipped):** axe-core, Node.js, Headless Chrome (DevTools Protocol), PyYAML.

<!-- libraries:end -->

## Working on it

See `.claude/skills/quickybricks/SKILL.md` and `APP_MAP.md`. In short:

```
python tools/check.py                            # anvil validate, JS syntax, asset hashes, server tests -> ALL CHECKS PASSED
python -I tools/ui_test.py                       # the app in the local Anvil App Server (Docker) + the smoke test
git push origin master                           # deploy: Anvil pulls master
```

## Project layout

```
client_code/    native Anvil Forms: Layouts/Shell, Pages/, Components/, Dialogs/, Items/; router.py, state.py, qb.py
                (the engine bridge), moves.py (Play together), bedtime.py (Tuck-in Time), legal.py
server_code/    rules.py (game numbers), Cubes.py, World.py, Shop.py, Champs.py, Quests.py, Safety.py, DemoData.py,
                Accounts.py, Admin.py, common.py, legal_server.py, seo_routes.py
theme/assets/   qb.js (the three.js engine), qb-play.js (stage controllers, Paper Cube, Read to me), three.min.js,
                app.css, app-kit.js, icons
tools/          check.py, ui_test.py (+ ui/smoke.js), assets.py, testing/ (server tests on a mock)
```
