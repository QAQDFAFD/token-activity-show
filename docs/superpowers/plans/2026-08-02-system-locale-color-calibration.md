# System Locale and Color Calibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Localize all renderer copy from the machine locale and unify light/dark colors through semantic tokens.

**Architecture:** A typed i18n module resolves one of `zh-CN | zh-TW | en`, provides complete dictionaries and locale formatters, and exposes them through React context. Existing components consume that context while CSS components consume theme-independent semantic tokens.

**Tech Stack:** React 19.2, TypeScript 7, Intl, native CSS, Vitest, Testing Library.

## Global Constraints

- Support Simplified Chinese, Traditional Chinese, and English fallback.
- Read `navigator.languages`; do not add manual language selection.
- Keep product/provider names and protocol error codes unchanged.
- Keep the current three-state appearance model.
- Theme-specific component colors must use semantic variables.

---

### Task 1: Typed locale model

- [ ] Add locale resolution, complete dictionaries, interpolation, and date/time/number formatters.
- [ ] Add tests for Chinese variants, English fallback, dictionary completeness, and formatting.

### Task 2: Localize renderer

- [ ] Add an i18n provider at the renderer root.
- [ ] Replace every visible hard-coded renderer string and accessibility label with translations.
- [ ] Use the resolved locale for dates, times, and numbers.
- [ ] Update representative renderer tests for controlled locales.

### Task 3: Calibrate semantic palettes

- [ ] Define complete light/dark semantic tokens for canvas, sidebar, surfaces, borders, text, accent, controls, success, and errors.
- [ ] Remove theme-specific colors from component selectors.
- [ ] Verify system/light/dark modes in real Electron.

### Task 4: Verify and ship

- [ ] Run renderer tests, typecheck, lint, full tests, build, review, commit, and push.
