# Token Show Foundation and Statistics Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure, packaged macOS Electron application that discovers fixture-backed Claude Code, Codex, and Hermes sessions, stores normalized metadata locally, computes honest activity metrics, and presents a statistics-only Today view in both the menu bar and full client.

**Architecture:** Electron's main process owns files, SQLite, scanning, metrics, and tray/window lifecycle. React renderers receive validated view models through a narrow typed preload bridge. Source adapters are isolated behind a capability-based contract; unknown real-world formats remain unsupported until captured as sanitized fixtures rather than being guessed.

**Tech Stack:** Electron 43.2, electron-vite 5.0, TypeScript 7.0, React 19.2, Vite 8.2, Vitest 4.1, Zod 4.4, better-sqlite3 13.0, Testing Library 16.3, pnpm, ESLint, Prettier, electron-builder.

## Global Constraints

- Target macOS first; keep domain, database, and renderer code platform-neutral for a later Windows release.
- MVP supports Claude Code, OpenAI Codex, and Nous Research Hermes Agent through isolated `SessionSource` adapters.
- Use each tool's native session; do not merge sessions.
- Keep all collected data local; this plan does not read or store conversation bodies.
- Renderer processes must have `contextIsolation: true`, `nodeIntegration: false`, and no direct filesystem, SQLite, credential, or arbitrary IPC access.
- Missing metrics are `null`, never zero; adapters declare capabilities explicitly.
- Quota is not part of intensity and must never be estimated.
- Do not use undocumented private APIs, browser cookies, or network interception.
- The statistics-only app must work without API configuration.
- Automatic refresh runs only while Electron is open, defaults to 10 minutes, never overlaps, and does no work when sources have not changed.
- Use macOS system typography, neutral surfaces, one restrained indigo accent, keyboard-visible focus, WCAG AA contrast, and reduced-motion support.
- Do not add model APIs, conversation reading, summaries, widgets, cloud sync, Windows packaging, or a background daemon in this plan.

## Plan sequence

The approved specification is too broad for one safe implementation pass. Execute these plans in order:

1. **This plan — Foundation and Statistics Slice:** secure shell, SQLite, source contracts and format spikes, metadata ingestion, metrics/intensity foundation, Today UI, tray, refresh.
2. **AI Activity Agent:** credential storage; Anthropic/OpenAI/OpenAI-compatible clients; filtering/redaction; session-summary and daily-summary jobs; token ceilings and retries.
3. **Journal, Trends, Quota, and Privacy:** history, trends, reliable quota capabilities, exclusions, exports, deletion, and advanced regeneration controls.
4. **Release Hardening:** real-source compatibility matrix, migrations, accessibility audit, macOS signing/notarization, upgrade recovery, performance, and Windows portability spike.

Each plan must leave a working application. Do not start Plan 2 until all exit criteria in this document pass.

## File map

```text
package.json                         scripts and pinned dependencies
pnpm-lock.yaml                      reproducible dependency graph
electron.vite.config.ts             main/preload/renderer build inputs
tsconfig.json                       project references
tsconfig.node.json                  main/preload/test settings
tsconfig.web.json                   renderer settings
eslint.config.js                    TypeScript/React lint rules
.prettierrc.json                    formatting rules
electron-builder.yml               unsigned local macOS packaging

src/main/index.ts                   Electron bootstrap
src/main/application.ts             lifecycle composition root
src/main/security/window-options.ts hardened BrowserWindow preferences
src/main/windows.ts                 tray/full-window creation and positioning
src/main/tray.ts                    macOS tray icon/menu behavior
src/main/ipc/register-ipc.ts        validated IPC registration
src/main/refresh/refresh-coordinator.ts non-reentrant scan orchestration
src/main/refresh/refresh-scheduler.ts configurable in-process timer

src/preload/index.ts                contextBridge implementation
src/shared/api.ts                   RendererApi interface and channel constants
src/shared/schemas.ts               Zod schemas at IPC boundaries
src/shared/domain.ts                normalized domain types
src/shared/result.ts                serializable result/error type

src/main/db/open-database.ts        SQLite opening and pragmas
src/main/db/migrations.ts           ordered schema migrations
src/main/db/session-repository.ts   session upsert/query operations
src/main/db/settings-repository.ts  refresh/source settings
src/main/db/metrics-repository.ts   daily aggregate persistence/query

src/main/sources/session-source.ts  source contract
src/main/sources/source-registry.ts enabled adapter registry
src/main/sources/version.ts         stable content-version helper
src/main/sources/claude-code/*      Claude detector/parser/adapter
src/main/sources/codex/*            Codex detector/parser/adapter
src/main/sources/hermes/*           Hermes detector/parser/adapter

src/main/metrics/aggregate-day.ts   daily metric aggregation
src/main/metrics/intensity.ts       cold-start and baseline scoring
src/main/metrics/today-service.ts   renderer-ready TodayViewModel

src/renderer/index.html             renderer document
src/renderer/src/main.tsx           React bootstrap and hash routing
src/renderer/src/api.ts             typed window bridge accessor
src/renderer/src/App.tsx            full-client shell
src/renderer/src/MenuBarApp.tsx     compact popover shell
src/renderer/src/pages/TodayPage.tsx statistics-only Today page
src/renderer/src/pages/SettingsPage.tsx source/interval settings
src/renderer/src/components/*       focused UI components
src/renderer/src/styles.css         design tokens, focus, reduced motion

fixtures/sources/README.md          fixture provenance/sanitization rules
fixtures/sources/{claude,codex,hermes}/ supported and malformed examples
scripts/probe-sources.ts            read-only local format probe

tests/unit/**                       pure domain/parser/repository tests
tests/integration/**                DB, IPC, refresh, source fixture tests
tests/renderer/**                   React interaction/accessibility tests
```

---

### Task 1: Secure Electron project shell

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- Create: `eslint.config.js`, `.prettierrc.json`, `electron-builder.yml`
- Create: `src/main/index.ts`, `src/main/security/window-options.ts`
- Create: `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`
- Test: `tests/unit/main/window-options.test.ts`

**Interfaces:**
- Produces: `secureWebPreferences(preload: string): WebPreferences`
- Produces scripts: `dev`, `build`, `test`, `test:unit`, `lint`, `typecheck`, `package:mac`

- [ ] **Step 1: Initialize the pinned workspace**

Create `package.json` with `type: "module"`, `packageManager: "pnpm@10"`, Node `>=22`, and these dependencies: React `19.2.8`, React DOM `19.2.8`, Zod `4.4.3`, better-sqlite3 `13.0.2`; development dependencies Electron `43.2.0`, electron-vite `5.0.0`, TypeScript `7.0.2`, Vite `8.2.0`, Vitest `4.1.10`, `@vitejs/plugin-react` `6.0.5`, Testing Library React `16.3.2`, electron-builder, ESLint, typescript-eslint, Prettier, and matching type packages. Configure Electron entry as `out/main/index.js` and scripts through `electron-vite`.

Run: `pnpm install`
Expected: `pnpm-lock.yaml` is created with no peer-dependency error.

- [ ] **Step 2: Write the failing security test**

```ts
import { describe, expect, it } from 'vitest'
import { secureWebPreferences } from '../../../src/main/security/window-options'

describe('secureWebPreferences', () => {
  it('isolates renderers from Node and enables sandboxing', () => {
    expect(secureWebPreferences('/app/preload.js')).toEqual({
      preload: '/app/preload.js',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    })
  })
})
```

Run: `pnpm vitest run tests/unit/main/window-options.test.ts`
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the hardened shell**

Implement `secureWebPreferences`; create one minimal full-client `BrowserWindow` using it. In `src/main/index.ts`, wait for `app.whenReady()`, create the window, and quit on `window-all-closed` outside macOS. Create a minimal React renderer containing “Token Show” and “Statistics-only mode”. Keep preload empty except for a comment explaining that Task 3 adds the bridge.

- [ ] **Step 4: Add build, lint, and package configuration**

Configure three electron-vite entries, strict TypeScript project references, React linting, and an unsigned local DMG/ZIP target with app ID `com.tokenshow.app`. Do not add signing credentials.

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all commands pass and `out/main`, `out/preload`, and `out/renderer` exist.

- [ ] **Step 5: Smoke-test the shell**

Run: `pnpm dev`
Expected: a macOS window opens, DevTools console has no security warning, and the page shows “Token Show”. Close the app manually.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml electron.vite.config.ts tsconfig*.json eslint.config.js .prettierrc.json electron-builder.yml src tests/unit/main/window-options.test.ts
git commit -m "chore: scaffold secure Electron application"
```

---

### Task 2: Domain contracts and SQLite persistence

**Files:**
- Create: `src/shared/domain.ts`, `src/shared/result.ts`
- Create: `src/main/db/open-database.ts`, `src/main/db/migrations.ts`
- Create: `src/main/db/session-repository.ts`, `src/main/db/settings-repository.ts`, `src/main/db/metrics-repository.ts`
- Test: `tests/integration/db/migrations.test.ts`, `tests/integration/db/session-repository.test.ts`

**Interfaces:**
- Produces: `ProviderId = 'claude-code' | 'codex' | 'hermes'`
- Produces: `MetricCapabilities`, `NormalizedSession`, `DailyMetrics`, `SourceSettings`
- Produces: `openDatabase(path: string): Database.Database`
- Produces: `SessionRepository.upsertMany(sessions: readonly NormalizedSession[]): UpsertResult`
- Produces: `SessionRepository.listByLocalDate(date: string, timeZone: string): NormalizedSession[]`

- [ ] **Step 1: Define normalized types and repository expectations in failing tests**

Use nullable optional metrics explicitly:

```ts
export interface NormalizedSession {
  id: string
  providerId: ProviderId
  sourceSessionId: string
  startedAt: string
  updatedAt: string
  projectName: string | null
  workingDirectory: string | null
  model: string | null
  interactionCount: number | null
  tokenUsage: number | null
  activeDurationSeconds: number | null
  contentVersion: string
}
```

Test that an insert followed by an unchanged upsert reports `{ inserted: 0, updated: 0, unchanged: 1 }`, while a changed `contentVersion` updates one row. Test uniqueness on `(provider_id, source_session_id)`.

Run: `pnpm vitest run tests/integration/db`
Expected: FAIL because the database modules do not exist.

- [ ] **Step 2: Implement migration 001**

Create `schema_migrations`, `provider_installations`, `sessions`, `daily_metrics`, and `settings`. Store times as ISO-8601 UTC text, booleans as integers, capability masks as JSON text, and nullable metrics as SQL `NULL`. Enable `journal_mode=WAL`, `foreign_keys=ON`, and `busy_timeout=5000`.

- [ ] **Step 3: Implement focused repositories**

Use prepared statements and transactions. `upsertMany` must compare content versions and avoid rewriting unchanged rows. Settings defaults are: enabled sources all true and `refreshIntervalMinutes = 10`. Metrics repository stores and retrieves per-date/per-provider records but does not compute them.

Run: `pnpm vitest run tests/integration/db`
Expected: PASS using a temporary database path per test.

- [ ] **Step 4: Verify migration idempotency and type safety**

Run: `pnpm typecheck && pnpm vitest run tests/integration/db`
Expected: repeated `openDatabase` calls leave one applied migration and all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/shared src/main/db tests/integration/db
git commit -m "feat: add local session persistence"
```

---

### Task 3: Narrow typed IPC bridge

**Files:**
- Create: `src/shared/api.ts`, `src/shared/schemas.ts`
- Modify: `src/preload/index.ts`
- Create: `src/main/ipc/register-ipc.ts`
- Create: `src/renderer/src/api.ts`
- Test: `tests/unit/shared/schemas.test.ts`, `tests/integration/ipc/register-ipc.test.ts`

**Interfaces:**
- Produces: `RendererApi` with only `getToday`, `refreshNow`, `getSettings`, `updateSettings`, `onRefreshState`
- Produces: `registerIpc(services: IpcServices): () => void`
- Consumes: repository and domain types from Task 2

- [ ] **Step 1: Write schema tests for every request**

Define Zod requests for `getToday({ localDate, timeZone })`, `updateSettings({ refreshIntervalMinutes, enabledSources })`, and no-argument `refreshNow`. Assert intervals accept `0 | 5 | 10 | 15 | 30 | 60` and reject arbitrary values, unknown provider IDs, extra keys, invalid dates, and invalid IANA time zones.

Run: `pnpm vitest run tests/unit/shared/schemas.test.ts`
Expected: FAIL until schemas exist.

- [ ] **Step 2: Define the serializable API**

```ts
export interface RendererApi {
  getToday(input: GetTodayInput): Promise<Result<TodayViewModel, AppError>>
  refreshNow(): Promise<Result<RefreshReport, AppError>>
  getSettings(): Promise<Result<AppSettings, AppError>>
  updateSettings(input: UpdateSettingsInput): Promise<Result<AppSettings, AppError>>
  onRefreshState(listener: (state: RefreshState) => void): () => void
}
```

Use fixed channel constants; do not expose generic `invoke`, `send`, `on`, filesystem paths, SQL, or credential methods.

- [ ] **Step 3: Test IPC input rejection**

Mock `ipcMain.handle`; capture handlers; call each with malformed data and assert an `INVALID_INPUT` result without invoking the service. Assert the returned disposer removes all registered handlers.

- [ ] **Step 4: Implement main handlers and preload bridge**

Parse at the main-process boundary even though the renderer is typed. Wrap expected failures in serializable `Result` values. In preload, expose exactly one frozen object as `window.tokenShow` through `contextBridge.exposeInMainWorld`.

Run: `pnpm vitest run tests/unit/shared tests/integration/ipc && pnpm typecheck`
Expected: PASS; `src/renderer/src/api.ts` returns `window.tokenShow` without casting to `any`.

- [ ] **Step 5: Commit**

```bash
git add src/shared src/preload src/main/ipc src/renderer/src/api.ts tests/unit/shared tests/integration/ipc
git commit -m "feat: expose validated renderer API"
```

---

### Task 4: Source contract and read-only format probe

**Files:**
- Create: `src/main/sources/session-source.ts`, `src/main/sources/source-registry.ts`, `src/main/sources/version.ts`
- Create: `scripts/probe-sources.ts`
- Create: `fixtures/sources/README.md`
- Test: `tests/unit/sources/version.test.ts`, `tests/unit/sources/source-registry.test.ts`

**Interfaces:**
- Produces:

```ts
export interface SessionSource {
  readonly providerId: ProviderId
  detect(): Promise<SourceDetection>
  scan(request: ScanRequest): Promise<SourceScanResult>
}

export interface SourceScanResult {
  sessions: NormalizedSession[]
  warnings: SourceWarning[]
  capabilities: MetricCapabilities
  fingerprint: string
}
```

- Produces: `createSourceRegistry(sources): SourceRegistry`
- Produces: `contentVersion(parts: readonly string[]): string`

- [ ] **Step 1: Write contract-helper tests**

Test that the registry rejects duplicate provider IDs, returns only enabled sources, and preserves provider isolation. Test that `contentVersion` is deterministic, order-sensitive, and contains no original input text.

Run: `pnpm vitest run tests/unit/sources/version.test.ts tests/unit/sources/source-registry.test.ts`
Expected: FAIL because the modules do not exist.

- [ ] **Step 2: Implement contracts and helpers**

`scan` returns warnings instead of throwing for malformed individual records. A fatal inaccessible root may return a typed source error. Capabilities contain booleans for interactions, tokens, active duration, model, and trustworthy quota; quota defaults to false.

- [ ] **Step 3: Implement the source probe**

The probe accepts `--provider`, optional `--path`, and `--output`. It may print or save only:

- candidate path
- file extension and byte size
- top-level JSON keys or SQLite table/column names
- record count
- sanitized timestamp/type samples

It must never print message content, environment values, tokens, cookies, or credentials. Require explicit `--output` before writing a report. Add usage and sanitization rules to the fixture README.

- [ ] **Step 4: Run the probe against the developer machine without committing output**

Run separately:

```bash
pnpm tsx scripts/probe-sources.ts --provider claude-code
pnpm tsx scripts/probe-sources.ts --provider codex
pnpm tsx scripts/probe-sources.ts --provider hermes
```

Expected: each reports detected/not-detected and structural metadata only. If a format is found, manually create the smallest sanitized fixture that preserves structure; replace all text, paths, IDs, and model responses. If no reliable format is found, add an `unsupported.json` fixture containing only a reason code. Never fabricate a parser schema.

- [ ] **Step 5: Verify no sensitive fixture content**

Run: `git diff -- fixtures scripts` and inspect every line; then run `pnpm test`.
Expected: no personal path, prompt, response, API key, email, or credential appears; tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/main/sources scripts/probe-sources.ts fixtures/sources tests/unit/sources
git commit -m "feat: define session source contract"
```

---

### Task 5: Fixture-backed Claude, Codex, and Hermes adapters

**Files:**
- Create: `src/main/sources/claude-code/detect.ts`, `parse.ts`, `index.ts`
- Create: `src/main/sources/codex/detect.ts`, `parse.ts`, `index.ts`
- Create: `src/main/sources/hermes/detect.ts`, `parse.ts`, `index.ts`
- Create/modify: `fixtures/sources/{claude,codex,hermes}/**`
- Test: `tests/unit/sources/{claude-code,codex,hermes}.test.ts`
- Test: `tests/integration/sources/source-contract.test.ts`

**Interfaces:**
- Produces: `createClaudeCodeSource(options)`, `createCodexSource(options)`, `createHermesSource(options)` returning `SessionSource`
- Consumes: normalized types and source contract from Tasks 2 and 4

- [ ] **Step 1: Write one parser test per evidenced format**

For each real sanitized fixture from Task 4, assert exact native ID, UTC timestamps, project/model where evidenced, effective interaction count where evidenced, nullable unavailable metrics, and a deterministic content version. Add malformed/truncated fixtures and assert one warning while valid neighboring records survive.

If a provider has only `unsupported.json`, write a test asserting `detect().available === false`, capability booleans are false, and the reason is `FORMAT_NOT_ESTABLISHED`. This is a passing supported state, not a reason to invent parsing logic.

Run: `pnpm vitest run tests/unit/sources`
Expected: FAIL because adapters do not exist.

- [ ] **Step 2: Implement detectors with injectable roots**

Default roots are platform-specific candidate functions, but tests always inject fixture roots. Detection must be read-only, follow no arbitrary symlink outside an injected/default root, and return all candidate evidence without logging conversation content.

- [ ] **Step 3: Implement only evidenced parsers**

Stream line-oriented formats rather than loading unbounded files. Validate each record. Count only real user requests; do not count system, empty, heartbeat, or tool-only records. Use `null` for data the source does not provide. Never infer quota or account plan.

- [ ] **Step 4: Run the cross-adapter contract suite**

The shared suite verifies unique native IDs, valid UTC ISO dates, idempotent scans, warning isolation, truthful capabilities, and no raw message text in serialized `NormalizedSession` values.

Run: `pnpm vitest run tests/unit/sources tests/integration/sources && pnpm typecheck`
Expected: all evidenced adapters pass; unsupported adapters return the explicit unsupported state.

- [ ] **Step 5: Commit**

```bash
git add src/main/sources fixtures/sources tests/unit/sources tests/integration/sources
git commit -m "feat: add local AI session adapters"
```

---

### Task 6: Non-reentrant refresh pipeline

**Files:**
- Create: `src/main/refresh/refresh-coordinator.ts`, `src/main/refresh/refresh-scheduler.ts`
- Modify: `src/main/db/settings-repository.ts`, `src/main/ipc/register-ipc.ts`
- Test: `tests/unit/refresh/refresh-coordinator.test.ts`, `tests/unit/refresh/refresh-scheduler.test.ts`
- Test: `tests/integration/refresh/scan-to-database.test.ts`

**Interfaces:**
- Produces: `RefreshCoordinator.refresh(trigger: RefreshTrigger): Promise<RefreshReport>`
- Produces: `RefreshScheduler.start(intervalMinutes)`, `reschedule(intervalMinutes)`, `stop()`
- Consumes: `SourceRegistry`, `SessionRepository`

- [ ] **Step 1: Write coordinator concurrency tests**

Use deferred fake sources. Start two refreshes before resolving the first; assert sources scan once and the second report is `{ status: 'skipped', reason: 'already-running' }`. Assert one failing provider does not block successful providers and unchanged sessions report no writes.

- [ ] **Step 2: Implement scan orchestration**

The coordinator snapshots enabled sources, emits `idle | scanning | complete | failed` events, scans providers independently, upserts normalized sessions transactionally per provider, and returns inserted/updated/unchanged/warning counts. Never retain raw source content.

- [ ] **Step 3: Write scheduler tests with fake timers**

Assert interval `10` triggers at 10 minutes, rescheduling cancels the old timer, `0` disables scheduling, and `stop` releases the timer.

- [ ] **Step 4: Implement in-process scheduling and IPC refresh**

The scheduler calls the same coordinator used by `refreshNow`; it does not duplicate logic. Wire settings updates to `reschedule`. Broadcast refresh state only through the allowlisted preload event.

Run: `pnpm vitest run tests/unit/refresh tests/integration/refresh`
Expected: PASS, including provider failure and overlap cases.

- [ ] **Step 5: Commit**

```bash
git add src/main/refresh src/main/db/settings-repository.ts src/main/ipc/register-ipc.ts tests/unit/refresh tests/integration/refresh
git commit -m "feat: scan sessions on a safe schedule"
```

---

### Task 7: Daily aggregation and honest intensity foundation

**Files:**
- Create: `src/main/metrics/aggregate-day.ts`, `src/main/metrics/intensity.ts`, `src/main/metrics/today-service.ts`
- Modify: `src/main/db/metrics-repository.ts`
- Test: `tests/unit/metrics/aggregate-day.test.ts`, `tests/unit/metrics/intensity.test.ts`
- Test: `tests/integration/metrics/today-service.test.ts`

**Interfaces:**
- Produces: `aggregateDay(sessions, date, timeZone): DailyMetricInput[]`
- Produces: `calculateIntensity(input: IntensityInput): IntensityAssessment`
- Produces: `TodayService.get(input: GetTodayInput): Promise<TodayViewModel>`

- [ ] **Step 1: Write aggregation tests**

Cover provider and overall native session counts, nullable metric sums, a session crossing midnight, and local-date aggregation in `America/Los_Angeles` and `Asia/Shanghai`. Ensure unavailable token data remains `null` rather than becoming zero.

- [ ] **Step 2: Implement daily aggregation**

Group native sessions by start date for session-list ownership. Attribute interaction/timing details to their event date only when an evidenced adapter supplies event-level metadata; otherwise attach the available aggregate to the session start date and mark precision in the capability mask. Document this fallback in the view-model explanation.

- [ ] **Step 3: Write intensity tests before implementation**

Test:

- fewer than 3 effective use days returns `insufficient-data`
- 3–6 returns `preliminary`
- 7+ enables short-term comparison
- missing token and duration weights redistribute across interactions and sessions
- an extreme outlier does not dominate the median/MAD baseline
- zero-activity calendar days remain in the 30-day context
- no score contains `NaN` or treats unknown as zero

Use fixed numeric fixtures and assert exact scores/bands/explanation facts.

- [ ] **Step 4: Implement scoring without in-progress-day correction**

Implement the 40/30/20/10 weights, proportional redistribution, robust z-score normalization, cold-start states, and bands. Defer usual-active-window correction until Plan 3 because this slice lacks sufficient event history; while today is incomplete, label comparison `provisional` and compare elapsed-day metrics only when historical hourly precision exists. Never claim precise same-stage comparison without that evidence.

- [ ] **Step 5: Build and persist Today view models**

`TodayViewModel` contains coverage time, refresh state, overall/provider counts, metric availability, cold-start/intensity labels, explanations, and recent sessions. It has `summary: null` in statistics-only mode. Store computed daily metrics after each successful refresh.

Run: `pnpm vitest run tests/unit/metrics tests/integration/metrics && pnpm typecheck`
Expected: all tests pass with deterministic dates and time zones.

- [ ] **Step 6: Commit**

```bash
git add src/main/metrics src/main/db/metrics-repository.ts tests/unit/metrics tests/integration/metrics
git commit -m "feat: calculate personal AI activity intensity"
```

---

### Task 8: Compose application lifecycle and tray windows

**Files:**
- Create: `src/main/application.ts`, `src/main/windows.ts`, `src/main/tray.ts`
- Modify: `src/main/index.ts`
- Test: `tests/unit/main/application.test.ts`, `tests/unit/main/windows.test.ts`

**Interfaces:**
- Produces: `createApplication(dependencies): TokenShowApplication`
- Produces: `WindowController.showMenuBar()`, `showClient()`, `hideMenuBar()`, `dispose()`
- Consumes: DB, registry, coordinator, scheduler, IPC registration

- [ ] **Step 1: Write lifecycle tests with Electron fakes**

Assert startup opens the database, registers IPC once, starts the configured schedule, performs one startup refresh, and creates the tray. Assert shutdown stops timers, unregisters IPC, closes windows, and closes SQLite. Assert clicking the tray toggles only the popover and “Open Token Show” opens/focuses the full client.

- [ ] **Step 2: Implement the composition root**

Construct dependencies in one place; do not use mutable module-global service singletons. Resolve the database under `app.getPath('userData')`. Startup refresh errors must leave the application usable and surface refresh state.

- [ ] **Step 3: Implement macOS tray/popover behavior**

Use a template tray icon asset; create a frameless, non-resizable popover with secure preferences and a separate normal full window. Hide the popover on blur unless DevTools is open. Use a URL hash (`#/menu` and `#/today`) so both windows share renderer assets without sharing window state.

- [ ] **Step 4: Run lifecycle and full regression tests**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS with no open handles after scheduler/lifecycle tests.

- [ ] **Step 5: Commit**

```bash
git add src/main src/renderer src/assets tests/unit/main
git commit -m "feat: add menu bar application lifecycle"
```

---

### Task 9: Statistics-only Today and Settings UI

**Files:**
- Modify: `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`
- Create: `src/renderer/src/MenuBarApp.tsx`
- Create: `src/renderer/src/pages/TodayPage.tsx`, `src/renderer/src/pages/SettingsPage.tsx`
- Create: `src/renderer/src/components/IntensityHeader.tsx`, `ProviderActivityList.tsx`, `RecentSessions.tsx`, `RefreshButton.tsx`, `EmptyState.tsx`
- Create: `src/renderer/src/styles.css`
- Test: `tests/renderer/MenuBarApp.test.tsx`, `tests/renderer/TodayPage.test.tsx`, `tests/renderer/SettingsPage.test.tsx`

**Interfaces:**
- Consumes only `RendererApi` and `TodayViewModel`; no direct imports from `src/main`
- Produces routes `#/menu`, `#/today`, `#/settings`

- [ ] **Step 1: Write renderer behavior tests**

With a fake `window.tokenShow`, assert:

- cold start says “Not enough history yet” and shows objective counts
- unknown token data renders “Unavailable”, not `0`
- provider unsupported state gives a setup action
- Refresh disables while running and invokes `refreshNow` once
- failed refresh preserves data and shows the actionable error
- interval selection persists only accepted values
- all icon-only controls have accessible names

Run: `pnpm vitest run tests/renderer`
Expected: FAIL because views do not exist.

- [ ] **Step 2: Implement shared visual tokens and responsive shells**

Use system font, neutral surfaces, `#5E5CE6` accent, visible 2px focus rings, 44px minimum primary targets, and CSS `@media (prefers-reduced-motion: reduce)`. The menu route is 360px-oriented and contains no navigation sidebar. The full client has Today and Settings only in this plan; History, Trends, and Quota appear disabled with “planned” accessible text rather than dead clickable controls.

- [ ] **Step 3: Implement menu-bar content**

Render date/coverage, intensity/cold-start state, total native sessions, provider rows, refresh status, and an “Open full activity” button. Because Plan 2 is not implemented, show a compact “Configure an analysis model in the next release to generate activity summaries” statistics-only notice rather than fake narrative text.

- [ ] **Step 4: Implement full Today and Settings pages**

Today shows objective metrics, provider composition, intensity explanation, and recent native-session metadata. It must not expose working directories by default; show sanitized project names. Settings supports source enablement and refresh interval only. Model and privacy controls are labeled as unavailable until their plans land.

- [ ] **Step 5: Run renderer and accessibility-oriented tests**

Run: `pnpm vitest run tests/renderer && pnpm lint && pnpm typecheck`
Expected: PASS; keyboard tab order follows visual order and no test query relies solely on color.

- [ ] **Step 6: Commit**

```bash
git add src/renderer tests/renderer
git commit -m "feat: present daily AI activity statistics"
```

---

### Task 10: End-to-end fixture smoke test and macOS package

**Files:**
- Create: `tests/e2e/statistics-slice.test.ts`
- Create: `scripts/smoke-package.mjs`
- Create: `docs/development.md`
- Modify: `package.json`, `electron-builder.yml`, `.gitignore`

**Interfaces:**
- Verifies all interfaces produced by Tasks 1–9
- Produces documented commands for development, fixture tests, source probing, and unsigned local packaging

- [ ] **Step 1: Write the vertical-slice test**

Launch the application in test mode with a temporary user-data directory and fixture source roots. Assert the startup refresh imports evidenced sessions, `getToday` returns their provider counts, the menu route renders them, a second scan is unchanged, and the temporary SQLite database contains no fixture message-body sentinel.

Run: `pnpm vitest run tests/e2e/statistics-slice.test.ts`
Expected: FAIL until test-mode dependency injection and launch wiring are complete.

- [ ] **Step 2: Add explicit test-mode dependency injection**

Allow source roots and user-data paths only through a test-only bootstrap object imported by the test runner; do not accept arbitrary renderer arguments or production IPC paths. Make the e2e test pass without touching real user data.

- [ ] **Step 3: Document and run all quality gates**

Document prerequisites (Node 22, pnpm 10, macOS), commands, fixture sanitization, unsupported adapter behavior, and source-probe privacy. Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm package:mac
```

Expected: all checks pass and electron-builder produces an unsigned local artifact under `dist/`.

- [ ] **Step 4: Smoke-test the packaged application**

Run: `node scripts/smoke-package.mjs`
Expected: it verifies the packaged app exists, its archive contains main/preload/renderer output, and no fixture or test directory is packaged. Then launch the artifact manually, confirm tray toggle, full-window navigation, refresh, and Settings persistence.

- [ ] **Step 5: Verify security and privacy exit criteria**

Inspect the packaged app and test database. Confirm:

- renderer Node integration is disabled and sandboxing enabled
- no generic IPC channel exists
- no raw conversation fixture sentinel exists in SQLite or logs
- no API key or model API dependency exists yet
- unsupported source formats are clearly labeled
- closing Electron stops all scheduling

- [ ] **Step 6: Commit**

```bash
git add tests/e2e scripts/smoke-package.mjs docs/development.md package.json pnpm-lock.yaml electron-builder.yml .gitignore
git commit -m "test: verify statistics-only application slice"
```

## Plan 1 exit criteria

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- An unsigned macOS artifact builds and opens.
- Tray popover and full client display fixture-derived activity statistics.
- Startup, manual, and scheduled scans share one non-reentrant coordinator.
- Repeat scans are idempotent.
- At least each evidenced real source format has a sanitized fixture and contract test; unknown formats are explicitly unsupported.
- SQLite and logs contain no conversation body.
- Missing metrics remain unavailable and quota is never inferred.
- Cold-start intensity claims are honest and numerically explained.
- The application is fully usable in statistics-only mode without credentials.

## Follow-on plan acceptance boundaries

Plan 2 may consume `SessionSource`, `NormalizedSession`, `AnalysisJob`, `RendererApi`, and the refresh coordinator, but it must add conversation access through a separate ephemeral-content interface so metadata scans remain content-free. Plan 3 may extend routes and repositories without bypassing typed IPC. Plan 4 owns signing/notarization and must not be pulled into feature tasks prematurely.
