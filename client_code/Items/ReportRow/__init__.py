from anvil import *

from ._anvil_designer import ReportRowTemplate
from ... import router, state


class ReportRow(ReportRowTemplate):
    """An open report in Admin -> Reports. item = {id, reason, created, reporter, cube (+ owner_email)}. Each action
    calls admin_resolve and raises x-changed so the list reloads."""

    def __init__(self, **properties):
        super().__init__(**properties)
        r, c = self.item, self.item["cube"]
        self.thumb.cube = c
        self.reason.text = r["reason"]
        self.by.text = "by %s · %s" % (r["reporter"], state.short_date(r["created"]))
        self.cube_name.text = c["name"]
        state.set_attr(self.cube_link, "href", router.href("cube", c["id"]))
        self.owner.text = "Owner: %s (%s)%s" % (c.get("owner") or "", c.get("owner_email") or "", " · in the World" if c.get("in_world") else "")

    def _act(self, action):
        if state.call("admin_resolve", self.item["id"], action):
            state.toast("Done", "ok")
            panel = self.parent
            if panel is not None:
                panel.raise_event("x-changed")

    @handle("wipe_button", "click")
    def wipe_button_click(self, **event_args):
        self._act("wipe")

    @handle("rename_button", "click")
    def rename_button_click(self, **event_args):
        self._act("rename")

    @handle("home_button", "click")
    def home_button_click(self, **event_args):
        self._act("home")

    @handle("dismiss_button", "click")
    def dismiss_button_click(self, **event_args):
        self._act("dismiss")
