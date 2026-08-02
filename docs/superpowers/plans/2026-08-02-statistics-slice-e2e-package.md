# Statistics Slice End-to-End Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Foundation Plan Task 10 by exercising a non-zero fixture-derived statistics slice in an isolated test bootstrap and verifying the unsigned macOS package contents.

**Architecture:** Add one sanitized, metadata-only in-memory `SessionSource` fixture for end-to-end tests rather than inventing a production parser for unsupported real formats. Extend `createApplication` with an explicit dependency object whose defaults preserve production behavior; tests inject a temporary database path, sources, UI controllers, and IPC adapter directly from test code. A package smoke script validates the built `.app`/archive inputs without adding production IPC, renderer arguments, or command-line injection.

**Tech Stack:** Electron 43.2, TypeScript 7, Vitest 4.1, React 19.2, SQLite, electron-builder, Node 22.23.1, pnpm 10.

## Global Constraints

- Keep all production defaults and renderer-visible APIs unchanged.
- Test injection is available only through imported TypeScript interfaces; do not read test roots from renderer input, IPC, environment variables, or production CLI arguments.
- The evidenced E2E fixture contains normalized metadata only and must include no prompt, response, conversation body, credential, or personal filesystem path.
- Continue reporting real Claude Code, Codex, and Hermes formats as `FORMAT_NOT_ESTABLISHED`; the fixture is not evidence for a production parser.
- Use a temporary SQLite path and fake UI/IPC boundaries so automated tests never touch real user data or open windows.
- Missing metrics remain `null`; quota is never inferred.
- Package output remains unsigned and macOS-only under `release/`.

---

### Task 1: Add an isolated application composition seam

**Files:**
- Modify: `src/main/application.ts`
- Create: `tests/unit/main/application.test.ts`

**Interfaces:**
- Produces: `ApplicationDependencies`, an explicit dependency object accepted by `createApplication(overrides?: Partial<ApplicationDependencies>)`
- Preserves: `createApplication()` production behavior and `TokenActivityShowApplication.start/activate/dispose`
- Exposes for tests: `refresh(trigger)` and `getToday(input)` through an application test harness returned by injected adapters, not through renderer IPC

- [ ] **Step 1: Write failing composition tests**

Add tests with a temporary SQLite path and fakes for windows, tray, IPC registration, scheduler timing, clock/today input, and `SessionSource[]`. Assert:

1. `createApplication()` can still be called with no arguments.
2. Injected `databasePath` is passed to `openDatabase` instead of `app.getPath('userData')`.
3. Injected sources are registered instead of production sources.
4. `start()` creates tray/windows, schedules once, and starts one refresh.
5. `dispose()` remains ordered and idempotent.

Capture the concrete coordinator and Today service through injected factory functions so the test can await startup work without adding methods to the production application interface.

- [ ] **Step 2: Run the tests and verify the seam is missing**

Run: `pnpm vitest run tests/unit/main/application.test.ts`

Expected: FAIL because `createApplication` accepts no dependency overrides.

- [ ] **Step 3: Implement production-defaulted dependencies**

Refactor construction only. Define defaults for:

- database path: `join(app.getPath('userData'), 'token-activity-show.sqlite')`
- sources: `createClaudeCodeSource()`, `createCodexSource()`, `createHermesSource()`
- windows/tray controllers
- IPC registration
- scheduler/coordinator factories
- `currentTodayInput`

Merge explicit overrides at the top of `createApplication`. Keep the existing start/dispose sequence and all production callback wiring unchanged. Do not introduce global mutable test state.

- [ ] **Step 4: Verify lifecycle behavior**

Run: `pnpm vitest run tests/unit/main/application.test.ts tests/unit/main/windows.test.ts tests/integration/ipc/register-ipc.test.ts`

Expected: PASS with no Electron window creation in the application tests.

- [ ] **Step 5: Commit the composition seam**

```bash
git add src/main/application.ts tests/unit/main/application.test.ts
git commit -m "test: isolate application composition"
```

---

### Task 2: Exercise the non-zero vertical slice

**Files:**
- Create: `tests/fixtures/e2e/evidenced-sessions.ts`
- Create: `tests/e2e/statistics-slice.test.ts`
- Modify only if required by the test seam: `src/main/application.ts`

**Interfaces:**
- Consumes: `SessionSource`, `NormalizedSession`, `createApplication(overrides)`
- Produces: one deterministic metadata-only source with provider ID `claude-code`, non-zero native session and interaction counts, nullable unsupported metrics, and a stable fingerprint/content version

- [ ] **Step 1: Create the sanitized metadata fixture**

Export a deterministic fake `SessionSource` containing two sessions dated on a fixed local day. Use generic values such as `projectName: 'sample-project'`, `workingDirectory: null`, and `model: null`. Include a sentinel constant such as `RAW_BODY_MUST_NOT_BE_STORED`, but never place it inside either normalized session; use it only to search the resulting database bytes.

The source must return truthful capabilities matching its fields and must not be imported from any production source adapter.

- [ ] **Step 2: Write the failing vertical-slice test**

Use a temporary directory and database file. Inject the fixture source, fixed current-date input, fake windows/tray, and an IPC registrar that captures the typed service callbacks. Then:

1. start the application and await the captured startup refresh;
2. invoke captured `getToday` for the fixture date/time zone;
3. assert the Claude Code provider and overall native session counts are `2` and interaction totals are non-zero;
4. render `MenuBarApp` with a renderer API fake backed by the captured service and assert the provider/session evidence is visible;
5. invoke a second refresh and assert inserted/updated counts are zero and unchanged count is `2`;
6. dispose the application;
7. read the temporary SQLite file as bytes and assert it does not contain `RAW_BODY_MUST_NOT_BE_STORED`.

- [ ] **Step 3: Run the test and observe the first real integration gap**

Run: `pnpm vitest run tests/e2e/statistics-slice.test.ts`

Expected: FAIL only at the unimplemented composition/capture detail, not because real user roots are consulted.

- [ ] **Step 4: Make the minimum integration adjustment**

If Task 1's dependency object does not expose enough control, add only a factory dependency or callback required to await the startup coordinator. Do not add methods to `RendererApi`, production command-line flags, environment switches, or generic IPC.

- [ ] **Step 5: Verify the full vertical slice**

Run: `pnpm vitest run tests/e2e/statistics-slice.test.ts tests/integration/refresh/scan-to-database.test.ts tests/renderer/MenuBarApp.test.tsx`

Expected: PASS; the E2E test shows non-zero fixture-derived statistics, idempotent rescanning, and no body sentinel in SQLite.

- [ ] **Step 6: Commit the vertical slice**

```bash
git add tests/fixtures/e2e/evidenced-sessions.ts tests/e2e/statistics-slice.test.ts src/main/application.ts
git commit -m "test: exercise fixture statistics slice"
```

---

### Task 3: Document and verify unsigned packaging

**Files:**
- Create: `scripts/smoke-package.mjs`
- Create: `docs/development.md`
- Modify: `package.json`
- Modify: `electron-builder.yml`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `pnpm smoke:package`
- Consumes: electron-builder output under `release/`
- Verifies: packaged app contains `out/main`, `out/preload`, `out/renderer`, and tray asset; excludes `tests/`, `fixtures/`, and source maps/test-only modules

- [ ] **Step 1: Add a failing package smoke script**

Implement `scripts/smoke-package.mjs` using Node built-ins and macOS `unzip -l`/filesystem inspection. It must:

1. locate the `.app` and ZIP output under `release/` deterministically;
2. inspect `Contents/Resources/app.asar` with the installed `asar` CLI/API or inspect unpacked resources according to builder output;
3. require main, preload, renderer, package metadata, and tray asset;
4. reject paths beginning with `tests/`, `fixtures/`, `docs/`, or containing the E2E fixture module;
5. print one concise success summary and exit non-zero with a specific missing/forbidden path message.

- [ ] **Step 2: Register scripts and package boundaries**

Add `"smoke:package": "node scripts/smoke-package.mjs"` to `package.json`. Keep `files` allowlisted in `electron-builder.yml`; add explicit exclusions only if inspection proves electron-builder includes a forbidden path. Add `release/` to `.gitignore` while preserving existing entries.

- [ ] **Step 3: Write development documentation**

Document exact prerequisites and commands:

- Node `22.23.1`
- pnpm `10`
- macOS
- `pnpm dev`, focused fixture/E2E tests, `pnpm test`
- read-only source probing and its privacy restrictions
- `FORMAT_NOT_ESTABLISHED` behavior
- `pnpm package:mac` and `pnpm smoke:package`
- unsigned artifact limitations and the fact that signing/notarization belong to Release Hardening

Also state that E2E evidenced sessions are metadata-only synthetic integration evidence and do not establish a real provider file format.

- [ ] **Step 4: Build and inspect the unsigned package**

Run:

```bash
pnpm package:mac
pnpm smoke:package
```

Expected: DMG/ZIP and `.app` exist under `release/`; the smoke script passes and no test/fixture directory is packaged.

- [ ] **Step 5: Commit packaging verification**

```bash
git add scripts/smoke-package.mjs docs/development.md package.json electron-builder.yml .gitignore
git commit -m "test: verify unsigned macOS package"
```

---

### Task 4: Run Foundation Plan exit gates

**Files:**
- Modify only when a gate exposes a Task 10 regression

**Interfaces:**
- Verifies all Foundation Plan interfaces and exit criteria

- [ ] **Step 1: Run static and automated gates under Node 22.23.1**

```bash
node --version
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package:mac
pnpm smoke:package
```

Expected: Node reports `v22.23.1`; every command exits zero.

- [ ] **Step 2: Inspect security and privacy boundaries**

Confirm from source and package contents:

- all windows use `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and `webSecurity: true`;
- preload exposes only the fixed typed API;
- no generic IPC channel, model API dependency, key, fixture sentinel, test fixture, or conversation body is packaged/stored;
- unsupported real source formats remain visibly labeled;
- application disposal stops scheduling and closes the database.

- [ ] **Step 3: Launch the built application**

Open the generated `.app` and manually verify tray toggle, popover, full-client Today/Settings navigation, refresh action, settings persistence, and clean quit. Record any skipped manual check explicitly; do not report it as automated coverage.

- [ ] **Step 4: Request code review and resolve confirmed Important findings**

Review only the Task 10 diff. Re-run the narrowest affected test after each fix, then rerun the full gates if production code or packaging configuration changed.

- [ ] **Step 5: Commit any verified gate fixes**

```bash
git add <only-files-changed-by-verified-fixes>
git commit -m "fix: satisfy statistics slice exit gates"
```

Skip this commit when no fixes are needed. Do not push unless explicitly requested.

## Self-Review Results

- **Spec coverage:** Covers test-only DI, non-zero fixture statistics, menu renderer evidence, idempotent rescans, SQLite privacy, documentation, unsigned packaging, package inspection, and all Foundation Plan exit gates.
- **Placeholder scan:** No TBD/TODO or deferred implementation requirement remains.
- **Type consistency:** Uses existing `SessionSource`, `NormalizedSession`, `RendererApi`, `TokenActivityShowApplication`, refresh coordinator, and Today service boundaries; any new dependency types are confined to `application.ts` and test imports.
- **Scope:** Does not implement a real provider parser, model API, signing/notarization, production test flags, or additional renderer capabilities.
