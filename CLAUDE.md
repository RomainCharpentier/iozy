# IozyCore

A personal, self-hosted knowledge base to catalogue a collection (manga, video games, board games, custom types). Each account has its own collection. The catalogue of works is shared.

Monorepo: `backend/` (Spring Boot, the reference), `web/` (React, the living client), `ios/` (SwiftUI, **out of service** since 2026-08-29). Each folder has its own `CLAUDE.md`. Read the one for the folder you work in.

## Where to look

- `README.md`: how to run and test everything (practical, not architectural).
- `backend/README.md`, `web/README.md`: a "Le projet" section at the top, written to help you take over the code.
- `docs/CONCEPTION.md`: vision and model. If it differs from the code, the code is right.
- `docs/DESIGN_MIGRATION_V1.2.md`: log of the web UI batches.
- `docs/AUDIT_TECHNIQUE.md`, `DEPLOIEMENT.md`, `EXPLOITATION.md`, `USER_JOURNEYS.md`.
- `design_handoff_v2/`: reference mockups of the design.

## Rules for everything

- **Language**: write **code, comments, commit messages, READMEs, docs and `CLAUDE.md` files in English**. Keep the English simple: short sentences, common words, no idioms. Only two things stay in French: **text the app user reads** (labels, error messages, help text) and the chat with the owner.
  - Many existing files are still in French (identifiers like `Carte`, `Jaquette`, `ProprietaireCourant`, comments, READMEs, docs). **Do not rename or translate everything at once.** Write new code and new text in English. When you edit an existing line or section, translate only what you already touch. A mass rename hides the history and breaks routes, cache keys and migrations.
  - Keep an established domain name as it is when it is already public or stored: a route, a URL key like `/releases?mois=`, a shipped database column. Do not translate it in one place only.
- **Public repository**: never put an address, an identifier, a key or a setting of one specific installation in a tracked file. Keep personal notes in a `*.local.md` file (ignored by git). Keep keys in `backend/.env`, never in code.
- **Strengthen before adding**: when the work is not assigned, choose in this order: (1) what is shipped but broken or inconsistent, (2) what is shipped but unreachable or silent, (3) what is fragile. Add a screen only if the feature behind it is really wired.
- **Legitimate metadata sources only**: no scan sites, even as a fallback. Mangacollec is used to check French editions. It is not a source for the app.
- **No provider is required**: every screen has a fallback, and the app says when it uses one. A provider outage never makes a search fail.

## Architecture in one minute

The backend is a **DDD modulith**: one core (`core`) and four universes (`manga`, `videogame`, `boardgame`, `custom`). A universe depends on the core, never the other way, and never on another universe. The core offers extension points that universes implement. `ModulesTest` (Spring Modulith) checks these borders on every build.

Security: the API needs a session (cookie), except for login, instance state and share links. Private data is filtered by owner with `@TenantId` (Hibernate), not in the queries. Details are in `backend/CLAUDE.md`.

## Check a change

| You touched | Run |
|---|---|
| `web/` | `npm test`, `npm run typecheck`, `npm run lint` (see `web/CLAUDE.md`) |
| `backend/` | a targeted subset of tests (see `backend/CLAUDE.md`) |
| a screen flow | `npm run test:e2e` in `web/` |

A check that does not run proves nothing. Several obvious commands check nothing here (`npx tsc --noEmit`, `mvn` without Docker). See the traps in each folder.

## How to work

- **Short and direct**: say the action in one or two sentences, then act. When asked "what do we do?", decide and give the reason. Do not offer a menu. Ask a question only if the answer really changes the work. Put technical detail in the commit message and in `docs/DESIGN_MIGRATION_V1.2.md`, not in the chat.
- **Mockups with several boards**: if a design export has several boards of the same screen, say in one sentence what each one proposes and ask which one is right **before** the first line of code. Nothing in a zip says which one is current, and a wrong choice costs a whole batch.
- **"I see no change"**: first check that the dev server is still running. Do not blame the cache.
- **End of a batch**: check live on throwaway data and return to the exact state before. Add a section to `docs/DESIGN_MIGRATION_V1.2.md`. Commit. Trap: a throwaway purchase analysis leaves a trace (`market_price_observation`, deleted with `DELETE /api/purchase-analysis/market-observations/{id}`). Count the table before and after. Otherwise the check analyses use each other as comparables.
- **Editing files by script**: the working copy mixes LF and CRLF (`core.autocrlf=true`). A multi-line replace written with `\n` can find "0 occurrences", and text inserted with LF makes the file mixed. Normalise to search, then write back with the original line ending. Always check the number of matches before replacing. Git warnings like "LF will be replaced by CRLF" are expected noise.
- **Long Bash commands**: a command over about 5 KB is cut without a clear message (it looks like a quote error). Use one file per call. Write big files with `cat >` then `cat >>`.

## Git

### Branches

The owner may commit **directly on `main`**. For everything else (another contributor, experiments, risky or reviewable changes), **avoid `main`**: work on a branch and let the owner merge. Never force-push.

### Commit message format

Conventional Commits, **in English**, subject and body:

```
type(scope): subject

body (optional)

Co-Authored-By: ...
```

**Type**: pick the one that describes the effect, not the tool.

| Type | When |
|---|---|
| `feat` | new behaviour for the user |
| `fix` | something shipped that behaved wrongly |
| `refactor` | structure changes, behaviour does not |
| `perf` | same result, faster or cheaper |
| `test` | tests only (add, strengthen, remove) |
| `docs` | documentation only (`docs/`, READMEs, `CLAUDE.md`) |
| `chore` | upkeep: dependencies, config, scripts |
| `ci` | GitHub workflows (`.github/workflows`) |
| `style` | formatting with no effect (rare) |
| `revert` | undo an earlier commit |

**Scope** (optional): one lowercase word without accents, or two separated by a comma. It names the layer or the feature.
- Layer: `web`, `api`, `e2e`, `ui`, or `web,api` when a change crosses both.
- Feature: `fiche`, `import`, `recognition`, `purchase-analysis`, `tomes`, `editions`, `catalogue`, `gemini`, `visite`, `metadonnees`, `listing`, `profil`.
- No scope when the change is cross-cutting or the type is enough.
- Reuse an existing scope before you invent one (`git log --format=%s | grep '(fiche)'`). Existing scopes keep their French names: they are feature names.

**Subject**: imperative mood ("add", "retry", "stop"), **no final period**, lowercase first letter, about 65 characters (hard limit about 100). Say **what changes for the user or the system**, not which files changed: `fix(gemini): retry a 503 or 429 before reporting failure`, not `fix: update GeminiClient.java`. More examples: `feat(import): validate extracted titles one by one`, `refactor(web): move shared hooks into common`, `chore(web): bump dependencies within their ranges`.

The history before this rule is in French. Do not rewrite it (no rebase and no `--amend` on pushed commits).

**Body**: for anything not trivial. Give the *why* first (what was wrong or unclear), then the list of what was done, then what was checked (`typecheck, lint, contrast, boundaries, N tests and build green`). Put technical detail here, not in the chat.

**Footer**: end with the `Co-Authored-By` line that the session requires. A numbered batch may keep "Batch N" in the body, not in the subject.

**One commit = one intent.** Do not mix a `fix` and a `feat`, or a `refactor` and a behaviour change. Before you commit, run the full suite of the folder you touched (see `backend/CLAUDE.md` and `web/CLAUDE.md`).

Automatic merge messages (`Merge remote-tracking branch …`) stay as they are.
