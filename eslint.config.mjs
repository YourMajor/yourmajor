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
