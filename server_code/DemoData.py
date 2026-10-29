"""Demo content, so the World is alive for the very first visitor. Loaded automatically the first time anyone
opens the app (ensure_loaded), removed or reloaded from Admin -> Demo data. Removing it is remembered.

Six silly demo players own cubes; most of their grown-ups are out in the World with open hands and full love,
so a new player can hold hands with them right away. Some demo cubes are babies of others (generations 2-3).
A few have little doodles (mustache, freckles ...) drawn here as tiny PNGs.
Demo users have is_demo=True and @example.com emails; they can't sign in. Every demo row is flagged is_demo=True.
"""
import base64
import datetime as dt
import struct
import zlib

from anvil.tables import app_tables

from . import common as C
from . import rules as R

DEMO_USERS = [
    ("Captain Wobble", "wobble.demo@example.com"),
    ("Mimi Sprinkles", "mimi.demo@example.com"),
    ("Bo Boingo", "bo.demo@example.com"),
    ("Ziggy Zoom", "ziggy.demo@example.com"),
    ("Pip Noodle", "pip.demo@example.com"),
    ("Lulu Gumdrop", "lulu.demo@example.com"),
]
# owner, name, colour, eyes, mouth, hat, doodle, world tile (None = at home), orientation
DEMO_CUBES = [
    (0, "Sir Squish", "#ff5fa2", 0, 0, "crown", "mustache", (6, 12), "235401"),
    (0, "Wobbles", "#ffd23f", 1, 1, "party", "freckles", (12, 9), "235401"),
    (0, "Admiral Bop", "#2f8cff", 6, 5, "", "", None, "235401"),
    (1, "Sprinkle", "#ff9cc8", 5, 4, "bow", "blush", (8, 13), "235401"),
    (1, "Mintoo", "#34d6c4", 2, 2, "flower", "", (11, 14), "235401"),
    (1, "Cupcakey", "#ffb36b", 3, 8, "chef", "freckles", None, "235401"),
    (2, "Boingo", "#4cd964", 7, 1, "propeller", "", (14, 8), "235401"),
    (2, "Jellybean", "#a07bff", 4, 7, "", "stars", (7, 6), "235401"),
    (3, "Zoomer", "#ff3b3b", 8, 5, "tophat", "", (10, 5), "235401"),
    (3, "Dizzy", "#c86bff", 9, 6, "", "unibrow", (16, 12), "235401"),
    (4, "Noodle", "#fff07a", 0, 3, "cat", "blush", (5, 6), "235401"),
    (4, "Pickle", "#b6e84a", 2, 9, "viking", "mustache", None, "235401"),
    (5, "Gummy", "#6cc6ff", 6, 0, "halo", "stars", (9, 15), "235401"),
    (5, "Licorice", "#4a4458", 1, 2, "", "", (13, 6), "235401"),
]
# babies: owner, parent a, parent b (indexes into the list of cubes made so far), rolls, world tile
DEMO_BABIES = [
    (1, 0, 3, 14, (12, 12)),   # Sir Squish + Sprinkle
    (2, 6, 4, 4, None),        # Boingo + Mintoo, still a baby
    (5, 12, 8, 12, (6, 16)),   # Gummy + Zoomer
    (3, 14, 16, 2, None),      # a generation-3 grandbaby
]
# Tables that hold demo rows (each has an is_demo column). Children before parents.
DEMO_TABLES = ["chats", "happenings", "cubes"]


# ------------------------------------------------------------------------------------------- tiny PNG doodles
def _png(w, h, pixels):
    raw = b"".join(b"\x00" + bytes(row) for row in pixels)

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) +
            chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def doodle(kind, size=64):
    """A 64x64 transparent doodle that sits on the cube's face (eyes at y~27, mouth at y~43)."""
    px = [[0] * (size * 4) for _ in range(size)]

    def dot(cx, cy, rx, ry, rgba):
        for y in range(max(0, int(cy - ry - 1)), min(size, int(cy + ry + 2))):
            for x in range(max(0, int(cx - rx - 1)), min(size, int(cx + rx + 2))):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1:
                    px[y][x * 4:x * 4 + 4] = rgba
    brown, pink, dark, yellow = (110, 62, 40, 255), (255, 120, 170, 150), (59, 42, 90, 255), (255, 210, 63, 255)
    if kind == "mustache":
        dot(25, 38.5, 7.5, 3.4, brown)
        dot(39, 38.5, 7.5, 3.4, brown)
        dot(17.5, 36.5, 2.6, 2.6, brown)
        dot(46.5, 36.5, 2.6, 2.6, brown)
    elif kind == "freckles":
        for cx, cy in [(14, 35), (18, 37), (15, 39), (46, 35), (50, 37), (49, 39)]:
            dot(cx, cy, 1.3, 1.3, brown)
    elif kind == "blush":
        dot(14, 37, 5.5, 3.5, pink)
        dot(50, 37, 5.5, 3.5, pink)
    elif kind == "stars":
        for cx, cy, r in [(10, 10, 2.6), (54, 12, 2.2), (50, 54, 2.4), (12, 52, 1.8), (32, 8, 1.6)]:
            dot(cx, cy, r, r, yellow)
    elif kind == "unibrow":
        dot(32, 18, 17, 2.4, dark)
    return "data:image/png;base64," + base64.b64encode(_png(size, size, px)).decode()


# ------------------------------------------------------------------------------------------- load / remove
def state():
    return C.get_setting("demo", "never")  # "never" | "loaded" | "removed"


def ensure_loaded():
    """Call from the app's main data callables: loads the demo once, unless an admin removed it."""
    if state() == "never":
        load()


def load():
    remove(remember=False)
    users = []
    for i, (name, email) in enumerate(DEMO_USERS):
        u = app_tables.users.get(email=email) or app_tables.users.add_row(email=email, enabled=False)
        u.update(display_name=name, is_demo=True, signed_up=C.now() - dt.timedelta(days=30 - i), sparkles=200, rolls=40 + i * 17)
        users.append(u)
    cubes = []
    t0 = C.now() - dt.timedelta(days=20)
    for i, (who, name, color, eyes, mouth, hat, dd, tile, orient) in enumerate(DEMO_CUBES):
        drawing = doodle(dd) if dd else ""
        cubes.append(app_tables.cubes.add_row(
            owner=users[who], name=name, color=color, eyes=eyes, mouth=mouth, drawing=drawing, drawing_v=1 if drawing else 0,
            hat=hat, gen=1, handmade=True, born=t0 + dt.timedelta(hours=i * 7), love=R.LOVE_MAX, rolls=30 + i * 3, orient=orient,
            in_world=tile is not None, wx=tile[0] if tile else 0, wz=tile[1] if tile else 0, open_hands=True,
            last_active=C.now() - dt.timedelta(minutes=i * 9), is_demo=True))
    for j, (who, a, b, rolls, tile) in enumerate(DEMO_BABIES):
        pa, pb = cubes[a], cubes[b]
        baby = app_tables.cubes.add_row(
            owner=users[who], name=R.baby_name(pa["name"], pb["name"]), color=R.mix_colors(pa["color"], pb["color"]),
            eyes=pa["eyes"] if j % 2 else pb["eyes"], mouth=pb["mouth"] if j % 2 else pa["mouth"], drawing="", drawing_v=0,
            hat="", gen=max(pa["gen"], pb["gen"]) + 1, handmade=False, parent_a=pa, parent_b=pb,
            born=C.now() - dt.timedelta(days=6 - j), love=R.LOVE_MAX if rolls >= R.GROW_ROLLS else 20, rolls=rolls,
            orient=R.START_ORIENT, in_world=tile is not None, wx=tile[0] if tile else 0, wz=tile[1] if tile else 0,
            open_hands=True, last_active=C.now() - dt.timedelta(minutes=30 + j), is_demo=True)
        cubes.append(baby)
        app_tables.happenings.add_row(kind="birth", text="%s was born! %s held hands with %s." % (baby["name"], pa["name"], pb["name"]),
                                      data={"color": baby["color"], "a": pa["color"], "b": pb["color"]},
                                      created=C.now() - dt.timedelta(hours=40 - j * 9), is_demo=True)
    app_tables.happenings.add_row(kind="golden", text="Dizzy had a GOLDEN disco moment!", data={"color": "#c86bff"},
                                  created=C.now() - dt.timedelta(hours=2), is_demo=True)
    C.set_setting("demo", "loaded")
    return counts()


def remove(remember=True):
    # Real players' babies can have demo parents: unlink those first, so removing the demo keeps the babies.
    demo = set(r.get_id() for r in app_tables.cubes.search(is_demo=True))
    if demo:
        for c in app_tables.cubes.search(is_demo=False):
            for col in ("parent_a", "parent_b"):
                if c[col] is not None and c[col].get_id() in demo:
                    c[col] = None
        for r in app_tables.reports.search():
            if r["cube"] is not None and r["cube"].get_id() in demo:
                r.delete()
        for m in app_tables.chats.search():
            if m["cube"] is not None and m["cube"].get_id() in demo:
                m["cube"] = None
    for name in DEMO_TABLES:
        for r in getattr(app_tables, name).search(is_demo=True):
            r.delete()
    for u in app_tables.users.search(is_demo=True):
        u.delete()
    if remember:
        C.set_setting("demo", "removed")
    return counts()


def counts():
    out = {"users": len(app_tables.users.search(is_demo=True))}
    for name in DEMO_TABLES:
        out[name] = len(getattr(app_tables, name).search(is_demo=True))
    return out
