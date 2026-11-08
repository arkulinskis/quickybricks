from anvil import *

from ._anvil_designer import CubeCardTemplate
from ... import router, state


class CubeCard(CubeCardTemplate):
    """Another player's cube in the World: who it is, why my cube can't hold hands with it yet (or that it can), a link
    to its card. Closes with "hold" when Hold hands is pressed."""

    def __init__(self, cube, mine, why, **properties):
        super().__init__(**properties)
        self.thumb.cube = cube
        self.title.text = cube["name"]
        state.heading(self.title, 2)
        self.whose.text = "%s's cube · Gen %d" % (cube.get("owner") or "Someone", cube.get("gen") or 1)
        self.why.text = why
        self.why.visible = bool(why)
        self.can.visible = not why
        if not why:
            self.can.text = "💞 %s and %s can hold hands! You'll both get a baby%s." % (
                mine.get("name", ""), cube["name"], "" if cube.get("demo") else " (twins!)")
        self.hold_button.enabled = not why
        state.set_attr(self.card_link, "href", router.href("cube", cube["id"]))

    def card_click(self, event):
        self.raise_event("x-close-alert", value=None)

    @handle("hold_button", "click")
    def hold_button_click(self, **event_args):
        self.raise_event("x-close-alert", value="hold")
