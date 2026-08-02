# Root README Design

## Goal

Add a Chinese-first `README.md` at the repository root so a developer can install, run, validate, build, and package Token Activity Show without reading internal planning documents.

## Contents

The README will include:

1. A concise project description and current development status.
2. Prerequisites: macOS, Node.js 22 (22.23.1 recommended), pnpm 10.17.1.
3. Dependency installation with `pnpm install`.
4. Development startup with `pnpm dev`.
5. Test, type-check, and lint commands.
6. Production build and unsigned local macOS packaging commands.
7. A command summary table.
8. Current limitations: real Claude Code, Codex, and Hermes session formats are not established, so adapters report `FORMAT_NOT_ESTABLISHED` instead of inventing parsers.
9. Privacy and security notes: local-only storage, no conversation-body collection, and hardened renderer boundaries.
10. Troubleshooting for Node version and `better-sqlite3` native-module failures.

## Scope

Only the root `README.md` will be added. No runtime behavior, package scripts, source files, or dependencies will change.

## Verification

Check every documented command against `package.json`, run Markdown-oriented manual review for clarity, and run `git diff --check`.
