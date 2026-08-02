# macOS Utility Visual Refinement Design

## Goal

Refine the existing Token Activity Show Today and Settings interface so it feels like a calm macOS utility rather than a generated dashboard, without changing its information architecture, behavior, or data semantics.

## Direction

Use a restrained macOS utility language inspired by native settings and inspector surfaces. Hierarchy comes from typography, spacing, alignment, and sparse separators instead of repeated cards, shadows, decorative marks, or marketing-style labels.

The `ui-ux-pro-max` generated recommendation for an App Store landing page, gold accent, Space Mono, and AI-native animations is explicitly rejected because Token Activity Show is a desktop product surface rather than a marketing page.

## Shell and Navigation

- Narrow the sidebar and remove the decorative `TS` tile.
- Present the product name as quiet system typography.
- Use text-only Today and Settings navigation with a native selected row.
- Remove temporary text glyph icons.
- Reduce the sidebar footer to one concise local-storage statement.
- Keep navigation semantics, focus states, hash routes, and responsive collapse behavior.

## Today Page

- Replace the marketing-style eyebrow with a straightforward date label.
- Treat the title, coverage time, and refresh action as a compact toolbar.
- Present intensity as one summary region with score and explanation, using no decorative status badge.
- Replace four equal metric cards with one horizontal metrics strip separated by sparse rules.
- Present providers and recent sessions as consistent inset lists with no initial-letter tiles.
- Remove redundant per-metric promotional explanations; preserve only evidence-critical availability copy.
- Render the unsupported state as a quiet content section, not an illustrated card or error-code pill.
- Keep `FORMAT_NOT_ESTABLISHED` visible in explanatory prose and never fabricate data.

## Settings Page

- Use native-looking grouped settings sections.
- Keep labels, descriptions, switches, select input, save state, and supported intervals unchanged.
- Reduce card shadows and separate groups through whitespace and borders.
- Keep future capabilities visually subordinate without a badge.

## Visual Tokens

- System font stack only.
- Light and dark neutral palettes remain unified across the full application.
- `#5E5CE6` is reserved for selection, focus, primary action, and enabled switches.
- Use one radius rule: 10px for grouped surfaces and controls, full radius only for switches.
- Eliminate decorative shadows; allow only a subtle selected-navigation inset effect if needed.
- Motion is limited to 150-200ms color and switch-state feedback, with reduced-motion support.

## Accessibility and Behavior

- Preserve semantic navigation, headings, lists, labels, alerts, and status regions.
- Preserve 44px minimum primary targets and 2px visible focus rings.
- Keep WCAG AA contrast in light and dark modes.
- Preserve loading, error, empty, refresh, and settings-save behavior.
- Never expose working directories.

## Verification

- Existing renderer tests must continue to pass without weakening assertions.
- Add or update shell-level assertions if structural changes affect accessible navigation.
- Run typecheck, lint, full tests, and production build.
- Launch the Electron app, inspect Today and Settings in the real window, and confirm the placeholder or dashboard-card appearance is gone.
