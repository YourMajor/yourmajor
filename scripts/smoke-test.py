"""Lightweight smoke test against the running dev server.

Boots no server (assumes one is already running on the URL passed).
For each route, navigates, waits for networkidle, captures any uncaught
exceptions or console errors, and reports a pass/fail summary.

Does NOT require login — only hits routes that work for an unauthenticated
visitor. The goal is to catch SSR/runtime breakage from the new code (layout
mount of NotificationPopup, draft pick route restructure, etc.) that vitest
can't see because tests stub the framework.
"""

from __future__ import annotations
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3001"

ROUTES = [
    "/",
    "/auth/login",
    "/tournaments",
    "/features",
    "/pricing",
    "/privacy",
    "/terms",
]

results: list[tuple[str, str, list[str]]] = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    for route in ROUTES:
        url = f"{BASE}{route}"
        errors: list[str] = []

        def on_console(msg, errors=errors):
            if msg.type == "error":
                errors.append(f"console.error: {msg.text}")

        def on_pageerror(exc, errors=errors):
            errors.append(f"pageerror: {exc}")

        page.on("console", on_console)
        page.on("pageerror", on_pageerror)

        status = "OK"
        try:
            response = page.goto(url, wait_until="networkidle", timeout=30000)
            if response is None or not response.ok:
                code = response.status if response else "no-response"
                status = f"HTTP {code}"
        except Exception as exc:  # noqa: BLE001
            status = f"navigation failed: {exc}"

        results.append((route, status, list(errors)))

        page.remove_listener("console", on_console)
        page.remove_listener("pageerror", on_pageerror)

    browser.close()

print()
print(f"Smoke test against {BASE}")
print("=" * 60)

failures = 0
for route, status, errors in results:
    icon = "PASS" if status == "OK" and not errors else "FAIL"
    if icon == "FAIL":
        failures += 1
    print(f"[{icon}] {route} -> {status}")
    for e in errors:
        print(f"        {e}")

print("=" * 60)
print(f"{len(results) - failures}/{len(results)} passed")
sys.exit(0 if failures == 0 else 1)
