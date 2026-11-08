from anvil import *

from ._anvil_designer import SwatchTemplate
from ... import state


class Swatch(SwatchTemplate):
    """A colour to pick (landing playground, Maker). item = {hex, name, on}; a click raises x-color on the panel."""

    def __init__(self, **properties):
        super().__init__(**properties)
        self.swatch.style["background"] = self.item["hex"]
        self.swatch.classes["on"] = bool(self.item.get("on"))
        state.set_attr(self.swatch, "aria-label", self.item["name"])
        state.set_attr(self.swatch, "title", self.item["name"])
        state.set_attr(self.swatch, "aria-pressed", "true" if self.item.get("on") else "false")
        state.set_attr(self.swatch, "data-key", self.item["hex"])

    def swatch_click(self, event):
        panel = self.parent
        if panel is not None:
            panel.raise_event("x-color", hex=self.item["hex"])
            state.refocus(panel, self.item["hex"])
