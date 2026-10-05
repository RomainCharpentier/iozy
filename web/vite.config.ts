import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Which number what we are writing right now would carry.
 *
 * In a container, the number comes from the workflow (`ARG VERSION`, see
 * .github/workflows/deploiement.yml) and this function is never called -
 * `VITE_VERSION` is already set, and the build image has neither git nor
 * tags anyway. Outside a container, there was NOTHING: the footer said
 * "Version dev", which answers "I do not know" to the only question it asks.
 *
 * Git knows: it is the same calculation as the release, the same file
 * (scripts/version.mjs), deduced from the commit messages.
 *
 * The `-dev` suffix is not decoration. A workstation has uncommitted changes,
 * so its number designates NO published image: showing a plain "1.1.0" would
 * pass a draft off as a release, exactly what `ARG VERSION=dev` avoided until
 * now. "1.1.0-dev" says both things at once - which commit we start from, and
 * that we are not a release. This is also what `-dev` means in version
 * semantics: a pre-release, which comes BEFORE the published 1.1.0.
 */
function versionDuPosteDeTravail(): string {
  try {
    // As a subprocess and not by import: this file is also read by the
    // container build, where the script would fail for lack of tags - so it
    // must run only if nobody has already set the version.
    return `${execSync('node scripts/version.mjs', { encoding: 'utf8', cwd: import.meta.dirname }).trim()}-dev`
  } catch {
    // No git, no tag, no repository: invent nothing.
    return 'dev'
  }
}

// Vite exposes the `VITE_` variables already present in process.env: the
// container one wins, and nothing runs when it is there.
process.env.VITE_VERSION ??= versionDuPosteDeTravail()

// https://vite.dev/config/
export default defineConfig({
  // The same alias as tsconfig.app.json: `@/` = src (Batch 134).
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [react(), tailwindcss()],
  server: {
    // "localhost" alone made Vite listen ONLY on IPv6 ([::1]) on this
    // machine (checked manually: `netstat` showed no listener on IPv4
    // 127.0.0.1) - the browser resolving "localhost" to IPv4 then had its
    // connection refused. true = listen on all interfaces (0.0.0.0 AND ::),
    // whatever the local DNS resolution of "localhost".
    host: true,
    // The backend (Spring Boot, docker compose) runs on :8080 with no
    // structuring CORS for this case - all /api requests go through this
    // proxy instead of an absolute URL, so the browser sees them as
    // same-origin (see backend/src/main/java/com/iozycore/api/config/CorsConfig.java
    // for the server-side safety net, not required here).
    proxy: {
      '/api': {
        // Configurable for the end-to-end tests, which run their own stack
        // on another port (see backend/docker-compose.e2e.yml): without this,
        // they would write into the everyday database.
        target: process.env.IOZYCORE_API ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    // jsdom for everyone: pure modules do not need it, but two environments
    // in the same suite would force us to ask, for each new file, which one
    // it falls into.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // No `globals: true`: `describe`/`it`/`expect` are imported, like all the
    // rest of the code in this repository. A test that reads without knowing
    // what the configuration injects can still be read months later.
    // `scripts/` in addition to `src/`: the version number calculation lives
    // there, and it is code whose errors would show on no screen.
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
  },
})
