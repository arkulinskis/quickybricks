from anvil import *

from ._anvil_designer import ChampRowTemplate


class ChampRow(ChampRowTemplate):
    """A leaderboard row. item = {rank, name, me, star (their best cube), value}."""

    def __init__(self, **properties):
        super().__init__(**properties)
        self.thumb.cube = self.item.get("star")
        self.name.text = self.item["name"] + (" (you!)" if self.item.get("me") else "")
        self.row.classes["me"] = bool(self.item.get("me"))
