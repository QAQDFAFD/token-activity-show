# Source fixtures

Fixtures capture only source structure needed to implement and test a metadata adapter. They must not contain conversation bodies or data copied verbatim from a developer machine.

## Read-only probe

Run the probe with Node 22.23.1:

```bash
volta run --node 22.23.1 pnpm tsx scripts/probe-sources.ts --provider claude-code
volta run --node 22.23.1 pnpm tsx scripts/probe-sources.ts --provider codex
volta run --node 22.23.1 pnpm tsx scripts/probe-sources.ts --provider hermes
```

Use `--path <candidate>` to inspect one explicit candidate. The probe prints structural metadata to standard output. It never creates a report unless `--output <new-file>` is supplied, and it refuses to overwrite an existing report.

Allowed output is limited to:

- provider and detected/not-detected status;
- a structural path template (`<project>/<session>.jsonl` for Claude Code), never real path segments;
- extension and on-disk byte size;
- sorted top-level JSON key names;
- counts only for allowlisted record types (`assistant`, `file-history-snapshot`, `progress`, `queue-operation`, `summary`, `system`, and `user`);
- timestamp parseability counts (`parseable`, `unparseable`, and `missing`); and
- fixed reason codes for missing, unreadable, or unsupported structures.

The probe is deterministic and bounded to 100 files, 4 MiB total sampled bytes, 1 MiB sampled per file, 256 KiB per JSONL line, and 100 successfully parsed records per file. Oversized and malformed JSONL lines are skipped. Directory entries are sorted before traversal. Paths are canonicalized against the selected root, and symlinks are never followed, so a link cannot escape that root.

The probe must never output JSON values, real nested directory or file names, message content, prompts, responses, tool input or output, environment values, token values, cookies, credentials, email addresses, API keys, account identifiers, or personal paths. Top-level key names are structural metadata only; values are never serialized.

## Sanitizing an evidenced fixture

Create the smallest fixture that preserves the observed container and field structure. Replace every path, ID, project name, timestamp value, model response, prompt, and other free text with synthetic placeholders. Delete fields unrelated to metadata ingestion. Review the complete fixture diff before committing it.

If a reliable format is not detected, create `fixtures/sources/<provider>/unsupported.json` containing only:

```json
{ "reasonCode": "FORMAT_NOT_ESTABLISHED" }
```

Do not infer or fabricate a parser schema from an unsupported result. Probe output and temporary reports are investigation artifacts and must not be committed.
