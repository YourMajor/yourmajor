"""Shared helpers for the e2e click-through harness.

A scenario is a Python module under scenarios/ that exports
`run(page, viewport, ctx) -> list[StepResult]`. The runner here holds
the cross-cutting infra: storage-state loading, console/page-error
capture, screenshots, viewport configs, and a known-noise allowlist.
"""
from __future__ import annotations

import contextlib
import dataclasses
import re
import shutil
from pathlib import Path
from typing import Iterator

ROOT = Path(__file__).resolve().parent
STORAGE_STATE = ROOT / "storageState.json"
SCREENSHOTS = ROOT / "screenshots"
FIXTURES = ROOT / "fixtures"

DESKTOP = {
    "viewport": {"width": 1280, "height": 800},
    "device_scale_factor": 1,
}

# Filled in at runtime from playwright.devices["iPhone 13"]; set by run_all.py.
MOBILE_DEVICE_NAME = "iPhone 13"


# Console noise we don't care about for pass/fail. Matched as substrings.
NOISE_SUBSTRINGS = (
    "[Fast Refresh]",
    "Download the React DevTools",
    "[HMR]",
    "Failed to load resource: the server responded with a status of 401",  # /api/auth probes pre-login
    "Failed to load resource: net::ERR_ABORTED",  # nav cancels on quick redirects
    "favicon.ico",
    "Service worker registration successful",
    "Manifest:",  # PWA manifest dev warnings
    "[Supabase Realtime]",  # noisy reconnect logs
    "WebSocket connection",  # realtime reconnects in dev
)


@dataclasses.dataclass
class StepResult:
    name: str
    ok: bool
    detail: str = ""
    errors: list[str] = dataclasses.field(default_factory=list)


def is_noise(text: str) -> bool:
    return any(s in text for s in NOISE_SUBSTRINGS)


@contextlib.contextmanager
def capture_errors(page) -> Iterator[list[str]]:
    """Collect console.error and pageerror messages while the block runs."""
    errors: list[str] = []

    def on_console(msg):
        if msg.type == "error" and not is_noise(msg.text):
            errors.append(f"console.error: {msg.text}")

    def on_pageerror(exc):
        text = str(exc)
        if not is_noise(text):
            errors.append(f"pageerror: {text}")

    page.on("console", on_console)
    page.on("pageerror", on_pageerror)
    try:
        yield errors
    finally:
        page.remove_listener("console", on_console)
        page.remove_listener("pageerror", on_pageerror)


def screenshot(page, viewport: str, scenario: str, step: str) -> Path:
    safe = re.sub(r"[^a-zA-Z0-9_-]+", "_", step)[:60]
    out_dir = SCREENSHOTS / viewport / scenario
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{safe}.png"
    full_page = viewport == "desktop"
    try:
        page.screenshot(path=str(path), full_page=full_page, timeout=10000)
    except Exception as exc:  # noqa: BLE001
        # Don't let screenshot failures fail the step; just record.
        path.with_suffix(".error.txt").write_text(f"screenshot failed: {exc}")
    return path


def safe_goto(page, url: str, *, wait_until: str = "networkidle", timeout: int = 30000) -> str:
    """Navigate. Return 'ok' or an HTTP/error string. Doesn't raise."""
    try:
        resp = page.goto(url, wait_until=wait_until, timeout=timeout)
        if resp is None:
            return "no-response"
        if not resp.ok:
            return f"HTTP {resp.status}"
        return "ok"
    except Exception as exc:  # noqa: BLE001
        return f"navigation failed: {type(exc).__name__}: {exc}"


def reset_screenshots():
    if SCREENSHOTS.exists():
        shutil.rmtree(SCREENSHOTS, ignore_errors=True)
    SCREENSHOTS.mkdir(parents=True, exist_ok=True)


def storage_state_exists() -> bool:
    return STORAGE_STATE.exists() and STORAGE_STATE.stat().st_size > 200


def context_kwargs(viewport: str, p) -> dict:
    """Build kwargs for browser.new_context() for a given viewport name."""
    base: dict = {}
    if storage_state_exists():
        base["storage_state"] = str(STORAGE_STATE)
    if viewport == "desktop":
        base.update(DESKTOP)
    elif viewport == "mobile":
        base.update(p.devices[MOBILE_DEVICE_NAME])
    else:
        raise ValueError(f"unknown viewport {viewport}")
    return base
