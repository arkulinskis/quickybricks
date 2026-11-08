from anvil import *

from ._anvil_designer import SurpriseTemplate


class Surprise(SurpriseTemplate):
    """Babies born while the player was away (someone else's cube held hands with theirs). Shows the first one."""

    def __init__(self, babies, **properties):
        super().__init__(**properties)
        b = babies[0]
        par = b.get("parents") or []
        self.thumb.cube = b
        text = "Meet %s!" % b["name"]
        if len(par) == 2:
            text += " %s (%s) held hands with your %s." % (par[0]["name"], par[0]["owner"], par[1]["name"])
        self.meet.text = text
        n = len(babies) - 1
        self.more.visible = n > 0
        self.more.text = "…and %d more baby cube%s!" % (n, "s" if n > 1 else "")

    @handle("ok_button", "click")
    def ok_button_click(self, **event_args):
        self.raise_event("x-close-alert", value=True)
