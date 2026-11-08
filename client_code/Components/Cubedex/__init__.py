from anvil import *

from ._anvil_designer import CubedexTemplate
from ... import qb


class Cubedex(CubedexTemplate):
    """The Cubedex grid: 100 painted faces drawn by the engine (QBP.cubedex)."""

    def __init__(self, **properties):
        self._faces, self._ready = [], False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if self._ready:
            qb.QBP.cubedex(self.dom_nodes["grid"], qb.js_value(list(self._faces or [])))

    @property
    def faces(self):
        return self._faces

    @faces.setter
    def faces(self, value):
        self._faces = value or []
        self._draw()
