# Three-State Theme Design

## Goal

Give Token Activity Show a deliberate, accessible day/night color system with a persistent three-state appearance control: System, Light, and Dark.

## Theme Model

The renderer supports `system | light | dark`. The selected preference is stored in local storage under `token-activity-show:theme`. Missing or invalid values resolve to `system`.

System mode follows `prefers-color-scheme` and updates live when the operating-system appearance changes. Explicit Light or Dark choices ignore subsequent system changes until the user returns to System.

## Initialization

Apply the resolved theme to `document.documentElement.dataset.theme` before React renders. This prevents the window from flashing the wrong appearance at startup. Set `color-scheme` consistently so native form controls match the selected theme.

## Control

Place a compact appearance control in the lower sidebar:

- Label: `外观`
- Options: `系统`, `日间`, `暗夜`
- Each option is a real button with `aria-pressed`.
- The selected option uses the existing indigo accent without glow or gradients.
- Focus remains visible and keyboard order follows visual order.
- The control remains available in the narrow/mobile navigation layout.

## Palette

### Light

- Cold neutral canvas rather than pure white.
- Slightly darker silver-gray sidebar.
- Soft off-white grouped surfaces.
- Charcoal primary text and darker secondary text meeting WCAG AA.
- Indigo reserved for selection, focus, enabled controls, and primary action.

### Dark

- Deep charcoal canvas rather than pure black.
- Sidebar and content surfaces retain visible hierarchy.
- Borders remain perceptible without becoming bright outlines.
- Off-white primary text and sufficiently bright secondary text.
- A lighter indigo variant preserves contrast on dark surfaces.

## Architecture

- `theme.ts` owns validation, resolution, DOM application, persistence, and system subscription.
- `ThemeControl.tsx` owns accessible UI only.
- `App.tsx` owns current theme preference state and renders the control.
- `main.tsx` applies the initial theme before mounting React.
- `styles.css` uses semantic color tokens selected through `[data-theme="light"]` and `[data-theme="dark"]`; the existing dark media query is removed as the primary styling mechanism.

No main-process API, IPC, database, or source behavior changes.

## Testing

Cover:

- invalid or missing storage values falling back to System;
- Light and Dark persistence;
- System resolving from media query;
- live system updates only while System is selected;
- `aria-pressed` states and button interaction;
- theme application before normal renderer use;
- existing renderer behavior remaining intact.

Run renderer tests, typecheck, lint, full tests, build, and real Electron light/dark visual verification.
