"""Click-through orchestrator.

Usage:
    python tests/e2e/run_all.py [BASE_URL]

Iterates every scenario in scenarios/ for both desktop and mobile viewports,
captures screenshots + errors per step, and prints a final pass/fail summary.

Exits non-zero if any step failed.
"""
from __future__ import annotations

import dataclasses
import importlib.util
import sys
import time
import traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import runner  # noqa: E402  (after sys.path tweak)
from runner import StepResult  # noqa: E402

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3001"

SCENARIO_FILES = sorted(p for p in (ROOT / "scenarios").glob("s*.py")
                        if p.name != "__init__.py")
VIEWPORTS = ["desktop", "mobile"]


@dataclasses.dataclass
class Ctx:
    browser: object
    context: object
    context_kwargs: dict


def load_module(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


def main() -> int:
    runner.reset_screenshots()

    if not runner.storage_state_exists():
        print("WARN: tests/e2e/storageState.json missing or empty.")
        print("      Authed scenarios will fail. Run auth_bootstrap.py first.\n")

    overall: list[tuple[str, str, list[StepResult]]] = []
    started = time.time()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for viewport in VIEWPORTS:
            print(f"\n{'='*70}\nVIEWPORT: {viewport}\n{'='*70}")
            ctx_kwargs = runner.context_kwargs(viewport, p)
            for scenario_path in SCENARIO_FILES:
                mod = load_module(scenario_path)
                name = getattr(mod, "NAME", scenario_path.stem)
                print(f"\n--- {viewport} :: {name} ---")
                # Each scenario gets a fresh context so cookies/console don't leak.
                context = browser.new_context(**ctx_kwargs)
                # Tame default timeouts so a stuck selector doesn't hang the run.
                context.set_default_timeout(8000)
                context.set_default_navigation_timeout(30000)
                page = context.new_page()
                ctx = Ctx(browser=browser, context=context, context_kwargs=ctx_kwargs)
                try:
                    results = mod.run(page, viewport, BASE, ctx)
                except Exception:  # noqa: BLE001
                    tb = traceback.format_exc()
                    results = [StepResult(name=f"{name} crashed", ok=False,
                                          detail="see traceback", errors=[tb])]
                for r in results:
                    icon = "PASS" if r.ok else "FAIL"
                    print(f"  [{icon}] {r.name:<40} {r.detail}")
                    for e in r.errors:
                        for line in str(e).splitlines()[:6]:
                            print(f"         {line}")
                overall.append((viewport, name, results))
                context.close()
        browser.close()

    elapsed = time.time() - started
    total = sum(len(r) for _, _, r in overall)
    failed = sum(1 for _, _, rs in overall for r in rs if not r.ok)
    print(f"\n{'='*70}")
    print(f"Click-through complete in {elapsed:.1f}s")
    print(f"{total - failed}/{total} steps passed across {len(VIEWPORTS)} viewports")
    if failed:
        print("\nFAILED STEPS:")
        for vp, sc, rs in overall:
            for r in rs:
                if not r.ok:
                    print(f"  [{vp}/{sc}] {r.name} — {r.detail}")
    print(f"{'='*70}")
    print(f"Screenshots: {runner.SCREENSHOTS}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
