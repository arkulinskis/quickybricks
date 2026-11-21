from anvil import *
import anvil.js

from ._anvil_designer import TuckCubeTemplate
from ... import qb


class TuckCube(TuckCubeTemplate):
    """A sleepy cube in the tuck-in dialog. item = {name, color, eyes, mouth, drawing, tucked}. Sleepy eyes until it's
    tapped, then closed eyes, a blanket and 💤; raises x-tuck on the panel."""

    def __init__(self, **properties):
        super().__init__(**properties)
        self.dom_nodes["nm"].textContent = self.item.get("name") or "Cube"
        self.dom_nodes["btn"].addEventListener("click", anvil.js.report_exceptions(self._click))
        self._draw()

    def _draw(self):
        it, b = self.item, self.dom_nodes["btn"]
        tucked = bool(it.get("tucked"))
        face = dict(it, eyes=11 if tucked else 3, mouth=0 if tucked else 3, hat="")  # 11 = closed eyes, 3 = sleepy
        qb.thumb(self.dom_nodes["cv"], face, 78)
        b.classList.toggle("on", tucked)
        b.setAttribute("aria-pressed", "true" if tucked else "false")
        name = it.get("name") or "Cube"
        b.setAttribute("aria-label", (name + " is tucked in") if tucked else ("Tuck in " + name))

    def _click(self, event):
        if self.item.get("tucked"):
            return
        self.item["tucked"] = True
        self._draw()
        qb.sfx("tuck")
        panel = self.parent
        if panel is not None:
            panel.raise_event("x-tuck")
