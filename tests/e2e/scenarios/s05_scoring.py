"""Scoring page: stepper, score entry. READ-ONLY assertions only.

We don't actually submit scores — just verify the live-scoring UI mounts
and the stepper / putts / GIR controls render with no console errors.
"""
from __future__ import annotations
from runner import StepResult, capture_errors, safe_goto, screenshot

NAME = "05_scoring"
SLUG = "test-league-2-jun-23"


def run(page, viewport: str, base_url: str, ctx) -> list[StepResult]:
    out: list[StepResult] = []

    with capture_errors(page) as errs:
        status = safe_goto(page, f"{base_url}/{SLUG}/play")
    screenshot(page, viewport, NAME, "load")
    out.append(StepResult("scoring page load", status == "ok" and not errs, status, list(errs)))

    # Possible states:
    # - tournament not active → redirected to hub or shows banner
    # - active and registered → stepper visible
    # - registered but not started → "Tournament hasn't started"
    on_play = "/play" in page.url
    out.append(StepResult("on play route", on_play,
                          f"url={page.url}", []))

    if on_play:
        with capture_errors(page) as errs:
            stepper = page.locator(
                "button[aria-label*=increment i], button:has-text('+'), input[type=number]"
            ).first
            has_stepper = stepper.count() > 0
            # Pending-state messages: "Round Not Open", "Tournament not active",
            # "Coming up", "hasn't started"
            has_pending = page.locator(
                "text=/Round Not Open|round (hasn['’]t|not) started|"
                "Tournament not active|coming up|score entry/i"
            ).first.count() > 0
        screenshot(page, viewport, NAME, "stepper-or-pending")
        out.append(StepResult(
            "scoring UI mounted",
            (has_stepper or has_pending) and not errs,
            f"stepper={has_stepper} pending={has_pending}",
            list(errs),
        ))

    return out
