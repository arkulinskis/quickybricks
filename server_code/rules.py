"""QuickyBricks game rules: numbers, the six roll events, shop items, the world map, names, colours, chat.

Not callable from the browser; the feature modules (Cubes, World, Shop, Champs, Safety) import it.
Keep the numbers here in step with web/pages/_qb.html (QB.EVENTS, QB.HATS ...) where the page shows them.
"""
import colorsys
import random
import re

RNG = random.Random()  # tests seed this

# ------------------------------------------------------------------------------------------- limits
HANDMADE_MAX = 10          # cubes a player can make by hand; the rest come from holding hands
MAX_CUBES = 500            # a safety cap per player
GROW_ROLLS = 10            # a baby grows up after this many rolls
LOVE_MAX = 100             # a cube needs full love to hold hands
NAP_HOURS = 2              # rest after holding hands
WORLD_PER_PLAYER = 3       # cubes a player can have out in the World at once
BABIES_PER_DAY = 12        # babies a player can start per day
HAND_DIST = 3              # tiles: how close two cubes must be to hold hands
WORLD_W, WORLD_D = 20, 20  # world grid
IDLE_HOURS = 48            # cubes idle this long in the World go home by themselves
START_SPARKLES = 30
CHAT_GAP = 30              # seconds between chat messages (the page enforces it too)
CHAT_SHOW = 75             # seconds a chat message stays visible
CHAT_KEEP = 180            # seconds before chat messages are deleted for good
DRAWING_MAX = 60000        # characters of a PNG data URL

# ------------------------------------------------------------------------------------------- faces and rolls
# A cube's orientation: which face id points [top, bottom, north, south, east, west].
# Face ids are the box sides: 0 +x, 1 -x, 2 +y, 3 -y, 4 +z (the face with eyes and mouth), 5 -z.
START_ORIENT = "235401"
# The face that ends up on TOP after a roll decides what happens.
EVENTS = {
    0: "boing",   # spring side: super bounce, maybe a present
    1: "toot",    # cloud side: a rainbow toot
    2: "love",    # heart side: lots of love
    3: "snack",   # cupcake side: a cupcake falls from the sky
    4: "sunny",   # the face looks at the sky: sunglasses + sparkles
    5: "disco",   # swirl side: dizzy disco, sometimes golden
}
DIRS = {"N": (0, -1), "S": (0, 1), "E": (1, 0), "W": (-1, 0)}


def roll(orient, direction):
    """New orientation string after tipping the cube over towards N/S/E/W."""
    t, b, n, s, e, w = [int(c) for c in orient]
    if direction == "E":
        t, e, b, w = w, t, e, b
    elif direction == "W":
        t, w, b, e = e, t, w, b
    elif direction == "S":
        t, s, b, n = n, t, s, b
    elif direction == "N":
        t, n, b, s = s, t, n, b
    else:
        raise ValueError(direction)
    return "".join(str(x) for x in (t, b, n, s, e, w))


def valid_orient(o):
    return isinstance(o, str) and len(o) == 6 and sorted(o) == list("012345")


def reward(event):
    """What a roll gives: {sparkles, love, present, golden}."""
    r = {"sparkles": 0, "love": 5, "present": False, "golden": False}
    if event == "sunny":
        r["sparkles"] = 5
    elif event == "love":
        r.update(sparkles=1, love=30)
    elif event == "snack":
        r.update(sparkles=2, love=12)
    elif event == "boing":
        r["sparkles"] = 3
        if RNG.random() < 1 / 6:
            r.update(present=True, sparkles=18)
    elif event == "toot":
        r["sparkles"] = 1
    elif event == "disco":
        r["sparkles"] = 4
        if RNG.random() < 0.1:
            r.update(golden=True, sparkles=29)
    return r


# ------------------------------------------------------------------------------------------- shop
HATS = [("party", "Party Hat", 20), ("flower", "Daisy", 25), ("bow", "Big Bow", 25), ("propeller", "Propeller Cap", 40),
        ("chef", "Chef Hat", 40), ("cat", "Cat Ears", 50), ("tophat", "Top Hat", 60), ("viking", "Viking Helmet", 70),
        ("crown", "Crown", 80), ("halo", "Halo", 100)]
TOYS = [("lolly", "Lollipop Tree", 30), ("trampoline", "Trampoline", 50), ("jelly", "Jelly Pool", 60),
        ("rainbow", "Rainbow", 80), ("discoball", "Disco Ball", 100), ("house", "Cupcake House", 120)]
SUPPLIES = [("potion", "Love Potion", 15), ("whistle", "Wake-Up Whistle", 20)]
HAT_KEYS = {k for k, _, _ in HATS}
TOY_KEYS = {k for k, _, _ in TOYS}
PRICES = {k: p for k, _, p in HATS + TOYS + SUPPLIES}


def new_inventory():
    return {"hats": [], "toys": [], "potion": 1, "whistle": 1}


# ------------------------------------------------------------------------------------------- the world map
# Props block their tiles. x, z = top-left tile; w, d = size in tiles.
PROPS = [
    {"kind": "gazebo", "x": 9, "z": 8, "w": 2, "d": 2},
    {"kind": "lolly", "x": 3, "z": 4, "w": 1, "d": 1, "color": "#ff5fa2"},
    {"kind": "lolly", "x": 15, "z": 3, "w": 1, "d": 1, "color": "#34d6c4"},
    {"kind": "lolly", "x": 4, "z": 15, "w": 1, "d": 1, "color": "#ffd23f"},
    {"kind": "lolly", "x": 16, "z": 16, "w": 1, "d": 1, "color": "#a07bff"},
    {"kind": "lolly", "x": 12, "z": 4, "w": 1, "d": 1, "color": "#ff8a3d"},
    {"kind": "jelly", "x": 4, "z": 8, "w": 3, "d": 2},
    {"kind": "mushroom", "x": 15, "z": 10, "w": 1, "d": 1},
    {"kind": "mushroom", "x": 2, "z": 12, "w": 1, "d": 1},
    {"kind": "donut", "x": 13, "z": 15, "w": 1, "d": 1},
    {"kind": "gumdrop", "x": 7, "z": 3, "w": 1, "d": 1, "color": "#6cc6ff"},
    {"kind": "gumdrop", "x": 17, "z": 7, "w": 1, "d": 1, "color": "#ff5fa2"},
    {"kind": "gumdrop", "x": 8, "z": 17, "w": 1, "d": 1, "color": "#34d6c4"},
    {"kind": "gumdrop", "x": 1, "z": 1, "w": 1, "d": 1, "color": "#ffd23f"},
    {"kind": "gumdrop", "x": 18, "z": 13, "w": 1, "d": 1, "color": "#a07bff"},
    {"kind": "pinwheel", "x": 13, "z": 12, "w": 1, "d": 1},
]


def blocked_tiles():
    out = set()
    for p in PROPS:
        for dx in range(p["w"]):
            for dz in range(p["d"]):
                out.add((p["x"] + dx, p["z"] + dz))
    return out


BLOCKED = blocked_tiles()


def in_bounds(x, z):
    return 0 <= x < WORLD_W and 0 <= z < WORLD_D


def free_tile(taken, start=(10, 12)):
    """The nearest free tile to `start` (breadth-first), or None if the world is full."""
    seen, queue = {start}, [start]
    while queue:
        x, z = queue.pop(0)
        if in_bounds(x, z) and (x, z) not in BLOCKED and (x, z) not in taken:
            return x, z
        for dx, dz in DIRS.values():
            nxt = (x + dx, z + dz)
            if nxt not in seen and in_bounds(*nxt):
                seen.add(nxt)
                queue.append(nxt)
    return None


# ------------------------------------------------------------------------------------------- names
SYL_A = ["Wob", "Squi", "Boo", "Zig", "Noo", "Pip", "Fluf", "Bon", "Jel", "Mo", "Tic", "Gub", "Bim", "Lol", "Pud",
         "Snu", "Wig", "Dop", "Fiz", "Kip"]
SYL_B = ["ble", "shy", "po", "gle", "dle", "bo", "zy", "ster", "kins", "ly", "mo", "pop", "nut", "boo", "doodle",
         "berry", "sprout", "wump"]
BAD_WORDS = ["fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "nigg", "fag", "slut", "whore", "rape", "nazi",
             "penis", "vagina", "sex", "porn", "boob", "kill", "bastard", "asshole", "retard"]
NAME_RX = re.compile(r"^[\w][\w '\-]{0,13}$", re.U)


def random_name():
    return RNG.choice(SYL_A) + RNG.choice(SYL_B)


def clean_name(name):
    """A cube name a kid can see: 2-14 letters, digits, spaces, - and ', and nothing rude. None if not OK."""
    s = re.sub(r"\s+", " ", str(name or "")).strip()
    if len(s) < 2 or len(s) > 14 or not NAME_RX.match(s) or "_" in s:
        return None
    low = re.sub(r"[^a-z]", "", s.lower())
    if any(w in low for w in BAD_WORDS):
        return None
    return s


def _head(w):
    """The start of a name up to its first vowel sound + one more letter: Sprinkle -> Sprin, Wobble -> Wob."""
    m = re.match(r"^[^aeiouy]*[aeiouy]+[^aeiouy]?", w, re.I)
    return m.group(0) if m and len(m.group(0)) >= 2 else w[:3]


def _tail(w):
    """The end of a name from a vowel sound, at least 3 letters: Sprinkle -> inkle, Gummy -> ummy."""
    spots = [m.start() for m in re.finditer(r"(?<![aeiouy])[aeiouy]", w, re.I) if m.start() > 0]
    for i in reversed(spots):
        if len(w) - i >= 3 and not (w[i:].lower() == "e"):
            return w[i:]
    return w[len(w) // 2:]


def baby_name(a, b):
    """The start of one parent's name + the end of the other's: Sprinkle + Gummy = Sprinummy."""
    a = re.sub(r"[^A-Za-z]", "", a or "") or random_name()
    b = re.sub(r"[^A-Za-z]", "", b or "") or random_name()
    first, second = (a, b) if RNG.random() < 0.5 else (b, a)
    name = (_head(first) + _tail(second).lower())[:14]
    return clean_name(name.capitalize()) or random_name()


# ------------------------------------------------------------------------------------------- colours
HEX_RX = re.compile(r"^#[0-9a-fA-F]{6}$")
COLOR_NAMES = [
    ("#ff5fa2", "Bubblegum"), ("#f0428c", "Pink Fizz"), ("#ff9cc8", "Cotton Candy"), ("#ff3b3b", "Cherry Bomb"),
    ("#ff8a3d", "Tangerine"), ("#ffb36b", "Peach Pie"), ("#ffd23f", "Lemon Zing"), ("#fff07a", "Banana Split"),
    ("#b6e84a", "Lime Fizz"), ("#4cd964", "Slime"), ("#19bfae", "Minty"), ("#34d6c4", "Mint Chip"),
    ("#6cc6ff", "Sky Splash"), ("#2f8cff", "Blueberry"), ("#4a5bff", "Ocean Blob"), ("#7b4dff", "Grape Soda"),
    ("#a07bff", "Lavender Puff"), ("#c86bff", "Purple Pop"), ("#e96bff", "Unicorn"), ("#8b5a3c", "Chocolate Chip"),
    ("#c79a6b", "Cookie Dough"), ("#ffffff", "Marshmallow"), ("#c8c8d8", "Cloudy"), ("#4a4458", "Licorice"),
]
CREATE_COLORS = [h for h, _ in COLOR_NAMES]


def clean_color(c):
    return c.lower() if isinstance(c, str) and HEX_RX.match(c) else None


def _rgb(h):
    return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]


def color_name(h):
    r, g, b = _rgb(h)
    best = min(COLOR_NAMES, key=lambda nc: sum((x - y) ** 2 for x, y in zip((r, g, b), _rgb(nc[0]))))
    return best[1]


def mix_colors(a, b):
    """The baby's colour: halfway round the colour wheel between the parents, with a tiny surprise."""
    ha, la, sa = colorsys.rgb_to_hls(*_rgb(a))
    hb, lb, sb = colorsys.rgb_to_hls(*_rgb(b))
    if sa < 0.08:   # a grey/white parent: keep the other parent's hue
        ha = hb
    if sb < 0.08:
        hb = ha
    d = ((hb - ha + 0.5) % 1.0) - 0.5
    h = (ha + d / 2 + RNG.uniform(-0.025, 0.025)) % 1.0
    l_ = min(0.82, max(0.3, (la + lb) / 2 + RNG.uniform(-0.04, 0.04)))
    s = min(1.0, max(0.25, max(sa, sb) * 0.9 + 0.05))
    r, g, bl = colorsys.hls_to_rgb(h, l_, s)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(bl * 255))


# ------------------------------------------------------------------------------------------- chat (3 symbols)
CHAT_EMOJI = ["😀", "😂", "😍", "🥳", "😮", "😴", "👋", "👍", "💖", "⭐", "🌈", "🎉", "🍕", "🐱", "💩", "🧁"]
CHAT_BLOCK = {"ASS", "FUK", "FCK", "FUC", "FUQ", "SEX", "WTF", "KYS", "CUM", "TIT", "FAG", "NIG", "DIK", "COK", "STD",
              "GTF", "STFU", "DIE", "XXX", "PEE"}


def clean_chat(text):
    """1-3 symbols (A-Z, 0-9, ! ? or one of CHAT_EMOJI), upper-cased. Returns (text, error)."""
    s = "".join(str(text or "").split()).upper()
    chars = list(s)
    if not chars:
        return None, "Type 1 to 3 letters."
    if len(chars) > 3:
        return None, "Only 3 letters at a time!"
    for ch in chars:
        if not (("A" <= ch <= "Z") or ("0" <= ch <= "9") or ch in "!?" or ch in CHAT_EMOJI):
            return None, "Only letters, numbers, ! ? and the emoji buttons."
    letters = "".join(ch for ch in chars if "A" <= ch <= "Z")
    if s in CHAT_BLOCK or letters in CHAT_BLOCK:
        return None, "Let's keep it nice!"
    return s, None
