# macOS Application Lifecycle and Menu Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an owned Electron lifecycle, reusable full-client window, macOS tray, compact popover, and startup/shutdown orchestration.

**Architecture:** `createApplication` constructs services and owns idempotent start/dispose. `WindowController` and `TrayController` isolate Electron UI behavior, while a fixed `openClient` IPC command connects the compact renderer to the full client.

**Tech Stack:** Electron 43.2, TypeScript 7, React 19.2, Vitest, Testing Library, SQLite.

## Global Constraints

- Keep hardened web preferences for every window.
- Create one full client and one hidden popover at most.
- Expose only fixed typed IPC, never generic Electron access.
- Startup refresh failure must not prevent use.
- Disposal must be idempotent and release every owned resource.

---

### Task 1: Window and tray controllers

- [ ] Add Electron-fake tests for full-client reuse, popover toggle/placement/blur, secure routes, tray click, menu actions, and disposal.
- [ ] Implement `windows.ts`, `tray.ts`, and a monochrome template icon asset.

### Task 2: Application lifecycle

- [ ] Add lifecycle tests for construction, one-time startup, configured scheduler, startup refresh isolation, activation, and ordered idempotent shutdown.
- [ ] Implement `application.ts` and reduce `index.ts` to Electron event forwarding.

### Task 3: Typed open-client IPC

- [ ] Extend shared API, schema-free no-argument handler, preload bridge, registration/disposal tests, and application wiring.

### Task 4: Compact menu renderer

- [ ] Add `MenuBarApp` tests for loading, empty state, refresh, provider/session count, and open-client action.
- [ ] Implement `#/menu` routing without the full sidebar, reusing locale/theme/Today data behavior.

### Task 5: Verification and delivery

- [ ] Run focused tests, typecheck, lint, full tests, and build.
- [ ] Launch Electron, verify tray/full/popover interactions and both routes.
- [ ] Review, commit, and push.
