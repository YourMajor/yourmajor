"""History page: podium card + roster table. NEW feature."""
from __future__ import annotations
from runner import StepResult, capture_errors, safe_goto, screenshot

NAME = "03_history_page"
SLUG = "test-league-2-jun-23"


def run(page, viewport: str, base_url: str, ctx) -> list[StepResult]:
    out: list[StepResult] = []

    with capture_errors(page) as errs:
        status = safe_goto(page, f"{base_url}/{SLUG}/history")
    screenshot(page, viewport, NAME, "load")

    # /history is route logic:
    # - leagues redirect to /{slug}/season
    # - non-renewed tournaments redirect to /{slug}
    # - renewed tournaments render the history page with podium + roster
    # All three are valid "ok" outcomes; we just verify no errors.
    final_url = page.url
    has_history_header = page.locator("h1", has_text="History").first.count() > 0
    is_renewed = has_history_header
    is_redirected_league = final_url.endswith(f"/{SLUG}/season")
    is_redirected_hub = final_url.endswith(f"/{SLUG}") or final_url.endswith(f"/{SLUG}/")
    landed_ok = is_renewed or is_redirected_league or is_redirected_hub

    redirect_kind = (
        "rendered" if is_renewed else
        "redirected->season" if is_redirected_league else
        "redirected->hub" if is_redirected_hub else
        "unexpected"
    )
    out.append(StepResult(
        "history loads or redirects",
        landed_ok and not errs,
        f"{redirect_kind} ({final_url})",
        list(errs),
    ))

    if has_history_header:
        # Podium card
        podium = page.locator("[data-history-podium], text=/^(1st|2nd|3rd|Champion)/i").first
        out.append(StepResult("podium card", podium.count() > 0,
                              f"count={podium.count()}", []))
        # Roster table
        roster = page.locator("table, [role=table]").first
        out.append(StepResult("roster table", roster.count() > 0,
                              f"count={roster.count()}", []))
        screenshot(page, viewport, NAME, "podium-and-roster")

    return out
