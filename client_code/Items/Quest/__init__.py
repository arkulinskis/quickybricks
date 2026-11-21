from anvil import *

from ._anvil_designer import QuestTemplate
from ... import moves, state


class Quest(QuestTemplate):
    """One of today's three quests. item = {key, text, goal, progress, done, claimed, sparkles, emoji}. Claim raises
    x-claim on the panel."""

    def __init__(self, **properties):
        super().__init__(**properties)
        it = self.item
        pct = int(round(100.0 * it["progress"] / max(1, it["goal"])))
        self.fill.style["width"] = "%d%%" % min(100, pct)
        state.set_attr(self.bar, "aria-label", "%d of %d" % (it["progress"], it["goal"]))
        self.count.text = "%d / %d" % (it["progress"], it["goal"])
        self.row.classes["claimed"] = bool(it.get("claimed"))
        self.got.visible = bool(it.get("claimed"))
        self.claim_button.visible = not it.get("claimed")
        self.claim_button.text = "✨ %d" % it["sparkles"]
        self.claim_button.enabled = bool(it.get("done"))
        self.claim_button.role = ["btn", "btn-sm", "btn-lemon"] if it.get("done") else ["btn", "btn-sm"]
        state.set_control_attr(self.claim_button, "aria-label", "Claim %d sparkles" % it["sparkles"])
        self.say_button.visible = moves.readaloud()  # Read to me: tap 🔊 to hear the quest
        state.set_control_attr(self.say_button, "aria-label", "Read this quest out loud")

    @handle("say_button", "click")
    def say_button_click(self, **event_args):
        it = self.item
        moves.say("%s. %d of %d done." % (it["text"], it["progress"], it["goal"]))

    @handle("claim_button", "click")
    def claim_button_click(self, **event_args):
        panel = self.parent
        if panel is not None:
            self.claim_button.enabled = False
            panel.raise_event("x-claim", key=self.item["key"])
