from anvil import *

from ._anvil_designer import BabyTemplate
from ... import qb, state


class Baby(BabyTemplate):
    """POP! The baby two cubes just made by holding hands. Closes with "meet" (open its card) or None."""

    def __init__(self, result, **properties):
        super().__init__(**properties)
        b = result["baby"]
        self.title.text = "POP! It's %s!" % b["name"]
        state.heading(self.title, 2)
        self.thumb.cube = b
        self.looks.text = "%s eyes, %s mouth, %s colour. Generation %d!" % (
            qb.eyes()[int(b["eyes"])], qb.mouths()[int(b["mouth"])].lower(), b["color_name"], b["gen"])
        self.twins.visible = bool(result.get("twin"))
        self.twins.text = "👯 Twins! %s got a baby too." % (result.get("partner_owner") or "Your friend")
        self.grow.text = "It's in your Cubby. Roll it %d times to grow it up. +10 ✨" % int(qb.QB.GROW_ROLLS)
        self.meet_button.text = "Meet " + b["name"]

    @handle("keep_button", "click")
    def keep_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)

    @handle("meet_button", "click")
    def meet_button_click(self, **event_args):
        self.raise_event("x-close-alert", value="meet")
