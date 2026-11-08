from anvil import *
import anvil.js

from ._anvil_designer import EmojiKeyTemplate
from ... import state


class EmojiKey(EmojiKeyTemplate):
    """An emoji key under the World chat box. item = {e}. A click raises x-emoji(e)."""

    def __init__(self, **properties):
        super().__init__(**properties)
        anvil.js.get_dom_node(self.key).textContent = self.item["e"]
        state.set_attr(self.key, "aria-label", "Add " + self.item["e"])

    def key_click(self, event):
        panel = self.parent
        if panel is not None:
            panel.raise_event("x-emoji", e=self.item["e"])
