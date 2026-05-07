"""Admin core pages: setup, communications, groups, chat moderation.

READ-ONLY. We open each admin page and confirm it mounts without errors.
We do NOT click destructive buttons (reset draft, delete message, ban user).
"""
from __future__ import annotations
from runner import StepResult, capture_errors, safe_goto, screenshot

NAME = "06_admin_core"
SLUG = "test-league-2-jun-23"

ADMIN_ROUTES = [
    "/admin",
    "/admin/setup",
    "/admin/invites",
    "/admin/draft",
    "/admin/scores",
    "/admin/chat",
    "/admin/communications",
    "/admin/groups",
]


def run(page, viewport: str, base_url: str, ctx) -> list[StepResult]:
    out: list[StepResult] = []

    for route in ADMIN_ROUTES:
        with capture_errors(page) as errs:
            status = safe_goto(page, f"{base_url}/{SLUG}{route}")
        # If the test user isn't admin of this tournament we'll be redirected.
        # Note that as informational, not a failure.
        redirected = f"/{SLUG}{route}" not in page.url
        screenshot(page, viewport, NAME, route.replace("/", "_"))
        ok = status == "ok" and not errs
        detail = status if not redirected else f"{status} (redirected to {page.url})"
        out.append(StepResult(f"admin {route}", ok, detail, list(errs)))

    return out
