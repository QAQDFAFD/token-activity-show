# macOS Application Lifecycle and Menu Bar Design

## Goal

Turn Token Activity Show from a single-window Electron process into a managed macOS menu-bar application with explicit lifecycle ownership, a tray popover, and one reusable full client window.

## Composition Root

`application.ts` owns construction and disposal of the database, repositories, source registry, TodayService, refresh coordinator, scheduler, IPC registration, window controller, and tray controller. Startup performs one non-blocking refresh after resources are ready. A startup refresh failure leaves the tray, popover, full client, settings, and manual refresh usable.

`index.ts` becomes a thin Electron event adapter that starts the application after `app.whenReady()`, forwards activation, and disposes once before quitting.

## Window Controller

`windows.ts` manages two isolated BrowserWindows using the existing hardened web preferences and preload:

- Full client: normal resizable window, route `#/today`, created once and focused on repeat requests.
- Menu popover: approximately 360px wide, frameless, non-resizable, route `#/menu`, positioned beneath the tray bounds, hidden rather than destroyed on blur.

Popover blur hides it unless DevTools is open. Destroyed windows clear their references. Disposal removes event handlers and destroys both windows.

## Tray Controller

`tray.ts` creates one macOS template-image tray item. Clicking the tray toggles only the popover. The context menu provides localized actions to open Token Activity Show and quit. The tray is destroyed during application disposal.

A small committed template icon asset is used; it must remain legible in light and dark menu bars and carry no color styling.

## Renderer Menu Route

`#/menu` renders a focused `MenuBarApp` without the full-client sidebar. It reuses the existing renderer API, theme, locale, Today view model, refresh behavior, and truthful unsupported state.

The compact view includes date/coverage, intensity or cold-start state, native session count, provider composition, refresh action, statistics-only notice, and an action to open the full client. Opening the full client uses a narrow allowlisted API rather than generic IPC.

## IPC Boundary

Extend the existing typed renderer API with one fixed `openClient()` command. Validate and register it like other allowlisted IPC calls. Do not expose generic send/invoke, window handles, filesystem paths, or Electron APIs.

## Startup and Shutdown

Startup order:

1. Open the user-data SQLite database.
2. Construct repositories and services.
3. Create window and tray controllers.
4. Register IPC exactly once.
5. Start the configured scheduler.
6. Create the tray.
7. Show the full client during the current development phase.
8. Trigger one startup refresh without making startup depend on success.

Shutdown is idempotent and ordered:

1. Stop scheduler.
2. Remove IPC handlers and refresh subscriptions.
3. Destroy tray and windows.
4. Close SQLite.

## Testing

Use Electron fakes to verify:

- one-time startup and IPC registration;
- database path under `app.getPath('userData')`;
- configured scheduler and one startup refresh;
- startup refresh failure isolation;
- tray click popover toggling;
- one full-client window across repeated opens;
- popover placement and blur hiding;
- hardened preferences and correct hash routes;
- complete idempotent shutdown without open timers or handlers;
- compact menu renderer loading, empty state, refresh, and open-client action.

## Scope

No real provider parser, signing, notarization, release packaging, background daemon, new metric, or AI summary work is included.
