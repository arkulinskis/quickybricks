# QuickyBricks

A silly 3D browser game for kids (played with a grown-up; accounts 16+). Every character is a squishy cube that rolls onto its six sides, and something different happens for each side. Make up to 10 cubes, then grow a family by making cubes hold hands with other players' cubes in a shared World. Three.js at its core. Built on [Anvil](https://anvil.works).

- **App repo:** github.com/arkulinskis/quickybricks (branch `master`). Anvil pulls `master`.
- **Live:** not published yet (https://quickybricks.anvil.app once it is).

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
  the hand-made counter (x/10), the daily gift (streak up to 7 days: 15 → 45 ✨), today's quests + chest, the Rainbow Roll
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

**For everyone:** sign-up with email and password, feedback through Prepsto ("Submit feedback" in the footer and menu opens its panel),
and the Privacy & Terms page (footer link, `#legal`).

**For admins** (`#admin`; arkulinskis@gmail.com becomes an admin on first sign-in):
- **Overview:** people, cubes, babies, cubes in the World, open reports.
- **Reports:** reported cubes; wipe the doodle, give a random name, send home + close hands, or dismiss.
- **Chat:** the messages still around (with the sender's email); delete one.
- **Feedback inbox:** New / Read / Done, private notes.
- **Users:** search, make admin, disable an account.
- **Demo data:** six silly demo players with cubes in the World (open hands, full love) so a first player can make a
  baby right away; remove or reload it.

## Setting it up in Anvil (once)

1. In the Anvil editor: **Create app → Clone from GitHub**, and paste `https://github.com/arkulinskis/quickybricks`.
2. **Users** service: email + password, sign-up allowed (already set in `anvil.yaml`; check it).
3. Open the app in the editor. If it shows a **Schema Mismatch** alert, choose **"The schema of the source code is correct"** so Anvil creates the tables.
4. **Run** it and sign up with **arkulinskis@gmail.com** straight away (that account becomes the admin).
5. **Publish** (Publish → public URL, or your own domain).

<!-- libraries:start -->
## Libraries and outside services

What this project uses besides its own code. Generated by `APP_MAKER/tools/libraries.py`; to change it, edit `APP_MAKER/libraries/catalog.py` and re-run the script.

| Name | How it gets in | Used here for |
|---|---|---|
| [three.js](https://threejs.org) r158 | Copied into the app | the 3D world of rolling, hand-holding cubes |
| [Google Fonts](https://fonts.google.com) | Loaded from a CDN | Baloo 2, Lilita One |

**Built into the browser:** Canvas 2D, WebGL, Web Audio API, localStorage.

**Anvil platform:** Anvil, Anvil Data Tables, Anvil JS bridge (anvil.js), Anvil Users.

**Build and test tools (not shipped):** Node.js, Headless Chrome (DevTools Protocol), PyYAML.

<!-- libraries:end -->

## Working on it

See `.claude/skills/quickybricks/SKILL.md`. In short:

```
python -I tools/check.py --ui                    # syntax, server tests, headless UI tests → ALL CHECKS PASSED
python -I tools/preview/devserver.py 8765        # the app on in-memory data: http://localhost:8765/  (?as=ana#cubby, ?as=admin#admin)
python tools/deploy.py                           # dry run (needs PyYAML, so no -I)
python tools/deploy.py --push "Message"          # deploy: commit + push to GitHub, Anvil pulls it
```

## Project layout

```
web/            the interface: core.js/core.css (shared engine + design tokens), app.js (header, footer), pages/*.html
client_code/    Main.py (the only Anvil form: bridge to the server, sign-in), legal.py
server_code/    common.py, Accounts.py, Feedback.py, Admin.py, DemoData.py, legal_server.py,
                rules.py (game numbers), Cubes.py, World.py, Shop.py, Champs.py, Safety.py
assets/         icon.svg + generated PNG icons, three.min.js (three.js r158 UMD, served at _/theme/three.min.js)
tools/          sync_to_anvil.py (settings + table schema), deploy.py, check.py, preview/ (dev server, UI tests, screenshots), testing/
```
