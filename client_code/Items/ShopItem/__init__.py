from anvil import *

from ._anvil_designer import ShopItemTemplate
from ... import state


class ShopItem(ShopItemTemplate):
    """One thing in the Sparkle Shop. item = {key, kind (hat/toy/supply), name, price, owned, limited, emoji, about,
    bg, afford}. Buy raises x-buy."""

    def __init__(self, **properties):
        super().__init__(**properties)
        it = self.item
        state.heading(self.name, 3)
        self.card.classes["limited"] = bool(it.get("limited"))
        self.limited.visible = bool(it.get("limited"))
        self.em.style["background"] = it["bg"]
        if it.get("limited"):
            about = "Only in the shop this time of year"
        elif it["kind"] == "hat":
            about = "Any of your cubes can wear it"
        elif it["kind"] == "toy":
            about = "Goes in your Cubby"
        else:
            about = "%s You have %d." % (it.get("about") or "", int(it.get("owned") or 0))
        self.about.text = about
        owned = it["kind"] != "supply" and bool(it.get("owned"))
        self.owned.visible = owned
        self.buy_button.visible = not owned
        self.buy_button.text = "✨ %d" % it["price"]
        self.buy_button.role = ["btn", "btn-sm", "btn-lemon"] if it.get("afford") else ["btn", "btn-sm"]
        self.buy_button.tooltip = "" if it.get("afford") else "Not enough sparkles yet"
        state.set_control_attr(self.buy_button, "aria-label", "Buy %s for %d sparkles" % (it["name"], it["price"]))

    @handle("buy_button", "click")
    def buy_button_click(self, **event_args):
        panel = self.parent
        if panel is not None:
            panel.raise_event("x-buy", key=self.item["key"])
