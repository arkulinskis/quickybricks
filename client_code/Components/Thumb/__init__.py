from anvil import *

from ._anvil_designer import ThumbTemplate
from ... import qb


class Thumb(ThumbTemplate):
    """A cube thumbnail drawn on a canvas by the engine (QB.drawThumb). Set `cube` (and `size`) and it redraws."""

    def __init__(self, **properties):
        self._cube, self._size, self._ready = None, 74, False
        super().__init__(**properties)
        self._ready = True
        self._draw()

    def _draw(self):
        if self._ready:
            qb.thumb(self.dom_nodes["cv"], self._cube, int(self._size or 74))

    @property
    def cube(self):
        return self._cube

    @cube.setter
    def cube(self, value):
        self._cube = value
        self._draw()

    @property
    def size(self):
        return self._size

    @size.setter
    def size(self, value):
        self._size = value or 74
        self._draw()
