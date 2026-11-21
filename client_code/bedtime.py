"""Tuck-in Time: the grown-up's play timer, the bedtime ritual and the sleep screen (every page, guests too).

    bedtime.start()          once, from Layouts/Shell's show: a 15 s clock (+ a tick when the tab comes back)
    bedtime.attach(shell)    Shell.refresh: the header's ⏰ button and the sleep screen live in the Shell
    bedtime.open_timer()     the ⏰ button: Dialogs/PlayTimer (10/15/20/30 min; change/stop behind Components/GrownupHold)
    bedtime.wake()           the sleep screen's "Wake up" hold (or 30 minutes passing)
    bedtime.asleep()         True while the sleep screen is up (Pages/World pauses its polling)

The timer lives in this browser only: storage key "timer" = {ends, min, warned, asleep_until} (ms since 1970).
2 minutes before the end: a sleepy toast and a dusk tint (body.qb-sleepy). At 0: Dialogs/TuckIn (tap each cube to
tuck it in; signed-in players' cubes come from Cubes.tuck_in, which also starts tomorrow's Dream gift), then the
sleep screen covers the game (body.qb-asleep, 3D drawing and music paused) for 30 minutes or until a grown-up holds
Wake up. Nothing here rewards playing longer: the only reward is for stopping.
"""
import anvil.js
from anvil import alert
from anvil.js import window

from . import moves, qb, state

TICK_MS = 15000
WARN_MS = 2 * 60 * 1000
SLEEP_MS = 30 * 60 * 1000
CHOICES = (10, 15, 20, 30)
GUEST_NOTE = "Sweet dreams! With an account, your cubes bring you a 💭 Dream gift the next morning."
NOTES = {"new": "💭 Your cubes will dream tonight. Find a Dream gift in your Cubby tomorrow morning!",
         "today": "💭 Your cubes are already dreaming. Their Dream gift comes tomorrow morning!",
         "waiting": "💭 A Dream gift is still waiting in your Cubby from last time!"}
_b: dict = {"shell": None, "started": False, "ritual": False, "sleeping": False}


def _now():
    return float(window.Date.now())


def timer():
    t = qb.store_get("timer", None)
    return t if isinstance(t, dict) else {}


def _save(t):
    qb.store_set("timer", t or None)


def asleep():
    t = timer()
    return bool(t.get("asleep_until")) and _now() < float(t["asleep_until"])


def left_ms():
    ends = timer().get("ends")
    return None if not ends else float(ends) - _now()


# ---------------------------------------------------------------- the header button and the page tint
def _paint(left):
    shell = _b["shell"]
    if shell is None:
        return
    btn, txt = shell.dom_nodes["timer_btn"], shell.dom_nodes["timer_txt"]
    if left is None:
        txt.textContent = "Play timer"
        btn.classList.remove("running", "sleepy")
        btn.setAttribute("aria-label", "Play timer")
        return
    mins = max(0, int(window.Math.ceil(left / 60000.0)))
    txt.textContent = "%dm" % mins
    btn.classList.add("running")
    btn.classList.toggle("sleepy", left <= WARN_MS)
    btn.setAttribute("aria-label", "Play timer: %d minute%s left" % (mins, "" if mins == 1 else "s"))


def _sleepy(on):
    window.document.body.classList.toggle("qb-sleepy", bool(on))


def _sleep_screen(on, left=0):
    shell = _b["shell"]
    body = window.document.body
    body.classList.toggle("qb-asleep", bool(on))
    for sel in (".ui-header-in", ".ui-main", ".ui-footer", ".ui-tabbar"):
        el = window.document.querySelector(sel)
        if el:
            if on:
                el.setAttribute("inert", "")
            else:
                el.removeAttribute("inert")
    qb.QB.paused = bool(on)
    if shell is not None:
        shell.sleep_screen.visible = bool(on)
        if on:
            mins = max(1, int(window.Math.ceil(left / 60000.0)))
            shell.sleep_text.text = "They wake up by themselves in %d minute%s. Sweet dreams!" % (mins, "" if mins == 1 else "s")
    if on and not _b["sleeping"]:
        _b["sleeping"] = True
        qb.QB.music.sync()
        if shell is not None:
            window.setTimeout(shell.wake_hold.focus, 300)
    elif not on and _b["sleeping"]:
        _b["sleeping"] = False
        qb.QB.music.sync()


# ---------------------------------------------------------------- the clock
def tick():
    t = timer()
    now = _now()
    if t.get("asleep_until"):
        if now < float(t["asleep_until"]):
            _sleepy(False)
            _paint(None)
            _sleep_screen(True, float(t["asleep_until"]) - now)
            return
        wake()
        return
    if _b["sleeping"]:
        _sleep_screen(False)
    ends = t.get("ends")
    if not ends:
        _paint(None)
        _sleepy(False)
        return
    left = float(ends) - now
    if left <= 0:
        if left < -SLEEP_MS:  # it ran out long ago (the tab was closed): the cubes have slept already
            _save(None)
            _paint(None)
            _sleepy(False)
            return
        _ritual()
        return
    _paint(left)
    if left <= WARN_MS:
        _sleepy(True)
        if not t.get("warned"):
            t["warned"] = True
            _save(t)
            qb.sfx("tuck")
            state.toast("🥱 The cubes are getting sleepy: 2 more minutes!")
    else:
        _sleepy(False)
    if left < TICK_MS + 1000:
        window.setTimeout(_tick_js, int(left) + 80)


_tick_js = anvil.js.report_exceptions(tick)


def _on_visible(event=None):
    if not window.document.hidden:
        tick()


def start():
    if _b["started"]:
        return
    _b["started"] = True
    window.setInterval(_tick_js, TICK_MS)
    window.document.addEventListener("visibilitychange", anvil.js.report_exceptions(_on_visible))
    window.setTimeout(_tick_js, 400)


def attach(shell):
    """Shell.refresh: repaint the button now; the ritual (a dialog) starts from the clock, never inside a page change."""
    _b["shell"] = shell
    t = timer()
    if t.get("asleep_until") or (t.get("ends") and float(t["ends"]) <= _now()):
        window.setTimeout(_tick_js, 60)
    else:
        left = left_ms()
        _paint(left if left is not None and left > 0 else None)


# ---------------------------------------------------------------- setting it (Dialogs/PlayTimer)
def set_minutes(n):
    n = int(n) if int(n) in CHOICES else 15
    _save({"ends": _now() + n * 60000, "min": n, "warned": False})
    _sleepy(False)
    tick()
    state.toast("⏰ Timer on: %d minutes of play. The cubes will say when it's nearly bedtime." % n, "ok")


def stop():
    _save(None)
    tick()
    state.toast("⏰ Play timer off.")


def bedtime_now():
    t = timer()
    t["ends"] = _now() - 1
    _save(t)
    window.setTimeout(_tick_js, 120)


def open_timer():
    from .Dialogs.PlayTimer import PlayTimer
    left = left_ms()
    running = left is not None and left > 0
    info = {"running": running, "left_min": int(window.Math.ceil(left / 60000.0)) if running else 0,
            "ends_at": str(qb.QBP.clock(float(timer().get("ends") or 0))) if running else "", "choices": list(CHOICES)}
    r = alert(PlayTimer(info=info), buttons=[], role="app-dialog", dismissible=True)
    if not isinstance(r, dict):
        return
    if r.get("set"):
        set_minutes(r["set"])
    elif r.get("stop"):
        stop()
    elif r.get("now"):
        bedtime_now()


# ---------------------------------------------------------------- bedtime
def _cubes_for_bed():
    if state.me():
        try:
            r = state.call_quiet("tuck_in", qb.today())
        except Exception:
            r = None
        if isinstance(r, dict) and r.get("ok") and r.get("cubes"):
            return r["cubes"], NOTES.get(r.get("dream") or "", NOTES["new"])
    d = qb.store_get("draft", None)
    if isinstance(d, dict) and d.get("color"):
        return [{"name": d.get("name") or "Your cube", "color": d["color"], "eyes": d.get("eyes") or 0,
                 "mouth": d.get("mouth") or 0, "drawing": d.get("drawing") or ""}], GUEST_NOTE
    return [{"name": "Snoozle", "color": "#a07bff", "eyes": 3, "mouth": 3, "drawing": ""}], GUEST_NOTE


def _ritual():
    if _b["ritual"]:
        return
    _b["ritual"] = True
    try:
        _sleepy(True)
        _paint(0)
        moves.hush()
        if getattr(window, "ArkMusic", None):
            window.ArkMusic.duck(0.35, 1.5)
        cubes, note = _cubes_for_bed()
        from .Dialogs.TuckIn import TuckIn
        alert(TuckIn(cubes=cubes, note=note), buttons=[], role="app-dialog", dismissible=False)
        t = timer()
        t.pop("ends", None)
        t["asleep_until"] = _now() + SLEEP_MS
        _save(t)
        tick()
    finally:
        _b["ritual"] = False


def lights_out():
    """All cubes are tucked in: the 3D stages stop drawing and the music fades out slowly."""
    qb.QB.paused = True
    qb.QB.music.sync()


def wake():
    was = _b["sleeping"] or bool(timer().get("asleep_until"))
    _save(None)
    _sleep_screen(False)
    qb.QB.paused = False
    if getattr(window, "ArkMusic", None):
        window.ArkMusic.duck(1, 0.5)
    qb.QB.music.sync()
    _sleepy(False)
    _paint(None)
    if was:
        qb.sfx("sunny")
        state.toast("☀️ Good morning, cubes! Time to play.", "ok")
