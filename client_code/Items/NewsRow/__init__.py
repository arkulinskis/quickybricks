from anvil import *

from ._anvil_designer import NewsRowTemplate
from ... import state


class NewsRow(NewsRowTemplate):
    """A happening in the World (a birth, a golden moment, an egg). item = {text, data {color}, at}."""

    def __init__(self, **properties):
        super().__init__(**properties)
        self.dot.style["background"] = (self.item.get("data") or {}).get("color") or "#ff5fa2"
        self.when.text = state.ago(self.item.get("at"))
