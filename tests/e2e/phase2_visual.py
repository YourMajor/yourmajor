"""Phase 2 bounded visual round: dashboard, branded + default tournament, admin.
Derived from smoke-auth.py's cookie-injection auth. One pass, two viewports."""
from __future__ import annotations

import base64
import io
import json
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

env_path = Path("C:/Users/Beast/Projects/golf-tournament-app/.env.local")
env: dict[str, str] = {}
for raw in env_path.read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip().strip('"').strip("'")

SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"]
ANON_KEY = env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"]
EMAIL = "hartleyfanson@gmail.com"
PROJECT_REF = urlparse(SUPABASE_URL).hostname.split(".")[0]
COOKIE_NAME = f"sb-{PROJECT_REF}-auth-token"

req = urllib.request.Request(
    f"{SUPABASE_URL}/auth/v1/admin/generate_link",
    data=json.dumps({"type": "magiclink", "email": EMAIL}).encode(),
    headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}",
             "Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=15) as resp:
    payload = json.loads(resp.read())
otp = (payload.get("email_otp") or payload.get("properties", {}).get("email_otp")
       or payload.get("hashed_token") or payload.get("properties", {}).get("hashed_token"))
req = urllib.request.Request(
    f"{SUPABASE_URL}/auth/v1/verify",
    data=json.dumps({"type": "magiclink", "email": EMAIL, "token": otp}).encode(),
    headers={"apikey": ANON_KEY, "Authorization": f"Bearer {ANON_KEY}",
             "Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=15) as resp:
    session = json.loads(resp.read())

session_obj = {
    "access_token": session["access_token"],
    "refresh_token": session["refresh_token"],
    "expires_in": session.get("expires_in", 3600),
    "expires_at": session.get("expires_at"),
    "token_type": session.get("token_type", "bearer"),
    "user": session["user"],
}
cookie_value = "base64-" + base64.b64encode(
    json.dumps(session_obj, separators=(",", ":")).encode()).decode()
CHUNK = 3180
chunks = ([{"name": COOKIE_NAME, "value": cookie_value}] if len(cookie_value) <= CHUNK
          else [{"name": f"{COOKIE_NAME}.{i}", "value": cookie_value[o:o + CHUNK]}
                for i, o in enumerate(range(0, len(cookie_value), CHUNK))])
cookies = [{**c, "domain": "localhost", "path": "/", "httpOnly": False,
            "secure": False, "sameSite": "Lax"} for c in chunks]

OUT = Path("C:/Users/Beast/Projects/golf-tournament-app/tests/e2e/screenshots/phase2")
OUT.mkdir(parents=True, exist_ok=True)

PAGES = [
    ("dashboard", "http://localhost:3000/dashboard"),
    ("hub-green", "http://localhost:3000/qa-low-gross-low-net"),
    ("hub-purple", "http://localhost:3000/test-league-2-jun-23"),
    ("admin", "http://localhost:3000/qa-low-gross-low-net/admin"),
    ("profile", "http://localhost:3000/profile"),
]
VIEWPORTS = [("1440", 1440, 900), ("390", 390, 844)]

problems: list[str] = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for vp_label, w, h in VIEWPORTS:
        context = browser.new_context(viewport={"width": w, "height": h})
        context.add_cookies(cookies)
        page = context.new_page()
        errors: list[str] = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        for label, url in PAGES:
            errors.clear()
            try:
                page.goto(url, wait_until="networkidle", timeout=40000)
                page.wait_for_timeout(600)
                page.screenshot(path=str(OUT / f"{label}-{vp_label}.png"), full_page=True)
                status = "AUTH-FAIL" if "/auth/login" in page.url else "ok"
                err_txt = "; ".join(errors[:3])
                print(f"{vp_label} {label}: {status} {page.url} {err_txt}")
                if status != "ok":
                    problems.append(f"{label}-{vp_label}: {page.url}")
                if errors:
                    problems.append(f"{label}-{vp_label} console: {err_txt}")
            except Exception as e:
                print(f"{vp_label} {label}: ERROR {e}")
                problems.append(f"{label}-{vp_label}: {e}")
        context.close()
    browser.close()

print("PROBLEMS:" if problems else "CLEAN")
for pr in problems:
    print(" -", pr)
