from anvil import *

from ._anvil_designer import DoodleTemplate


class Doodle(DoodleTemplate):
    """The doodle dialog of the landing playground (the Maker has the pad on the page). Closes with the doodle as a
    PNG data URL ("" = wiped clean), or None for Cancel."""

    def __init__(self, cube, **properties):
        super().__init__(**properties)
        self.pad.set_cube(cube)

    @handle("cancel_button", "click")
    def cancel_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)

    @handle("done_button", "click")
    def done_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=self.pad.data_url())
