# Agent / Contributor Test Rules

These rules apply to every change in this repository. A change is not complete until the required tests pass.

## Required gates

- **Any code change**: `swift test` (or `make test`) must pass.
- **Provider, credential, parser, or refresh changes**: `swift test --filter EndToEndTests` must pass in addition to the full suite.
- **Menu bar layout, settings, display mode, or status item changes**:
  - `swift test --filter MenuBarLayoutTests`
  - `swift test --filter EndToEndTests`
  - `./scripts/e2e.sh`
- **Packaging, resources, Info.plist, preview rendering, or launch changes**: `./scripts/e2e.sh`.
- **Explicit command from the user**: run that exact command and report the result. Do not substitute a different test command unless the requested one cannot run; explain why.

## Full gate

Before a large change, a release, or a handoff, run:

```bash
./scripts/e2e.sh
```

This runs the complete Swift suite, builds `dist/TokenBar.app`, renders a preview with an isolated home, runs `--dump` with an isolated home, and verifies the packaged app stays running.

## Test map

| Area | Command |
| --- | --- |
| All Swift tests | `swift test` / `make test` |
| Unit and parser tests only | `swift test --skip EndToEndTests` / `make test-unit` |
| Full pipeline E2E | `swift test --filter EndToEndTests` / `make test-e2e` |
| Menu bar layout resolver | `swift test --filter MenuBarLayoutTests` |
| Provider parsing | `swift test --filter ProviderParsingTests` |
| Packaging and app smoke | `./scripts/e2e.sh` / `make e2e` |

## Environment-dependent tests

- Do not weaken or delete an E2E assertion to make a test pass. Fix the code or the fixture.
- If a test requires a local signed-in provider, use the isolated fixtures in `Tests/TokenBarCoreTests/EndToEndTests.swift` instead of real credentials.
- Never print or commit tokens, cookies, account IDs, or real session paths when debugging a failing test.
- If a test cannot run because the host lacks a required tool, report the exact blocker and run the closest available gate (for example `swift test` without the packaging smoke).
