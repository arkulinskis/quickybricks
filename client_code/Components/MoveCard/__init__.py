from anvil import *
from anvil.js import window

from ._anvil_designer import MoveCardTemplate
from ... import moves, qb

HIDE_MS = 8000          # the card hides by itself after this (longer while Read to me speaks)
DONE_MS = 1300          # after Done: show who's next, then hide


class MoveCard(MoveCardTemplate):
    """Play Together mode: the Silly Move card over a 3D stage (Landing, Cubby, cube card). The page calls
    show_for(result) from its roll hook. With Play together off it only reads the side out (Read to me).
    Every card goes to the next player: Done, the card hiding by itself, or a new roll all pass the turn on."""

    def __init__(self, **properties):
        self._hide_t = None
        self._open = False
        super().__init__(**properties)
        self.dom_nodes["card"].setAttribute("hidden", "")

    # ---- showing a card
    def show_for(self, res):
        res = res or {}
        if res.get("ok") is False:
            return
        if not moves.together():
            label = (qb.events_by_key().get(res.get("event")) or {}).get("label")
            if label:
                moves.say_if(label)
            return
        if self._open:
            moves.flip()  # the last card wasn't finished: the next player gets this one
        card = moves.pick(res)
        n = self.dom_nodes
        n["em"].textContent = card["emoji"]
        n["label"].textContent = card["label"]
        n["text"].textContent = card["text"]
        n["turn"].textContent = moves.badge() + "'s turn"
        n["card"].style.setProperty("--mc", card["color"])
        n["card"].removeAttribute("hidden")
        n["card"].classList.remove("on", "done")
        getattr(n["card"], "offsetWidth")  # restart the pop-in
        n["card"].classList.add("on")
        self.done_button.enabled = True
        self._open = True
        moves.say_if(card["speech"])
        self._restart(HIDE_MS + (4000 if moves.readaloud() else 0))

    def _restart(self, ms):
        if self._hide_t is not None:
            window.clearTimeout(self._hide_t)
        self._hide_t = window.setTimeout(self._auto_hide, ms)

    def _auto_hide(self):
        self._hide_t = None
        if self._open:
            self._open = False
            moves.flip()
        self.hide()

    def hide(self):
        card = self.dom_nodes["card"]
        card.classList.remove("on")
        window.setTimeout(self._park, 220)

    def _park(self):
        card = self.dom_nodes["card"]
        if not card.classList.contains("on"):
            card.setAttribute("hidden", "")

    # ---- Done: the move was done, the other player is next
    @handle("done_button", "click")
    def done_button_click(self, **event_args):
        if not self._open:
            return
        self._open = False
        self.done_button.enabled = False
        nxt = moves.flip()
        self.dom_nodes["turn"].textContent = "Next: " + moves.badge(nxt)
        self.dom_nodes["card"].classList.add("done")
        qb.sfx("done")
        qb.confetti(24)
        moves.say_if("Yay! Next: " + moves.who(nxt))
        self._restart(DONE_MS)

    @handle("", "hide")
    def form_hide(self, **event_args):
        if self._hide_t is not None:
            window.clearTimeout(self._hide_t)
            self._hide_t = None
        self._open = False
