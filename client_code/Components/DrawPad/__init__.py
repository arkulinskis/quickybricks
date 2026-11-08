from anvil import *
import anvil.js

from ._anvil_designer import DrawPadTemplate
from ... import qb


class DrawPad(DrawPadTemplate):
    """The doodle pad engine (QB.drawPad). The first set_cube() builds it; later calls repaint the colour and face
    under the doodle without losing it."""

    def __init__(self, **properties):
        self.pad = qb.NULL
        super().__init__(**properties)

    def set_cube(self, cube):
        c = qb.js_value({"color": cube.get("color"), "eyes": cube.get("eyes", 0), "mouth": cube.get("mouth", 0),
                         "drawing": cube.get("drawing") or ""})
        if self.pad is None:
            o = qb.js_value({})
            o.cube = c
            o.onChange = anvil.js.report_exceptions(self._changed)
            self.pad = qb.QB.drawPad(o)
            self.dom_nodes["host"].appendChild(self.pad.el)
        else:
            self.pad.setCube(c)

    def _changed(self):
        self.raise_event("drawn")

    def data_url(self):
        return str(self.pad.toDataURL()) if self.pad is not None else ""
