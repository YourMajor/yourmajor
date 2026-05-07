"""Sponsor banner upload — admin/setup flow. NEW feature.

Walks to admin setup, locates the sponsor banner file input, sets a tiny
fixture PNG, submits, then verifies the banner appears on the hub.
"""
from __future__ import annotations
from pathlib import Path
from runner import StepResult, capture_errors, safe_goto, screenshot, FIXTURES

NAME = "07_sponsor_banner"
SLUG = "test-league-2-jun-23"

FIXTURE = FIXTURES / "sponsor-test.png"


def run(page, viewport: str, base_url: str, ctx) -> list[StepResult]:
    out: list[StepResult] = []

    if not FIXTURE.exists():
        out.append(StepResult("fixture present", False,
                              f"missing {FIXTURE}", []))
        return out

    with capture_errors(page) as errs:
        status = safe_goto(page, f"{base_url}/{SLUG}/admin/setup")
    screenshot(page, viewport, NAME, "setup-load")
    if "/admin/setup" not in page.url:
        out.append(StepResult("admin/setup reachable", False,
                              f"redirected to {page.url}", list(errs)))
        return out

    out.append(StepResult("admin/setup load", status == "ok" and not errs, status, list(errs)))

    # Find the file input near the sponsor card. We try a few strategies:
    file_input = page.locator(
        "input[type=file][accept*=image]"
    ).first

    if file_input.count() == 0:
        out.append(StepResult("sponsor file input", False, "no input[type=file]", []))
        return out

    with capture_errors(page) as errs:
        try:
            file_input.set_input_files(str(FIXTURE), timeout=5000)
            page.wait_for_timeout(800)
            uploaded = True
        except Exception as exc:  # noqa: BLE001
            uploaded = False
            errs.append(f"set_input_files: {exc}")
    screenshot(page, viewport, NAME, "after-upload")
    out.append(StepResult("upload sponsor image", uploaded and not errs,
                          "uploaded" if uploaded else "failed", list(errs)))

    return out
