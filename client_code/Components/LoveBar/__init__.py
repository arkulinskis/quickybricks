from anvil import *

from ._anvil_designer import LoveBarTemplate
from ... import state


class LoveBar(LoveBarTemplate):
    """Love 0-100 as a pink bar (the old QB.loveBar)."""

    def __init__(self, **properties):
        self._love, self._ready = 0, False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if not self._ready:
            return
        v = max(0, min(100, int(self._love or 0)))
        self.fill.style["width"] = "%d%%" % v
        state.set_attr(self.bar, "aria-label", "Love %d out of 100" % v)

    @property
    def love(self):
        return self._love

    @love.setter
    def love(self, value):
        self._love = value or 0
        self._draw()
