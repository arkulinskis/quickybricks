from anvil import *
import anvil.js

from ._anvil_designer import HatButtonTemplate
from ... import state


class HatButton(HatButtonTemplate):
    """A hat in the cube card's wardrobe. item = {key ("" = no hat), emoji, name, on}. A click raises x-hat."""

    def __init__(self, **properties):
        super().__init__(**properties)
        anvil.js.get_dom_node(self.hat).textContent = self.item["emoji"]
        self.hat.classes["on"] = bool(self.item.get("on"))
        state.set_attr(self.hat, "aria-label", self.item["name"])
        state.set_attr(self.hat, "title", self.item["name"])
        state.set_attr(self.hat, "aria-pressed", "true" if self.item.get("on") else "false")
        state.set_attr(self.hat, "data-key", self.item["key"] or "none")

    def hat_click(self, event):
        panel = self.parent
        if panel is not None:
            panel.raise_event("x-hat", key=self.item["key"])
            state.refocus(panel, self.item["key"] or "none")
