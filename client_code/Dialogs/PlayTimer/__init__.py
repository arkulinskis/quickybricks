from anvil import *

from ._anvil_designer import PlayTimerTemplate


class PlayTimer(PlayTimerTemplate):
    """The ⏰ header button (client_code/bedtime.py). No timer: pick 10/15/20/30 minutes. A timer running: how long is
    left; changing or stopping it is behind the grown-up hold (Components/GrownupHold), which also shows "Bedtime now"
    and a link for grown-ups to Little Hero Books. Closes with {"set": n}, {"stop": True}, {"now": True} or None.
    info = {running, left_min, ends_at}."""

    def __init__(self, info, **properties):
        super().__init__(**properties)
        self.info = info
        running = bool(info.get("running"))
        self.run_part.visible = running
        self.grown_part.visible = False
        self.pick_part.visible = not running
        self.pick_lead.text = "How long shall we play today?"
        if running:
            n = int(info.get("left_min") or 0)
            self.left_label.text = "%d minute%s left" % (n, "" if n == 1 else "s")
            self.ends_label.text = ("The cubes go to bed at %s." % info["ends_at"]) if info.get("ends_at") else ""

    @handle("hold", "held")
    def hold_held(self, **event_args):
        self.run_part.visible = False
        self.grown_part.visible = True
        self.pick_part.visible = True
        self.pick_lead.text = "Or start again with a new time:"

    def _set(self, n):
        self.raise_event("x-close-alert", value={"set": n})

    @handle("m10", "click")
    def m10_click(self, **event_args):
        self._set(10)

    @handle("m15", "click")
    def m15_click(self, **event_args):
        self._set(15)

    @handle("m20", "click")
    def m20_click(self, **event_args):
        self._set(20)

    @handle("m30", "click")
    def m30_click(self, **event_args):
        self._set(30)

    @handle("stop_button", "click")
    def stop_button_click(self, **event_args):
        self.raise_event("x-close-alert", value={"stop": True})

    @handle("now_button", "click")
    def now_button_click(self, **event_args):
        self.raise_event("x-close-alert", value={"now": True})

    @handle("close_button", "click")
    def close_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=None)
