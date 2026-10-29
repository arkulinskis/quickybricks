"""Daily quests: three small goals per player per day (rules.QUESTS), progress bumped by the game, claimed for
sparkles, plus a bonus chest when all three are claimed. Stored in users.quests:
{"day": "2026-10-29", "list": [{"key", "progress", "claimed"}], "chest": False}."""
import anvil.server

from . import common as C
from . import rules as R


def state(u):
    day = C.now().date().isoformat()
    q = u["quests"] if isinstance(u["quests"], dict) else None
    if not q or q.get("day") != day:
        q = {"day": day, "list": [{"key": k, "progress": 0, "claimed": False} for k in R.pick_quests(day, u.get_id())], "chest": False}
        u["quests"] = q
    return q


def view(u):
    q = state(u)
    out = []
    for item in q["list"]:
        text, goal, sparkles = R.QUEST_INFO[item["key"]]
        out.append({"key": item["key"], "text": text, "goal": goal, "progress": min(goal, item["progress"]),
                    "sparkles": sparkles, "done": item["progress"] >= goal, "claimed": item["claimed"]})
    return {"list": out, "chest": q["chest"], "chest_ready": all(i["claimed"] for i in out) and not q["chest"],
            "chest_sparkles": R.QUEST_CHEST}


def bump(u, key, n=1):
    """Add progress to today's quest `key` (if the player has it). Returns the texts of quests that just got done."""
    q = state(u)
    done = []
    changed = False
    for item in q["list"]:
        if item["key"] != key:
            continue
        goal = R.QUEST_INFO[key][1]
        before = item["progress"]
        if before < goal:
            item["progress"] = min(goal, before + n)
            changed = True
            if item["progress"] >= goal:
                done.append(R.QUEST_INFO[key][0])
    if changed:
        u["quests"] = dict(q, list=[dict(i) for i in q["list"]])
    return done


@anvil.server.callable(require_user=True)
def claim_quest(key):
    u = C.require_user()
    q = state(u)
    for item in q["list"]:
        if item["key"] == key:
            text, goal, sparkles = R.QUEST_INFO[key]
            if item["claimed"]:
                return C.fail("You already got that one!")
            if item["progress"] < goal:
                return C.fail("Not done yet! %d of %d." % (item["progress"], goal))
            item["claimed"] = True
            u["quests"] = dict(q, list=[dict(i) for i in q["list"]])
            u["sparkles"] = (u["sparkles"] or 0) + sparkles
            return C.ok(sparkles=u["sparkles"], amount=sparkles, quests=view(u))
    return C.fail("That's not one of today's quests.")


@anvil.server.callable(require_user=True)
def claim_chest():
    u = C.require_user()
    v = view(u)
    if not v["chest_ready"]:
        return C.fail("Finish and claim all three quests first!" if not v["chest"] else "You opened today's chest already!")
    q = state(u)
    u["quests"] = dict(q, chest=True)
    u["sparkles"] = (u["sparkles"] or 0) + R.QUEST_CHEST
    u["chests"] = (u["chests"] or 0) + 1
    return C.ok(sparkles=u["sparkles"], amount=R.QUEST_CHEST, quests=view(u))
