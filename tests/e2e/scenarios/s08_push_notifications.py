"""Push notifications: profile-page subscribe UI + opt-in toggles.

We grant the notifications permission in the context, navigate to /profile,
locate the push card, and verify the Enable/Disable button + toggles render.
We don't actually wait for a real push delivery.
"""
from __future__ import annotations
import re
from runner import StepResult, capture_errors, safe_goto, screenshot

NAME = "08_push_notifications"


def run(page, viewport: str, base_url: str, ctx) -> list[StepResult]:
    out: list[StepResult] = []

    # Grant permission preemptively so the subscribe path works.
    try:
        page.context.grant_permissions(["notifications"], origin=base_url)
    except Exception as exc:  # noqa: BLE001
        out.append(StepResult("grant notifications permission", False, str(exc), []))
        return out

    with capture_errors(page) as errs:
        status = safe_goto(page, f"{base_url}/profile")
    screenshot(page, viewport, NAME, "profile-load")
    out.append(StepResult("profile load", status == "ok" and not errs, status, list(errs)))

    # Push card detection — look for Bell icon header or "Notifications" card title.
    push_card = page.locator(
        "text=/Push notifications|Enable notifications|notify on|notifications/i"
    ).first
    found = push_card.count() > 0
    out.append(StepResult("push card visible", found,
                          "yes" if found else "no", []))

    # Subscribe / Enable button (only on supported browsers — chromium qualifies)
    if found:
        btn_count = page.get_by_role(
            "button", name=re.compile(r"Enable|Subscribe|Turn on", re.I)
        ).count()
        toggles = page.locator("[role=switch]").count()
        out.append(StepResult("subscribe button or toggles",
                              btn_count > 0 or toggles > 0,
                              f"button={btn_count} switches={toggles}", []))
        screenshot(page, viewport, NAME, "push-card")

    return out
