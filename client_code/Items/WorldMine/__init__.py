from anvil import *

from ._anvil_designer import WorldMineTemplate
from ... import state


class WorldMine(WorldMineTemplate):
    """One of my cubes out in the World (the list on the right). item = a World cube dict + on. Raises x-pick."""

    def __init__(self, **properties):
        super().__init__(**properties)
        c = self.item
        self.love.love = c["love"]
        self.love.visible = bool(c["grown"])
        self.baby.visible = not c["grown"]
        self.mood.text = "💤" if c.get("nap") else "💖" if c["love"] >= 100 and c["grown"] else ""
        self.row.classes["on"] = bool(c.get("on"))
        state.set_attr(self.row, "aria-pressed", "true" if c.get("on") else "false")
        state.set_attr(self.row, "data-key", c["id"])

    def row_click(self, event):
        panel = self.parent
        if panel is not None:
            panel.raise_event("x-pick", cube_id=self.item["id"])
            state.refocus(panel, self.item["id"])
