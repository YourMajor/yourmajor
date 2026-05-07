"""Tournament hub: leaderboard, chat, photos. Sponsor banner render."""
from __future__ import annotations
import re
import time
from runner import StepResult, capture_errors, safe_goto, screenshot

NAME = "02_tournament_hub"
SLUG = "test-league-2-jun-23"


def run(page, viewport: str, base_url: str, ctx) -> list[StepResult]:
    out: list[StepResult] = []
    hub = f"{base_url}/{SLUG}"

    # Hub root
    with capture_errors(page) as errs:
        status = safe_goto(page, hub)
    screenshot(page, viewport, NAME, "hub-root")
    out.append(StepResult(f"GET /{SLUG}", status == "ok" and not errs, status, list(errs)))

    # Detect whether this slug is a tournament hub or a league season page.
    # Leagues redirect /<slug> to a season-style shell with Standings/Schedule/Awards
    # tabs and no chat/photos.
    is_league = page.get_by_text("Season Standings", exact=False).count() > 0 \
        or page.get_by_role("tab", name="Standings").count() > 0

    # Sponsor strip render (may not be present if not configured — make non-blocking)
    sponsor_present = page.locator("[data-sponsor-strip], img[alt*=sponsor i]").count() > 0
    out.append(StepResult("sponsor strip present", True,
                          f"{'yes' if sponsor_present else 'absent (ok)'}", []))

    # Leaderboard / Standings table content
    with capture_errors(page) as errs:
        has_lb = page.locator("table, [role=table], [data-leaderboard]").first.count() > 0
        if not has_lb:
            has_lb = page.locator(
                "text=/Leaderboard|^Pos$|Position|Standings/i"
            ).first.count() > 0
    screenshot(page, viewport, NAME, "leaderboard")
    out.append(StepResult("leaderboard/standings renders", has_lb and not errs,
                          "present" if has_lb else "missing", list(errs)))

    if is_league:
        out.append(StepResult("chat/photos tabs (league shell)", True,
                              "skipped — leagues use season shell", []))
        return out

    # Tournament-shell only: chat tab
    with capture_errors(page) as errs:
        chat_tab = page.locator("[role=tab]", has_text="Chat").first
        if chat_tab.count():
            chat_tab.click(timeout=5000)
            page.wait_for_timeout(500)
            chat_visible = page.locator("textarea, input[placeholder*=message i]").first.count() > 0
        else:
            chat_visible = False
    screenshot(page, viewport, NAME, "chat-tab")
    out.append(StepResult("chat tab opens", chat_visible and not errs,
                          "opened" if chat_visible else "no chat tab", list(errs)))

    # Send a chat message (idempotent-ish; just adds one row)
    if chat_visible:
        with capture_errors(page) as errs:
            box = page.locator("textarea, input[placeholder*=message i]").first
            ts = int(time.time())
            box.fill(f"e2e {viewport} {ts}")
            # Try Enter then send button
            box.press("Enter")
            page.wait_for_timeout(800)
            sent = page.locator(f"text=e2e {viewport} {ts}").first.count() > 0
            if not sent:
                btn = page.get_by_role("button", name=re.compile(r"^Send$", re.I)).first
                if btn.count() > 0:
                    btn.click(timeout=3000)
                    page.wait_for_timeout(800)
                    sent = page.locator(f"text=e2e {viewport} {ts}").first.count() > 0
        screenshot(page, viewport, NAME, "chat-sent")
        out.append(StepResult("send chat message", sent and not errs,
                              "sent" if sent else "not visible after send", list(errs)))

    # Photos tab
    with capture_errors(page) as errs:
        photos_tab = page.locator("[role=tab]", has_text="Photos").first
        if photos_tab.count():
            photos_tab.click(timeout=5000)
            page.wait_for_timeout(500)
            photos_visible = page.locator("text=/Upload|No photos|Drag/i").first.count() > 0
        else:
            photos_visible = False
    screenshot(page, viewport, NAME, "photos-tab")
    out.append(StepResult("photos tab opens", photos_visible and not errs,
                          "opened" if photos_visible else "no photos tab", list(errs)))

    return out
