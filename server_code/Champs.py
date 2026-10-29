"""Cube Champs: the leaderboard (most cubes, biggest families), your stickers and the Cubedex (all 100 faces)."""
import anvil.server
from anvil.tables import app_tables

from . import common as C
from . import rules as R
from . import Cubes as CB

STICKERS = [
    ("first", "First Cube!", "Make your very first cube", "🧊"),
    ("ten", "Full Ten", "Make all 10 hand-made cubes", "🔟"),
    ("baby", "It's a Cube!", "Get your first baby", "🍼"),
    ("c25", "Cube Crowd", "Own 25 cubes", "👨‍👩‍👧"),
    ("c50", "Cube Party", "Own 50 cubes", "🎉"),
    ("c100", "Cube Kingdom", "Own 100 cubes", "🏰"),
    ("gen3", "Grandcubes", "Own a generation 3 cube", "👵"),
    ("gen5", "Family Tree", "Own a generation 5 cube", "🌳"),
    ("golden", "Golden Disco", "Have a golden disco moment", "✨"),
    ("roll100", "Roly Poly", "Roll 100 times", "🎲"),
    ("roll1000", "Rolling Legend", "Roll 1,000 times", "🏆"),
    ("rainbow", "Rainbow Gang", "Own cubes in 7 different colours", "🌈"),
    ("faces25", "Face Collector", "Collect 25 different faces", "😜"),
    ("hats5", "Fashionista", "Own 5 hats", "🎩"),
    ("chatty", "Chatterbox", "Send a chat message", "💬"),
    ("egg", "Egg Hunter", "Find a Surprise Egg in the World", "🥚"),
    ("rainbowroll", "Rainbow Roller", "Land all 6 sides in 6 rolls", "🌈"),
    ("quests", "Quest Champ", "Open a daily quest chest", "🧰"),
]


def _stickers(u, cubes):
    inv = CB.inventory(u)
    colors = {R.color_name(c["color"] or "#ff5fa2") for c in cubes}
    faces = {(int(c["eyes"] or 0), int(c["mouth"] or 0)) for c in cubes}
    gen = max([int(c["gen"] or 1) for c in cubes] or [0])
    rolls = u["rolls"] or 0
    got = {
        "first": len(cubes) >= 1, "ten": len([c for c in cubes if c["handmade"]]) >= R.HANDMADE_MAX,
        "baby": any(not c["handmade"] for c in cubes), "c25": len(cubes) >= 25, "c50": len(cubes) >= 50,
        "c100": len(cubes) >= 100, "gen3": gen >= 3, "gen5": gen >= 5, "golden": (u["golden"] or 0) > 0,
        "roll100": rolls >= 100, "roll1000": rolls >= 1000, "rainbow": len(colors) >= 7, "faces25": len(faces) >= 25,
        "hats5": len(inv["hats"]) >= 5, "chatty": (u["chats_sent"] or 0) > 0,
        "egg": (u["eggs"] or 0) > 0, "rainbowroll": (u["rainbows"] or 0) > 0,
        "quests": (u["chests"] or 0) > 0,
    }
    return [{"key": k, "name": n, "how": h, "emoji": e, "got": bool(got[k])} for k, n, h, e in STICKERS]


@anvil.server.callable(require_user=True)
def get_champs():
    me = CB.player(C.require_user())
    per = {}
    best_gen = {}
    for c in app_tables.cubes.search():
        o = c["owner"]
        if o is None or (o["enabled"] is False and not o["is_demo"]):
            continue
        per.setdefault(o, []).append(c)
    board = []
    for o, cs in per.items():
        top = max(cs, key=lambda c: (int(c["gen"] or 1), int(c["rolls"] or 0)))
        board.append({"name": C.name_of(o), "cubes": len(cs), "gen": int(top["gen"] or 1), "star": CB.tiny(top),
                      "me": o == me, "demo": bool(o["is_demo"])})
        best_gen[o] = int(top["gen"] or 1)
    most = sorted(board, key=lambda b: (-b["cubes"], b["name"]))
    oldest = sorted(board, key=lambda b: (-b["gen"], -b["cubes"], b["name"]))
    rank = next((i + 1 for i, b in enumerate(most) if b["me"]), None)
    mine = per.get(me, [])
    faces = sorted({"%d-%d" % (int(c["eyes"] or 0), int(c["mouth"] or 0)) for c in mine})
    return {"most": most[:10], "families": oldest[:5], "rank": rank, "players": len(board),
            "stickers": _stickers(me, mine), "faces": faces,
            "me": {"cubes": len(mine), "rolls": me["rolls"] or 0, "golden": me["golden"] or 0,
                   "gen": max([int(c["gen"] or 1) for c in mine] or [0]), "sparkles": me["sparkles"] or 0}}
