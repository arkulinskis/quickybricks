import json

import anvil.server
from anvil import *
from anvil.js import window

from ._anvil_designer import CubbyTemplate
from ... import qb, router, state

QUEST_EMOJI = {"roll": "🎲", "world_roll": "🏝️", "chat": "💬", "hands": "🤝", "doodle": "✏️", "hat": "🎩", "egg": "🥚",
               "rainbow": "🌈"}


class Cubby(CubbyTemplate):
    """#cubby (Operate): the player's own space, the home page after signing in. A 3D play mat with up to 16 cubes
    (Components/Stage, QBP.cubby: positions kept in the browser, 'pos.<user>'), the picked cube's card and the d-pad,
    today's quests, every cube as a thumbnail, news from the World. Adopts the landing-page cube ('draft')."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.me = state.me() or {}
        self.sel_id = None
        state.heading(self.title, 1)
        self.cubes_panel.add_event_handler("x-pick", self._pick)
        self.quests_panel.add_event_handler("x-claim", self._claim)
        self.data = anvil.server.call("get_cubby")
        if self._adopt_draft():
            self.data = anvil.server.call("get_cubby")
        self._draw()
        if self.data.get("surprises"):
            window.setTimeout(self._surprises, 600)

    # ---- loading
    def _adopt_draft(self):
        d = qb.store_get("draft", None)
        m = self.data["me"]
        if not isinstance(d, dict) or not d.get("color") or m["handmade"] >= m["handmade_max"]:
            return False
        name = d.get("name") if len((d.get("name") or "").strip()) >= 2 else qb.random_name()
        try:
            r = anvil.server.call_s("create_cube", name, d["color"], int(d.get("eyes") or 0), int(d.get("mouth") or 0),
                                    d.get("drawing") or "")
        except Exception:
            r = None
        qb.store_set("draft", None)
        if not r or not r.get("ok"):
            return False
        state.toast(r["cube"]["name"] + " from the front page moved into your Cubby! 🎉", "ok")
        qb.store_set("sel", r["cube"]["id"])
        return True

    def _cube(self, cube_id):
        for c in self.data["cubes"]:
            if c["id"] == cube_id:
                return c
        return None

    # ---- drawing
    def _draw(self):
        d, m = self.data, self.data["me"]
        self.title.text = qb.first_name(self.me.get("name")) + "'s Cubby"
        empty = not d["cubes"]
        self.empty_part.visible = empty
        self.play_part.visible = not empty
        self._chips()
        self._quests()
        self._list()
        self.news_panel.items = d.get("happenings") or []
        self.news_part.visible = bool(d.get("happenings"))
        self._card()
        if not empty:
            self.stage.mount("cubby", {"user": self.me.get("id") or "", "cubes": d["cubes"], "toys": m["inventory"].get("toys") or []},
                             {"onSelect": self._selected, "onResult": self._rolled}, pad=self.dom_nodes["pad"])

    def _chips(self):
        m = self.data["me"]
        g = m["gift"]
        self.sparkles.text = "✨ %d" % m["sparkles"]
        self.total_badge.text = "🧊 %d cubes" % m["total"]
        self.handmade_badge.text = "✋ %d/%d hand-made" % (m["handmade"], m["handmade_max"])
        self.gift_button.visible = bool(g["ready"])
        self.streak_badge.visible = not g["ready"]
        self.streak_badge.text = "🔥 %d-day streak" % g["streak"]

    def _quests(self):
        q = self.data.get("quests")
        self.chest_box.visible = bool(q)
        if not q:
            self.quests_panel.items = []
            return
        items = []
        events = {e["key"]: e for e in qb.events()}
        for it in q["list"]:
            ev = events.get(it["key"])
            em = "✅" if it.get("claimed") else "🎉" if it.get("done") else ev["emoji"] if ev else QUEST_EMOJI.get(it["key"], "⭐")
            items.append(dict(it, emoji=em))
        self.quests_panel.items = items
        self.chest_box.classes["ready"] = bool(q.get("chest_ready"))
        self.chest_text.text = "🧰 " + ("Chest opened! New quests tomorrow." if q.get("chest") else
                                       "Finish all three for a bonus chest: +%d ✨" % q.get("chest_sparkles", 0))
        self.chest_button.visible = not q.get("chest")
        self.chest_button.enabled = bool(q.get("chest_ready"))

    def _list(self):
        m = self.data["me"]
        left = m["handmade_max"] - m["handmade"]
        self.make_tile.visible = left > 0
        self.left_label.text = "%d hand-made left" % left
        self.count_label.text = str(len(self.data["cubes"]))
        self.cubes_panel.items = [dict(c, on=c["id"] == self.sel_id) for c in reversed(self.data["cubes"])]

    def _card(self):
        c = self._cube(self.sel_id) if self.sel_id else None
        self.sel_none.visible = c is None
        self.sel_box.visible = c is not None
        if c is None:
            return
        if not c["grown"]:
            left = c["grow_left"]
            hint = "🍼 Baby! Roll %d more time%s to grow up." % (left, "" if left == 1 else "s")
        elif c["love"] >= 100:
            hint = "💖 Full of love! Take it to the World to hold hands."
        else:
            hint = "Roll to land the 💖 heart side on top!"
        self.sel_thumb.cube = c
        self.sel_name.text = c["name"]
        self.sel_meta.text = "%s · Gen %d%s" % (c["color_name"], c["gen"], " · 🏝️ in the World" if c["in_world"] else "")
        self.sel_love.love = c["love"]
        self.sel_rainbow.recent = c.get("recent") or ""
        self.sel_hint.text = hint
        state.set_attr(self.card_link, "href", router.href("cube", c["id"]))
        self.world_button.text = "🏠 Bring home" if c["in_world"] else "🏝️ To the World"

    # ---- the stage talks back
    def _selected(self, cube_id):
        self.sel_id = cube_id
        self._card()
        self._list()

    def _rolled(self, res_json):
        res = json.loads(res_json)
        c = self._cube(res.get("id"))
        if c and res.get("cube"):
            for k in ("orient", "love", "rolls", "grown", "grow_left", "recent"):
                c[k] = res["cube"].get(k, c.get(k))
        if res.get("sparkles") is not None:
            self.data["me"]["sparkles"] = res["sparkles"]
        if res.get("quests_done"):
            fresh = state.call_quiet("get_cubby")
            if fresh:
                self.data["quests"] = fresh["quests"]
                self._quests()
        self._chips()
        self._card()
        if (res.get("reward") or {}).get("grew"):
            self._list()

    # ---- clicks
    def _pick(self, cube_id, **event_args):
        if self.stage.live() and self.stage.ctl.select(cube_id):
            self._selected(cube_id)
        else:
            router.go("cube", cube_id)  # only the newest 16 cubes are on the mat

    def _claim(self, key, **event_args):
        r = state.call("claim_quest", key)
        if r:
            self.data["quests"], self.data["me"]["sparkles"] = r["quests"], r["sparkles"]
            self._quests()
            self._chips()
            qb.confetti(50)
            qb.sfx("golden")
            state.toast("+%d ✨ Quest complete!" % r["amount"], "ok")

    @handle("chest_button", "click")
    def chest_button_click(self, **event_args):
        r = state.call("claim_chest")
        if r:
            self.data["quests"], self.data["me"]["sparkles"] = r["quests"], r["sparkles"]
            self._quests()
            self._chips()
            qb.confetti(160)
            qb.sfx("baby")
            state.toast("🧰 Bonus chest! +%d ✨" % r["amount"], "ok")

    @handle("gift_button", "click")
    def gift_button_click(self, **event_args):
        r = state.call("claim_gift")
        if r:
            self.data["me"]["sparkles"] = r["sparkles"]
            self.data["me"]["gift"] = {"ready": False, "streak": r["streak"]}
            self._chips()
            qb.confetti(90)
            qb.sfx("golden")
            state.toast("🎁 +%d sparkles! %d-day streak 🔥" % (r["amount"], r["streak"]), "ok")

    @handle("world_button", "click")
    def world_button_click(self, **event_args):
        c = self._cube(self.sel_id)
        if not c:
            return
        out = not c["in_world"]
        self.world_button.enabled = False
        try:
            r = state.call("send_to_world", c["id"], out)
        finally:
            self.world_button.enabled = True
        if r:
            c["in_world"] = r["cube"]["in_world"]
            self._card()
            self._list()
            if out:
                state.toast(c["name"] + " is off to play in the World! 🏝️", "ok")

    # ---- babies born while you were away
    def _surprises(self):
        babies = self.data.get("surprises") or []
        if not babies or router.current() is not self:
            return
        from ...Dialogs.Surprise import Surprise
        qb.confetti(120)
        qb.sfx("baby")
        state.call_quiet("mark_seen", [b["id"] for b in babies])
        self.data["surprises"] = []
        alert(Surprise(babies=babies), buttons=[], role="app-dialog", dismissible=True)
