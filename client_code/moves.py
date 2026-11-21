"""Play Together mode: every roll becomes a Silly Move card for a little one and a grown-up, taking turns.

    moves.together() / set_together(on)     Play together on or off
    moves.readaloud() / set_readaloud(on)   Read to me (cards, toasts and quests spoken by the browser's voice)
    moves.names() / set_names(kid, grown)   the two names on the cards ("Little one", "Grown-up" by default)
    moves.turn() / flip()                   whose turn it is: 0 = the little one, 1 = the grown-up
    moves.pick(res)                         the card for a roll result {event, reward}: {emoji, label, text, color, ...}
    moves.sheet()                           one Silly Move per side for the Paper Cube (QBP.papercraft)
    moves.say(text) / say_if(text)          speak now / speak only while Read to me is on

Everything is kept in this browser (qb.store_get/store_set: keys together, readaloud, names, turn). No server call,
and the names never leave the browser. The moves are indoor-safe: jumps on the spot, noises, hugs, poses.
"""
from anvil.js import window

from . import qb

KID, GROWN = "Little one", "Grown-up"
NAME_MAX = 12

# Five or more Silly Moves per side. "{who}" = whoever's turn it is; the other player copies.
MOVES = {
    "boing": ["3 big spring jumps!", "5 bunny hops on the spot!", "jump up and touch the sky 3 times!",
              "frog jump: squat down low, then BOING up high!", "jump and land as quietly as a cat!",
              "bounce like a kangaroo, 4 hops!"],
    "toot": ["your silliest toot noise!", "blow a raspberry on your arm: PFFFT!",
             "waddle like a penguin and toot with every step!", "puff your cheeks up like a cloud, then PFFF!",
             "make a trumpet with your hands: TOOT TOOT!", "float like a cloud, then rain: pitter-patter fingers!"],
    "love": ["a big squishy hug!", "make a heart with your hands!", "blow 3 kisses to someone in the room!",
             "say one nice thing about the other player!", "a high five, a low five and a wiggle five!",
             "rub noses like two bunnies!"],
    "snack": ["chomp a pretend giant cupcake: CHOMP CHOMP!", "stir a pretend cake bowl 10 times!",
              "rub your tummy and say YUM YUM YUM!", "be a hungry crocodile: snap your arms 3 times!",
              "lick the biggest pretend lollipop in the world!", "munch a pretend carrot like a bunny!"],
    "sunny": ["your biggest, sunniest smile for 3 seconds!", "stretch up tall like a sunflower!",
              "put on pretend sunglasses and strike a cool pose!", "wave hello to the sun with both hands!",
              "make your funniest face, then smile!", "rise like the sun: tiny ball to giant star!"],
    "disco": ["spin 3 times and freeze!", "disco point: up, down, up, down!", "wiggle like jelly for 5 seconds!",
              "dance like a robot, then FREEZE!", "shake your hands like they're dripping wet!",
              "do the twist all the way down and back up!"],
}
# Special rolls (signed-in players: the server decides these).
SPECIAL = {
    "golden": {"emoji": "🌟", "label": "GOLDEN DISCO!", "text": "Everybody dances together: 10 seconds of your best moves!",
               "color": "#ffd23f"},
    "present": {"emoji": "🎁", "label": "PRESENT!", "text": "{who} wraps the other in a pretend present. Unwrap it: SURPRISE!",
                "color": "#4cd964"},
    "rainbow": {"emoji": "🌈", "label": "RAINBOW ROLL!", "text": "Everybody! All six moves in a row: jump, toot, hug, chomp, smile, spin!",
                "color": "#ff5fa2"},
}
LEADS = ["{who} leads", "{who} first", "{who}'s turn"]
# One move per side for the paper cube's sheet.
SHEET = {"boing": "3 big spring jumps!", "toot": "your silliest toot noise!", "love": "a big squishy hug!",
         "snack": "chomp a pretend cupcake!", "sunny": "your biggest sunny smile!", "disco": "spin 3 times and freeze!"}

_last: dict = {}


# ---------------------------------------------------------------- settings (this browser only)
def together():
    return bool(qb.store_get("together", False))


def set_together(on):
    qb.store_set("together", bool(on))


def readaloud():
    return bool(qb.store_get("readaloud", False)) and can_say()


def set_readaloud(on):
    qb.store_set("readaloud", bool(on))
    if not on:
        hush()


def clean_name(text, fallback):
    text = " ".join(str(text or "").split())[:NAME_MAX]
    return text or fallback


def names():
    n = qb.store_get("names", None)
    n = n if isinstance(n, dict) else {}
    return {"kid": clean_name(n.get("kid"), KID), "grown": clean_name(n.get("grown"), GROWN)}


def set_names(kid, grown):
    qb.store_set("names", {"kid": clean_name(kid, KID), "grown": clean_name(grown, GROWN)})


def turn():
    return 1 if qb.store_get("turn", 0) == 1 else 0


def flip():
    qb.store_set("turn", 1 - turn())
    return turn()


def who(t=None):
    n = names()
    return n["grown"] if (turn() if t is None else t) == 1 else n["kid"]


def badge(t=None):
    t = turn() if t is None else t
    return ("🧑 " if t == 1 else "🧒 ") + who(t)


# ---------------------------------------------------------------- cards
def pick(res):
    """The card for one roll. res = the roller's result: {event, reward: {golden, present, rainbow}}."""
    ev = (res or {}).get("event") or "boing"
    rw = (res or {}).get("reward") or {}
    name = who()
    special = "rainbow" if rw.get("rainbow") else "golden" if rw.get("golden") else "present" if rw.get("present") else ""
    if special:
        s = SPECIAL[special]
        text = s["text"].replace("{who}", name)
        return {"kind": special, "emoji": s["emoji"], "label": s["label"], "text": text, "color": s["color"],
                "speech": s["label"] + " " + text}
    info = qb.events_by_key().get(ev) or {"label": "BOING!", "emoji": "🌀", "color": "#4cd964"}
    options = MOVES.get(ev) or MOVES["boing"]
    n = len(options)
    i = int(window.Math.floor(window.Math.random() * n))
    if n > 1 and _last.get(ev) == i:
        i = (i + 1) % n  # never the same move twice in a row
    _last[ev] = i
    lead = LEADS[int(window.Math.floor(window.Math.random() * len(LEADS)))].replace("{who}", name)
    text = lead + ": " + options[i]
    return {"kind": ev, "emoji": info["emoji"], "label": info["label"], "text": text, "color": info["color"],
            "speech": info["label"] + " " + text}


def sheet():
    """[{face, key, emoji, label, move}] in face order, for the Paper Cube."""
    out = []
    for face, ev in enumerate(qb.events()):
        move = SHEET.get(ev["key"], "")
        out.append({"face": face, "key": ev["key"], "emoji": ev["emoji"], "label": ev["label"],
                    "move": move[:1].upper() + move[1:]})
    return out


# ---------------------------------------------------------------- Read to me
def can_say():
    return bool(qb.QBP.canSay())


def say(text):
    return bool(qb.QBP.say(str(text or "")))


def say_if(text):
    if readaloud():
        say(text)


def hush():
    qb.QBP.hush()
