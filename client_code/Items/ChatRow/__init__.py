from anvil import *

from ._anvil_designer import ChatRowTemplate
from ... import state


class ChatRow(ChatRowTemplate):
    """A chat message still around (Admin -> Chat). item = {id, text, who, email, at}. Delete raises x-changed."""

    def __init__(self, **properties):
        super().__init__(**properties)
        self.who.text = "%s · %s" % (self.item["who"], self.item.get("email") or "")
        self.when.text = state.ago(self.item.get("at"))
        state.set_control_attr(self.delete_button, "aria-label", "Delete " + self.item["text"])

    @handle("delete_button", "click")
    def delete_button_click(self, **event_args):
        if state.call("admin_delete_chat", self.item["id"]):
            panel = self.parent
            if panel is not None:
                panel.raise_event("x-changed")
