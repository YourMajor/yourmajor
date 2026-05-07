"""Fully automated: mint a magic link via Supabase admin, exchange it for
a session via /auth/v1/verify, then plant the @supabase/ssr cookies in
a Playwright context and save storage state.

Usage:
    python tests/e2e/auth_bootstrap.py [BASE_URL] [EMAIL]

No browser interaction needed.
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
APP_ROOT = ROOT.parent.parent
ENV_LOCAL = APP_ROOT / ".env.local"
STATE_PATH = ROOT / "storageState.json"


def load_env(path: Path) -> dict[str, str]:
    """Tiny .env parser — enough for our two keys."""
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        v = v.strip().strip('"').strip("'")
        out[k.strip()] = v
    return out


def mint_magic_link(supabase_url: str, service_key: str, email: str, redirect_to: str) -> str:
    """Hit /auth/v1/admin/generate_link, return action_link."""
    import urllib.request

    payload = json.dumps({
        "type": "magiclink",
        "email": email,
        "options": {"redirect_to": redirect_to},
    }).encode()
    req = urllib.request.Request(
        f"{supabase_url}/auth/v1/admin/generate_link",
        data=payload,
        method="POST",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        body = json.loads(r.read())
    link = body.get("action_link") or body.get("properties", {}).get("action_link")
    if not link:
        raise RuntimeError(f"no action_link in admin response: {body}")
    return link


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3001"
    email = sys.argv[2] if len(sys.argv) > 2 else "hartleyfanson@gmail.com"

    env = load_env(ENV_LOCAL)
    supabase_url = env.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    service_key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not supabase_url or not service_key:
        print(f"FAIL: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in {ENV_LOCAL}",
              flush=True)
        return 2

    callback = f"{base}/api/auth/callback"
    print(f"Minting magic link for {email} via {urlparse(supabase_url).netloc}", flush=True)
    print(f"  redirect_to = {callback}", flush=True)
    try:
        action_link = mint_magic_link(supabase_url, service_key, email, redirect_to=callback)
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL: admin generate_link error: {exc}", flush=True)
        return 3
    print(f"  got action_link, length = {len(action_link)}", flush=True)

    # Fetch the verify URL with redirects DISABLED — its 302 Location
    # header carries access_token/refresh_token in the URL fragment
    # (Supabase's implicit flow, used because our PKCE redirect_to isn't
    # in the project's allow-list).
    import urllib.parse
    import urllib.request
    import urllib.error

    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **kw):  # noqa: D401
            return None

    print("  fetching verify URL (no-redirect) for tokens...", flush=True)
    opener = urllib.request.build_opener(NoRedirect)
    try:
        opener.open(action_link, timeout=15)
        location = None
    except urllib.error.HTTPError as e:
        location = e.headers.get("Location")
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL: verify request error: {exc}", flush=True)
        return 4

    if not location or "#" not in location:
        print(f"FAIL: no fragment in Location: {location}", flush=True)
        return 4

    fragment = location.split("#", 1)[1]
    parts = dict(urllib.parse.parse_qsl(fragment))
    access_token = parts.get("access_token")
    refresh_token = parts.get("refresh_token")
    expires_at = int(parts.get("expires_at", "0"))
    expires_in = int(parts.get("expires_in", "3600"))
    token_type = parts.get("token_type", "bearer")
    if not access_token or not refresh_token:
        print(f"FAIL: missing tokens in fragment: keys={list(parts)}", flush=True)
        return 4
    print(f"  got tokens (access={len(access_token)}c, refresh={len(refresh_token)}c)", flush=True)

    # Need user object for the Supabase session shape — fetch /auth/v1/user.
    anon_key = env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    if not anon_key:
        print("FAIL: NEXT_PUBLIC_SUPABASE_ANON_KEY missing in .env.local", flush=True)
        return 4
    try:
        ureq = urllib.request.Request(
            f"{supabase_url}/auth/v1/user",
            headers={
                "apikey": anon_key,
                "Authorization": f"Bearer {access_token}",
            },
        )
        with urllib.request.urlopen(ureq, timeout=15) as r:
            user = json.loads(r.read())
    except Exception as exc:  # noqa: BLE001
        print(f"FAIL: GET /auth/v1/user: {exc}", flush=True)
        return 4
    print(f"  user.email = {user.get('email')}, user.id = {user.get('id')}", flush=True)

    # Derive project_ref from the Supabase URL (https://{ref}.supabase.co).
    project_ref = urlparse(supabase_url).hostname.split(".")[0]
    cookie_name = f"sb-{project_ref}-auth-token"

    # @supabase/ssr session-cookie shape: base64-{base64(JSON.stringify(session))}
    session = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": expires_in,
        "expires_at": expires_at,
        "token_type": token_type,
        "user": user,
    }
    import base64
    encoded = base64.b64encode(json.dumps(session).encode()).decode()
    cookie_value = f"base64-{encoded}"

    # Chunk if longer than ~3180 bytes — @supabase/ssr splits into .0, .1, ...
    CHUNK_SIZE = 3180

    def cookie_chunks(value: str) -> list[tuple[str, str]]:
        if len(value) <= CHUNK_SIZE:
            return [(cookie_name, value)]
        chunks: list[tuple[str, str]] = []
        for i in range(0, len(value), CHUNK_SIZE):
            chunks.append((f"{cookie_name}.{i // CHUNK_SIZE}", value[i:i + CHUNK_SIZE]))
        return chunks

    target_host = urlparse(base).hostname or "localhost"
    cookies_to_set = [
        {
            "name": name,
            "value": val,
            "domain": target_host,
            "path": "/",
            "httpOnly": False,  # @supabase/ssr browser cookies are non-HttpOnly
            "secure": False,
            "sameSite": "Lax",
        }
        for name, val in cookie_chunks(cookie_value)
    ]
    print(f"  injecting {len(cookies_to_set)} cookie chunk(s)", flush=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        context.add_cookies(cookies_to_set)
        page = context.new_page()
        try:
            page.goto(f"{base}/dashboard", wait_until="networkidle", timeout=30000)
        except Exception as exc:  # noqa: BLE001
            print(f"  /dashboard nav: {exc}", flush=True)

        url = page.url
        all_cookies = context.cookies()
        sb_cookies = [c for c in all_cookies if c["name"].startswith("sb-")]
        print(f"  final url = {url}", flush=True)
        print(f"  sb cookies present: {[c['name'] for c in sb_cookies]}", flush=True)

        if "/auth/login" in url or not sb_cookies:
            print("FAIL: did not reach an authenticated state.", flush=True)
            try:
                page.screenshot(path=str(ROOT / "auth_bootstrap_error.png"))
                (ROOT / "auth_bootstrap_error.html").write_text(page.content(), encoding="utf-8")
            except Exception:
                pass
            browser.close()
            return 5

        context.storage_state(path=str(STATE_PATH))
        print(f"OK: saved {STATE_PATH}", flush=True)
        browser.close()
    return 0


if __name__ == "__main__":
    # Force unbuffered stdout on Windows so logs land in the bash output file.
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except Exception:
        pass
    sys.exit(main())
