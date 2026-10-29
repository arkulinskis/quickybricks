"""Keeping it kind: anyone signed in can report a cube (a rude drawing or name); admins wipe, rename or send it home.
Admins also see the (short-lived) chat and can delete a message."""
import anvil.server
from anvil.tables import app_tables
import anvil.tables as tables

from . import common as C
from . import rules as R
from . import Cubes as CB

REASONS = {"drawing": "Rude drawing", "name": "Rude name", "other": "Something else"}


@anvil.server.callable(require_user=True)
def report_cube(cube_id, reason):
    me = C.require_user()
    c = C.row_by_id(app_tables.cubes, cube_id)
    if c is None:
        return C.fail("That cube wandered off.")
    if c["owner"] == me:
        return C.fail("That's your own cube!")
    if reason not in REASONS:
        reason = "other"
    if app_tables.reports.get(reporter=me, cube=c, status="open"):
        return C.ok(already=True)
    if C.rate_limited("report", 10, 3600):
        return C.fail("Thanks! You've sent lots of reports. We'll look at them soon.")
    app_tables.reports.add_row(reporter=me, cube=c, reason=reason, status="open", created=C.now())
    return C.ok()


@anvil.server.callable(require_user=True)
def admin_reports():
    C.require_admin()
    out = []
    for r in app_tables.reports.search(tables.order_by("created", ascending=False), status="open"):
        c = r["cube"]
        if c is None:
            r["status"] = "done"
            continue
        d = CB.cube_dict(c)
        d["owner_email"] = c["owner"]["email"] if c["owner"] else ""
        out.append({"id": r.get_id(), "reason": REASONS.get(r["reason"], r["reason"]), "created": C.iso(r["created"]),
                    "reporter": C.name_of(r["reporter"]), "cube": d})
    return {"reports": out[:100]}


@anvil.server.callable(require_user=True)
def admin_resolve(report_id, action):
    """action: dismiss | wipe (clear the drawing) | rename (a random silly name) | home (out of the World, hands closed)."""
    C.require_admin()
    r = C.row_by_id(app_tables.reports, report_id)
    if r is None:
        return C.fail("That report is gone.")
    c = r["cube"]
    if action not in ("dismiss", "wipe", "rename", "home"):
        return C.fail("Unknown action.")
    if c is not None:
        if action == "wipe":
            c.update(drawing="", drawing_v=int(c["drawing_v"] or 0) + 1)
        elif action == "rename":
            c["name"] = R.random_name()
        elif action == "home":
            c.update(in_world=False, open_hands=False)
        if action != "dismiss":
            for other in app_tables.reports.search(cube=c, status="open"):
                other["status"] = "done"
    r["status"] = "done"
    return C.ok()


@anvil.server.callable(require_user=True)
def admin_chats():
    C.require_admin()
    rows = app_tables.chats.search(tables.order_by("created", ascending=False))
    return {"chats": [{"id": m.get_id(), "text": m["text"], "who": C.name_of(m["user"]),
                       "email": m["user"]["email"] if m["user"] else "", "at": C.iso(m["created"])} for m in rows[:60]],
            "keep": R.CHAT_KEEP}


@anvil.server.callable(require_user=True)
def admin_delete_chat(chat_id):
    C.require_admin()
    m = C.row_by_id(app_tables.chats, chat_id)
    if m is not None:
        m.delete()
    return C.ok()
