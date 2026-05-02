"""Authenticated smoke pass.

Approach: mint an OTP via Supabase admin API, exchange it for an access/refresh
token via the public verify endpoint, then construct the @supabase/ssr cookie
format and inject it into the Playwright browser context.
"""
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
print(f"project ref: {PROJECT_REF}, cookie name: {COOKIE_NAME}")

# 1. Mint magic link to get email OTP
req = urllib.request.Request(
    f"{SUPABASE_URL}/auth/v1/admin/generate_link",
    data=json.dumps({"type": "magiclink", "email": EMAIL}).encode(),
    headers={
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
    },
)
with urllib.request.urlopen(req, timeout=15) as resp:
    payload = json.loads(resp.read())

otp = (
    payload.get("email_otp")
    or payload.get("properties", {}).get("email_otp")
    or payload.get("hashed_token")
    or payload.get("properties", {}).get("hashed_token")
)
if not otp:
    print("no email_otp in admin response. keys:", list(payload.keys()))
    print(json.dumps(payload, indent=2)[:600])
    sys.exit(1)
print(f"got otp: {otp[:8]}...")

# 2. Verify OTP to get access/refresh tokens
req = urllib.request.Request(
    f"{SUPABASE_URL}/auth/v1/verify",
    data=json.dumps({"type": "magiclink", "email": EMAIL, "token": otp}).encode(),
    headers={
        "apikey": ANON_KEY,
        "Authorization": f"Bearer {ANON_KEY}",
        "Content-Type": "application/json",
    },
)
try:
    with urllib.request.urlopen(req, timeout=15) as resp:
        session = json.loads(resp.read())
except urllib.error.HTTPError as e:
    body = e.read().decode("utf-8", errors="replace")
    print(f"verify HTTP {e.code}: {body[:600]}")
    sys.exit(1)

access_token = session.get("access_token")
refresh_token = session.get("refresh_token")
expires_in = session.get("expires_in", 3600)
expires_at = session.get("expires_at")
user = session.get("user")
if not access_token or not refresh_token or not user:
    print("verify response missing fields:", list(session.keys()))
    sys.exit(1)
print(f"got access_token ({len(access_token)} chars), refresh_token, user.id={user.get('id')}")

# 3. Build the @supabase/ssr cookie value: 'base64-' + base64(JSON.stringify(session))
session_obj = {
    "access_token": access_token,
    "refresh_token": refresh_token,
    "expires_in": expires_in,
    "expires_at": expires_at,
    "token_type": session.get("token_type", "bearer"),
    "user": user,
}
session_json = json.dumps(session_obj, separators=(",", ":"))
cookie_value = "base64-" + base64.b64encode(session_json.encode()).decode()
print(f"cookie value length: {len(cookie_value)}")

OUT = Path("C:/Users/Beast/AppData/Local/Temp/claude-smoke")
OUT.mkdir(parents=True, exist_ok=True)

# Cookies > 4096 bytes need splitting into .0, .1 chunks. The chunk size used
# by @supabase/ssr is around 3180 bytes per chunk to leave headroom.
CHUNK_SIZE = 3180

def chunked_cookies(name: str, value: str):
    if len(value) <= CHUNK_SIZE:
        return [{"name": name, "value": value}]
    chunks = [value[i:i + CHUNK_SIZE] for i in range(0, len(value), CHUNK_SIZE)]
    return [{"name": f"{name}.{i}", "value": c} for i, c in enumerate(chunks)]

cookies_to_set = []
for entry in chunked_cookies(COOKIE_NAME, cookie_value):
    cookies_to_set.append({
        **entry,
        "domain": "localhost",
        "path": "/",
        "httpOnly": False,
        "secure": False,
        "sameSite": "Lax",
    })

PAGES_AUTHED = [
    ("authed-dashboard", "http://localhost:3000/dashboard"),
    ("authed-tournament-hub", "http://localhost:3000/test-tournament"),
    ("authed-tournament-leaderboard", "http://localhost:3000/test-tournament/leaderboard"),
    ("authed-league-season", "http://localhost:3000/test-league-2/season"),
    ("authed-admin-setup", "http://localhost:3000/test-tournament/admin/setup"),
    ("authed-admin-groups", "http://localhost:3000/test-tournament/admin/groups"),
    ("authed-admin-invites", "http://localhost:3000/test-tournament/admin/invites"),
    ("authed-admin-roster", "http://localhost:3000/test-league-2-apr-28/admin/roster"),
]

problems: list[str] = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context()
    context.add_cookies(cookies_to_set)
    page = context.new_page()

    page.goto("http://localhost:3000/dashboard", wait_until="networkidle", timeout=30000)
    if "/auth/login" in page.url:
        print(f"FAIL: cookie injection didn't authenticate (still at {page.url})")
        # Print cookies for debugging
        for c in context.cookies():
            print(f"  cookie: {c['name']} ({len(c['value'])} chars)")
        sys.exit(1)
    print(f"authed: dashboard at {page.url}")

    for label, url in PAGES_AUTHED:
        console_errors: list[str] = []
        page_errors: list[str] = []
        bad_requests: list[str] = []

        def on_console(msg):
            if msg.type == "error":
                console_errors.append(msg.text)

        def on_page_error(err):
            page_errors.append(str(err))

        def on_response(resp):
            if resp.status >= 500:
                bad_requests.append(f"{resp.status} {resp.url}")

        page.on("console", on_console)
        page.on("pageerror", on_page_error)
        page.on("response", on_response)

        try:
            page.goto(url, wait_until="networkidle", timeout=30000)
        except Exception as e:
            problems.append(f"[{label}] navigation failed: {e}")
            page.remove_listener("console", on_console)
            page.remove_listener("pageerror", on_page_error)
            page.remove_listener("response", on_response)
            continue

        page.wait_for_timeout(1200)

        screenshot = OUT / f"{label}.png"
        page.screenshot(path=str(screenshot), full_page=False)

        body_text_len = len(page.locator("body").inner_text())
        url_now = page.url

        meaningful = [e for e in console_errors if not any(skip in e for skip in [
            "Failed to load resource",
            "DevTools",
        ])]

        page.remove_listener("console", on_console)
        page.remove_listener("pageerror", on_page_error)
        page.remove_listener("response", on_response)

        status = "OK"
        if page_errors or meaningful or bad_requests:
            status = "ISSUES"

        print(f"[{status}] {label}")
        print(f"  -> {url_now}  body={body_text_len}ch  shot={screenshot.name}")
        for e in page_errors:
            print(f"  ! pageerror: {e[:300]}")
        for e in meaningful:
            print(f"  ! console: {e[:300]}")
        for r in bad_requests:
            print(f"  ! 5xx: {r}")

        if status == "ISSUES":
            problems.append(label)

    context.close()
    browser.close()

print()
print("=" * 60)
if problems:
    print(f"FAIL: {len(problems)} page(s) had issues: {', '.join(problems)}")
    sys.exit(1)
else:
    print("PASS: all authed pages rendered cleanly")
