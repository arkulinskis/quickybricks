from anvil import *
import anvil.js

from ._anvil_designer import StageTemplate
from ... import qb


class Stage(StageTemplate):
    """One 3D stage (QBP.hero / QBP.cubby / QBP.world in theme/assets/qb-play.js).

        self.stage.mount("hero", cube, {"guest": True, "onResult": fn}, pad=self.dom_nodes["pad"])

    `data` and plain options go to JS as JSON; options whose value is a Python function become hooks the engine calls
    (with JSON text); `pad` is the element the d-pad goes into. The controller is `self.ctl` (setData, select, sync...).
    Browsers allow ~16 WebGL contexts, so the stage is always destroyed when the page goes (hide)."""

    def __init__(self, **properties):
        self.ctl = qb.NULL
        self._look = ""
        self._pending: list = []
        self._shown = False
        super().__init__(**properties)
        self._paint_look()

    @property
    def look(self):
        return self._look

    @look.setter
    def look(self, value):
        self._look = value or ""
        self._paint_look()

    def _paint_look(self):
        nodes = getattr(self, "dom_nodes", None)  # the setter can run before the template exists
        if nodes is not None and "host" in nodes:
            nodes["host"].className = ("qb-host " + self._look).strip()

    def mount(self, kind, data, hooks=None, pad=None):
        self._pending = [kind, data, hooks or {}, pad]
        if self._shown:
            self._start()

    def _start(self):
        self.destroy()
        if not self._pending:
            return
        kind, data, hooks, pad = self._pending
        host = self.dom_nodes["host"]
        host.innerHTML = ""
        if pad is not None:
            pad.innerHTML = ""
        plain = {k: v for k, v in hooks.items() if not callable(v)}
        o = qb.js_value(plain)
        for k, v in hooks.items():
            if callable(v):
                setattr(o, k, anvil.js.report_exceptions(v))
        if pad is not None:
            o.pad = pad
        if kind == "hero":
            self.ctl = qb.QBP.hero(host, qb.js_value(data), o)
        elif kind == "cubby":
            self.ctl = qb.QBP.cubby(host, qb.js_value(data), o)
        else:
            self.ctl = qb.QBP.world(host, qb.js_value(data), o)

    @handle("", "show")
    def form_show(self, **event_args):
        self._shown = True
        self._start()

    @handle("", "hide")
    def form_hide(self, **event_args):
        self._shown = False
        self.destroy()

    def destroy(self):
        if self.ctl is not None:
            self.ctl.destroy()
            self.ctl = qb.NULL

    def live(self):
        """True while a controller is running (pages call ctl methods only then)."""
        return self.ctl is not None
