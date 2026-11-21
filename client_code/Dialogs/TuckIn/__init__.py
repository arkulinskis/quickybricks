from anvil import *

from ._anvil_designer import TuckInTemplate
from ... import bedtime, moves, qb, state


class TuckIn(TuckInTemplate):
    """Bedtime (the play timer ran out; client_code/bedtime.py). A starry dialog with up to 6 sleepy cubes
    (Items/TuckCube): the child taps each one to tuck it in. When all are in bed the music fades, "Goodnight, cubes!"
    and the Goodnight button closes it (then the sleep screen covers the game). Not dismissible.
    cubes = [{name, color, eyes, mouth, drawing}], note = what tomorrow brings (the Dream gift)."""

    def __init__(self, cubes, note, **properties):
        super().__init__(**properties)
        self.cubes = [dict(c, tucked=False) for c in (cubes or [])[:6]]
        self.note = note or ""
        state.heading(self.title, 2)
        self.title.text = "🌙 Bedtime, cubes!"
        self.lead.text = "The cubes are so sleepy. Tap each one to tuck it in." if len(self.cubes) > 1 else \
            "%s is so sleepy. Tap it to tuck it in." % (self.cubes[0]["name"] if self.cubes else "Your cube")
        self.cubes_panel.items = self.cubes
        self.cubes_panel.add_event_handler("x-tuck", self._tucked)
        self.dream_label.visible = False
        self.night_button.visible = False
        moves.say_if("Bedtime, cubes! " + self.lead.text)

    def _tucked(self, **event_args):
        if any(not c.get("tucked") for c in self.cubes):
            return
        self.title.text = "Goodnight, cubes! 💤"
        self.lead.text = "Everyone is snug in bed. See you tomorrow!"
        self.dream_label.text = self.note
        self.dream_label.visible = bool(self.note)
        self.night_button.visible = True
        qb.sfx("night")
        bedtime.lights_out()
        moves.say_if("Goodnight, cubes! " + self.note)

    @handle("night_button", "click")
    def night_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=True)
