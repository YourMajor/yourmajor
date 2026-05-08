"""Playwright clickthrough for every seeded QA tournament.

For each `qa-{format}` slug, navigates to the tournament hub, waits for the
leaderboard to render, takes a screenshot, captures any console errors or
uncaught exceptions, and verifies the right leaderboard table is on the page
for that format.

Run after seeding:
    npx tsx scripts/seed-format-test.ts
    python scripts/format-clickthrough.py [http://localhost:3000]

Output:
    - tmp/qa-screenshots/{slug}.png  per format
    - PASS/FAIL summary on stdout
"""

from __future__ import annotations
import os
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"

# (slug, expected_kind_marker)
# `expected_kind_marker` is a piece of accessible text or an aria-label that
# unambiguously identifies the leaderboard component used.
TOURNAMENTS: list[tuple[str, str]] = [
    ("qa-stroke-play",          "Leaderboard"),
    ("qa-stroke-play-net",      "Leaderboard"),
    ("qa-stableford",           "Leaderboard"),
    ("qa-modified-stableford",  "Leaderboard"),
    ("qa-callaway",             "Leaderboard"),
    ("qa-peoria",               "Leaderboard"),
    ("qa-quota",                "Leaderboard"),
    ("qa-skins-gross",          "Skins leaderboard"),
    ("qa-skins-net",            "Skins leaderboard"),
    ("qa-match-play",           "Match-play leaderboard"),
    ("qa-ryder-cup",            "Match-play leaderboard"),
    ("qa-nassau",               "Nassau leaderboard"),
    ("qa-low-gross-low-net",    "Low gross / low net leaderboard"),
    ("qa-best-ball-2",          "Team leaderboard"),
    ("qa-best-ball-4",          "Team leaderboard"),
    ("qa-scramble",             "Team leaderboard"),
    ("qa-shamble",              "Team leaderboard"),
    ("qa-chapman",              "Team leaderboard"),
    ("qa-pinehurst",            "Team leaderboard"),
]

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "tmp", "qa-screenshots")
os.makedirs(OUT_DIR, exist_ok=True)


def main() -> int:
    print(f"QA clickthrough vs {BASE}")
    print("=" * 70)
    failures: list[str] = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        page = context.new_page()

        for slug, expected_marker in TOURNAMENTS:
            url = f"{BASE}/{slug}"
            errors: list[str] = []

            def on_console(msg, _errors=errors):
                if msg.type in ("error",):
                    txt = msg.text
                    # Filter low-signal noise that isn't a real regression.
                    if "Failed to load resource" in txt and "favicon" in txt:
                        return
                    _errors.append(f"console.{msg.type}: {txt[:200]}")

            def on_pageerror(err, _errors=errors):
                _errors.append(f"pageerror: {str(err)[:200]}")

            page.on("console", on_console)
            page.on("pageerror", on_pageerror)
            try:
                resp = page.goto(url, timeout=30_000)
                page.wait_for_load_state("networkidle", timeout=30_000)

                if resp is None or resp.status >= 400:
                    failures.append(f"{slug}: HTTP {resp.status if resp else '?'}")
                    print(f"[FAIL] {slug:28s} HTTP {resp.status if resp else '?'}")
                    continue

                # Verify the expected leaderboard table is on the page.
                marker = page.locator(f'[aria-label="{expected_marker}"]')
                if marker.count() == 0:
                    failures.append(f"{slug}: missing aria-label='{expected_marker}'")
                    print(f"[FAIL] {slug:28s} missing leaderboard aria-label '{expected_marker}'")
                else:
                    print(f"[PASS] {slug:28s} {expected_marker}")

                if errors:
                    failures.append(f"{slug}: {len(errors)} console error(s) — first: {errors[0]}")
                    print(f"       └─ {len(errors)} console error(s); first: {errors[0]}")

                page.screenshot(path=os.path.join(OUT_DIR, f"{slug}.png"), full_page=True)
            except Exception as e:
                failures.append(f"{slug}: {e}")
                print(f"[FAIL] {slug:28s} exception: {e}")
            finally:
                page.remove_listener("console", on_console)
                page.remove_listener("pageerror", on_pageerror)

        browser.close()

    print("=" * 70)
    if failures:
        print(f"{len(failures)} failure(s):")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"All {len(TOURNAMENTS)} format leaderboards rendered cleanly")
    print(f"Screenshots: {OUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
