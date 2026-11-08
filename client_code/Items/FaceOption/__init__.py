from anvil import *

from ._anvil_designer import FaceOptionTemplate
from ... import qb, state


class FaceOption(FaceOptionTemplate):
    """One of the 10 eyes or 10 mouths in the Maker, painted on the cube's colour. item = {kind, i, name, base, on}.
    A click raises x-face(kind, i) on the panel."""

    def __init__(self, **properties):
        super().__init__(**properties)
        it = self.item
        cube = dict(it["base"])
        cube[it["kind"]] = it["i"]
        qb.QBP.face(self.dom_nodes["cv"], qb.js_value(cube), it["kind"], 128)
        self.opt.classes["on"] = bool(it.get("on"))
        state.set_attr(self.opt, "aria-pressed", "true" if it.get("on") else "false")
        state.set_attr(self.opt, "data-key", "%s-%d" % (it["kind"], it["i"]))
        state.set_attr(self.opt, "aria-label", "%s %s" % (it["name"], it["kind"]))

    def opt_click(self, event):
        panel = self.parent
        if panel is not None:
            panel.raise_event("x-face", kind=self.item["kind"], i=self.item["i"])
            state.refocus(panel, "%s-%d" % (self.item["kind"], self.item["i"]))
