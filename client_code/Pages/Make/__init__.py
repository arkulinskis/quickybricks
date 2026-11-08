import anvil.server
from anvil import *
from anvil.js import window

from ._anvil_designer import MakeTemplate
from ... import qb, router, state


class Make(MakeTemplate):
    """#make (new cube) and #make/<id> (fix up your own cube): the Maker. New: colour, eyes (10), mouth (10), doodle,
    name -> create_cube (max 10 hand-made). Existing: only the doodle and the name change (update_cube). A live 3D
    preview (Components/Stage, QBP.hero with guest rolls) shows every choice right away."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.cube_id = args[0] if args else None
        state.heading(self.title, 1)
        state.set_control_attr(self.name_box, "aria-label", "Name")
        state.set_control_attr(self.name_box, "maxlength", 14)
        self.color_panel.add_event_handler("x-color", self._color)
        self.eyes_panel.add_event_handler("x-face", self._face)
        self.mouth_panel.add_event_handler("x-face", self._face)
        self.full_part.visible = False
        self.maker_part.visible = False
        if self.cube_id:
            r = anvil.server.call("get_cube", self.cube_id)
            if not r.get("ok"):
                state.toast(r.get("error") or "That cube wandered off.", "error")
                window.setTimeout(lambda: router.go("cubby"), 0)
                return
            if not r["cube"].get("mine"):
                state.toast("You can only change your own cubes.", "error")
                window.setTimeout(lambda: router.go("cube", self.cube_id), 0)
                return
            self.cube = r["cube"]
            self._draw(None)
        else:
            d = state.call("get_cubby")
            if not d:
                return
            self.cube = qb.loose({"name": qb.random_name(), "color": qb.pick(qb.colors())["hex"],
                         "eyes": int(window.Math.floor(window.Math.random() * 10)),
                         "mouth": int(window.Math.floor(window.Math.random() * 10)), "drawing": ""})
            self._draw(d["me"])

    def _draw(self, me):
        editing = bool(self.cube_id)
        left = me["handmade_max"] - me["handmade"] if me else 0
        if not editing and left <= 0:
            self.full_part.visible = True
            return
        self.maker_part.visible = True
        name = self.cube["name"]
        self.title.text = "Fix up " + name if editing else "Cube Maker"
        self.lead.text = ("Doodle a new face or change the name. Colour, eyes and mouth are how %s was born!" % name if editing
                          else "You can make %d more hand-made cube%s. Every choice shows up on the cube right away." % (left, "" if left == 1 else "s"))
        for step in (self.color_step, self.eyes_step, self.mouth_step):
            step.visible = not editing
        self.name_box.text = name
        self.save_button.text = "Save ✨" if editing else "Hatch my cube! 🐣"
        state.set_attr(self.cancel_link, "href", router.href("cube", self.cube_id) if editing else "#cubby")
        self.pad.set_cube(self.cube)
        self._options()
        preview = dict(self.cube, id="preview", orient=str(qb.QB.START), grown=True)
        self.stage.mount("hero", preview, {"guest": True, "dist": 0.82, "season": False})

    def _options(self):
        if self.cube_id:
            return
        c = self.cube
        self.color_panel.items = [dict(x, on=x["hex"] == c["color"]) for x in qb.colors()]
        base = {"color": c["color"], "eyes": c["eyes"], "mouth": c["mouth"]}
        self.eyes_panel.items = [{"kind": "eyes", "i": i, "name": n, "base": base, "on": i == c["eyes"]} for i, n in enumerate(qb.eyes())]
        self.mouth_panel.items = [{"kind": "mouth", "i": i, "name": n, "base": base, "on": i == c["mouth"]} for i, n in enumerate(qb.mouths())]

    def _refresh(self, options=False):
        if self.stage.live():
            self.stage.ctl.setData(qb.js_value({k: self.cube.get(k) for k in ("color", "eyes", "mouth", "drawing")}))
        if options:
            self.pad.set_cube(self.cube)
            self._options()

    def _color(self, hex, **event_args):
        self.cube["color"] = hex
        self._refresh(True)
        qb.sfx("pop")

    def _face(self, kind, i, **event_args):
        self.cube[kind] = i
        self._refresh(True)
        if kind == "eyes" and self.stage.live():
            self.stage.ctl.express("love", 400)
        qb.sfx("pop")

    @handle("pad", "drawn")
    def pad_drawn(self, **event_args):
        self.cube["drawing"] = self.pad.data_url()
        self._refresh()

    @handle("dice_button", "click")
    def dice_button_click(self, **event_args):
        self.name_box.text = qb.random_name()

    @handle("save_button", "click")
    def save_button_click(self, **event_args):
        name = (self.name_box.text or "").strip()
        if len(name) < 2:
            state.toast("Give your cube a name (2 letters or more)!", "error")
            return
        drawing = self.pad.data_url()
        self.save_button.enabled = False
        try:
            if self.cube_id:
                r = state.call("update_cube", self.cube_id, {"name": name, "drawing": drawing})
            else:
                c = self.cube
                r = state.call("create_cube", name, c["color"], c["eyes"], c["mouth"], drawing)
        finally:
            self.save_button.enabled = True
        if not r:
            return
        qb.confetti(50 if self.cube_id else 120)
        qb.sfx("baby")
        if self.cube_id:
            state.toast("Saved!", "ok")
            router.go("cube", self.cube_id)
        else:
            state.toast(r["cube"]["name"] + " hatched! 🐣", "ok")
            qb.store_set("sel", r["cube"]["id"])
            router.go("cubby")
