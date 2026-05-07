"""Auth shell pages — dashboard, profile, billing, plus nav."""
from __future__ import annotations
from runner import StepResult, capture_errors, safe_goto, screenshot

NAME = "01_shell_and_nav"
ROUTES = ["/dashboard", "/tournaments", "/profile", "/billing"]


def run(page, viewport: str, base_url: str, ctx) -> list[StepResult]:
    out: list[StepResult] = []

    for route in ROUTES:
        with capture_errors(page) as errs:
            status = safe_goto(page, base_url + route)
        screenshot(page, viewport, NAME, route)
        out.append(StepResult(f"GET {route}", status == "ok" and not errs, status, list(errs)))

    # Verify GlobalNav shows on desktop, BottomTabBar on mobile.
    with capture_errors(page) as errs:
        safe_goto(page, base_url + "/dashboard")
        if viewport == "desktop":
            link = page.locator("a", has_text="Dashboard").first
            visible = link.is_visible(timeout=5000)
        else:
            # BottomTabBar — look for the Home tab text or aria-label.
            link = page.locator(
                "[role=navigation], nav"
            ).filter(has_text="Home").first
            visible = link.count() > 0
    screenshot(page, viewport, NAME, "nav-visible")
    out.append(
        StepResult(
            f"{viewport} nav present",
            visible and not errs,
            "visible" if visible else "missing",
            list(errs),
        )
    )

    # Profile dropdown (desktop) / profile route (mobile already covered).
    if viewport == "desktop":
        with capture_errors(page) as errs:
            safe_goto(page, base_url + "/dashboard")
            avatar = page.locator("button[aria-haspopup], button:has(img[alt*=avatar i])").first
            opened = False
            if avatar.count():
                avatar.click(timeout=5000)
                opened = page.locator("text=/Sign out|Profile|Billing/i").first.is_visible(timeout=3000)
        screenshot(page, viewport, NAME, "profile-menu")
        out.append(
            StepResult(
                "profile menu opens",
                opened and not errs,
                "opened" if opened else "no menu",
                list(errs),
            )
        )

    return out
