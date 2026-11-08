from anvil import *

from ._anvil_designer import StickerTemplate
from ... import state


class Sticker(StickerTemplate):
    """A sticker (badge) on Cube Champs: bright when earned, dashed and grey when not. item = {name, how, emoji, got}."""

    def __init__(self, **properties):
        super().__init__(**properties)
        got = bool(self.item.get("got"))
        self.card.classes["yes"] = got
        self.card.classes["no"] = not got
        state.set_attr(self.card, "aria-label", "%s: %s (%s)" % (self.item["name"], self.item["how"], "earned" if got else "not yet"))
