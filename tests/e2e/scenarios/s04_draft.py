"""Draft page: timer, mobile bottom sheets, browse cards. READ-ONLY."""
from __future__ import annotations
import re
from runner import StepResult, capture_errors, safe_goto, screenshot

NAME = "04_draft"
SLUG = "test-league-2-jun-23"


def run(page, viewport: str, base_url: str, ctx) -> list[StepResult]:
    out: list[StepResult] = []

    with capture_errors(page) as errs:
        status = safe_goto(page, f"{base_url}/{SLUG}/draft")
    screenshot(page, viewport, NAME, "load")
    out.append(StepResult("draft page load", status == "ok" and not errs, status, list(errs)))

    # Possible states for /{slug}/draft:
    # - powerups disabled or no draft yet → "Draft hasn't started" / "Powerups disabled"
    # - draft in progress → countdown timer (role=timer) visible
    # - draft complete → pick list visible, no timer
    # We report what we observe rather than fail on absence.
    timer_count = page.locator("[role=timer]").count()
    pick_list_count = page.locator("[data-draft-pick-list], [data-draft-board]").count()
    not_started_count = page.get_by_text(
        re.compile(r"Draft hasn[’']t started|powerups (are )?disabled|coming soon|not enabled",
                   re.I)
    ).count()

    state = "unknown"
    if timer_count > 0:
        state = "in-progress (timer visible)"
    elif pick_list_count > 0:
        state = "completed (pick list visible)"
    elif not_started_count > 0:
        state = "not started or disabled"

    out.append(StepResult("draft state observed", state != "unknown", state, []))
    screenshot(page, viewport, NAME, f"state-{state.split()[0]}")

    # On mobile, exercise the bottom sheet trigger if present (DraftBottomSheet).
    if viewport == "mobile":
        sheet_trigger = page.get_by_role(
            "button", name=re.compile(r"browse|cards|powerups|order", re.I)
        ).first
        if sheet_trigger.count() > 0:
            with capture_errors(page) as errs:
                try:
                    sheet_trigger.click(timeout=5000)
                    page.wait_for_timeout(600)
                    sheet_open = page.locator("[role=dialog], [data-state=open]").count() > 0
                except Exception as exc:  # noqa: BLE001
                    sheet_open = False
                    errs.append(f"sheet click failed: {exc}")
            screenshot(page, viewport, NAME, "sheet-open")
            out.append(StepResult("mobile sheet opens", sheet_open and not errs,
                                  "open" if sheet_open else "no sheet", list(errs)))

    return out
