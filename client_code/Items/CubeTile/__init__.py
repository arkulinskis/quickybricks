from anvil import *

from ._anvil_designer import CubeTileTemplate
from ... import state


class CubeTile(CubeTileTemplate):
    """A cube under the Cubby mat. item = a cube dict + on (picked). A click raises x-pick on the panel."""

    def __init__(self, **properties):
        super().__init__(**properties)
        c = self.item
        self.meta.text = ("Gen %d" % c["gen"] if c["grown"] else "🍼 baby") + (" · 🏝️" if c.get("in_world") else "") + (" · 💤" if c.get("nap") else "")
        self.tile.classes["on"] = bool(c.get("on"))
        state.set_attr(self.tile, "aria-pressed", "true" if c.get("on") else "false")
        state.set_attr(self.tile, "data-key", c["id"])

    def tile_click(self, event):
        panel = self.parent
        if panel is not None:
            panel.raise_event("x-pick", cube_id=self.item["id"])
            state.refocus(panel, self.item["id"])
