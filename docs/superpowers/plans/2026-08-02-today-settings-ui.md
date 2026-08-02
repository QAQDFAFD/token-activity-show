# Statistics-Only Today and Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder renderer with an accessible macOS-oriented Today and Settings client backed exclusively by the typed renderer API.

**Architecture:** `App` owns hash-based full-client navigation while focused page components own their async API lifecycles. Small presentational components render intensity, provider metrics, recent sessions, empty states, and refresh state; one stylesheet defines the responsive visual system.

**Tech Stack:** React 19.2, TypeScript 7, Testing Library 16.3, Vitest 4.1, CSS.

## Global Constraints

- Consume only `RendererApi` and shared view-model types; never import `src/main` modules.
- Use macOS system typography, neutral surfaces, white cards, and `#5E5CE6` as the single accent.
- Render unknown metrics as “不可用”, never `0`.
- Never expose `workingDirectory` in the renderer.
- Preserve the last successful Today data when refresh fails.
- Provide visible 2px focus rings, 44px primary targets, semantic labels, and reduced-motion support.
- Implement full-client `#/today` and `#/settings`; tray/menu behavior remains in the later lifecycle task.

---

### Task 1: Renderer behavior tests

**Files:**
- Create: `tests/renderer/TodayPage.test.tsx`
- Create: `tests/renderer/SettingsPage.test.tsx`
- Modify: `tests/renderer/App.test.tsx` if an existing shell test is present

**Interfaces:**
- Consumes: `RendererApi`, `TodayViewModel`, `AppSettings`
- Produces: test coverage for loading, success, empty, nullable metrics, refresh failure, and settings persistence

- [ ] Create a complete fake `RendererApi` and tests asserting cold-start copy, objective session counts, “不可用” for nullable metrics, unsupported/no-data guidance, one-shot refresh, preserved data after refresh failure, and accepted settings intervals.
- [ ] Run `pnpm vitest run tests/renderer` and verify failure because pages do not exist.

### Task 2: Shared visual components and stylesheet

**Files:**
- Create: `src/renderer/src/components/IntensityHeader.tsx`
- Create: `src/renderer/src/components/ProviderActivityList.tsx`
- Create: `src/renderer/src/components/RecentSessions.tsx`
- Create: `src/renderer/src/components/RefreshButton.tsx`
- Create: `src/renderer/src/components/EmptyState.tsx`
- Create: `src/renderer/src/styles.css`

**Interfaces:**
- Consumes: shared `TodayViewModel` fragments
- Produces: focused semantic presentational components without API access

- [ ] Implement intensity/cold-start presentation with numerical rationale.
- [ ] Implement provider metrics with “不可用” for null values.
- [ ] Implement recent sessions showing provider, sanitized project name, model, and time, excluding working directories.
- [ ] Implement accessible refresh and empty-state components.
- [ ] Define responsive layout tokens, cards, focus states, 44px targets, and reduced-motion behavior.

### Task 3: Today and Settings pages

**Files:**
- Create: `src/renderer/src/pages/TodayPage.tsx`
- Create: `src/renderer/src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: `getRendererApi(): RendererApi`
- Produces: complete Today and Settings experiences

- [ ] Implement Today loading through local date and IANA timezone input.
- [ ] Subscribe to refresh state and clean up on unmount.
- [ ] Implement manual refresh followed by Today reload; retain data and show an actionable error on failure.
- [ ] Render coverage, intensity, overall metrics, providers, recent sessions, statistics-only notice, and truthful empty state.
- [ ] Implement Settings load, source toggles, accepted interval selection, save feedback, and failed-save recovery.

### Task 4: Full-client shell and verification

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/main.tsx`

**Interfaces:**
- Produces: `#/today` and `#/settings` full-client routes

- [ ] Replace the placeholder with semantic sidebar navigation and page selection.
- [ ] Import the shared stylesheet from the renderer entry point.
- [ ] Run `pnpm vitest run tests/renderer` and fix only renderer behavior defects.
- [ ] Run `pnpm typecheck && pnpm lint && pnpm test && pnpm build` under Node 22.23.1.
- [ ] Launch `pnpm dev`, interact with Today and Settings, inspect a screenshot, then close the app.
- [ ] Request code review and resolve all Important findings.
- [ ] Commit with `feat: present daily AI activity statistics`.
