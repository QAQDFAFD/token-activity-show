# Hourly Agent Activity Visualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add truthful hourly provider activity, consistent agent identity, and correctly styled refresh feedback to Today and the menu-bar view.

**Architecture:** Main-process aggregation converts event-level timestamps into 24 local-hour buckets and extends `TodayViewModel`; renderers consume only typed view data. A presentational provider map supplies fixed identity labels/colors, while an accessible stacked bar component renders one horizontal baseline, legend, table fallback, tooltip/focus details, and explicit unknown states.

**Tech Stack:** Electron 43.2, TypeScript 7, React 19.2, Vitest 4.1, native CSS/SVG or HTML, Node 22.23.1, pnpm 10.

## Global Constraints

- Use real effective interaction events only; never substitute session starts for missing event times.
- Missing hourly precision is `null`, never zero; zero means known no activity.
- Main process owns aggregation and timezone conversion; renderer receives serialized models only.
- Provider identity is fixed: Claude Code blue, Codex green, Hermes orange, with text labels and table fallback.
- Validate categorical colors with `node scripts/validate_palette.js` for light and dark surfaces before chart code is considered complete.
- For ≥2 series, always render a legend; identity is never color-only.
- Use one axis, thin marks, surface gaps between stacked segments, hover/focus details, and a table view.
- Preserve statistics-only behavior, secure IPC, reduced motion, responsive layouts, and privacy boundaries.

---

### Task 1: Fix refresh feedback and provider presentation

**Files:**
- Modify: `src/renderer/src/pages/TodayPage.tsx`
- Modify: `src/renderer/src/MenuBarApp.tsx`
- Modify: `src/renderer/src/styles.css`
- Modify: `src/renderer/src/i18n.tsx`
- Create: `src/renderer/src/provider-presentation.ts`
- Modify: `tests/renderer/TodayPage.test.tsx`
- Modify: `tests/renderer/MenuBarApp.test.tsx`

**Interfaces:**
- Produces: `providerPresentation(providerId): { label: string; colorToken: string; className: string }`
- Preserves: `RefreshReport` and current typed renderer API.

- [x] Write failing tests asserting success feedback uses `.refresh-feedback`, not `.notice`, and provider rows expose text labels plus stable provider classes.
- [x] Run focused renderer tests and confirm the new class assertions fail.
- [x] Add the provider presentation map and replace any provider-specific ad hoc labels/classes in chart/list consumers.
- [x] Replace refresh feedback markup class with `.refresh-feedback`, retaining `role="status"`/`role="alert"`; keep `.notice` only for the statistics-only footer.
- [x] Add compact menu-bar feedback styling and light/dark semantic tokens.
- [x] Run `pnpm vitest run --exclude '.claude/**' tests/renderer/TodayPage.test.tsx tests/renderer/MenuBarApp.test.tsx`, then typecheck and lint.
- [x] Commit `style: clarify provider and refresh feedback presentation` with the required co-author trailer.

---

### Task 2: Add hourly interaction aggregation

**Files:**
- Modify: `src/shared/domain.ts`
- Modify: `src/shared/api.ts`
- Create: `src/main/metrics/aggregate-hourly.ts`
- Modify: `src/main/metrics/today-service.ts`
- Modify: source parser contracts only where event-level metadata is already evidenced: `src/main/sources/claude-code/parse.ts`, `src/main/sources/session-source.ts`
- Modify: `tests/unit/metrics/aggregate-hourly.test.ts`
- Modify: `tests/integration/metrics/today-service.test.ts`
- Modify: `tests/unit/sources/claude-code.test.ts`

**Interfaces:**
- Produces: `HourlyActivity` with `hour`, `totalInteractions`, `byProvider`, and availability flags.
- Produces: `aggregateHourlyActivity(sessions/events, localDate, timeZone): HourlyActivity[]`.
- Extends: `TodayViewModel.hourlyActivity` with exactly 24 entries.

- [x] Write failing pure aggregation tests for timezone conversion, midnight boundaries, zero known hours, provider totals, and unavailable event-time precision.
- [x] Run `pnpm vitest run tests/unit/metrics/aggregate-hourly.test.ts`; confirm missing implementation failures.
- [x] Implement a 24-entry bucket initializer; use `Intl.DateTimeFormat(...).formatToParts` to derive local hour/date; count only event-level user interactions.
- [x] Return provider/hour `null` when the source capability lacks event-level timestamps; do not infer from session start.
- [x] Extend source scan/domain data only with sanitized event metadata needed for hourly aggregation; never include content text.
- [x] Have `TodayService.get()` aggregate hourly data and serialize it in `TodayViewModel` for every route.
- [x] Run unit and integration metrics tests plus source tests, typecheck, and lint.
- [x] Commit `feat: aggregate hourly agent activity` with the required co-author trailer.

---

### Task 3: Build accessible stacked chart

**Files:**
- Create: `src/renderer/src/components/HourlyActivityChart.tsx`
- Modify: `src/renderer/src/pages/TodayPage.tsx`
- Modify: `src/renderer/src/styles.css`
- Modify: `tests/renderer/TodayPage.test.tsx`
- Create: `tests/renderer/HourlyActivityChart.test.tsx`

**Interfaces:**
- Consumes: `HourlyActivity[]` and `providerPresentation`.
- Produces: accessible chart with legend, bars, focus/hover detail, and table fallback.

- [x] Before chart implementation, read dataviz references for choosing form, colors, marks, interaction, accessibility, and anti-patterns.
- [x] Validate fixed categorical palette against both chart surfaces using `node scripts/validate_palette.js "<three provider colors>" --mode light` and `--mode dark`; change colors until both pass or add secondary encoding and document the warning.
- [x] Write failing tests for 24 bars, accessible labels, legend text, focus detail, table rows, zero hours, and unavailable precision state.
- [x] Run focused chart tests and confirm failures.
- [x] Implement a single-baseline 24-hour stacked bar chart. Use thin marks, 2px surface gaps between stacked fills, rounded data ends only where visually appropriate, and muted axes.
- [x] Render a legend for all three providers, a table/list fallback with hour/provider/count text, and `aria-label`/`aria-describedby` for each bar. Add keyboard focus and pointer tooltip with hour, total, and provider values.
- [x] Render unavailable state when all relevant hourly values are `null`; render known zero as an empty bar with accessible “0 interactions”. Keep unknown segments visually absent but textually disclosed.
- [x] Use fixed provider colors as identity only; keep all text in text tokens. Add a forced-colors/texture or outline fallback so identity survives non-color modes.
- [x] Add responsive CSS: preserve readable 24-hour chart at narrow widths, allow horizontal scroll or compact labels without overlapping, and respect `prefers-reduced-motion`.
- [x] Render the chart in Today between intensity summary and metric details; keep menu-bar view compact unless its existing viewport can support the chart without truncation.
- [x] Run chart/Today tests, typecheck, lint, and inspect a real Electron screenshot in light and dark modes before committing.
- [x] Commit `feat: show hourly agent activity chart` with the required co-author trailer.

---

### Task 4: Full regression and release verification

**Files:**
- Modify only for confirmed regressions.

- [x] Run under Node 22.23.1: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm package:mac`, `pnpm smoke:package`.
- [x] Confirm Vitest excludes `.claude/**` and reports only current-project tests.
- [x] Confirm Today displays distinct Claude Code/Codex/Hermes labels and colors, not a single undifferentiated total.
- [x] Use a privacy-safe real-source smoke to verify the three providers’ actual imported counts/availability without printing paths, names, or content.
- [x] Verify SQLite and package contents contain no prompt, response, tool content, fixture sentinel, credentials, source maps, or personal paths.
- [x] Launch the current packaged app with isolated HOME/user-data and verify clean startup/exit.
- [x] Manually inspect Today at desktop and narrow widths in light/dark themes; click refresh and verify the independent feedback bar is aligned, readable, and not using `.notice` columns.
- [x] Request code review for the complete diff and fix confirmed Important/Critical findings.
- [x] Re-run affected tests and all gates after any fix; commit only verified fixes and do not push unless requested.

## Self-Review

- Covers refresh styling, provider identity, truthful hourly aggregation, chart accessibility, palette validation, responsive/dark/reduced-motion behavior, privacy, and release gates.
- No chart code is specified before dataviz guidance and palette validation.
- No unknown metrics are coerced to zero and no speculative source fields are introduced.
- Types and component boundaries match the current `TodayViewModel`/renderer architecture.
