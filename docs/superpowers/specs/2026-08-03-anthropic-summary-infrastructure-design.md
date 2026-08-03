# Anthropic Summary Infrastructure Design

**Date:** 2026-08-03
**Status:** Approved for specification

## 1. Goal

Add the first independently useful slice of Token Activity Show's AI Activity Agent phase: secure Anthropic credential storage, non-sensitive model configuration, an Anthropic summary-provider boundary, a real minimal structured connection test, fixed typed IPC, and Settings UI.

This slice establishes the credential and provider boundaries required by later session-summary work without reading, filtering, persisting, or transmitting any real local session content. Statistics-only operation remains fully usable without credentials.

## 2. Scope

### Included

- Electron `safeStorage`-backed API-key encryption.
- Atomic encrypted credential-file persistence under Electron's user-data directory.
- SQLite persistence for non-sensitive Anthropic summary configuration only.
- A generic `SummaryProvider` contract suitable for later session and daily summary agents.
- An Anthropic implementation using the official `@anthropic-ai/sdk` package.
- Fixed model `claude-opus-5` for this slice.
- A real minimal structured Messages API request for connection testing.
- Stable provider error classification without exposing sensitive API payloads.
- Fixed typed IPC for reading configuration status, saving/testing configuration, testing an existing credential, and clearing the credential.
- An AI Summary group in the existing Settings page.
- Unit, integration, IPC, renderer, and privacy tests using fakes or a mock API boundary.

### Excluded

- OpenAI and OpenAI-compatible providers.
- Arbitrary model-name input.
- Real source-conversation readers.
- Conversation filtering, redaction, and chunking.
- Session summaries, daily summaries, and their persistence.
- Analysis jobs, scheduled retries, repair requests, and daily token ceilings.
- History, Trends, Journal, or summary content UI.
- Automatic or background model calls.
- Managed Agents, tool use, or multi-turn model loops.
- Any inference from the synthetic Foundation E2E source about a real provider file format.

## 3. Architecture

```text
Settings renderer
    │ fixed typed requests; API key may be submitted but is never returned
    ▼
Preload and validated IPC
    ├── getSummaryConfiguration()
    ├── saveAnthropicConfiguration(input)
    ├── testAnthropicConnection()
    └── clearAnthropicCredential()
          │
          ▼
Electron main process
    ├── SummarySettingsRepository
    │     └── SQLite: provider, model, credential reference, enabled state,
    │                 and sanitized last-test metadata
    ├── SafeStorageCredentialStore
    │     └── user-data: encrypted credential records
    └── AnthropicSummaryProvider
          └── official @anthropic-ai/sdk Messages API
```

The renderer receives neither filesystem access nor a credential-reading method. Credential decryption and SDK client construction occur only in the main process. Existing secure window settings and the fixed IPC allowlist remain unchanged in principle.

## 4. Domain boundaries

### 4.1 Summary configuration

Renderer-visible configuration status contains only non-sensitive information:

```ts
interface SummaryConfigurationView {
  provider: 'anthropic'
  model: 'claude-opus-5'
  credentialConfigured: boolean
  summarizationEnabled: boolean
  credentialProtectionAvailable: boolean
  lastConnectionTest: {
    testedAt: string
    status: 'succeeded' | 'failed'
    inputTokens: number | null
    outputTokens: number | null
    errorCode: SummaryProviderErrorCode | null
  } | null
}
```

It must not contain the API key, encrypted value, credential-file path, raw SDK error, request payload, or response payload.

SQLite stores:

- provider ID (`anthropic`);
- fixed model ID (`claude-opus-5`);
- an opaque fixed credential reference;
- summary-enabled state;
- sanitized last-test metadata.

SQLite never stores API-key plaintext or ciphertext.

### 4.2 Credential store

The credential-store interface is main-process-only and supports:

- determining whether system encryption is available;
- saving/replacing one credential by opaque reference;
- reading a credential for provider use;
- deleting a credential idempotently.

The implementation uses `safeStorage.encryptString()` and `safeStorage.decryptString()`. The encrypted record is written through a temporary file in the same directory and atomically renamed into place. File contents and paths are never logged or returned over IPC.

If `safeStorage.isEncryptionAvailable()` is false, saving fails with `CREDENTIAL_PROTECTION_UNAVAILABLE`. There is no plaintext fallback.

A corrupt, missing, or undecryptable record returns a stable credential error without including file bytes or the API key in the error message.

### 4.3 Summary provider

`SummaryProvider` normalizes provider invocation and usage reporting for later summary agents. This slice implements only its connection-test capability, while defining the request/result/error types so later structured summary calls can extend the same boundary without exposing SDK types outside the provider module.

The Anthropic implementation:

- uses the official TypeScript SDK;
- uses `claude-opus-5` exactly;
- performs a single tool-less Messages API request;
- uses structured output to require `{ "status": "ok" }`;
- does not use Managed Agents, tools, or an agent loop;
- reads API-reported input/output token usage;
- checks `stop_reason` before reading content;
- never includes local session content in the connection-test request.

The connection test uses a fixed, non-sensitive prompt. It verifies authentication, model access, Messages API access, structured-output support, response parsing, and usage reporting. The Settings UI states that it makes a real API call that may incur a small token charge.

## 5. Save and connection-test flow

“Save and test” is one user operation but preserves clear state boundaries:

1. Renderer submits a nonblank API key and requested enabled state through a validated fixed IPC request.
2. Main verifies that system encryption is available.
3. The credential store encrypts and atomically persists the key.
4. SQLite writes the non-sensitive configuration and credential reference only after credential persistence succeeds.
5. Main decrypts the credential and runs the fixed structured connection test.
6. Main stores sanitized test metadata and returns the renderer-safe configuration view.

A failed connection test does not echo or log the key. The encrypted credential may remain saved so a transient outage can be retried without re-entry, but summarization remains disabled until a connection test succeeds. Authentication, permission, or model-availability failures are actionable through Settings.

If credential persistence fails, SQLite must not claim that a credential is configured. If SQLite persistence fails after writing a new encrypted record, the service removes the newly written record or restores the previously valid record so configuration and credential state do not diverge.

Testing an existing configuration decrypts the key in main memory only for the duration of provider construction/request handling. No decrypted value is retained in a singleton, repository, log, renderer response, or persistent cache.

## 6. Clear flow

Clearing a credential is outwardly destructive and requires renderer confirmation. Once confirmed:

1. Main deletes the encrypted credential record idempotently.
2. SQLite marks the credential unconfigured and disables summarization.
3. Sanitized historical connection-test metadata may remain unless the implementation plan chooses to clear it consistently; the UI must not imply that a remaining success record means a credential is still configured.

Deleting a nonexistent credential is a successful idempotent operation. Clearing does not delete local statistics, source settings, or other application data.

## 7. Error model

Renderer-visible errors use stable application codes:

- `CREDENTIAL_PROTECTION_UNAVAILABLE`
- `CREDENTIAL_NOT_CONFIGURED`
- `AUTHENTICATION_FAILED`
- `MODEL_NOT_AVAILABLE`
- `RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `REQUEST_TIMED_OUT`
- `INVALID_PROVIDER_RESPONSE`
- `CREDENTIAL_STORAGE_FAILED`

Typed Anthropic SDK exceptions are classified most-specific-first. Authentication, permission, not-found/model, and invalid structured responses are not blindly retried. SDK retry behavior is bounded to at most two retries for retryable network failures, 408, 409, 429, and 5xx responses. Connection testing has an explicit overall UX deadline so Settings cannot wait indefinitely; the TypeScript SDK timeout is configured in milliseconds.

A response with `stop_reason === 'refusal'` is handled before content access and maps to `INVALID_PROVIDER_RESPONSE` for this fixed benign probe. Empty content, incomplete structured output, `max_tokens`, and schema mismatch also map to a sanitized invalid-response outcome.

Errors and logs may include a stable error code, provider ID, model ID, timestamp, and request ID when safe. They must not include API-key data, authorization headers, encrypted credential bytes, source conversation content, complete prompts, complete responses, or raw provider error bodies.

## 8. Settings experience

Add one AI Summary group to the existing Settings page. Today and the menu-bar popover remain unchanged.

### Unconfigured

- Password-style API-key input.
- Fixed model label: Claude Opus 5.
- “Save and test” primary action.
- Text explaining that the test calls Anthropic and may use a small number of tokens.

### Configured

- “Credential securely saved”; no API-key value is returned or repopulated.
- Fixed model, summarization-enabled state, and sanitized last connection-test status.
- “Test connection” action using the stored credential.
- “Replace credential and test” flow.
- “Clear credential” destructive action with confirmation.

### System protection unavailable

- Saving is disabled.
- The UI explains that system credential protection is unavailable.
- Statistics-only features remain available.

### Privacy copy

The UI states:

- the connection test does not send local session content;
- enabling/configuring this infrastructure does not start automatic summarization in this slice;
- later content summarization requires separate explicit consent;
- future automatic redaction can reduce but cannot eliminate secret-exposure risk.

The enabled setting in this slice means only that later summary functionality may use the verified configuration. It does not trigger content reads or background API calls.

## 9. Security and privacy invariants

- API-key plaintext exists only in renderer input during submission and main-process memory during save/decrypt/request; it is never returned.
- Renderer input is cleared after save/test completion regardless of success.
- API-key plaintext and ciphertext never enter SQLite.
- API-key plaintext, ciphertext, credential paths, complete provider payloads, and authorization headers never enter logs.
- Credential encryption failure never falls back to plaintext.
- Existing statistics-only behavior works with no credential.
- No connection-test path reads a `SessionSource`, source root, or conversation.
- No provider-specific SDK type crosses into shared renderer API/domain types.
- No generic IPC method is added.
- Packaged archive checks continue excluding test fixtures and source maps.

## 10. Testing strategy

### Credential-store tests

Use a fake `safeStorage` adapter and temporary directory to verify:

- encrypted file does not contain plaintext key;
- atomic create and replacement;
- unavailable protection rejects saving;
- read, overwrite, and idempotent delete;
- corrupt records produce sanitized stable errors;
- errors and logs do not contain the key.

### Repository/service tests

Verify:

- SQLite stores only non-sensitive model/configuration fields;
- database bytes contain neither key plaintext nor credential ciphertext;
- failed credential persistence does not leave a configured SQLite state;
- post-credential SQLite failure restores/removes the encrypted record;
- clearing disables summarization and is idempotent;
- no-credential mode preserves all existing statistics behavior.

### Anthropic-provider tests

Use a fake SDK client or local mock HTTP boundary to verify:

- exact model `claude-opus-5`;
- fixed benign prompt and structured-output schema;
- successful `{status: 'ok'}` parsing;
- input/output token usage mapping;
- typed authentication, permission, not-found, rate-limit, timeout, network, and 5xx classification;
- refusal handled before content access;
- empty, truncated, and invalid structured responses;
- no request contains local session data;
- only the official `@anthropic-ai/sdk` integration is used.

No automated test sends a paid live Anthropic request. A separately documented manual connection smoke test may do so only with explicit operator action and a non-sensitive probe.

### IPC and renderer tests

Verify:

- every request is validated and rejects unknown fields;
- every response omits key, ciphertext, and credential path;
- unconfigured, saving, testing, success, error, protection-unavailable, replacing, and clear-confirmation states;
- password input is cleared after completion;
- statistics-only Settings, Today, and menu tests continue to pass.

### Packaging and regression

Run lint, typecheck, full tests, build, unsigned package, and package smoke checks under Node 22.23.1. Verify the credential implementation and test fixtures do not leak into renderer bundles beyond shared non-sensitive types.

## 11. Delivery boundary

This slice is complete when a person can open Settings, securely save an Anthropic API key, perform a real minimal structured connection test, see sanitized status and API-reported token usage, retry, replace, or confirm-clear the credential, and continue using the application without any key.

Completion does not imply that the application can summarize sessions. The next design cycle must cover the ephemeral content-reader/filter/redaction boundary and Session Summary Agent, including separate user consent before any local conversation content is sent to a model provider.
