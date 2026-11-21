from anvil import *

from ._anvil_designer import TogetherBarTemplate
from ... import moves, state


class TogetherBar(TogetherBarTemplate):
    """Play together / Read to me toggles and the two names (Landing, Cubby, cube card). Saves straight into this
    browser (moves.py) and raises `changed` so a page can redraw what depends on it (the Cubby's quest 🔊 buttons)."""

    def __init__(self, **properties):
        super().__init__(**properties)
        for box, label in ((self.kid_box, "The little one's name"), (self.grown_box, "The grown-up's name")):
            state.set_control_attr(box, "aria-label", label)
            state.set_control_attr(box, "maxlength", moves.NAME_MAX)
            state.set_control_attr(box, "autocomplete", "off")
        n = moves.names()
        self.kid_box.text = "" if n["kid"] == moves.KID else n["kid"]
        self.grown_box.text = "" if n["grown"] == moves.GROWN else n["grown"]
        self.read_button.visible = moves.can_say()
        self._paint()

    def _paint(self):
        on, read = moves.together(), moves.readaloud()
        self.together_button.text = "👨‍👧 Play together" + (" ✓" if on else "")
        self.read_button.text = "🗣️ Read to me" + (" ✓" if read else "")
        state.set_control_attr(self.together_button, "aria-pressed", "true" if on else "false")
        state.set_control_attr(self.read_button, "aria-pressed", "true" if read else "false")
        self.together_button.tooltip = "Every roll shows a Silly Move for the little one and the grown-up, taking turns"
        self.read_button.tooltip = "Reads the cards, messages and quests out loud"
        self.names_row.visible = on

    @handle("together_button", "click")
    def together_button_click(self, **event_args):
        on = not moves.together()
        moves.set_together(on)
        self._paint()
        if on:
            state.toast("👨‍👧 Play together is on! Roll the cube: whatever lands on top, do its Silly Move.", "ok")
        self.raise_event("changed")

    @handle("read_button", "click")
    def read_button_click(self, **event_args):
        on = not moves.readaloud()
        moves.set_readaloud(on)
        self._paint()
        if on:
            moves.say("Read to me is on! I'll read the cards out loud.")  # inside the tap: lets phones speak later
        self.raise_event("changed")

    @handle("kid_box", "change")
    def kid_box_change(self, **event_args):
        moves.set_names(self.kid_box.text, self.grown_box.text)

    @handle("grown_box", "change")
    def grown_box_change(self, **event_args):
        moves.set_names(self.kid_box.text, self.grown_box.text)
