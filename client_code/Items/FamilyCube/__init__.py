from anvil import *

from ._anvil_designer import FamilyCubeTemplate
from ... import router, state


class FamilyCube(FamilyCubeTemplate):
    """A parent, grandparent or baby on the cube card: links to that cube's card. item = a tiny cube dict."""

    def __init__(self, **properties):
        super().__init__(**properties)
        state.set_attr(self.link, "href", router.href("cube", self.item["id"]))
        self.meta.text = "%s · Gen %d" % (self.item.get("owner") or "", self.item.get("gen") or 1)
