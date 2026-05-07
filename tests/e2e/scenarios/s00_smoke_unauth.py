"""Smoke: every public route loads with no console errors.

Catches SSR/runtime breakage from the new code (NotificationPopup mount,
draft route restructure, etc.) that vitest cannot see.
"""
from __future__ import annotations
from runner import StepResult, capture_errors, safe_goto, screenshot

NAME = "00_smoke_unauth"
ROUTES = [
    "/",
    "/auth/login",
    "/tournaments",
    "/features",
    "/pricing",
    "/privacy",
    "/terms",
    "/feedback",
]


def run(page, viewport: str, base_url: str, ctx) -> list[StepResult]:
    out: list[StepResult] = []
    # Use a fresh, *unauthenticated* context for this scenario.
    fresh = ctx.browser.new_context(
        **{k: v for k, v in ctx.context_kwargs.items() if k != "storage_state"}
    )
    p = fresh.new_page()
    try:
        for route in ROUTES:
            with capture_errors(p) as errs:
                status = safe_goto(p, base_url + route)
            screenshot(p, viewport, NAME, route or "root")
            ok = status == "ok" and not errs
            out.append(
                StepResult(
                    name=f"GET {route}",
                    ok=ok,
                    detail=status,
                    errors=list(errs),
                )
            )
    finally:
        fresh.close()
    return out
