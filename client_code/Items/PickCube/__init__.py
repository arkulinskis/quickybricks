from anvil import *

from ._anvil_designer import PickCubeTemplate


class PickCube(PickCubeTemplate):
    """A cube at home in the "Who's going out to play?" dialog. item = a tiny cube dict. Raises x-pick."""

    def __init__(self, **properties):
        super().__init__(**properties)

    def pick_click(self, event):
        panel = self.parent
        if panel is not None:
            panel.raise_event("x-pick", cube_id=self.item["id"])
