"""Dashboard light/dark visual check (bounded)."""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
_src = open('tests/e2e/phase2_visual.py', encoding='utf-8').read().split('OUT = ')[0]
_src = _src.replace('sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")', '')
exec(_src)

from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path("C:/Users/Beast/Projects/golf-tournament-app/tests/e2e/screenshots/phase2")

runs = [
    ("dash-light-1440", 1440, 900, None),
    ("dash-dark-1440", 1440, 900, "dark"),
    ("dash-dark-390", 390, 844, "dark"),
]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for label, w, h, theme in runs:
        context = browser.new_context(viewport={"width": w, "height": h})
        cs = list(cookies)
        if theme:
            cs.append({"name": "ym-theme", "value": theme, "domain": "localhost",
                       "path": "/", "httpOnly": False, "secure": False, "sameSite": "Lax"})
        context.add_cookies(cs)
        page = context.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.goto("http://localhost:3000/dashboard", wait_until="networkidle", timeout=40000)
        page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / f"{label}.png"), full_page=True)
        print(label, "ok" if not errs else errs[:2])
        context.close()
    browser.close()
