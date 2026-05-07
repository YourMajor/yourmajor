"""PWA: manifest, service worker registration, icons reachable."""
from __future__ import annotations
from runner import StepResult, capture_errors, safe_goto, screenshot

NAME = "09_pwa"


def run(page, viewport: str, base_url: str, ctx) -> list[StepResult]:
    out: list[StepResult] = []

    # Manifest fetch
    with capture_errors(page) as errs:
        try:
            resp = page.request.get(f"{base_url}/manifest.json", timeout=10000)
            ok = resp.ok
            ct = resp.headers.get("content-type", "")
            body_ok = "name" in resp.text() if ok else False
        except Exception as exc:  # noqa: BLE001
            ok = False
            body_ok = False
            errs.append(str(exc))
    out.append(StepResult("manifest.json", ok and body_ok and not errs,
                          f"ok={ok} ct={ct if ok else '-'}", list(errs)))

    # Service worker registers on dashboard load. In Next.js dev mode
    # `next-pwa` typically does NOT register a SW (production-only). We
    # treat 0 registrations as informational rather than a failure.
    with capture_errors(page) as errs:
        safe_goto(page, f"{base_url}/dashboard")
        sw_count = page.evaluate(
            "async () => 'serviceWorker' in navigator ? "
            "(await navigator.serviceWorker.getRegistrations()).length : -1"
        )
    is_dev = "localhost" in base_url or "127.0.0.1" in base_url
    ok = (sw_count > 0) or (is_dev and sw_count == 0)
    detail = (f"registrations={sw_count}"
              + (" (expected 0 in dev)" if is_dev and sw_count == 0 else ""))
    out.append(StepResult("service worker registered (or skipped in dev)",
                          ok and not errs, detail, list(errs)))
    screenshot(page, viewport, NAME, "dashboard-with-sw")

    return out
