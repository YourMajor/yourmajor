"""Hover the first tournament tile and capture the curtain state."""
_src = open('tests/e2e/phase2_visual.py', encoding='utf-8').read().split('OUT = ')[0]
_src = _src.replace('sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")', '')
exec(_src)

from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path("C:/Users/Beast/Projects/golf-tournament-app/tests/e2e/screenshots/phase2")
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    context.add_cookies(cookies)
    page = context.new_page()
    page.goto("http://localhost:3000/test-league-2-jun-23", wait_until="networkidle", timeout=40000)
    # The league card on the dashboard has a header image; go there instead.
    page.goto("http://localhost:3000/dashboard", wait_until="networkidle", timeout=40000)
    page.wait_for_timeout(700)
    cards = page.locator(".tcard-hover")
    n = cards.count()
    print("tiles found:", n)
    # Hover the league card (has headerImage) if present, else the first.
    target = cards.nth(min(5, n - 1))
    target.scroll_into_view_if_needed()
    target.hover()
    page.wait_for_timeout(1000)
    target.screenshot(path=str(OUT / "tile-hover.png"))
    # And a photo-less one for the breathe variant
    first = cards.first
    first.scroll_into_view_if_needed()
    first.hover()
    page.wait_for_timeout(1000)
    first.screenshot(path=str(OUT / "tile-hover-breathe.png"))
    browser.close()
print("done")
