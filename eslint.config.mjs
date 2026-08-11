import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local Playwright python venv — vendored JS/TS in there isn't ours.
    ".venv-playwright/**",
  ]),
  // The chart kit is vendored upstream code (see `feat(charts): vendor the
  // bklit chart primitives on visx`), written before the React Compiler rules
  // this repo enforces. It tripped 36 errors the moment it landed, which failed
  // the Lint step and meant `test` and `build` stopped running in CI entirely.
  //
  // Rules are switched off only for this path, and only the ones vendored code
  // legitimately trips — not the directory as a whole, because the
  // no-restricted-imports guard below must keep applying here too. Fixing these
  // upstream-style would be undone by the next re-vendor. Warnings are left on
  // so the file still reports something.
  {
    files: ["src/components/charts/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Block @/lib/scoring (server-only Prisma queries) from client components.
  // Client UI must use @/lib/scoring-utils (pure, client-safe) instead — the
  // original violation pulled `pg` into the browser bundle and broke chunk loading.
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/scoring",
              message:
                "Use @/lib/scoring-utils for client-safe helpers. @/lib/scoring imports prisma/pg and must stay server-side.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
