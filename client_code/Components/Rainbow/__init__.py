from anvil import *
import anvil.js

from ._anvil_designer import RainbowTemplate
from ... import qb, state


class Rainbow(RainbowTemplate):
    """Rainbow Roll progress: the six sides, lit when they were on top in the last six rolls (the old QB.rainbowHtml)."""

    def __init__(self, **properties):
        self._recent, self._ready = "", False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if not self._ready:
            return
        have = str(self._recent or "")
        events = qb.events()
        spans = [self.s0, self.s1, self.s2, self.s3, self.s4, self.s5]
        lit = 0
        for i, el in enumerate(spans):
            on = str(i) in have
            lit += 1 if on else 0
            el.classes["on"] = on
            anvil.js.get_dom_node(el).textContent = events[i]["emoji"]
        state.set_attr(self.row, "aria-label", "Rainbow Roll: %d of 6 sides landed in the last six rolls" % lit)

    @property
    def recent(self):
        return self._recent

    @recent.setter
    def recent(self, value):
        self._recent = value or ""
        self._draw()
