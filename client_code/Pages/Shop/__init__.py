from anvil import *

from ._anvil_designer import ShopTemplate
from ... import qb, state

BG = ["#ffe0ee", "#d4f7f2", "#fff0c2", "#e3f1ff", "#efe6ff"]


class Shop(ShopTemplate):
    """#shop: the Sparkle Shop (get_shop, buy). Hats (owned once, any cube can wear them: the cube card's wardrobe),
    toys (appear around the Cubby play mat) and supplies (Love Potion, Wake-Up Whistle; used on the cube card)."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        for p in (self.hats_panel, self.toys_panel, self.supplies_panel):
            p.add_event_handler("x-buy", self._buy)
        earn = ["%s %s: +%d" % (e["emoji"], e["label"].rstrip("!"), qb.guest_reward(e["key"])["sparkles"]) for e in qb.events()]
        earn += ["🎁 Daily gift: +15 or more", "🍼 A new baby: +10", "🌱 A baby grows up: +10"]
        self.earn_panel.items = [{"text": t} for t in earn]
        self.data = qb.loose(state.call("get_shop") or {"sparkles": 0, "items": []})
        self._draw()

    def _draw(self):
        d = self.data
        self.sparkles.text = "✨ %d" % d["sparkles"]
        meta = {"hat": qb.hats(), "toy": qb.py_value(qb.QB.TOYS), "supply": qb.py_value(qb.QB.SUPPLIES)}
        panels = {"hat": self.hats_panel, "toy": self.toys_panel, "supply": self.supplies_panel}
        lists: dict = {"hat": [], "toy": [], "supply": []}
        for it in d["items"]:
            m = meta[it["kind"]].get(it["key"]) or [it["name"], "✨", ""]
            n = len(lists[it["kind"]])
            lists[it["kind"]].append(dict(it, emoji=m[1], about=m[2] if len(m) > 2 else "", bg=BG[n % len(BG)],
                                          afford=d["sparkles"] >= it["price"]))
        for kind, panel in panels.items():
            panel.items = lists[kind]

    def _buy(self, key, **event_args):
        r = state.call("buy", key)
        if r:
            self.data["sparkles"], self.data["items"] = r["sparkles"], r["items"]
            self._draw()
            qb.confetti(50)
            qb.sfx("golden")
            state.toast("Yay! You got it! 🎉", "ok")
