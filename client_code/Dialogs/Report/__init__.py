from anvil import *

from ._anvil_designer import ReportTemplate
from ... import state


class Report(ReportTemplate):
    """Report another player's cube (rude drawing, rude name, something else): report_cube, then a thank-you."""

    def __init__(self, cube, **properties):
        super().__init__(**properties)
        self.cube = cube
        self.title.text = "Report %s?" % cube["name"]
        state.heading(self.title, 2)

    def _send(self, reason):
        if state.call("report_cube", self.cube["id"], reason):
            state.toast("Thanks! A moderator will check it.", "ok")
            self.raise_event("x-close-alert", value=True)

    @handle("drawing_button", "click")
    def drawing_button_click(self, **event_args):
        self._send("drawing")

    @handle("name_button", "click")
    def name_button_click(self, **event_args):
        self._send("name")

    @handle("other_button", "click")
    def other_button_click(self, **event_args):
        self._send("other")

    @handle("cancel_button", "click")
    def cancel_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)
