# macOS Utility Visual Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Token Activity Show feel like a calm native macOS utility by removing generated-dashboard visual patterns while preserving behavior and accessibility.

**Architecture:** Simplify existing renderer markup only where decoration is coupled to structure, then rebuild the visual hierarchy in the shared stylesheet using typography, spacing, grouped lists, and sparse rules. No API or data-flow changes are required.

**Tech Stack:** React 19.2, TypeScript 7, native CSS, Testing Library, Vitest.

## Global Constraints

- Preserve Today and Settings routes, API calls, states, and visible evidence semantics.
- Keep `#5E5CE6` only for selection, focus, primary action, and enabled switches.
- Remove decorative glyph icons, initial-letter tiles, repeated shadows, and equal-card dashboard patterns.
- Keep light/dark modes, responsive layout, 44px primary targets, focus rings, and reduced motion.
- Do not expose working directories or turn unknown metrics into zero.

---

### Task 1: Simplify renderer structure

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Modify: `src/renderer/src/pages/TodayPage.tsx`, `SettingsPage.tsx`
- Modify: `src/renderer/src/components/IntensityHeader.tsx`, `ProviderActivityList.tsx`, `EmptyState.tsx`

- [ ] Remove decorative brand/provider/empty-state tiles and temporary navigation glyphs.
- [ ] Convert the Today metric area into one semantic summary strip.
- [ ] Shorten repeated helper copy while retaining availability and unsupported-format facts.
- [ ] Keep all accessible labels, headings, alerts, status regions, and tests valid.

### Task 2: Rebuild macOS utility styling

**Files:**
- Modify: `src/renderer/src/styles.css`

- [ ] Narrow and quiet the sidebar with native selected rows.
- [ ] Replace card shadows with grouped surfaces, whitespace, and sparse separators.
- [ ] Style intensity, metrics, providers, sessions, empty state, and settings as one consistent utility system.
- [ ] Verify light, dark, 960x720, and narrow layouts.

### Task 3: Verify and commit

- [ ] Run renderer tests, typecheck, lint, full tests, and build under Node 22.23.1.
- [ ] Launch Electron, inspect Today and Settings, and confirm no renderer errors.
- [ ] Request code review and resolve Important findings.
- [ ] Commit with `style: refine macOS utility interface`.
