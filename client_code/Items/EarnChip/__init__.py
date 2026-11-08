from anvil import *

from ._anvil_designer import EarnChipTemplate


class EarnChip(EarnChipTemplate):
    """One way to earn sparkles (Shop). item = {text}."""

    def __init__(self, **properties):
        super().__init__(**properties)
