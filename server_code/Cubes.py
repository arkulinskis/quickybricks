"""Cubes: making, rolling, dressing up and looking after your cubes; the player's sparkles, daily gift and items.

Everyone's cubes are in the `cubes` table. A handmade cube (max rules.HANDMADE_MAX per player) is made in the
Maker; every other cube is a baby from holding hands (World.hold_hands). Rolling is checked here: the server
works out the new orientation and what happens, so the page can't invent rewards.
"""
import datetime as dt

import anvil.server
from anvil.tables import app_tables
import anvil.tables as tables

from . import common as C
from . import rules as R
from . import DemoData
from . import Quests as Q


# ------------------------------------------------------------------------------------------- players
def player(u):
    """Fill in a player's game columns the first time (sparkles, inventory)."""
    if u["sparkles"] is None:
        u["sparkles"] = R.START_SPARKLES
    if not isinstance(u["inventory"], dict):
        u["inventory"] = R.new_inventory()
    return u


def inventory(u):
    inv = dict(R.new_inventory())
    inv.update(u["inventory"] or {})
    return inv


def add_sparkles(u, n):
    u["sparkles"] = max(0, (u["sparkles"] or 0) + int(n))
    return u["sparkles"]


def today():
    return C.now().date()


def gift_info(u):
    last = u["last_gift"]
    ready = last is None or last < today()
    streak = u["streak"] or 0
    if last is not None and last < today() - dt.timedelta(days=1):
        streak = 0   # missed a day: the streak starts again
    nxt = min(streak + 1, 7) if ready else min(streak, 7)
    return {"ready": ready, "streak": streak, "amount": 10 + 5 * nxt}


def handmade_count(u):
    return len(app_tables.cubes.search(owner=u, handmade=True))


def stats(u):
    player(u)
    return {"sparkles": u["sparkles"] or 0, "handmade": handmade_count(u), "handmade_max": R.HANDMADE_MAX,
            "total": len(app_tables.cubes.search(owner=u)), "gift": gift_info(u), "inventory": inventory(u),
            "in_world": len(app_tables.cubes.search(owner=u, in_world=True)), "world_max": R.WORLD_PER_PLAYER}


# ------------------------------------------------------------------------------------------- cubes
def grown(c):
    return bool(c["handmade"]) or (c["rolls"] or 0) >= R.GROW_ROLLS


def nap_left(c):
    if c["nap_until"] is None:
        return 0
    return max(0, int((c["nap_until"] - C.now()).total_seconds()))


def cube_light(c, me=None):
    """What the World needs for every cube (no drawing: the page fetches those by `dv`)."""
    o = c["orient"] if R.valid_orient(c["orient"]) else R.START_ORIENT
    return {"id": c.get_id(), "name": c["name"], "color": c["color"], "eyes": int(c["eyes"] or 0), "mouth": int(c["mouth"] or 0),
            "hat": c["hat"] or "", "orient": o, "top": R.EVENTS[int(o[0])], "x": int(c["wx"] or 0), "z": int(c["wz"] or 0),
            "dv": int(c["drawing_v"] or 0) if c["drawing"] else 0, "owner": C.name_of(c["owner"]),
            "mine": me is not None and c["owner"] == me, "open": bool(c["open_hands"]), "love": int(c["love"] or 0),
            "grown": grown(c), "nap": nap_left(c), "gen": int(c["gen"] or 1), "demo": bool(c["is_demo"])}


def cube_dict(c, me=None, drawing=True):
    d = cube_light(c, me)
    d.update({"drawing": (c["drawing"] or "") if drawing else None, "handmade": bool(c["handmade"]),
              "born": C.iso(c["born"]), "rolls": int(c["rolls"] or 0), "in_world": bool(c["in_world"]),
              "color_name": R.color_name(c["color"] or "#ff5fa2"), "recent": c["recent"] or "",
              "grow_left": 0 if grown(c) else R.GROW_ROLLS - int(c["rolls"] or 0)})
    return d


def tiny(c):
    """A cube in a list (family tree, leaderboards)."""
    if c is None:
        return None
    return {"id": c.get_id(), "name": c["name"], "color": c["color"], "eyes": int(c["eyes"] or 0),
            "mouth": int(c["mouth"] or 0), "gen": int(c["gen"] or 1), "owner": C.name_of(c["owner"]), "hat": c["hat"] or ""}


def own_cube(cube_id, me):
    c = C.row_by_id(app_tables.cubes, cube_id)
    if c is None:
        return None, C.fail("That cube wandered off. Try again!")
    if c["owner"] != me:
        return None, C.fail("That's not your cube.")
    return c, None


def clean_drawing(d):
    if d in (None, ""):
        return ""
    if not isinstance(d, str) or not d.startswith("data:image/png;base64,") or len(d) > R.DRAWING_MAX:
        return None
    return d


def happening(kind, text, data=None, is_demo=False):
    app_tables.happenings.add_row(kind=kind, text=text, data=data or {}, created=C.now(), is_demo=is_demo)
    old = list(app_tables.happenings.search(tables.order_by("created", ascending=False)))[60:]
    for r in old:
        r.delete()


def recent_happenings(n=8):
    rows = app_tables.happenings.search(tables.order_by("created", ascending=False))
    return [{"kind": r["kind"], "text": r["text"], "data": r["data"] or {}, "at": C.iso(r["created"])} for r in rows[:n]]


# ------------------------------------------------------------------------------------------- callables
@anvil.server.callable(require_user=True)
def get_cubby():
    """The player's own space: every cube they own, their sparkles, gift and items."""
    DemoData.ensure_loaded()
    me = player(C.require_user())
    rows = app_tables.cubes.search(tables.order_by("born", ascending=True), owner=me)
    surprises = []
    for c in app_tables.cubes.search(owner=me, seen=False):
        d = cube_dict(c, me)
        d["parents"] = [tiny(p) for p in (c["parent_a"], c["parent_b"]) if p is not None]
        surprises.append(d)
    return {"me": stats(me), "cubes": [cube_dict(c, me) for c in rows[:R.MAX_CUBES]],
            "happenings": recent_happenings(5), "colors": R.CREATE_COLORS, "quests": Q.view(me), "surprises": surprises}


@anvil.server.callable(require_user=True)
def mark_seen(ids):
    """The player has met these surprise babies (born when someone else's cube held hands with theirs)."""
    me = C.require_user()
    for i in (ids or [])[:50]:
        c = C.row_by_id(app_tables.cubes, i)
        if c is not None and c["owner"] == me:
            c["seen"] = True
    return C.ok()


@anvil.server.callable
def get_pulse():
    """Live numbers for the landing page (anyone)."""
    DemoData.ensure_loaded()
    start = C.now().replace(hour=0, minute=0, second=0, microsecond=0)
    babies = [c for c in app_tables.cubes.search(handmade=False) if c["born"] and c["born"] >= start]
    return {"cubes": len(app_tables.cubes.search()), "babies_today": len(babies),
            "in_world": len(app_tables.cubes.search(in_world=True)), "latest": recent_happenings(3)}


# ------------------------------------------------------------------------------------------- the Surprise Egg
def egg_get():
    """The egg's tile {x, z} in the World, placing a new one when it's time (or None while waiting)."""
    e = C.get_setting("egg", None) or {}
    if e.get("x") is not None:
        return {"x": e["x"], "z": e["z"]}
    nxt = e.get("next")
    if nxt and C.now().isoformat() < nxt:
        return None
    taken = {(int(o["wx"] or 0), int(o["wz"] or 0)) for o in app_tables.cubes.search(in_world=True)}
    free = [(x, z) for x in range(R.WORLD_W) for z in range(R.WORLD_D) if (x, z) not in R.BLOCKED and (x, z) not in taken]
    if not free:
        return None
    x, z = R.RNG.choice(free)
    C.set_setting("egg", {"x": x, "z": z})
    return {"x": x, "z": z}


def egg_take(x, z):
    """True if the egg is on (x, z); then it's gone and a new one comes after rules.EGG_WAIT seconds."""
    e = C.get_setting("egg", None) or {}
    if e.get("x") == x and e.get("z") == z:
        import datetime as _dt
        C.set_setting("egg", {"next": (C.now() + _dt.timedelta(seconds=R.EGG_WAIT)).isoformat()})
        return True
    return False


@anvil.server.callable(require_user=True)
def create_cube(name, color, eyes, mouth, drawing=""):
    me = player(C.require_user())
    if handmade_count(me) >= R.HANDMADE_MAX:
        return C.fail("You've made all %d hand-made cubes! Hold hands in the World to get more." % R.HANDMADE_MAX)
    nm = R.clean_name(name)
    if nm is None:
        return C.fail("Pick a nice name with 2 to 14 letters.")
    col = R.clean_color(color)
    if col is None:
        return C.fail("Pick a colour.")
    try:
        eyes, mouth = int(eyes), int(mouth)
    except (TypeError, ValueError):
        return C.fail("Pick eyes and a mouth.")
    if not (0 <= eyes <= 9 and 0 <= mouth <= 9):
        return C.fail("Pick eyes and a mouth.")
    dr = clean_drawing(drawing)
    if dr is None:
        return C.fail("That drawing is too big. Try a simpler one!")
    if C.rate_limited("create_cube", 20, 3600):
        return C.fail("Whoa, slow down! Try again in a little while.")
    c = app_tables.cubes.add_row(owner=me, name=nm, color=col, eyes=eyes, mouth=mouth, drawing=dr, drawing_v=1 if dr else 0,
                                 hat="", gen=1, handmade=True, born=C.now(), love=50, rolls=0, orient=R.START_ORIENT,
                                 in_world=False, wx=0, wz=0, open_hands=True, last_active=C.now(), is_demo=False)
    return C.ok(cube=cube_dict(c, me), me=stats(me))


@anvil.server.callable(require_user=True)
def update_cube(cube_id, changes):
    """Rename, redraw, change hat, open/close hands. `changes` holds only what changes."""
    me = player(C.require_user())
    c, err = own_cube(cube_id, me)
    if err:
        return err
    changes = changes if isinstance(changes, dict) else {}
    upd = {}
    if "name" in changes:
        nm = R.clean_name(changes["name"])
        if nm is None:
            return C.fail("Pick a nice name with 2 to 14 letters.")
        upd["name"] = nm
    if "drawing" in changes:
        dr = clean_drawing(changes["drawing"])
        if dr is None:
            return C.fail("That drawing is too big. Try a simpler one!")
        upd["drawing"] = dr
        upd["drawing_v"] = int(c["drawing_v"] or 0) + 1
        if dr:
            Q.bump(me, "doodle")
    if "hat" in changes:
        hat = changes["hat"] or ""
        if hat and (hat not in R.HAT_KEYS or hat not in inventory(me)["hats"]):
            return C.fail("Get that hat in the Shop first!")
        upd["hat"] = hat
        if hat and hat != c["hat"]:
            Q.bump(me, "hat")
    if "open" in changes:
        upd["open_hands"] = bool(changes["open"])
    if upd:
        c.update(**upd)
    return C.ok(cube=cube_dict(c, me))


@anvil.server.callable(require_user=True)
def roll_cube(cube_id, direction, where="home"):
    """Tip a cube over. In the World it moves one tile (it can't roll into things). Returns what happened."""
    me = player(C.require_user())
    c, err = own_cube(cube_id, me)
    if err:
        return err
    if direction not in R.DIRS:
        return C.fail("Roll which way?")
    if C.rate_limited("roll", 120, 60):
        return C.fail("Phew, so much rolling! Your cube needs a tiny break.")
    if where == "world":
        if not c["in_world"]:
            return C.fail("That cube is at home.")
        dx, dz = R.DIRS[direction]
        nx, nz = int(c["wx"] or 0) + dx, int(c["wz"] or 0) + dz
        taken = {(int(o["wx"] or 0), int(o["wz"] or 0)) for o in app_tables.cubes.search(in_world=True) if o != c}
        if not R.in_bounds(nx, nz) or (nx, nz) in R.BLOCKED or (nx, nz) in taken:
            return {"ok": False, "error": "Bonk!", "blocked": True, "cube": cube_light(c, me)}
        c.update(wx=nx, wz=nz)
    orient = R.roll(c["orient"] if R.valid_orient(c["orient"]) else R.START_ORIENT, direction)
    event = R.EVENTS[int(orient[0])]
    rw = R.reward(event)
    was_grown = grown(c)
    love = min(R.LOVE_MAX, int(c["love"] or 0) + rw["love"])
    # Rainbow Roll: all six sides on top within the cube's last six rolls
    recent = ((c["recent"] or "") + orient[0])[-6:]
    rw["rainbow"] = len(set(recent)) == 6
    if rw["rainbow"]:
        rw["sparkles"] += R.RAINBOW_BONUS
        recent = ""
    c.update(orient=orient, love=love, rolls=int(c["rolls"] or 0) + 1, last_active=C.now(), recent=recent)
    rw["grew"] = not was_grown and grown(c)
    if rw["grew"]:
        rw["sparkles"] += 10
    rw["egg"] = None
    if where == "world" and egg_take(int(c["wx"]), int(c["wz"])):
        inv = inventory(me)
        prize = {"sparkles": R.EGG_SPARKLES, "hat": None}
        missing = [k for k, _, _ in R.HATS if k not in inv["hats"]]
        if missing and R.RNG.random() < 1 / 3:
            prize["hat"] = R.RNG.choice(missing)
            inv["hats"] = inv["hats"] + [prize["hat"]]
            me["inventory"] = inv
        rw["sparkles"] += R.EGG_SPARKLES
        rw["egg"] = prize
        happening("egg", "%s found a Surprise Egg!" % c["name"], {"color": c["color"]})
    total = add_sparkles(me, rw["sparkles"])
    me["rolls"] = (me["rolls"] or 0) + 1
    if rw["rainbow"]:
        me["rainbows"] = (me["rainbows"] or 0) + 1
    if rw["egg"]:
        me["eggs"] = (me["eggs"] or 0) + 1
    if rw["golden"]:
        me["golden"] = (me["golden"] or 0) + 1
        happening("golden", "%s had a GOLDEN disco moment!" % c["name"], {"color": c["color"]})
    done = Q.bump(me, "roll") + Q.bump(me, event)
    if where == "world":
        done += Q.bump(me, "world_roll")
    if rw["rainbow"]:
        done += Q.bump(me, "rainbow")
    if rw["egg"]:
        done += Q.bump(me, "egg")
    return C.ok(event=event, reward=rw, sparkles=total, cube=cube_dict(c, me, drawing=False), quests_done=done,
                recent=recent)


@anvil.server.callable
def get_cube(cube_id):
    """One cube's card: anyone signed in can look (it's how you meet other people's cubes)."""
    me = C.me()
    c = C.row_by_id(app_tables.cubes, cube_id)
    if c is None:
        return C.fail("That cube wandered off.")
    kids = [k for k in app_tables.cubes.search(parent_a=c)] + [k for k in app_tables.cubes.search(parent_b=c)]
    kids.sort(key=lambda k: k["born"], reverse=True)
    grands = []
    for p in (c["parent_a"], c["parent_b"]):
        if p is not None:
            grands += [tiny(g) for g in (p["parent_a"], p["parent_b"]) if g is not None]
    d = cube_dict(c, me)
    d.update(parents=[tiny(p) for p in (c["parent_a"], c["parent_b"]) if p is not None], grandparents=grands,
             children=[tiny(k) for k in kids[:24]], children_total=len(kids))
    out = {"cube": d}
    if me is not None and c["owner"] == me:
        out["me"] = stats(player(me))
    return C.ok(**out)


@anvil.server.callable(require_user=True)
def get_faces(ids):
    """Drawings for cubes the World shows (fetched once per drawing version)."""
    C.require_user()
    out = {}
    for i in (ids or [])[:80]:
        c = C.row_by_id(app_tables.cubes, i)
        if c is not None:
            out[i] = {"drawing": c["drawing"] or "", "dv": int(c["drawing_v"] or 0)}
    return out


@anvil.server.callable(require_user=True)
def claim_gift():
    me = player(C.require_user())
    g = gift_info(me)
    if not g["ready"]:
        return C.fail("You already opened today's gift. Come back tomorrow!")
    streak = min(g["streak"] + 1, 7)
    me.update(last_gift=today(), streak=g["streak"] + 1)
    total = add_sparkles(me, 10 + 5 * streak)
    return C.ok(amount=10 + 5 * streak, streak=g["streak"] + 1, sparkles=total)


@anvil.server.callable(require_user=True)
def use_item(item, cube_id):
    """Love Potion (fills love) or Wake-Up Whistle (ends the rest after holding hands)."""
    me = player(C.require_user())
    c, err = own_cube(cube_id, me)
    if err:
        return err
    inv = inventory(me)
    if item not in ("potion", "whistle"):
        return C.fail("What's that?")
    if inv.get(item, 0) < 1:
        return C.fail("You don't have any. Get one in the Shop!")
    if item == "potion":
        if (c["love"] or 0) >= R.LOVE_MAX:
            return C.fail("%s is already full of love!" % c["name"])
        c["love"] = R.LOVE_MAX
    else:
        if nap_left(c) <= 0:
            return C.fail("%s is already wide awake!" % c["name"])
        c["nap_until"] = None
    inv[item] = inv.get(item, 0) - 1
    me["inventory"] = inv
    return C.ok(cube=cube_dict(c, me), me=stats(me))
