"""The Sparkle Shop: hats (any cube can wear one once you own it), toys for your Cubby, and supplies."""
import anvil.server

from . import common as C
from . import rules as R
from . import Cubes as CB


def _items(inv):
    out = []
    month = C.now().month
    for key, name, price, months in R.SEASONAL_HATS:
        if month in months or key in inv["hats"]:
            out.append({"key": key, "name": name, "price": price, "kind": "hat", "owned": key in inv["hats"],
                        "limited": True, "available": month in months})
    for kind, lst in (("hat", R.HATS), ("toy", R.TOYS), ("supply", R.SUPPLIES)):
        for key, name, price in lst:
            owned = (key in inv["hats"]) if kind == "hat" else (key in inv["toys"]) if kind == "toy" else int(inv.get(key, 0))
            out.append({"key": key, "name": name, "price": price, "kind": kind, "owned": owned, "limited": False, "available": True})
    return out


@anvil.server.callable(require_user=True)
def get_shop():
    me = CB.player(C.require_user())
    inv = CB.inventory(me)
    return {"sparkles": me["sparkles"] or 0, "items": _items(inv), "inventory": inv}


@anvil.server.callable(require_user=True)
def buy(key):
    me = CB.player(C.require_user())
    if key not in R.PRICES:
        return C.fail("That's not in the shop.")
    inv = CB.inventory(me)
    if (key in R.HAT_KEYS and key in inv["hats"]) or (key in R.TOY_KEYS and key in inv["toys"]):
        return C.fail("You already have it!")
    if not R.in_season(key, C.now().month):
        return C.fail("That one is only in the shop at a special time of year!")
    price = R.PRICES[key]
    if (me["sparkles"] or 0) < price:
        return C.fail("You need %d more sparkles. Roll your cubes to earn some!" % (price - (me["sparkles"] or 0)))
    if C.rate_limited("buy", 30, 600):
        return C.fail("So much shopping! Try again in a bit.")
    if key in R.HAT_KEYS:
        inv["hats"] = inv["hats"] + [key]
    elif key in R.TOY_KEYS:
        inv["toys"] = inv["toys"] + [key]
    else:
        inv[key] = int(inv.get(key, 0)) + 1
    me["inventory"] = inv
    CB.add_sparkles(me, -price)
    return C.ok(sparkles=me["sparkles"], items=_items(inv), inventory=inv)
