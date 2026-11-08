"""QuickyBricks' 3D engine (theme/assets/qb.js, window.QB) and its page glue (qb-play.js, window.QBP) seen from Python.

    qb.setup()               once at start-up: the server bridge the engine's UI.api uses (the roller's roll_cube,
                             the World's get_faces) and QB.host.toast
    qb.QB / qb.QBP           the JS objects themselves (game data: QB.EVENTS, QB.EYES, QB.COLORS ...)
    qb.js_value(x)           a Python dict/list as a real JS object;  qb.py_value(x): JS -> plain Python
    qb.events() ...          game data as plain Python lists for RepeatingPanels
    qb.thumb(canvas, cube)   draw a cube thumbnail on a <canvas> (Components/Thumb does this)
Stage controllers (QBP.hero / cubby / world) are mounted by Components/Stage.
"""
import json

import anvil.js
import anvil.server
from anvil.js import window

from . import state

QB = window.QB
QBP = window.QBP
UI = window.UI
NULL = anvil.js.call(window.Function("return null"))  # "no JS object yet", typed for the validator
HAND_DIST_DEFAULT = 2


def py_value(x):
    if x is None:
        return None
    return json.loads(window.JSON.stringify(x))


def js_value(x):
    return window.JSON.parse(json.dumps(x))


def loose(x):
    """Pass a value through untyped (dynamic keys the validator can't follow)."""
    return x


# ---------------------------------------------------------------- server calls for the engine (UI.api / UI.apiQuiet)
def _bridge(fn, args_json, quiet):
    """Called from qb-play.js. Always returns JSON text: {"result": ...} or {"error": ...}."""
    args = json.loads(args_json) if args_json else []
    if fn not in ("roll_cube", "get_faces"):
        return json.dumps({"error": "Unknown request."})
    try:
        call = anvil.server.call_s if quiet else anvil.server.call
        return json.dumps({"result": call(fn, *args)})
    except Exception as e:
        kind = type(e).__name__  # (some of Anvil's exception classes aren't in the validator's stubs)
        if kind == "SessionExpiredError":
            return json.dumps({"error": "Your session expired. Reload the page and sign in again."})
        if kind == "AppOfflineError":
            return json.dumps({"error": "You seem to be offline. Check your connection and try again."})
        print("qb bridge %s failed: %r" % (fn, e))
        return json.dumps({"error": "Something went wrong. Please try again."})


def _toast(message, kind=""):
    state.toast(message, kind or None)


def setup():
    window.QB_BRIDGE = _bridge
    QB.host.toast = _toast


# ---------------------------------------------------------------- game data (qb.js keeps it in step with rules.py)
def events():
    """The six sides in face order: [{key, label, emoji, side, text, color}]."""
    ev = py_value(QB.EVENTS)
    return [dict(ev[k], key=k) for k in py_value(QB.FACE_EVENT)]


def eyes():
    return py_value(QB.EYES)


def mouths():
    return py_value(QB.MOUTHS)


def colors():
    return [{"hex": c[0], "name": c[1]} for c in py_value(QB.COLORS)]


def hats():
    return py_value(QB.HATS)


def guest_reward(event):
    return py_value(QB.guestReward(event))


def random_name():
    return str(QB.randomName())


def pick(seq):
    return seq[int(window.Math.floor(window.Math.random() * len(seq)))]


def nap_text(seconds):
    return str(QB.napText(seconds or 0))


def sfx(name):
    QB.sfx(name)


def confetti(n=80):
    QB.confetti(n)


def quest_toasts(result):
    QB.questToasts(js_value(result))


def store_get(key, default=None):
    """This browser's storage as plain Python (UI.store.get gives a JS proxy, not a dict). Same keys as the JS version."""
    try:
        raw = window.localStorage.getItem(str(UI.config.key) + "." + key)
        return default if raw is None else json.loads(raw)
    except Exception:
        return default


def store_set(key, value):
    UI.store.set(key, js_value(value))


def thumb(canvas, cube, px=74):
    QBP.thumb(canvas, js_value(cube), px)


def first_name(name):
    return (name or "Your").split(" ")[0]
