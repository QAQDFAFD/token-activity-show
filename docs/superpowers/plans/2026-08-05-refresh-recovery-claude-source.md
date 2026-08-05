# Refresh Recovery and Claude Code Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every manual refresh visibly meaningful and import real Claude Code session metadata only after its local format is structurally evidenced and sanitized.

**Architecture:** Extend the existing refresh report with renderer-safe provider outcomes and render a persistent status after every button press. Then enhance the read-only probe under strict privacy bounds, capture structural evidence without content, and implement only the evidenced Claude Code JSONL shape behind the existing `SessionSource` contract.

**Tech Stack:** Electron 43.2, TypeScript 7, React 19.2, Zod 4.4, SQLite, Vitest 4.1, Node 22.23.1, pnpm 10.

## Global Constraints

- Never output, fixture, persist, log, or send prompt/response/tool content, credentials, environment values, or personal paths.
- Do not guess a Claude Code schema; parser work starts only after the safe probe establishes structural evidence.
- Codex and Hermes remain `FORMAT_NOT_ESTABLISHED`.
- Missing metrics remain `null`, never zero.
- No generic IPC or renderer filesystem access.
- Preserve statistics-only operation and existing security settings.

---

### Task 1: Make manual refresh visibly report outcomes

**Files:**
- Modify: `src/shared/api.ts`
- Modify: `src/main/refresh/refresh-coordinator.ts`
- Modify: `src/renderer/src/pages/TodayPage.tsx`
- Modify: `src/renderer/src/MenuBarApp.tsx`
- Modify: `src/renderer/src/i18n.tsx`
- Modify: `tests/unit/refresh/refresh-coordinator.test.ts`
- Modify: `tests/renderer/TodayPage.test.tsx`
- Modify: `tests/renderer/MenuBarApp.test.tsx`

**Interfaces:**
- Produces: `ProviderRefreshResult { providerId, status, inserted, updated, unchanged, warningCodes }`
- Extends: complete `RefreshReport` with `providerResults`
- Preserves: `RendererApi.refreshNow(): Promise<Result<RefreshReport, AppError>>`

- [ ] Add failing coordinator tests for succeeded, failed, unsupported, partial, and already-running results; assert no paths/messages are exposed.
- [ ] Add failing renderer tests proving complete/no-change/change/unsupported/skipped/failure status is visible, Today is refetched on every outcome, and thrown API errors restore the button.
- [ ] Run `pnpm vitest run tests/unit/refresh/refresh-coordinator.test.ts tests/renderer/TodayPage.test.tsx tests/renderer/MenuBarApp.test.tsx`; expect new assertions to fail.
- [ ] Build one provider result per enabled source. Classify `FORMAT_NOT_ESTABLISHED` as `unsupported`; sanitize thrown failures to status/counts only.
- [ ] Refactor Today and menu refresh handlers to `try/catch/finally`, always refetch, and retain an accessible status/alert message after scanning returns to idle.
- [ ] Add concise English and Chinese translations for every outcome.
- [ ] Run focused tests, typecheck, lint, and `git diff --check`; all pass.
- [ ] Commit `fix: report manual refresh outcomes` with the required co-author trailer.

---

### Task 2: Establish Claude Code structure safely

**Files:**
- Modify: `scripts/probe-sources.ts`
- Modify: `fixtures/sources/README.md`
- Create: `tests/unit/scripts/probe-sources.test.ts`

**Interfaces:**
- Produces bounded structural records containing provider, status, path template, extension, byte size, top-level keys, allowlisted record-type counts, and timestamp parseability.
- Accepts existing `--provider`, optional `--path`, and optional `--output`.

- [ ] Add failing tests with a nested temporary root containing JSONL secret sentinels, malformed lines, oversized data, and an escaping symlink. Assert output contains structural keys/counts but no sentinel, real directory name, field value, or escaped file.
- [ ] Run `pnpm vitest run tests/unit/scripts/probe-sources.test.ts`; expect nested structure assertions to fail.
- [ ] Implement canonical-root confinement, no external symlink traversal, deterministic traversal, and hard caps for files, bytes, and sampled records.
- [ ] Parse bounded JSONL lines only to collect top-level key names, allowlisted type counts, and timestamp validity; never serialize values.
- [ ] Render structural path templates such as `<project>/<session>.jsonl`, not real path segments.
- [ ] Update fixture privacy documentation with every output field and limit.
- [ ] Run tests, typecheck, lint, and `git diff --check`; all pass.
- [ ] Run the probe against `~/.claude/projects` without `--output`; inspect every line and confirm no sensitive values.
- [ ] Commit probe code/tests/docs only as `test: establish Claude Code source structure`; never commit raw probe output.

---

### Task 3: Implement the evidenced Claude Code parser

**Files:**
- Create/modify only after Task 2 evidence: `fixtures/sources/claude/**`
- Modify: `src/main/sources/claude-code/detect.ts`
- Modify: `src/main/sources/claude-code/parse.ts`
- Modify: `src/main/sources/claude-code/index.ts`
- Modify: `tests/unit/sources/claude-code.test.ts`
- Modify: `tests/integration/sources/source-contract.test.ts`
- Modify: `tests/integration/refresh/scan-to-database.test.ts`

**Interfaces:**
- Preserves: `createClaudeCodeSource(options): SessionSource`
- Parser consumes only the exact sanitized structure evidenced in Task 2.
- Produces normalized metadata without raw content.

- [ ] Manually author the smallest sanitized fixture preserving only evidenced keys/types. Replace every ID, text, path, project, model response, and timestamp value; include one raw-body sentinel solely for privacy assertions.
- [ ] Add failing tests for native session identity, UTC times, evidenced model/project metadata, effective non-empty user interaction count, nullable unavailable metrics, deterministic content version, malformed-neighbor survival, and no body text in normalized output.
- [ ] Run Claude source and contract tests; expect the unsupported parser to fail.
- [ ] Implement bounded streaming JSONL parsing and warning isolation for the evidenced shape only.
- [ ] Ensure `contentVersion` uses stable structural metadata and hashes, never raw content in the returned value.
- [ ] Wire detection and scanning to injected/default roots without following symlinks outside the root.
- [ ] Add scan-to-database tests for initial import, unchanged repeat scan, changed fixture version, and absence of the raw-body sentinel in SQLite bytes.
- [ ] Run source, contract, refresh integration, E2E, typecheck, lint, and `git diff --check`; all pass.
- [ ] Inspect `git diff -- fixtures` line by line for sensitive data.
- [ ] Commit `feat: import Claude Code session metadata` with the required co-author trailer.

---

### Task 4: Verify privacy and packaged behavior

**Files:**
- Modify only for confirmed regressions.

- [ ] Run under Node 22.23.1: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm package:mac`, `pnpm smoke:package`.
- [ ] Inspect package and a temporary test database for fixture sentinel, source maps, tests, fixtures, prompts, responses, credentials, and personal paths; none may exist.
- [ ] Launch packaged app with isolated HOME/user-data. Verify it stays running, writes only isolated SQLite, and exits cleanly.
- [ ] Manually verify refresh button scanning text and final outcome in Today and menu popover; verify imported Claude metadata appears when the evidenced local format matches.
- [ ] Request code review for the full diff and fix every confirmed Important/Critical finding.
- [ ] Re-run affected tests and full gates after fixes.
- [ ] Commit only verified gate fixes; do not push unless explicitly requested.

## Self-Review

- Covers all approved refresh status, safe probe, parser, privacy, and packaging requirements.
- Contains no speculative Claude Code field names; Task 3 is explicitly gated by Task 2 evidence.
- New refresh types are consistent across coordinator, IPC, and renderers.
- No placeholders or unrelated Anthropic-summary work are included.
