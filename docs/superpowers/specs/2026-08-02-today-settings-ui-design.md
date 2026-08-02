# Today and Settings UI Design

## Goal

Replace the renderer placeholder with a functional macOS-oriented statistics-only client that consumes the existing typed IPC API.

## Information Architecture

The full client uses a compact left navigation with two destinations:

- **Today:** current-day coverage, intensity state, objective metrics, provider status, recent sessions, refresh controls, and honest empty/error states.
- **Settings:** source enablement and automatic refresh interval.

Tray and menu-bar popover behavior remain outside this task.

## Today Page

The header shows the local date, last coverage time, current refresh state, and a manual refresh button. Content is organized into focused cards:

1. Intensity status, provisional/cold-start label, numerical score when supported, and explanation.
2. Overall native-session count and availability-aware interaction, token, and active-duration metrics.
3. Provider rows for Claude Code, Codex, and Hermes.
4. Recent session metadata without exposing working directories.
5. A statistics-only notice explaining that narrative summaries arrive in a later plan.

When no real source data exists, the page must say that source formats are not established and unknown metrics are not shown as zero. It must not fabricate activity.

## Settings Page

Settings exposes only controls supported by the current IPC contract:

- Enable/disable Claude Code, Codex, and Hermes.
- Select refresh intervals `0`, `5`, `10`, `15`, `30`, or `60` minutes.
- Save settings with visible pending, success, and error feedback.

Model, quota, and advanced privacy controls are shown only as unavailable future capabilities if mentioned at all.

## Visual System

Use macOS system typography, a pale neutral canvas, white elevated cards, subtle borders, and one restrained indigo accent. The layout must remain usable at the existing 960×720 window size and narrower widths. Controls require visible keyboard focus, WCAG AA text contrast, semantic labels, and reduced-motion support.

## Data Flow and States

The renderer obtains the bridge through `src/renderer/src/api.ts` and never accesses Node, SQLite, or the filesystem. On mount it requests Today data and settings. Manual refresh calls `refreshNow`, then reloads Today. The renderer subscribes to refresh state and cleans up the subscription on unmount.

Every async surface supports loading, success, empty, and error states. Settings remain editable after a failed save, and refresh errors do not erase the last successful Today data.

## Components

- `App.tsx`: navigation and page selection.
- `pages/TodayPage.tsx`: Today data lifecycle and composition.
- `pages/SettingsPage.tsx`: settings lifecycle and form submission.
- `components/IntensityHeader.tsx`: intensity/cold-start presentation.
- `components/ProviderActivityList.tsx`: provider rows and unavailable metrics.
- `components/RecentSessions.tsx`: sanitized session metadata.
- `components/RefreshButton.tsx`: refresh action and pending state.
- `components/EmptyState.tsx`: truthful unsupported/no-data state.
- `styles.css`: tokens, layout, responsive behavior, focus, and reduced motion.

## Testing

Renderer tests cover:

- Initial loading and successful Today rendering.
- Honest no-data/source-format empty state.
- Nullable metrics rendered as unavailable rather than zero.
- Manual refresh and refresh-state feedback.
- Today error with retry behavior.
- Settings load, source toggles, interval selection, successful save, and failed save.
- Keyboard-visible semantic controls and accessible labels.

No source parsing, tray behavior, model API, summary generation, or quota estimation is added.
