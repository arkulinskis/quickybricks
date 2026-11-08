"""The app starts here (anvil.yaml: startup module). One server call to learn who is signed in (Anvil's loading
spinner shows meanwhile), the Privacy & Terms kit, then the page for the address in the browser bar."""
import anvil.server

from . import legal, qb, router, state

LEGAL_THEME = {"accent": "#f0428c"}  # colours for the Privacy & Terms page (match --c-brand in app.css)

legal.setup(LEGAL_THEME)
qb.setup()  # the 3D engine's server bridge and toasts
state.set_me(anvil.server.call("get_me"))
if state.me():
    legal.refresh_soon()
router.start()
