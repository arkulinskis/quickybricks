import json

import anvil.server
from anvil import *
from anvil.js import window

from ._anvil_designer import WorldTemplate
from ... import qb, router, state


def why_not(them, mine, hand_dist):
    """Why my picked cube can't hold hands with theirs right now ("" = it can). Same order as World.hand_problem."""
    if not mine:
        return "Pick one of your cubes first (the list on the right)."
    dist = max(abs(int(mine.get("x") or 0) - int(them.get("x") or 0)), abs(int(mine.get("z") or 0) - int(them.get("z") or 0)))
    if not them.get("open"):
        return them["name"] + " isn't holding hands right now."
    if not them.get("grown"):
        return them["name"] + " is still a baby."
    if them.get("nap"):
        return "%s is resting (%s)." % (them["name"], qb.nap_text(them["nap"]))
    if not mine.get("grown"):
        return mine["name"] + " is still a baby. Roll it to grow up!"
    if mine.get("nap"):
        return "%s is resting (%s). A Wake-Up Whistle helps!" % (mine["name"], qb.nap_text(mine["nap"]))
    if int(mine.get("love") or 0) < 100:
        return "%s's heart is %d/100 full. Roll to land 💖 on top!" % (mine["name"], int(mine.get("love") or 0))
    if dist > hand_dist:
        return "Too far! Roll %s closer (%d tiles away, need %d)." % (mine["name"], dist, hand_dist)
    return ""


class World(WorldTemplate):
    """#world (Operate): everyone's cubes on one candy island. The 3D island is Components/Stage (QBP.world: rolling,
    picking, chat bubbles, other players' cubes moving); this page polls get_world every 3 s and hands each reply to
    it, and owns the HUD, my cubes, the chat bar and the dialogs (a cube's card + hold hands, the new baby, send out)."""

    def __init__(self, args=(), **properties):
        super().__init__(**properties)
        self._alive = True
        self._timers: list = []
        self._sig = ""
        self.sel_id = qb.store_get("wsel", None)
        self.emoji_panel.items = [{"e": e} for e in qb.py_value(qb.QB.CHAT_EMOJI)]
        self.emoji_panel.visible = False
        self.emoji_panel.add_event_handler("x-emoji", self._emoji)
        self.mine_panel.add_event_handler("x-pick", self._pick)
        state.set_control_attr(self.chat_box, "maxlength", 6)
        state.set_control_attr(self.chat_box, "aria-label", "Chat (3 letters)")
        state.set_control_attr(self.chat_box, "autocomplete", "off")
        state.set_control_attr(self.emoji_button, "aria-label", "Emoji")
        state.set_control_attr(self.egg_button, "aria-label", "A Surprise Egg is hiding! Find the egg")
        self.news.visible = False
        self.W = anvil.server.call("get_world")
        self.chat_wait = int(self.W.get("chat_wait") or 0)
        self._hud()
        self._tick()
        self._timers.append(window.setInterval(self._tick, 1000))
        self.stage.mount("world", self.W, {"onSelect": self._selected, "onPickOther": self._picked_other,
                                           "onResult": self._rolled, "onChat": self._chat_line, "onNews": self._news},
                         pad=self.dom_nodes["pad"])
        self._timers.append(window.setTimeout(self._poll, 3000))

    def leave(self):
        """router.show() calls this when another page opens: stop polling and the chat clock."""
        self._alive = False
        for t in self._timers:
            window.clearTimeout(t)
            window.clearInterval(t)
        self._timers = []

    # ---- the island
    def _mine(self):
        return [c for c in self.W["cubes"] if c.get("mine")]

    def _hud(self):
        W = self.W
        self.sparkles.text = "✨ %d" % W["me"]["sparkles"]
        self.here_badge.text = "🏝️ %d cubes here" % len(W["cubes"])
        self.send_button.text = "+ Send a cube (%d/%d)" % (W["me"]["out"], W["me"]["max_out"])
        self.egg_button.visible = bool(W.get("egg"))
        mine = self._mine()
        sig = json.dumps([[c["id"], c["love"], c["grown"], c.get("nap", 0) > 0, c["name"]] for c in mine] + [self.sel_id])
        if sig != self._sig:  # the poll runs every 3 s: only redraw the list when something in it changed
            self._sig = sig
            self.mine_panel.items = [dict(c, on=c["id"] == self.sel_id) for c in mine]
        self.mine_none.visible = not mine

    def _poll(self):
        if not self._alive:
            return
        fresh = state.call_quiet("get_world")
        if not self._alive:
            return
        if fresh:
            self.W = fresh
            if self.stage.live():
                self.stage.ctl.sync(json.dumps(fresh))
            self._hud()
        self._timers.append(window.setTimeout(self._poll, 3000))

    def _selected(self, cube_id):
        self.sel_id = cube_id
        self._hud()

    def _pick(self, cube_id, **event_args):
        if self.stage.live() and self.stage.ctl.select(cube_id):
            self._selected(cube_id)

    def _rolled(self, res_json):
        res = json.loads(res_json)
        for c in self.W["cubes"]:
            if c["id"] == res.get("id"):
                c["x"], c["z"] = res.get("x", c["x"]), res.get("z", c["z"])
                for k in ("love", "grown"):
                    c[k] = (res.get("cube") or {}).get(k, c[k])
        if res.get("sparkles") is not None:
            self.W["me"]["sparkles"] = res["sparkles"]
        if (res.get("reward") or {}).get("egg"):
            self.W["egg"] = None
        self._hud()

    def _chat_line(self, text):
        self.log.text = text

    def _news(self, text):
        self.news.text = "📣 " + text
        self.news.visible = True
        self._timers.append(window.setTimeout(self._news_off, 6000))

    def _news_off(self):
        self.news.visible = False

    # ---- another player's cube: its card, and holding hands
    def _picked_other(self, info_json):
        info = json.loads(info_json)
        them, mine = info["them"], info.get("me")
        why = why_not(them, mine, int((self.W.get("rules") or {}).get("hand_dist") or qb.HAND_DIST_DEFAULT))
        from ...Dialogs.CubeCard import CubeCard
        if alert(CubeCard(cube=them, mine=mine or {}, why=why), buttons=[], role="app-dialog", dismissible=True) != "hold":
            return
        if not mine:
            return
        r = state.call("hold_hands", mine["id"], them["id"])
        if not r:
            return
        if self.stage.live():
            self.stage.ctl.celebrate(mine["id"], them["id"])
        self.W["me"]["sparkles"] = r["sparkles"]
        self._hud()
        qb.quest_toasts(r)
        self._baby = r
        self._timers.append(window.setTimeout(self._show_baby, 900))

    def _show_baby(self):
        if not self._alive:
            return
        from ...Dialogs.Baby import Baby
        r = self._baby
        if alert(Baby(result=r), buttons=[], role="app-dialog", dismissible=True) == "meet":
            router.go("cube", r["baby"]["id"])

    # ---- HUD buttons
    @handle("send_button", "click")
    def send_button_click(self, **event_args):
        if not self.W.get("home"):
            state.toast("All your cubes are already here!")
            return
        from ...Dialogs.SendOut import SendOut
        cube_id = alert(SendOut(home=self.W["home"], out=self.W["me"]["out"], max_out=self.W["me"]["max_out"]),
                        buttons=[], large=True, role="app-dialog", dismissible=True)
        if not cube_id:
            return
        r = state.call("send_to_world", cube_id, True)
        if not r:
            return
        qb.store_set("wsel", r["cube"]["id"])
        qb.sfx("pop")
        fresh = state.call_quiet("get_world")
        if fresh:
            self.W = fresh
            if self.stage.live():
                self.stage.ctl.sync(json.dumps(fresh))
                if self.stage.ctl.select(r["cube"]["id"]):
                    self.stage.ctl.play(r["cube"]["id"], "boing")
                    self.sel_id = r["cube"]["id"]
            self._hud()

    @handle("egg_button", "click")
    def egg_button_click(self, **event_args):
        if self.stage.live() and self.stage.ctl.findEgg():
            state.toast("🥚 There it is! Roll one of your cubes onto it.")

    # ---- chat: 1-3 symbols, one message every 30 seconds (the server checks the same)
    def _tick(self):
        if self.chat_wait > 0:
            self.chat_wait -= 1
            self.say_button.enabled = False
            self.say_button.text = "%ds" % self.chat_wait
        else:
            self.say_button.enabled = True
            self.say_button.text = "Say"

    @handle("chat_box", "change")
    def chat_box_change(self, **event_args):
        clean = str(qb.QBP.chatClean(self.chat_box.text or ""))
        if clean != (self.chat_box.text or ""):
            self.chat_box.text = clean

    @handle("emoji_button", "click")
    def emoji_button_click(self, **event_args):
        self.emoji_panel.visible = not self.emoji_panel.visible

    def _emoji(self, e, **event_args):
        cur = self.chat_box.text or ""
        if int(qb.QBP.symbols(cur)) < 3:
            self.chat_box.text = cur + e

    @handle("chat_box", "pressed_enter")
    def chat_box_pressed_enter(self, **event_args):
        self.say_button_click()

    @handle("say_button", "click")
    def say_button_click(self, **event_args):
        t = str(qb.QBP.chatClean(self.chat_box.text or "")).strip()
        if not t:
            return
        if self.chat_wait > 0:
            state.toast("Wait %d more seconds!" % self.chat_wait)
            return
        r = anvil.server.call_s("send_chat", t, self.sel_id)
        if not r.get("ok"):
            if r.get("wait"):
                self.chat_wait = int(r["wait"])
                self._tick()
            state.toast(r.get("error") or "That didn't work.", "error")
            return
        self.chat_box.text = ""
        self.chat_wait = int(r.get("wait") or 0)
        self._tick()
        self.emoji_panel.visible = False
        if self.stage.live():
            self.stage.ctl.chats(json.dumps(r.get("chats") or []))
        qb.sfx("chat")
        qb.quest_toasts(r)
