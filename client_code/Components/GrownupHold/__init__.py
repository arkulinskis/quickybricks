from anvil import *
import anvil.js
from anvil.js import window

from ._anvil_designer import GrownupHoldTemplate
from ... import qb

HOLD_MS = 3000
KEYS = (" ", "Enter", "Spacebar")


class GrownupHold(GrownupHoldTemplate):
    """Press and hold for 3 seconds to raise `held`: the grown-up check for the play timer and the sleep screen (the
    user wanted a simple grown-up check, not a stored PIN). Letting go, sliding off or losing focus cancels."""

    def __init__(self, **properties):
        self._text = "Grown-ups: hold for 3 seconds"
        self._timer = None
        self._ready = False
        super().__init__(**properties)
        self._ready = True
        self._paint()
        b = self.dom_nodes["btn"]
        stop = anvil.js.report_exceptions(self._stop)
        b.addEventListener("pointerdown", anvil.js.report_exceptions(self._start))
        for kind in ("pointerup", "pointercancel", "lostpointercapture", "blur"):
            b.addEventListener(kind, stop)
        b.addEventListener("keydown", anvil.js.report_exceptions(self._key_down))
        b.addEventListener("keyup", anvil.js.report_exceptions(self._key_up))
        b.addEventListener("contextmenu", anvil.js.report_exceptions(self._no_menu))

    @property
    def text(self):
        return self._text

    @text.setter
    def text(self, value):
        self._text = value or ""
        self._paint()

    def _paint(self):
        if self._ready:
            self.dom_nodes["txt"].textContent = self._text

    def focus(self):
        getattr(self.dom_nodes["btn"], "focus")()

    # ---- holding
    def _start(self, event=None):
        if self._timer is not None:
            return
        b = self.dom_nodes["btn"]
        if event is not None and getattr(event, "pointerId", None) is not None:
            try:
                b.setPointerCapture(event.pointerId)  # a wobbly finger doesn't cancel the hold
            except Exception:
                pass
        b.classList.add("holding")
        self._timer = window.setTimeout(self._fire, HOLD_MS)

    def _stop(self, event=None):
        if self._timer is not None:
            window.clearTimeout(self._timer)
            self._timer = None
        self.dom_nodes["btn"].classList.remove("holding")

    def _fire(self):
        self._timer = None
        self.dom_nodes["btn"].classList.remove("holding")
        qb.sfx("pop")
        self.raise_event("held")

    def _key_down(self, event):
        if getattr(event, "key", None) in KEYS:
            event.preventDefault()
            if not getattr(event, "repeat", False):
                self._start()

    def _key_up(self, event):
        if getattr(event, "key", None) in KEYS:
            self._stop()

    def _no_menu(self, event):
        event.preventDefault()  # a long press on a phone would open the browser's menu
