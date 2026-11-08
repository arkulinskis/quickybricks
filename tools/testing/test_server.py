"""Server tests against the strict mock of Anvil (tools/testing/mock).

    python tools/testing/test_server.py          (no -I: reads anvil.yaml)          -> prints ALL OK, or the first failure

call(name, ...) runs a server function the way the browser does: by name, with require_user enforced,
and the reply must be JSON (a datetime or a row in a reply fails here, like it would break the page).
Add tests for every new server function: the happy path, bad input, and someone who isn't allowed.
"""
import datetime as dt
import importlib
import json
import os
import pathlib
import shutil
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
_tmp = pathlib.Path(tempfile.mkdtemp())
shutil.copytree(PROJECT / "server_code", _tmp / "app")
(_tmp / "app" / "__init__.py").write_text("")
os.environ["ANVIL_APP_YAML"] = str(PROJECT / "anvil.yaml")  # the mock's tables follow the app's own schema
sys.path[:0] = [str(HERE / "mock"), str(_tmp)]
import anvil.server  # noqa: E402
import anvil.users  # noqa: E402
from anvil.tables import app_tables as T  # noqa: E402

M = {p.stem: importlib.import_module("app." + p.stem) for p in sorted((PROJECT / "server_code").glob("*.py"))}
now = dt.datetime.now(dt.timezone.utc)


def call(name, *args):
    r = anvil.server.call(name, *args)
    json.dumps(r)  # strict: must be JSON-able
    return r


def as_user(row):
    anvil.users.CURRENT[0] = row
    anvil.server.session.use(row.get_id() if row is not None else None)


def denied(name, *args):
    try:
        call(name, *args)
    except anvil.server.PermissionDenied:
        return True
    return False


def ok(r, msg=""):
    assert isinstance(r, dict) and r.get("ok"), (msg, r)
    return r


def bad(r, msg=""):
    assert isinstance(r, dict) and r.get("ok") is False and r.get("error"), (msg, r)
    return r


def person(email, name=None, **kw):
    return T.users.add_row(email=email, enabled=True, signed_up=now, display_name=name, **kw)


# ---------------------------------------------------------------------------------- accounts
admin = person("arkulinskis@gmail.com", "The Admin")
ana = person("ana@example.com", "Ana")
bob = person("bob@example.com")

as_user(None)
assert call("get_me") is None
assert denied("update_profile", "X")
as_user(admin)
assert call("get_me")["is_admin"] is True, "ADMIN_EMAILS become admins on first sign-in"
as_user(ana)
me = call("get_me")
assert me["name"] == "Ana" and me["is_admin"] is False
assert ana["last_seen"] is not None
as_user(bob)
assert call("get_me")["name"] == "Bob", "a name comes from the email when none is set"
bad(call("update_profile", " x "))
assert ok(call("update_profile", "  Bob   Stone "))["me"]["name"] == "Bob Stone"

# ---------------------------------------------------------------------------------- feedback
as_user(None)
bad(call("submit_feedback", "bug", "hi"))
ok(call("submit_feedback", "bug", "The button is broken", "guest@example.com", {"page": "#home", "evil": "x" * 9999}))
fb = T.feedback.search()[0]
assert fb["name"] == "Guest" and fb["email"] == "guest@example.com" and "evil" not in fb["context"] and fb["status"] == "new"
for i in range(4):
    ok(call("submit_feedback", "idea", "Idea number %d" % i))
bad(call("submit_feedback", "idea", "One too many this hour"), "rate limit")
as_user(ana)
ok(call("submit_feedback", "nonsense-kind", "Signed-in feedback"))
assert T.feedback.get(message="Signed-in feedback")["kind"] == "other"
assert denied("list_feedback")
as_user(admin)
lst = call("list_feedback")
assert lst["counts"]["new"] == 6 and len(lst["items"]) == 6
fid = lst["items"][0]["id"]
ok(call("set_feedback_status", fid, "done", "Fixed it"))
assert call("list_feedback", "done")["items"][0]["note"] == "Fixed it"
bad(call("set_feedback_status", fid, "weird"))
bad(call("set_feedback_status", "nope", "done"))
ok(call("delete_feedback", fid))
assert len(call("list_feedback")["items"]) == 5

# ---------------------------------------------------------------------------------- admin
as_user(ana)
for fn, args in [("admin_overview", ()), ("list_users", ()), ("set_admin", (bob.get_id(), True)), ("demo_load", ()), ("demo_remove", ())]:
    assert denied(fn, *args), fn
as_user(admin)
ov = call("admin_overview")
assert ov["users"] == 3 and ov["admins"] == 1 and ov["feedback_new"] == 5
assert len(call("list_users")["users"]) == 3 and len(call("list_users", "bob")["users"]) == 1
ok(call("set_admin", bob.get_id(), True))
assert bob["is_admin"] is True
bad(call("set_admin", admin.get_id(), False), "can't remove your own admin")
ok(call("set_enabled", bob.get_id(), False))
assert bob["enabled"] is False
bad(call("set_enabled", admin.get_id(), False))
ok(call("set_enabled", bob.get_id(), True))
ok(call("set_admin", bob.get_id(), False))
assert bob["is_admin"] is False

# ---------------------------------------------------------------------------------- rules
R = M["rules"]
R.RNG.seed(7)
o = R.START_ORIENT
for d in "NSEW":
    assert R.roll(R.roll(o, d), {"N": "S", "S": "N", "E": "W", "W": "E"}[d]) == o, "rolling back undoes a roll"
    assert R.roll(R.roll(R.roll(R.roll(o, d), d), d), d) == o, "four rolls the same way come back round"
assert R.EVENTS[int(R.roll(o, "S")[0])] == "disco" and R.EVENTS[int(R.roll(o, "N")[0])] == "sunny"
assert R.EVENTS[int(R.roll(o, "E")[0])] == "toot" and R.EVENTS[int(R.roll(o, "W")[0])] == "boing"
assert R.clean_name("Wobbly Bob") == "Wobbly Bob" and R.clean_name("x") is None and R.clean_name("<script>") is None
assert R.clean_name("Shitty") is None and R.clean_name("a" * 15) is None
assert R.clean_chat("hi!")[0] == "HI!" and R.clean_chat("hello")[1] and R.clean_chat("")[1] and R.clean_chat("<b>")[1]
assert R.clean_chat("💖💖💖")[0] == "💖💖💖" and R.clean_chat("wtf")[1] and R.clean_chat("a s s")[1]
mixed = R.mix_colors("#ff0000", "#0000ff")
assert R.HEX_RX.match(mixed) and mixed != "#ff0000"
assert len(R.baby_name("Wobble", "Sprinkles")) >= 2
assert (10, 12) not in R.BLOCKED, "the spawn tile is free"

# ---------------------------------------------------------------------------------- demo data, cubby, making cubes
as_user(None)
assert denied("get_cubby") and denied("create_cube", "Bob", "#ff00ff", 1, 1)
as_user(ana)
cubby = call("get_cubby")
assert M["DemoData"].state() == "loaded", "demo loads on first visit"
assert cubby["me"]["sparkles"] == R.START_SPARKLES and cubby["me"]["handmade"] == 0 and cubby["cubes"] == []
assert cubby["me"]["inventory"]["potion"] == 1
assert T.cubes.search(is_demo=True, in_world=True), "demo cubes play in the World"
bad(call("create_cube", "x", "#ff00ff", 1, 1), "short name")
bad(call("create_cube", "Bob", "pink", 1, 1), "bad colour")
bad(call("create_cube", "Bob", "#ff00ff", 12, 1), "eyes out of range")
bad(call("create_cube", "Bob", "#ff00ff", 1, 1, "javascript:alert(1)"), "drawing must be a PNG")
bad(call("create_cube", "Bob", "#ff00ff", 1, 1, "data:image/png;base64," + "A" * 70000), "drawing too big")
png = M["DemoData"].doodle("mustache")
c1 = ok(call("create_cube", "Bobo", "#FF00FF", 3, 4, png))["cube"]
assert c1["color"] == "#ff00ff" and c1["drawing"] == png and c1["dv"] == 1 and c1["handmade"] and c1["grown"]
ids = [c1["id"]]
for i in range(R.HANDMADE_MAX - 1):
    ids.append(ok(call("create_cube", "Cubey %d" % i, "#34d6c4", i % 10, (i + 3) % 10))["cube"]["id"])
bad(call("create_cube", "Eleven", "#34d6c4", 1, 1), "only 10 hand-made cubes")
assert call("get_cubby")["me"]["handmade"] == R.HANDMADE_MAX

# update: name, drawing, hat, open hands; only the owner
ok(call("update_cube", c1["id"], {"name": "Bobo Two", "open": False}))
r = ok(call("update_cube", c1["id"], {"drawing": ""}))
assert r["cube"]["dv"] == 0 and r["cube"]["name"] == "Bobo Two" and r["cube"]["open"] is False
bad(call("update_cube", c1["id"], {"hat": "crown"}), "needs the hat first")
bad(call("update_cube", c1["id"], {"name": "poop sex"}))
as_user(bob)
bad(call("update_cube", c1["id"], {"name": "Mine now"}), "not the owner")
bad(call("roll_cube", c1["id"], "N"), "can't roll someone else's cube")
assert call("get_cube", c1["id"])["cube"]["mine"] is False, "anyone can look at a cube"

# ---------------------------------------------------------------------------------- rolling
as_user(ana)
bad(call("roll_cube", c1["id"], "UP"))
r = ok(call("roll_cube", c1["id"], "N"))
assert r["event"] == "sunny" and r["reward"]["sparkles"] == 5 and r["cube"]["orient"] == R.roll(R.START_ORIENT, "N")
assert r["sparkles"] == R.START_SPARKLES + 5 and ana["rolls"] == 1
bad(call("roll_cube", c1["id"], "N", "world"), "not in the World yet")

# ---------------------------------------------------------------------------------- daily gift, shop, items
g = ok(call("claim_gift"))
assert g["amount"] == 15 and g["streak"] == 1
bad(call("claim_gift"), "one gift a day")
ana["last_gift"] = ana["last_gift"] - dt.timedelta(days=1)
assert ok(call("claim_gift"))["streak"] == 2, "the streak grows day after day"
ana["last_gift"] = ana["last_gift"] - dt.timedelta(days=3)
assert ok(call("claim_gift"))["streak"] == 1, "a missed day starts again"
shop = call("get_shop")
assert any(i["key"] == "crown" for i in shop["items"])
bad(call("buy", "spaceship"))
ana["sparkles"] = 5
bad(call("buy", "crown"), "not enough sparkles")
ana["sparkles"] = 500
b1 = ok(call("buy", "crown"))
assert b1["sparkles"] == 420 and "crown" in b1["inventory"]["hats"]
bad(call("buy", "crown"), "only once")
ok(call("buy", "potion"))
ok(call("buy", "lolly"))
assert call("get_shop")["inventory"]["potion"] == 2
ok(call("update_cube", c1["id"], {"hat": "crown"}))
c2 = T.cubes.get_by_id(ids[1])
c2["love"] = 10
assert ok(call("use_item", "potion", ids[1]))["cube"]["love"] == R.LOVE_MAX
bad(call("use_item", "potion", ids[1]), "already full")
bad(call("use_item", "whistle", ids[1]), "not napping")
bad(call("use_item", "rocket", ids[1]))

# ---------------------------------------------------------------------------------- the World
as_user(None)
assert denied("get_world") and denied("send_chat", "HI") and denied("hold_hands", ids[0], ids[1])
as_user(ana)
w = call("get_world")
assert w["w"] == R.WORLD_W and w["cubes"] and w["props"]
assert all(not c["mine"] for c in w["cubes"])
r = ok(call("send_to_world", ids[0]))
assert r["cube"]["in_world"]
ok(call("send_to_world", ids[1]))
ok(call("send_to_world", ids[2]))
bad(call("send_to_world", ids[3]), "only 3 out at once")
ok(call("send_to_world", ids[2], False))
mine = T.cubes.get_by_id(ids[0])
w = call("get_world")
spots = [(c["x"], c["z"]) for c in w["cubes"]]
assert len(spots) == len(set(spots)), "one cube per tile"
# roll in the World: moves one tile, can't go into props / other cubes / off the map
mine.update(wx=0, wz=0)
r = call("roll_cube", ids[0], "N", "world")
assert r["ok"] is False and r.get("blocked"), "off the map"
r = ok(call("roll_cube", ids[0], "E", "world"))
assert (mine["wx"], mine["wz"]) == (1, 0)
r = call("roll_cube", ids[0], "S", "world")
assert r["ok"] is False and r.get("blocked"), "gumdrop at (1,1)"

# holding hands
demo_open = [c for c in T.cubes.search(is_demo=True, in_world=True) if c["handmade"]][0]
mine.update(wx=demo_open["wx"] + 5, wz=demo_open["wz"], love=R.LOVE_MAX)
bad(call("hold_hands", ids[0], demo_open.get_id()), "too far")
mine.update(wx=demo_open["wx"] + 1)
mine["love"] = 50
bad(call("hold_hands", ids[0], demo_open.get_id()), "love not full")
mine["love"] = R.LOVE_MAX
bad(call("hold_hands", ids[0], ids[1]), "not with your own cubes")
before = len(T.cubes.search(owner=ana))
r = ok(call("hold_hands", ids[0], demo_open.get_id()))
baby = r["baby"]
assert baby["gen"] == 2 and not baby["handmade"] and not baby["grown"] and baby["grow_left"] == R.GROW_ROLLS
assert baby["eyes"] in (mine["eyes"], demo_open["eyes"]) and baby["mouth"] in (mine["mouth"], demo_open["mouth"])
assert r["twin"] is False, "demo cubes don't get twins"
assert len(T.cubes.search(owner=ana)) == before + 1 and mine["love"] == 0
assert T.happenings.search(kind="birth")
mine["love"] = R.LOVE_MAX
bad(call("hold_hands", ids[0], demo_open.get_id()), "resting after holding hands")
ok(call("use_item", "whistle", ids[0]))
fam = ok(call("get_cube", baby["id"]))["cube"]
assert len(fam["parents"]) == 2 and fam["mine"]
assert ok(call("get_cube", ids[0]))["cube"]["children_total"] == 1

# twins with a real player's cube
as_user(bob)
bc = ok(call("create_cube", "Bobcube", "#ffd23f", 2, 2))["cube"]
ok(call("send_to_world", bc["id"]))
brow = T.cubes.get_by_id(bc["id"])
brow.update(wx=mine["wx"], wz=mine["wz"] + 1)
bob_before = len(T.cubes.search(owner=bob))
as_user(ana)
mine.update(love=R.LOVE_MAX, nap_until=None)
r = ok(call("hold_hands", ids[0], bc["id"]))
assert r["twin"] is True and len(T.cubes.search(owner=bob)) == bob_before + 1, "both owners get a baby"
# babies grow up by rolling
for i in range(R.GROW_ROLLS - 1):
    assert ok(call("roll_cube", baby["id"], "NSEW"[i % 4]))["reward"]["grew"] is False
assert ok(call("roll_cube", baby["id"], "N"))["reward"]["grew"] is True
assert ok(call("get_cube", baby["id"]))["cube"]["grown"]
# baby limit per day
ana.update(babies_today=R.BABIES_PER_DAY)
mine.update(love=R.LOVE_MAX, nap_until=None)
other = [c for c in T.cubes.search(is_demo=True, in_world=True) if c["handmade"] and c != demo_open][0]
mine.update(wx=other["wx"] + 1, wz=other["wz"])
bad(call("hold_hands", ids[0], other.get_id()), "babies per day")

# chat: 3 symbols, 30 seconds apart, kept short
r = ok(call("send_chat", "yay", ids[0]))
assert r["text"] == "YAY" and r["chats"][0]["text"] == "YAY"
r = call("send_chat", "hi")
assert r["ok"] is False and r["wait"] > 0, "30 seconds between messages"
ana["last_chat"] = ana["last_chat"] - dt.timedelta(seconds=31)
bad(call("send_chat", "toolong"))
bad(call("send_chat", "wtf"))
ok(call("send_chat", "💖!"))
assert len(call("get_world")["chats"]) == 2
for m in T.chats.search():
    m["created"] = m["created"] - dt.timedelta(seconds=R.CHAT_KEEP + 5)
assert call("get_world")["chats"] == [] and not T.chats.search(), "chat disappears"
# idle cubes go home
mine["last_active"] = now - dt.timedelta(hours=R.IDLE_HOURS + 1)
call("get_world")
assert not mine["in_world"]

# ---------------------------------------------------------------------------------- champs
ch = call("get_champs")
assert ch["most"] and ch["rank"] and any(s["key"] == "first" and s["got"] for s in ch["stickers"])
assert any(s["key"] == "baby" and s["got"] for s in ch["stickers"]) and len(ch["faces"]) >= 5

# ---------------------------------------------------------------------------------- safety
as_user(bob)
bad(call("report_cube", bc["id"], "name"), "not your own")
ok(call("report_cube", ids[0], "drawing"))
assert ok(call("report_cube", ids[0], "drawing")).get("already")
assert denied("admin_reports") and denied("admin_resolve", "x", "wipe") and denied("admin_chats")
as_user(admin)
reps = call("admin_reports")["reports"]
assert len(reps) == 1 and reps[0]["cube"]["owner_email"] == "ana@example.com"
bad(call("admin_resolve", reps[0]["id"], "explode"))
ok(call("admin_resolve", reps[0]["id"], "rename"))
assert mine["name"] != "Bobo Two" and call("admin_reports")["reports"] == []
ov = call("admin_overview")
assert ov["cubes"] > 20 and ov["babies"] >= 3 and ov["reports"] == 0
as_user(ana)
ana["last_chat"] = None
ok(call("send_chat", "OK"))
as_user(admin)
chats = call("admin_chats")["chats"]
assert chats and chats[0]["text"] == "OK"
ok(call("admin_delete_chat", chats[0]["id"]))

# ---------------------------------------------------------------------------------- alive: quests, rainbow roll, egg, surprises, seasons, pulse
as_user(None)
pulse = call("get_pulse")
assert pulse["cubes"] > 0 and "babies_today" in pulse, "anyone can see the live numbers"
assert denied("claim_quest", "roll") and denied("claim_chest") and denied("mark_seen", [])

carl = person("carl@example.com", "Carl")
as_user(carl)
cv = call("get_cubby")
qs = cv["quests"]["list"]
assert len(qs) == 3 and len({q["key"] for q in qs}) == 3 and qs[0]["key"] in ("roll", "love", "world_roll")
assert call("get_cubby")["quests"]["list"] == qs, "the same three quests all day"
cc = ok(call("create_cube", "Carly", "#a07bff", 1, 1))["cube"]
bad(call("claim_quest", qs[0]["key"]), "not done yet")
bad(call("claim_quest", "nonsense"))
# finish every quest by force, claim them, then the chest
st = carl["quests"]
for item in st["list"]:
    item["progress"] = R.QUEST_INFO[item["key"]][1]
carl["quests"] = dict(st)
bad(call("claim_chest"), "chest needs all three claimed")
s0 = carl["sparkles"]
for item in qs:
    ok(call("claim_quest", item["key"]))
bad(call("claim_quest", qs[0]["key"]), "only once")
assert carl["sparkles"] == s0 + sum(R.QUEST_INFO[q["key"]][2] for q in qs)
r = ok(call("claim_chest"))
assert r["amount"] == R.QUEST_CHEST and carl["chests"] == 1
bad(call("claim_chest"), "one chest a day")
# a new day: new quests
carl["quests"] = dict(carl["quests"], day="2000-01-01")
assert call("get_cubby")["quests"]["chest"] is False
# quest progress from rolling
carl["quests"] = {"day": now.date().isoformat(), "list": [{"key": "roll", "progress": 14, "claimed": False},
                                                          {"key": "sunny", "progress": 0, "claimed": False},
                                                          {"key": "rainbow", "progress": 0, "claimed": False}], "chest": False}
r = ok(call("roll_cube", cc["id"], "N"))
assert r["event"] == "sunny" and len(r["quests_done"]) == 1 and r["quests_done"][0].startswith("Roll"), r["quests_done"]
assert carl["quests"]["list"][1]["progress"] == 1
# Rainbow Roll: tops 4 (N) then 0, 2, 1, 3, 5 -> all six in six rolls
crow = T.cubes.get_by_id(cc["id"])
crow.update(orient=R.START_ORIENT, recent="")
path, seen = [], []
o = R.START_ORIENT
# find a 6-roll path with six different tops (search)
import itertools
for dirs in itertools.product("NSEW", repeat=6):
    oo, tops = R.START_ORIENT, []
    for d in dirs:
        oo = R.roll(oo, d)
        tops.append(oo[0])
    if len(set(tops)) == 6:
        path = dirs
        break
assert path, "a rainbow path exists"
for i, d in enumerate(path):
    r = ok(call("roll_cube", cc["id"], d))
    assert r["reward"]["rainbow"] is (i == 5), (i, r["reward"])
assert r["reward"]["sparkles"] >= R.RAINBOW_BONUS and carl["rainbows"] == 1 and crow["recent"] == ""
assert any("Rainbow" in t for t in r["quests_done"])

# Surprise Egg: appears, the first cube onto it gets the prize, then a wait
egg = call("get_world")["egg"]
assert egg and (egg["x"], egg["z"]) not in R.BLOCKED
ok(call("send_to_world", cc["id"]))
for o2 in T.cubes.search(in_world=True):   # clear the egg's neighbourhood for the test
    if o2 != crow and abs(int(o2["wx"]) - egg["x"]) + abs(int(o2["wz"]) - egg["z"]) <= 1:
        o2["in_world"] = False
side = None
for d, (dx, dz) in R.DIRS.items():
    sx, sz = egg["x"] - dx, egg["z"] - dz
    if R.in_bounds(sx, sz) and (sx, sz) not in R.BLOCKED:
        side = (d, sx, sz)
        break
crow.update(wx=side[1], wz=side[2])
e0 = carl["sparkles"]
r = ok(call("roll_cube", cc["id"], side[0], "world"))
assert r["reward"]["egg"] and r["reward"]["egg"]["sparkles"] == R.EGG_SPARKLES and carl["eggs"] == 1
assert call("get_world")["egg"] is None, "the next egg comes after a wait"
assert T.happenings.search(kind="egg")
# seasonal hats: only in their months
month = M["common"].now().month
inseason = [k for k, _, _, m in R.SEASONAL_HATS if month in m]
outseason = [k for k, _, _, m in R.SEASONAL_HATS if month not in m]
carl["sparkles"] = 500
if outseason:
    bad(call("buy", outseason[0]), "out of season")
if inseason:
    ok(call("buy", inseason[0]))
    assert any(i["key"] == inseason[0] and i["limited"] for i in call("get_shop")["items"])
    ok(call("update_cube", cc["id"], {"hat": inseason[0]}))

# surprise babies: Carl's open cube holds hands with Bob's -> Carl gets an unseen baby
as_user(bob)
bob_cube = T.cubes.get_by_id(bc["id"])
bob_cube.update(in_world=True, wx=crow["wx"], wz=crow["wz"] + (1 if crow["wz"] < R.WORLD_D - 1 else -1), love=R.LOVE_MAX, nap_until=None)
crow.update(nap_until=None, open_hands=True)
bob["babies_today"] = 0
r = ok(call("hold_hands", bc["id"], cc["id"]))
assert r["twin"]
bob_baby = r["baby"]["id"]
as_user(carl)
sur = call("get_cubby")["surprises"]
assert len(sur) == 1 and len(sur[0]["parents"]) == 2
ok(call("mark_seen", [sur[0]["id"]]))
assert call("get_cubby")["surprises"] == []
as_user(bob)
assert bob_baby not in [x["id"] for x in call("get_cubby")["surprises"]], "your own babies aren't surprises"
as_user(carl)
st = {s["key"]: s["got"] for s in call("get_champs")["stickers"]}
assert st["egg"] and st["rainbowroll"] and st["quests"]
as_user(admin)

# demo data: remove keeps real data (and real babies of demo parents), reload doesn't double
ok(call("demo_remove"))
assert M["DemoData"].state() == "removed" and not T.users.search(is_demo=True) and not T.cubes.search(is_demo=True)
assert T.cubes.get_by_id(baby["id"]) is not None, "a real baby with a demo parent stays"
as_user(ana)
call("get_cubby")
assert M["DemoData"].state() == "removed", "removed demo data doesn't come back by itself"
as_user(admin)
ok(call("demo_load"))
n = len(T.cubes.search(is_demo=True))
ok(call("demo_load"))
assert len(T.cubes.search(is_demo=True)) == n, "reloading replaces the demo instead of doubling it"

# ---------------------------------------------------------------------------------- Privacy & Terms
if "legal_server" in M:
    as_user(ana)
    st = call("legal_state")
    assert st["signedIn"] and st["accepted_version"] is None
    ok(call("legal_accept", st["version"], "signup"))
    assert ana["legal_source"] == "signup" and call("legal_state")["accepted_version"] == st["version"]

# ---------------------------------------------------------------------------------- every callable is covered by a permission check
# A callable that changes data without require_user / a C.require_* check is a security hole. List the public ones here.
PUBLIC = {"get_me", "submit_feedback", "get_cube", "get_pulse", "legal_state", "legal_accept"}
for name, (f, need) in sorted(anvil.server.CALLABLES.items()):
    if name in PUBLIC:
        continue
    assert need, "%s is callable by anyone: add require_user=True (or list it in PUBLIC in test_server.py)" % name

print("ALL OK (%d server functions)" % len(anvil.server.CALLABLES))
