# Manual Refresh Recovery and Claude Code Source Design

**Date:** 2026-08-05
**Status:** Approved

## Goal

Make manual refresh visibly report every outcome, then establish and implement a real Claude Code local-session parser using privacy-preserving structural evidence. Codex and Hermes remain explicitly unsupported until separately evidenced.

## Scope

### Refresh feedback

- Extend refresh reports with renderer-safe per-provider outcomes.
- Distinguish succeeded, failed, unsupported, and already-running outcomes.
- Show counts for inserted, updated, unchanged, warnings, succeeded, and failed providers.
- Show `FORMAT_NOT_ESTABLISHED` as a clear unsupported-format result.
- Refetch Today after complete, partial, skipped, and failed refreshes.
- Restore button state in `finally` on every path.
- Give Today and menu-bar routes consistent accessible status feedback.

Provider outcomes expose provider IDs, status, counts, and warning codes only. They never expose source paths, message content, raw parser errors, or provider payloads.

### Safe Claude Code structure probe

Extend the existing read-only probe to inspect nested files beneath `~/.claude/projects` or an explicit root while enforcing:

- canonical-root confinement;
- no symlink traversal outside the root;
- bounded file count, bytes read, and sampled JSONL records;
- no prompt, response, tool input/output, environment value, credential, project name, or personal path output;
- structural path templates instead of real directory names;
- top-level key names, file extensions/sizes, allowlisted record-type counts, and timestamp parseability only;
- stdout by default and writes only with explicit `--output`;
- no raw probe report committed.

### Claude Code parser

Implement only the structure established by the safe probe and represented by a manually sanitized fixture:

- one normalized record per native Claude Code session;
- native session ID and timestamps only from evidenced fields;
- real non-empty user requests count as effective interactions;
- system, assistant, tool-only, heartbeat, and empty records do not count;
- model/project metadata only when evidenced;
- unavailable token usage and active duration remain `null`;
- content versions derive from stable structural metadata and never contain message text;
- malformed records produce warnings while valid neighboring records survive;
- no message body enters `NormalizedSession`, SQLite, logs, IPC, or renderer state.

Codex and Hermes continue returning `FORMAT_NOT_ESTABLISHED`.

## Refresh result contract

```ts
interface ProviderRefreshResult {
  providerId: ProviderId
  status: 'succeeded' | 'failed' | 'unsupported'
  inserted: number
  updated: number
  unchanged: number
  warningCodes: SourceWarningCode[]
}
```

The aggregate refresh report retains trigger and total counts and includes `providerResults`. Unsupported sources are not described as successfully imported providers.

## UI behavior

Every button press has a visible accessible status:

- scanning: “正在刷新…”;
- no changes: “刷新完成：未发现新会话”;
- changes: report inserted/updated counts;
- unsupported: identify detected providers whose local format is not supported;
- partial: show failed/unsupported provider counts while preserving successful data;
- skipped: explain that another refresh is already running;
- failed: preserve prior data and show a sanitized reason.

Status remains visible long enough to be read and is represented with `role="status"` or `role="alert"` as appropriate. Button disabled state always clears in `finally`.

## Testing

- Coordinator tests cover provider outcomes, warnings, unsupported classification, partial success, overlap, and sanitized reporting.
- IPC/schema tests verify the extended report and reject untrusted fields.
- Today and menu tests cover complete/no-change/change/unsupported/skipped/failure feedback, refetch behavior, and button restoration after thrown errors.
- Probe tests use temporary nested roots, escaping symlinks, oversized files, JSONL with secret sentinels, and assert no sensitive values appear.
- Parser tests use a minimal sanitized evidenced fixture plus malformed neighbors.
- Integration tests verify scan-to-database import, idempotence, changed content versions, and absence of raw-body sentinels in SQLite.
- Run lint, typecheck, full tests, build, package smoke, and isolated packaged launch under Node 22.23.1.

## Delivery order

1. Refresh feedback contract, coordinator, IPC, Today, and menu renderer.
2. Privacy-preserving nested Claude Code probe.
3. Run probe locally and manually author the smallest sanitized structural fixture.
4. Claude Code detector/parser/source implementation.
5. Full privacy, packaging, and launch regression gates.
