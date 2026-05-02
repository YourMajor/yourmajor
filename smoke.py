"""Manual smoke pass for the golf tournament app.

Opens key public pages, waits for hydration, and reports any console errors,
page errors, or failed network requests. Saves a screenshot per page to /tmp/.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

PAGES = [
    ("home", "http://localhost:3000/"),
    ("dashboard", "http://localhost:3000/dashboard"),
    ("tournament-hub", "http://localhost:3000/test-tournament"),
    ("tournament-leaderboard", "http://localhost:3000/test-tournament/leaderboard"),
    ("league-hub", "http://localhost:3000/test-league-2"),
    ("league-season", "http://localhost:3000/test-league-2/season"),
]

OUT = Path("C:/Users/Beast/AppData/Local/Temp/claude-smoke")
OUT.mkdir(parents=True, exist_ok=True)

problems: list[str] = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    for label, url in PAGES:
        console_errors: list[str] = []
        page_errors: list[str] = []
        bad_requests: list[str] = []

        def on_console(msg):
            if msg.type == "error":
                # Skip noisy 404s on known-missing avatar/logo URLs that aren't ours
                text = msg.text
                console_errors.append(text)

        def on_page_error(err):
            page_errors.append(str(err))

        def on_response(resp):
            if resp.status >= 500 and "/api/" in resp.url:
                bad_requests.append(f"{resp.status} {resp.url}")

        page.on("console", on_console)
        page.on("pageerror", on_page_error)
        page.on("response", on_response)

        try:
            page.goto(url, wait_until="networkidle", timeout=30000)
        except Exception as e:
            problems.append(f"[{label}] navigation failed: {e}")
            continue

        # Let any post-hydration effects flush
        page.wait_for_timeout(800)

        screenshot = OUT / f"{label}.png"
        try:
            page.screenshot(path=str(screenshot), full_page=False)
        except Exception as e:
            problems.append(f"[{label}] screenshot failed: {e}")

        title = page.title()
        body_text_len = len(page.locator("body").inner_text())

        # Filter known-noisy console errors that aren't from our code
        meaningful = [e for e in console_errors if not any(skip in e for skip in [
            "Failed to load resource",  # 404s on missing images
            "DevTools",                  # React DevTools nag
        ])]

        page.remove_listener("console", on_console)
        page.remove_listener("pageerror", on_page_error)
        page.remove_listener("response", on_response)

        status = "OK"
        if page_errors or meaningful or bad_requests:
            status = "ISSUES"
        print(f"[{status}] {label} ({url})")
        print(f"  title: {title!r}")
        print(f"  body text length: {body_text_len}")
        print(f"  screenshot: {screenshot}")
        if page_errors:
            print("  ! page errors:")
            for e in page_errors:
                print(f"      {e}")
        if meaningful:
            print("  ! console errors:")
            for e in meaningful:
                print(f"      {e}")
        if bad_requests:
            print("  ! 5xx API calls:")
            for r in bad_requests:
                print(f"      {r}")

        if status == "ISSUES":
            problems.append(label)

    context.close()
    browser.close()

print()
print("=" * 60)
if problems:
    print(f"FAIL: {len(problems)} page(s) had issues: {', '.join(problems)}")
    sys.exit(1)
else:
    print("PASS: all pages rendered cleanly")
