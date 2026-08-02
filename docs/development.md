# Development

## Prerequisites

Token Activity Show development and packaging require:

- macOS
- Node.js 22.23.1 (the repository Volta configuration pins this version)
- pnpm 10

Install dependencies with `pnpm install`.

## Development and verification

Start Electron in development mode:

```bash
pnpm dev
```

Run the synthetic statistics-slice test or the complete test suite:

```bash
pnpm vitest run tests/e2e/statistics-slice.test.ts
pnpm test
```

Static checks are available through `pnpm lint` and `pnpm typecheck`.

The E2E evidenced sessions are synthetic, metadata-only integration evidence. They contain no prompts, responses, conversation bodies, credentials, or personal filesystem paths. They verify application composition and statistics flow but do not establish a real provider file format.

## Local source probing and privacy

Provider discovery probes local source roots read-only. It must not modify provider files, persist conversation bodies, send source data over the network, or infer quota from activity. Current Claude Code, Codex, and Hermes formats have not been established; detected unsupported data remains visibly reported as `FORMAT_NOT_ESTABLISHED` rather than being guessed or silently parsed.

## Unsigned macOS packaging

Build unsigned macOS artifacts and inspect their packaged contents:

```bash
pnpm package:mac
pnpm smoke:package
```

Artifacts are written under `release/`. The smoke check requires the main, preload, renderer, package metadata, and tray resources and rejects tests, fixtures, documentation, source maps, and the E2E fixture module.

These local artifacts are unsigned and not notarized. macOS may warn or block normal distribution and installation. Signing, notarization, hardened runtime validation, and release distribution belong to Release Hardening and are intentionally outside this workflow.
