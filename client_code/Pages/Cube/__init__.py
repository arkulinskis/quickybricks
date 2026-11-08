import json

import anvil.server
from anvil import *
from anvil.js import window

from ._anvil_designer import CubeTemplate
from ... import qb, router, state


class Cube(CubeTemplate):
    """#cube/<id>: one cube's card. Anyone signed in can look (get_cube). Owner: roll it here (Components/Stage), hat
    wardrobe, open/close hands, World on/off, Love Potion, Wake-Up Whistle, redraw/rename (-> #make/<id>).
    Others: report a rude drawing or name. Family: parents, grandparents, babies, and a poster PNG (QBP.poster)."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.cube_id = args[0] if args else ""
        state.heading(self.name, 1)
        self.hats_panel.add_event_handler("x-hat", self._hat)
        self.missing_part.visible = True
        self.cube_part.visible = False
        if not self.cube_id:
            return
        r: dict = anvil.server.call("get_cube", self.cube_id)
        if not r.get("ok"):
            return
        self.missing_part.visible = False
        self.cube_part.visible = True
        self.c = r["cube"]
        self.me = r.get("me")
        window.document.title = self.c["name"] + " · QuickyBricks"
        self._info()
        self._family()
        c = self.c
        if c["mine"]:
            self.stage.mount("hero", c, {"where": "home", "keys": True, "smallPad": True, "dist": 0.85 if c["grown"] else 0.7,
                                         "season": False, "onResult": self._rolled}, pad=self.dom_nodes["pad"])
        else:
            self.stage.mount("hero", c, {"canRoll": False, "dist": 0.85 if c["grown"] else 0.7, "season": False})

    # ---- drawing
    def _info(self):
        c, mine = self.c, self.c["mine"]
        if not c["grown"]:
            status = "🍼 Baby: roll %d more" % c["grow_left"]
        elif c.get("nap"):
            status = "💤 Resting " + qb.nap_text(c["nap"])
        elif c["love"] >= 100:
            status = "💖 Ready to hold hands"
        else:
            status = "🙂 Happy"
        self.name.text = c["name"]
        self.whose.text = ("Your cube" if mine else c["owner"] + "'s cube") + (" · demo" if c.get("demo") else "")
        self.edit_link.visible = mine
        state.set_attr(self.edit_link, "href", router.href("make", c["id"]))
        self.report_button.visible = not mine
        self.roll_tip.visible = mine
        self.roll_tip.text = "Roll %s right here!" % c["name"]
        self.f_color.text = c["color_name"]
        self.f_gen.text = "Gen %d" % c["gen"]
        self.f_gen_how.text = "hand-made" if c["handmade"] else "born from hand-holding"
        self.f_rolls.text = str(c["rolls"])
        self.f_age.text = state.ago(c.get("born")).replace(" ago", "")
        self.f_eyes.text = qb.eyes()[int(c["eyes"])]
        self.f_mouth.text = qb.mouths()[int(c["mouth"])]
        self.status.text = "%s · Love %d/100" % (status, c["love"])
        self.love_bar.love = c["love"]
        self.owner_part.visible = mine
        if not mine:
            return
        inv = qb.loose((self.me or {}).get("inventory") or {"hats": [], "potion": 0, "whistle": 0})
        names = qb.hats()
        hats = [{"key": "", "emoji": "🚫", "name": "No hat", "on": not c.get("hat")}]
        hats += [{"key": h, "emoji": names[h][1] if h in names else "🎩", "name": names[h][0] if h in names else h,
                  "on": c.get("hat") == h} for h in inv.get("hats") or []]
        self.hats_panel.items = hats
        self.no_hats.visible = not inv.get("hats")
        self.rainbow.recent = c.get("recent") or ""
        self.world_button.text = "🏠 Bring home" if c["in_world"] else "🏝️ Send to the World"
        self.open_box.text = "✋ Other cubes can hold hands with " + c["name"]
        self.open_box.checked = bool(c.get("open"))
        self.potion_button.text = "🧪 Love Potion (%d)" % inv.get("potion", 0)
        self.potion_button.enabled = inv.get("potion", 0) > 0
        self.whistle_button.text = "📯 Wake-Up Whistle (%d)" % inv.get("whistle", 0)
        self.whistle_button.enabled = inv.get("whistle", 0) > 0

    def _family(self):
        c = self.c
        self.parents_panel.items = c["parents"]
        self.no_parents.visible = not c["parents"]
        self.no_parents.text = "Hand-made with love by %s." % c["owner"]
        self.grand_part.visible = bool(c["grandparents"])
        self.grand_panel.items = c["grandparents"]
        self.babies_count.text = str(c["children_total"])
        self.babies_panel.items = c["children"]
        self.no_babies.visible = not c["children"]
        self.no_babies.text = "No babies yet." + (" Fill the heart, then hold hands in the World!" if c["mine"] else "")

    # ---- the stage talks back
    def _rolled(self, res_json):
        res = json.loads(res_json)
        if res.get("ok") is False or not res.get("cube"):
            return
        for k in ("orient", "love", "rolls", "grown", "grow_left", "recent"):
            self.c[k] = res["cube"].get(k, self.c.get(k))
        if self.me is not None and res.get("sparkles") is not None:
            self.me["sparkles"] = res["sparkles"]
        self._info()

    # ---- clicks
    def _hat(self, key, **event_args):
        r = state.call("update_cube", self.c["id"], {"hat": key})
        if r:
            self.c["hat"] = r["cube"]["hat"]
            self._info()
            if self.stage.live():
                self.stage.ctl.setData(qb.js_value({"hat": self.c["hat"]}))
            qb.sfx("pop")

    @handle("world_button", "click")
    def world_button_click(self, **event_args):
        c = self.c
        self.world_button.enabled = False
        try:
            r = state.call("send_to_world", c["id"], not c["in_world"])
        finally:
            self.world_button.enabled = True
        if r:
            c["in_world"] = r["cube"]["in_world"]
            self._info()
            state.toast(c["name"] + (" is off to the World! 🏝️" if c["in_world"] else " came home."), "ok")

    @handle("open_box", "change")
    def open_box_change(self, **event_args):
        on = bool(self.open_box.checked)
        if state.call("update_cube", self.c["id"], {"open": on}):
            self.c["open"] = on
            state.toast("Hands open ✋" if on else "Hands closed", "ok")
        else:
            self.open_box.checked = not on

    def _use(self, item, button):
        button.enabled = False
        r = state.call("use_item", item, self.c["id"])
        if not r:
            self._info()
            return
        self.c["love"], self.c["nap"] = r["cube"]["love"], r["cube"]["nap"]
        self.me = r["me"]
        self._info()
        if self.stage.live():
            self.stage.ctl.play("love" if item == "potion" else "boing")
        state.toast(self.c["name"] + (" is full of love! 💖" if item == "potion" else " is wide awake! 📯"), "ok")

    @handle("potion_button", "click")
    def potion_button_click(self, **event_args):
        self._use("potion", self.potion_button)

    @handle("whistle_button", "click")
    def whistle_button_click(self, **event_args):
        self._use("whistle", self.whistle_button)

    @handle("poster_button", "click")
    def poster_button_click(self, **event_args):
        qb.QBP.poster(qb.js_value(self.c))

    @handle("report_button", "click")
    def report_button_click(self, **event_args):
        from ...Dialogs.Report import Report
        alert(Report(cube=self.c), buttons=[], role="app-dialog", dismissible=True)
