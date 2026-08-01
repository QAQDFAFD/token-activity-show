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

- a home-relative or redacted candidate path;
- extension and byte size;
- non-sensitive top-level JSON keys;
- SQLite table and column names;
- record count;
- validated timestamp and type samples.

The probe must never output message content, prompts, responses, environment values, token values, cookies, credentials, email addresses, API keys, account identifiers, or full personal paths.

## Sanitizing an evidenced fixture

Create the smallest fixture that preserves the observed container and field structure. Replace every path, ID, project name, timestamp value, model response, prompt, and other free text with synthetic placeholders. Delete fields unrelated to metadata ingestion. Review the complete fixture diff before committing it.

If a reliable format is not detected, create `fixtures/sources/<provider>/unsupported.json` containing only:

```json
{ "reasonCode": "FORMAT_NOT_ESTABLISHED" }
```

Do not infer or fabricate a parser schema from an unsupported result. Probe output and temporary reports are investigation artifacts and must not be committed.
