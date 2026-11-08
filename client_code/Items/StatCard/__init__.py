from anvil import *

from ._anvil_designer import StatCardTemplate


class StatCard(StatCardTemplate):
    """A number with a caption (Champs: my numbers). item = {value, label}."""

    def __init__(self, **properties):
        super().__init__(**properties)
