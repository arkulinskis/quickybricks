from anvil import *

from ._anvil_designer import SideCardTemplate
from ... import state


class SideCard(SideCardTemplate):
    """One of the six sides on the landing page. item = an event dict (emoji, side, label, text, color)."""

    def __init__(self, **properties):
        super().__init__(**properties)
        self.em.style["background"] = self.item["color"]
        state.heading(self.title, 3)
