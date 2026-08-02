# Token Activity Show Complete Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every tracked legacy product identity with Token Activity Show without aliases or data migration.

**Architecture:** Rename product-facing copy, package/build metadata, runtime persistence identifiers, IPC channels, preload bridge, tests, and documentation as one atomic compatibility break. Verify absence of old identifiers before committing.

**Tech Stack:** Electron 43.2, TypeScript 7, React 19.2, pnpm 10.17.1, Vitest 4.1, Markdown, YAML.

## Global Constraints

- Canonical package/repository name is `token-activity-show`.
- Canonical product name is `Token Activity Show`.
- Canonical app ID is `com.tokenactivityshow.app`.
- Canonical database filename is `token-activity-show.sqlite`.
- Canonical IPC prefix is `token-activity-show:`.
- Canonical preload bridge is `window.tokenActivityShow`.
- Retain no old aliases and perform no old database migration.
- Do not rename the active checkout directory.

---

### Task 1: Rename runtime and build identity

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `electron-builder.yml`
- Modify: `src/renderer/index.html`, `src/main/index.ts`
- Modify: `src/shared/api.ts`, `src/preload/index.ts`, `src/renderer/src/api.ts`
- Modify: `src/renderer/src/App.tsx`, `src/renderer/src/pages/SettingsPage.tsx`, `src/renderer/src/components/EmptyState.tsx`
- Modify: affected IPC/renderer tests

**Interfaces:**
- Produces: `window.tokenActivityShow: RendererApi`
- Produces: `token-activity-show:*` IPC channels
- Produces: `token-activity-show.sqlite`

- [ ] Replace package, product, app ID, database, IPC, preload bridge, and visible product identifiers.
- [ ] Update global Window typing and every fake bridge assignment.
- [ ] Regenerate the lockfile through `pnpm install --lockfile-only` if the importer package name changes.
- [ ] Run focused shared, IPC, renderer, and database tests.

### Task 2: Rename maintained documentation and fixtures

**Files:**
- Modify: `README.md`, `docs/**/*.md`, and affected test fixtures/temporary path prefixes

**Interfaces:**
- Produces: repository documentation containing only the new identity

- [ ] Replace all textual and symbolic old-name forms in tracked documentation and tests.
- [ ] Preserve unrelated provider IDs and external product names.
- [ ] Search tracked content for all legacy package, product, app-ID, bridge, and type forms documented in the rename design; require zero matches.

### Task 3: Verify and commit

- [ ] Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` under Node 22.23.1.
- [ ] Verify the built preload exposes `tokenActivityShow` and contains no old bridge or IPC prefix.
- [ ] Launch Electron and verify the Token Activity Show title and functional Today page.
- [ ] Run `git diff --check`.
- [ ] Commit only rename changes with `refactor: rename app to Token Activity Show`.
