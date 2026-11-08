from anvil import *

from ._anvil_designer import SendOutTemplate


class SendOut(SendOutTemplate):
    """Pick one of my cubes at home to send out to the World. Closes with its id, or None."""

    def __init__(self, home, out, max_out, **properties):
        super().__init__(**properties)
        self.lead.text = "%d of %d of your cubes are in the World." % (out, max_out)
        self.pick_panel.items = home
        self.pick_panel.add_event_handler("x-pick", self._pick)

    def _pick(self, cube_id, **event_args):
        self.raise_event("x-close-alert", value=cube_id)

    @handle("cancel_button", "click")
    def cancel_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)
