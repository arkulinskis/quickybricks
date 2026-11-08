from anvil import *

from ._anvil_designer import ChampsTemplate
from ... import state

MEDALS = ["🥇", "🥈", "🥉"]


class Champs(ChampsTemplate):
    """#champs: Cube Champs (get_champs). Leaderboard by number of cubes, biggest families (highest generation), my
    numbers, my stickers and the Cubedex (Components/Cubedex: all 10 eyes x 10 mouths, owned faces painted)."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        d = state.call("get_champs")
        if not d:
            return
        self.rank.text = "Who has the most cubes? " + ("You're number %d of %d!" % (d["rank"], d["players"]) if d["rank"]
                                                       else "Make a cube to join in!")
        self.most_panel.items = [dict(b, rank=MEDALS[i] if i < 3 else str(i + 1), value="🧊 %d" % b["cubes"]) for i, b in enumerate(d["most"])]
        self.nobody.visible = not d["most"]
        self.families_panel.items = [dict(b, rank=MEDALS[i] if i < 3 else str(i + 1), value="Gen %d" % b["gen"]) for i, b in enumerate(d["families"])]
        m = d["me"]
        self.stats_panel.items = [{"value": "🧊 %d" % m["cubes"], "label": "cubes"}, {"value": "🎲 %d" % m["rolls"], "label": "rolls"},
                                  {"value": "🌳 Gen %d" % m["gen"], "label": "oldest family"},
                                  {"value": "🌟 %d" % m["golden"], "label": "golden moments"}]
        got = len([s for s in d["stickers"] if s["got"]])
        self.stickers_count.text = "%d/%d" % (got, len(d["stickers"]))
        self.stickers_panel.items = d["stickers"]
        self.faces_count.text = "%d/100 faces" % len(d["faces"])
        self.dex.faces = d["faces"]
