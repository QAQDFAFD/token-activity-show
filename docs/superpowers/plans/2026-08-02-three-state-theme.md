# Three-State Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent System, Light, and Dark appearance modes with balanced day/night palettes and no startup flash.

**Architecture:** A pure theme module validates and resolves preferences, while a focused control renders the accessible three-state selector. The root application owns preference state and semantic CSS tokens render the resolved palette.

**Tech Stack:** React 19.2, TypeScript 7, native CSS, localStorage, matchMedia, Vitest, Testing Library.

## Global Constraints

- Preference values are `system | light | dark` only.
- Persist under `token-activity-show:theme`.
- Apply `data-theme` before React mounts.
- Keep `#5E5CE6` as the only accent family.
- Preserve all existing application behavior and accessibility.

---

### Task 1: Theme model and tests

**Files:**
- Create: `src/renderer/src/theme.ts`
- Create: `tests/renderer/theme.test.ts`

- [ ] Test validation, storage fallback, system resolution, DOM application, persistence, and system-change subscription.
- [ ] Implement the pure theme API and pass focused tests.

### Task 2: Theme control and application integration

**Files:**
- Create: `src/renderer/src/components/ThemeControl.tsx`
- Modify: `src/renderer/src/App.tsx`, `src/renderer/src/main.tsx`
- Create: `tests/renderer/ThemeControl.test.tsx`

- [ ] Render System, Light, and Dark buttons with `aria-pressed`.
- [ ] Initialize before React render and persist interactions.
- [ ] Subscribe to OS changes only while System is selected.

### Task 3: Semantic day/night palettes and verification

**Files:**
- Modify: `src/renderer/src/styles.css`

- [ ] Replace media-query ownership with explicit light/dark semantic token blocks.
- [ ] Style the selector for desktop and narrow layouts.
- [ ] Run renderer tests, typecheck, lint, full tests, and build.
- [ ] Launch Electron, switch all three modes, inspect screenshots, review, commit, and push.
