"""The World: everybody's cubes on one candy island. Send cubes out to play, roll around, hold hands, chat.

Holding hands: your grown-up cube with full love, next to (within rules.HAND_DIST tiles) someone else's grown-up
cube whose hands are open. Both owners get a baby (twins!), unless the partner is a demo cube or over its limits.
Both cubes then rest for rules.NAP_HOURS.

Chat is ephemeral: 1-3 symbols, one message per rules.CHAT_GAP seconds per player (users.last_chat, so a new
browser session doesn't reset it), shown for rules.CHAT_SHOW seconds and deleted after rules.CHAT_KEEP.
"""
import datetime as dt

import anvil.server
from anvil.tables import app_tables
import anvil.tables as tables

from . import common as C
from . import rules as R
from . import Cubes as CB
from . import DemoData


def _taken(exclude=None):
    return {(int(o["wx"] or 0), int(o["wz"] or 0)) for o in app_tables.cubes.search(in_world=True) if o != exclude}


def _sweep():
    """Idle cubes go home; old chat disappears."""
    cutoff = C.now() - dt.timedelta(hours=R.IDLE_HOURS)
    for c in app_tables.cubes.search(in_world=True, is_demo=False):
        if c["last_active"] is None or c["last_active"] < cutoff:
            c["in_world"] = False
    old = C.now() - dt.timedelta(seconds=R.CHAT_KEEP)
    for m in app_tables.chats.search():
        if m["created"] is None or m["created"] < old:
            m.delete()


def _chats():
    since = C.now() - dt.timedelta(seconds=R.CHAT_SHOW)
    rows = [m for m in app_tables.chats.search(tables.order_by("created", ascending=False)) if m["created"] >= since]
    return [{"id": m.get_id(), "text": m["text"], "who": C.name_of(m["user"]), "cube": m["cube"].get_id() if m["cube"] else None,
             "at": C.iso(m["created"])} for m in rows[:30]]


def chat_wait(u):
    if u["last_chat"] is None:
        return 0
    return max(0, R.CHAT_GAP - int((C.now() - u["last_chat"]).total_seconds()))


@anvil.server.callable(require_user=True)
def get_world():
    """Everything on the island (the page polls this every few seconds, quietly)."""
    DemoData.ensure_loaded()
    me = CB.player(C.require_user())
    _sweep()
    cubes = list(app_tables.cubes.search(in_world=True))
    cubes.sort(key=lambda c: (c["owner"] != me, -(c["last_active"] or C.now()).timestamp()))
    home = [CB.tiny(c) for c in app_tables.cubes.search(tables.order_by("born", ascending=True), owner=me, in_world=False)]
    return {"w": R.WORLD_W, "d": R.WORLD_D, "props": R.PROPS, "cubes": [CB.cube_light(c, me) for c in cubes[:150]],
            "chats": _chats(), "happenings": CB.recent_happenings(8), "chat_wait": chat_wait(me),
            "me": {"sparkles": me["sparkles"] or 0, "out": len([c for c in cubes if c["owner"] == me]), "max_out": R.WORLD_PER_PLAYER},
            "home": home[:R.MAX_CUBES], "rules": {"hand_dist": R.HAND_DIST, "love_max": R.LOVE_MAX, "chat_gap": R.CHAT_GAP}}


@anvil.server.callable(require_user=True)
def send_to_world(cube_id, out=True):
    """Send a cube out to play (it appears near the middle of the island) or bring it home."""
    me = CB.player(C.require_user())
    c, err = CB.own_cube(cube_id, me)
    if err:
        return err
    if not out:
        c["in_world"] = False
        return C.ok(cube=CB.cube_dict(c, me, drawing=False))
    if c["in_world"]:
        return C.ok(cube=CB.cube_dict(c, me, drawing=False))
    if len(app_tables.cubes.search(owner=me, in_world=True)) >= R.WORLD_PER_PLAYER:
        return C.fail("Only %d of your cubes can play in the World at once. Bring one home first." % R.WORLD_PER_PLAYER)
    spot = R.free_tile(_taken(c))
    if spot is None:
        return C.fail("The World is full right now! Try again soon.")
    c.update(in_world=True, wx=spot[0], wz=spot[1], last_active=C.now())
    return C.ok(cube=CB.cube_dict(c, me, drawing=False))


def _new_baby(owner, a, b, is_demo):
    color = R.mix_colors(a["color"] or "#ff5fa2", b["color"] or "#6cc6ff")
    return app_tables.cubes.add_row(
        owner=owner, name=R.baby_name(a["name"], b["name"]), color=color,
        eyes=R.RNG.choice([int(a["eyes"] or 0), int(b["eyes"] or 0)]), mouth=R.RNG.choice([int(a["mouth"] or 0), int(b["mouth"] or 0)]),
        drawing="", drawing_v=0, hat="", gen=max(int(a["gen"] or 1), int(b["gen"] or 1)) + 1, handmade=False,
        parent_a=a, parent_b=b, born=C.now(), love=0, rolls=0, orient=R.START_ORIENT, in_world=False, wx=0, wz=0,
        open_hands=True, last_active=C.now(), is_demo=is_demo)


def _baby_budget(u):
    """How many babies the player has started today (resets each day)."""
    day = C.now().date().isoformat()
    if u["babies_day"] != day:
        u.update(babies_day=day, babies_today=0)
    return u["babies_today"] or 0


def hand_problem(mine, theirs, me):
    """Why these two can't hold hands, or None."""
    if theirs["owner"] == me:
        return "Cubes hold hands with other players' cubes. Find a friend in the World!"
    if not mine["in_world"] or not theirs["in_world"]:
        return "Both cubes need to be out in the World."
    if not theirs["open_hands"]:
        return "%s isn't holding hands right now." % theirs["name"]
    if not CB.grown(mine):
        return "%s is still a baby. Roll it %d more times to grow up!" % (mine["name"], R.GROW_ROLLS - int(mine["rolls"] or 0))
    if not CB.grown(theirs):
        return "%s is still a baby." % theirs["name"]
    if CB.nap_left(mine) > 0:
        return "%s is resting after holding hands. Use a Wake-Up Whistle, or wait a bit." % mine["name"]
    if CB.nap_left(theirs) > 0:
        return "%s is resting. Try another cube!" % theirs["name"]
    if int(mine["love"] or 0) < R.LOVE_MAX:
        return "%s needs a full heart first. Roll to fill it up!" % mine["name"]
    dist = max(abs(int(mine["wx"] or 0) - int(theirs["wx"] or 0)), abs(int(mine["wz"] or 0) - int(theirs["wz"] or 0)))
    if dist > R.HAND_DIST:
        return "Too far away! Roll %s closer to %s." % (mine["name"], theirs["name"])
    return None


@anvil.server.callable(require_user=True)
def hold_hands(my_cube_id, their_cube_id):
    me = CB.player(C.require_user())
    mine, err = CB.own_cube(my_cube_id, me)
    if err:
        return err
    theirs = C.row_by_id(app_tables.cubes, their_cube_id)
    if theirs is None:
        return C.fail("That cube wandered off.")
    why = hand_problem(mine, theirs, me)
    if why:
        return C.fail(why)
    if _baby_budget(me) >= R.BABIES_PER_DAY:
        return C.fail("That's %d babies today! Your cubes are pooped. Come back tomorrow." % R.BABIES_PER_DAY)
    if len(app_tables.cubes.search(owner=me)) >= R.MAX_CUBES:
        return C.fail("Your cubby is completely full!")
    baby = _new_baby(me, mine, theirs, False)
    me.update(babies_today=(me["babies_today"] or 0) + 1)
    CB.add_sparkles(me, 10)
    partner = theirs["owner"]
    twin = False
    if partner is not None and not partner["is_demo"] and not theirs["is_demo"]:
        CB.player(partner)
        if _baby_budget(partner) < R.BABIES_PER_DAY and len(app_tables.cubes.search(owner=partner)) < R.MAX_CUBES:
            _new_baby(partner, theirs, mine, False)
            partner.update(babies_today=(partner["babies_today"] or 0) + 1)
            CB.add_sparkles(partner, 10)
            twin = True
    nap = C.now() + dt.timedelta(hours=R.NAP_HOURS)
    mine.update(love=0, nap_until=nap, last_active=C.now())
    theirs.update(nap_until=nap)
    CB.happening("birth", "%s was born! %s held hands with %s." % (baby["name"], mine["name"], theirs["name"]),
                 {"color": baby["color"], "a": mine["color"], "b": theirs["color"]})
    return C.ok(baby=CB.cube_dict(baby, me), twin=twin, partner_owner=C.name_of(partner), sparkles=me["sparkles"])


@anvil.server.callable(require_user=True)
def send_chat(text, cube_id=None):
    me = C.require_user()
    wait = chat_wait(me)
    if wait > 0:
        return {"ok": False, "error": "Wait %d more seconds." % wait, "wait": wait}
    msg, err = R.clean_chat(text)
    if err:
        return C.fail(err)
    cube = None
    if cube_id:
        c = C.row_by_id(app_tables.cubes, cube_id)
        if c is not None and c["owner"] == me and c["in_world"]:
            cube = c
    if cube is None:
        mine = list(app_tables.cubes.search(tables.order_by("last_active", ascending=False), owner=me, in_world=True))
        cube = mine[0] if mine else None
    app_tables.chats.add_row(user=me, cube=cube, text=msg, created=C.now(), is_demo=False)
    me.update(last_chat=C.now(), chats_sent=(me["chats_sent"] or 0) + 1)
    _sweep()
    return C.ok(text=msg, wait=R.CHAT_GAP, chats=_chats())
