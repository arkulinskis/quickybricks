import json

from anvil import *
from anvil.js import window

from ._anvil_designer import LandingTemplate
from ... import qb, state

# The app's video on the Addanapp YouTube channel (APP_MAKER/youtube/manifest.json), shown in the Watch section.
YT_VIDEO = "7AX1pujnTy0"
START_COLORS = ["#ff5fa2", "#34d6c4", "#ffd23f", "#a07bff", "#6cc6ff", "#ff8a3d"]


def draft():
    """The playground cube, kept in this browser ('draft'); the Cubby adopts it after sign-up."""
    d = qb.store_get("draft", None)
    if not isinstance(d, dict) or not d.get("color"):
        d = {"name": qb.random_name(), "color": qb.pick(START_COLORS), "eyes": 1, "mouth": 0, "drawing": "",
             "orient": str(qb.QB.START), "sparkles": 0, "rolls": 0}
    return d


def save_draft(d):
    qb.store_set("draft", {k: d.get(k) for k in ("name", "color", "eyes", "mouth", "drawing", "orient", "sparkles", "rolls")})


class Landing(LandingTemplate):
    """#landing (Persuade): a title-screen hero over floating cube friends, then the game itself: a real 3D cube to roll,
    recolour, give eyes / a mouth / a doodle and a name before signing up (Components/Stage, QBP.hero with guest rolls).
    Then the Watch section, the six sides, how it works, features, questions. Static copy lives in the template."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self.me = state.me()
        for el, show in ((self.guest_cta, not self.me), (self.member_cta, bool(self.me)), (self.keep_link, not self.me),
                         (self.make_link, bool(self.me)), (self.band_guest, not self.me), (self.band_member, bool(self.me))):
            el.visible = show
        self.pulse.visible = False
        self.d = draft()
        self.color_panel.add_event_handler("x-color", self._color)
        self.legend_panel.items = [dict(e, hit=False) for e in qb.events()]
        self.sides_panel.items = qb.events()
        self.name_box.text = self.d.get("name") or ""
        state.set_control_attr(self.name_box, "aria-label", "Cube name")
        state.set_control_attr(self.name_box, "maxlength", 14)
        self.mom_thumb.cube = {"name": "Sprinkle", "color": "#ff5fa2", "eyes": 5, "mouth": 0}
        self.dad_thumb.cube = {"name": "Blueberry", "color": "#2f8cff", "eyes": 1, "mouth": 4}
        self.kid_thumb.cube = {"name": "Sprinberry", "color": "#a35cf0", "eyes": 5, "mouth": 4}
        self._labels()
        cube = dict(self.d, id="draft", grown=True)
        self.stage.mount("hero", cube, {"guest": True, "keys": True, "onResult": self._rolled}, pad=self.dom_nodes["pad"])
        self.dom_nodes["yt_cover"].addEventListener("click", self._play)
        window.setTimeout(self._pulse, 60)

    # ---- the playground cube
    def _labels(self):
        self.eyes_label.text = qb.eyes()[int(self.d.get("eyes") or 0)] + " eyes"
        self.mouth_label.text = qb.mouths()[int(self.d.get("mouth") or 0)]
        self.color_panel.items = [dict(c, on=c["hex"] == self.d.get("color")) for c in qb.colors()[:14]]

    def _changed(self):
        save_draft(self.d)
        self._labels()
        if self.stage.live():
            self.stage.ctl.setData(qb.js_value({k: self.d.get(k) for k in ("color", "eyes", "mouth", "drawing", "name")}))

    def _color(self, hex, **event_args):
        self.d["color"] = hex
        self._changed()
        qb.sfx("pop")

    def _step(self, key, by):
        self.d[key] = (int(self.d.get(key) or 0) + by + 10) % 10
        self._changed()
        qb.sfx("pop")

    @handle("eyes_prev", "click")
    def eyes_prev_click(self, **event_args):
        self._step("eyes", -1)

    @handle("eyes_next", "click")
    def eyes_next_click(self, **event_args):
        self._step("eyes", 1)

    @handle("mouth_prev", "click")
    def mouth_prev_click(self, **event_args):
        self._step("mouth", -1)

    @handle("mouth_next", "click")
    def mouth_next_click(self, **event_args):
        self._step("mouth", 1)

    @handle("dice_button", "click")
    def dice_button_click(self, **event_args):
        self.d["name"] = qb.random_name()
        self.name_box.text = self.d["name"]
        self._changed()

    @handle("name_box", "change")
    def name_box_change(self, **event_args):
        self.d["name"] = (self.name_box.text or "")[:14]
        save_draft(self.d)

    @handle("doodle_button", "click")
    def doodle_button_click(self, **event_args):
        from ...Dialogs.Doodle import Doodle
        url = alert(Doodle(cube=dict(self.d)), buttons=[], role="app-dialog", dismissible=True)
        if url is not None:
            self.d["drawing"] = url
            self._changed()

    def _rolled(self, res_json):
        res = json.loads(res_json)
        self.d["orient"] = res.get("orient") or self.d.get("orient")
        self.d["sparkles"] = int(self.d.get("sparkles") or 0) + int((res.get("reward") or {}).get("sparkles") or 0)
        self.d["rolls"] = int(self.d.get("rolls") or 0) + 1
        save_draft(self.d)
        for chip in self.legend_panel.get_components():
            c = qb.loose(chip)
            if c.item.get("key") == res.get("event"):
                c.flash()
        s = self.d["sparkles"]
        self.earn_label.text = ("Nice roll! %d ✨ practice sparkles" % s) if self.me else ("You'd have %d ✨ by now. Sign up to keep them!" % s)

    # ---- live numbers and the video
    def _pulse(self):
        p = state.call_quiet("get_pulse")
        if not p:
            return
        self.pulse_cubes.text = "{:,}".format(int(p.get("cubes") or 0))
        self.pulse_babies.text = str(p.get("babies_today") or 0)
        self.pulse_world.text = str(p.get("in_world") or 0)
        self.pulse.visible = True

    def _play(self, event):
        """Swap the video's cover for YouTube's player (privacy-enhanced); nothing loads from YouTube before this click."""
        self.dom_nodes["yt_frame"].innerHTML = (
            '<iframe src="https://www.youtube-nocookie.com/embed/' + YT_VIDEO + '?autoplay=1&rel=0&playsinline=1" '
            'title="QuickyBricks video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen '
            'referrerpolicy="strict-origin-when-cross-origin"></iframe>')
