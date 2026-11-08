from anvil import *
from anvil.js import window

from ._anvil_designer import LegendChipTemplate


class LegendChip(LegendChipTemplate):
    """One of the six sides under the playground cube. item = an event dict (key, emoji, label); flash() lights it up
    when that side lands on top."""

    def __init__(self, **properties):
        super().__init__(**properties)
        self.label.text = self.item["emoji"] + " " + self.item["label"].rstrip("!")

    def flash(self):
        self.chip.classes["hit"] = True
        window.setTimeout(self._off, 1400)

    def _off(self):
        self.chip.classes["hit"] = False
