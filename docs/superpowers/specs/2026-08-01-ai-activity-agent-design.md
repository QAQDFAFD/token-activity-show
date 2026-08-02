# Token Activity Show: AI Activity Agent Design

**Date:** 2026-08-01  
**Status:** Approved for implementation planning

## 1. Product summary

Token Activity Show is a local-first desktop application that records how intensely a person uses AI tools each day. It initially supports Claude Code, OpenAI Codex, and Nous Research Hermes Agent. The product treats each tool's native session as the source of truth, summarizes those sessions through a model configured by the user, and produces a daily AI activity journal.

The main experience is activity-first rather than quota-first. It answers:

- How intensely have I used AI today relative to my own habits?
- Which tools did I use, and how much?
- What did I work on, complete, or leave blocked?
- How has my AI-assisted work changed over the last 7 and 30 days?

Reliable quota information remains available as a secondary feature. Token Activity Show never estimates a remaining quota when no trustworthy source exists.

## 2. Scope

### 2.1 MVP

- macOS menu bar experience.
- Full Electron desktop client.
- Local session discovery for Claude Code, Codex, and Hermes.
- Extensible session-source adapters for future tools.
- Native sessions without cross-session merging.
- Local activity metrics and personal 7/30-day intensity baselines.
- Structured per-session summaries.
- Daily AI activity summaries rebuilt from session summaries.
- User-configured Anthropic, OpenAI, and OpenAI-compatible summary APIs.
- Configurable automatic refresh, defaulting to 10 minutes while the app runs.
- Manual refresh and retry.
- Local SQLite storage and operating-system credential storage.
- Reliable quota/usage information where an adapter can obtain it through supported means.
- Architecture boundaries that allow a later Windows release.

### 2.2 Explicitly excluded from the MVP

- macOS or Windows desktop widgets.
- A Windows release.
- Cloud accounts or synchronization.
- A full conversation reader.
- A background LaunchAgent or service that runs after Electron exits.
- A third-party plugin marketplace.
- Estimated quota values.
- Undocumented internal APIs, browser-cookie extraction, or network interception.

## 3. Technology and architecture

Use Electron and TypeScript so the client, domain logic, and most platform integration can be reused for Windows.

```text
Electron main process
├── application lifecycle and tray/menu-bar management
├── window management
├── refresh scheduler and job runner
├── filesystem and local-source access
├── SQLite repositories
├── OS credential-store integration
└── session, summary, intensity, and quota services

Preload and typed IPC
└── minimal business API exposed to renderers

Renderers
├── menu-bar popover
├── full desktop client
└── onboarding and settings

Core domain
├── SessionSource
│   ├── ClaudeCodeSource
│   ├── CodexSource
│   └── HermesSource
├── SummaryProvider
│   ├── AnthropicProvider
│   ├── OpenAIProvider
│   └── OpenAICompatibleProvider
├── SessionSummaryAgent
├── DailyActivityAgent
├── IntensityEngine
└── QuotaService
```

The renderer must not receive arbitrary filesystem access, database handles, Node.js APIs, or secret values. Electron must enable `contextIsolation` and disable renderer `nodeIntegration`. IPC methods expose specific use cases and validate every input.

### 3.1 Session source contract

A `SessionSource` must:

1. Detect whether its tool has usable local data.
2. Discover native sessions and identify their content versions.
3. Normalize supported metadata and content into domain records.
4. Declare capabilities such as token data, model names, active duration, or official quota data.
5. Report unsupported or malformed data without preventing other sources from running.

Provider-specific parsing cannot leak into UI, database repositories, intensity calculations, or summary prompts. The first release compiles all adapters into the application; it does not implement runtime plugins.

### 3.2 Summary provider contract

A `SummaryProvider` normalizes model invocation, token reporting, timeout behavior, authentication errors, rate limits, and structured-output handling.

Supported configurations:

- Anthropic native API.
- OpenAI native API.
- OpenAI-compatible API with configurable base URL, API key, and model name.

Sensitive credentials are stored in the OS credential store: macOS Keychain initially and Windows Credential Manager when Windows support is added. SQLite stores non-sensitive model settings and a credential reference only.

## 4. Data collection and refresh

The app performs a scan at startup and at the configured interval while it remains open. The default interval is 10 minutes; supported presets are 5, 10, 15, 30, and 60 minutes, plus disabled automatic refresh.

```text
Scan enabled sources
    ↓
Read native session index and metadata
    ↓
Deduplicate by provider + source session ID
    ↓
Compare content version
    ↓
Update metadata and enqueue changed sessions
```

A content version should use the strongest stable source information available, such as source revision, update time, message count, file size, and file modification time. It is a change detector, not a copy of conversation content.

Only one refresh run may execute at a time. A scheduled trigger that occurs during an active run is skipped. Job state persists so interrupted or failed work can resume when the application next opens.

The app does not promise refreshes while Electron is closed or the Mac is asleep. A startup scan catches up on missed source changes.

## 5. Two-level activity agent

### 5.1 Session Summary Agent

A new or changed session triggers a session-summary job:

1. Read the source conversation temporarily.
2. Remove system noise, heartbeats, binary data, and large low-value tool output.
3. Preserve user goals, key answers, actions, errors, outcomes, and unresolved work.
4. Redact common credential patterns and content originating from common secret files such as `.env` and private-key files.
5. Divide an oversized session into bounded chunks when required.
6. Request versioned structured JSON from the configured model.
7. Validate the result and store only the structured summary.
8. Release source content without writing it to the application database, cache, or logs.

The summary schema contains:

- Title and short summary.
- Topics and user intents.
- Activity categories such as coding, debugging, research, or writing.
- Actions taken.
- Outcomes and completed work.
- Blockers and unfinished work.
- Technical keywords.

When a session changes, the MVP regenerates its summary from the full filtered session content. This is more stable than merging an old summary with an arbitrary delta. A high-cost “reanalyze all sessions” action is available only as an advanced manual operation with a cost warning.

Automatic redaction reduces risk but cannot guarantee that every secret is detected. Onboarding and settings must state this clearly.

### 5.2 Daily Activity Agent

When any session summary for a local date changes, the Daily Activity Agent receives all structured summaries for that date and completely rebuilds the daily summary. It never receives the day's raw conversations.

The output includes:

- Main areas of focus.
- Tasks and accomplishments.
- Blockers and unfinished work.
- The observed role of each AI tool.
- An interpretation of local intensity metrics.
- A concise daily narrative.
- Optional next-day follow-ups.

The local `IntensityEngine` supplies objective counts, scores, and bands. The model may explain these values but cannot replace or modify them.

Every daily summary records its input fingerprint and coverage timestamp. If regeneration fails, the last successful summary remains visible with a clear “new activity not yet included” state.

### 5.3 Refresh commands

- **Startup/automatic refresh:** scan, summarize changed sessions, then rebuild affected days.
- **Refresh now:** run the same pipeline immediately.
- **Retry failed:** retry failed session jobs and dependent daily summaries.
- **Regenerate today's summary:** reuse saved session summaries; do not reread raw conversations.
- **Reanalyze all sessions:** explicitly regenerate session summaries and dependent daily summaries after a cost warning.

A periodic check that finds no changed session creates no model request.

## 6. Intensity engine

Intensity is computed locally for each provider and across all providers. It does not depend on a model response and does not include quota status.

### 6.1 Metrics and weights

| Metric | Default weight |
|---|---:|
| Effective user interactions | 40% |
| Active duration | 30% |
| Native session count | 20% |
| Token usage | 10% |

An effective interaction is a real user request. System messages, heartbeats, empty records, and tool-only events do not count.

Unavailable values are `unknown`, never zero. If a source lacks a metric, its weight is redistributed proportionally across available metrics. The result retains an available-metric mask so the UI can explain the score's evidence.

### 6.2 Personal baselines

- The most recent 7 effective use days provide a short-term baseline.
- The most recent 30 calendar days provide a stable long-term context and preserve zero-activity days.
- Matching weekdays may provide secondary context.
- An in-progress day is compared to historical activity at a similar point in the person's usual active window, rather than to completed days without adjustment.
- Robust statistics, including medians and median absolute deviation where applicable, prevent a single extreme day from distorting the baseline.

Intensity bands are: very low, low, normal, high, and very high. Every band is accompanied by its numerical rationale; color is never the only indicator.

Example:

> Hermes has 8 effective interactions today. At this time of day, that is 31% below the recent seven-use-day baseline, so Hermes activity is low.

### 6.3 Cold start

- Fewer than 3 effective use days: show objective metrics only.
- 3–6 effective use days: show a clearly labeled preliminary assessment.
- At 7 effective use days: enable the short-term baseline.
- At 30 calendar days: enable the complete long-term trend.

## 7. Local data model

### ProviderInstallation

- `providerID`
- `detectedPaths`
- `availability`
- `lastScanAt`
- `capabilities`

### Session

- `internalID`
- `providerID`
- `sourceSessionID`
- `startedAt`, `updatedAt`
- `projectName`, `workingDirectory`
- `model`
- `interactionCount`
- `tokenUsage`
- `activeDuration`
- `contentVersion`
- `summaryStatus`

### SessionSummary

- `sessionID`
- `schemaVersion`
- `sourceContentVersion`
- `title`, `shortSummary`
- `activityTypes`, `intents`
- `outcomes`, `blockers`, `keywords`
- `generatedAt`
- `modelConfigurationRef`

### DailyMetrics

- `localDate`
- `providerID` or overall
- `sessionCount`, `interactionCount`
- `tokenUsage`, `activeDuration`
- `availableMetricMask`
- `intensityScore`, `intensityBand`
- `baselineExplanation`

### DailySummary

- `localDate`
- `schemaVersion`
- `inputFingerprint`
- `narrative`
- `focusAreas`, `accomplishments`, `blockers`
- `providerRoles`, `followUps`
- `coverageThrough`, `generatedAt`
- `status`

### AnalysisJob

- `jobType`
- `targetID`
- `inputVersion`
- `status`, `attemptCount`
- `nextRetryAt`, `lastError`

A native session remains one `Session` even when it crosses midnight. Interaction metrics are attributed to the local dates when they occurred. Session lists primarily group the native session by its start date and disclose cross-day activity. Raw timestamps remain unchanged; views aggregate them in the current display timezone.

## 8. User experience

### 8.1 Menu-bar popover

The approximately 360-pixel-wide popover is the frequent-use view:

1. Current local date and coverage time.
2. Today's overall intensity band.
3. Native session total and personal-baseline difference.
4. Claude, Codex, and Hermes activity counts and concise activity labels.
5. A compact daily AI activity narrative.
6. Last update state and refresh/retry control.
7. Entry into the full activity journal.

Detailed trend charts, configuration forms, and the complete session list do not belong in the popover. Quota appears there only when nearing a known limit or when the data needs attention.

### 8.2 Full client

Primary navigation:

- **Today:** intensity, provider composition, daily narrative, and session-summary timeline.
- **History:** a date-oriented AI activity journal.
- **Trends:** 7/30-day intensity, provider distribution, and activity-category changes.
- **Quota:** trustworthy quota and usage details.
- **Settings:** sources, model providers, refresh behavior, privacy, credentials, and advanced regeneration.

Session rows display generated summaries only. The product neither displays complete conversations nor deep-links to source sessions in the MVP.

### 8.3 Visual language and accessibility

- Follow macOS hierarchy and use the system font.
- Use neutral surfaces with one restrained indigo accent.
- Use consistent icons rather than emoji or a collage of provider brand colors.
- Present status through text, values, shape, and color together.
- Avoid gradients, glow, theatrical “AI” animation, and enterprise KPI-card walls.
- Keep interaction feedback between 150 and 250 ms and respect reduced-motion preferences.
- Support keyboard navigation, clear focus states, accessible names, and at least WCAG AA text contrast.

The approved HTML concept is stored in `.superpowers/brainstorm/8095-1785582418/content/activity-ui-design.html`; `.superpowers/` is a local brainstorming artifact and is not part of the product source.

## 9. Onboarding and settings

Onboarding remains usable without an API key; users may begin in statistics-only mode.

1. **Detect local tools:** show detected source locations and capabilities; allow a source to be disabled or its path changed.
2. **Explain processing:** distinguish local scanning from content sent to the selected summary API; require consent before automatic summarization.
3. **Configure a model:** choose Anthropic, OpenAI, or compatible API; enter the required settings; test the connection; store the secret in the OS credential store.
4. **Choose refresh behavior:** default to 10 minutes and explain that no-change checks do not call the model.

Privacy controls include:

- Enable or disable each source.
- Exclude specified projects or directories.
- Exclude sessions matching configured keywords.
- Preview which sessions a manual generation will analyze.
- Pause summarization while continuing metadata collection.
- Delete a day's summary and metrics.
- Delete all local application data.
- Clear stored credentials.
- Export metrics and summaries without conversations.

Destructive actions require confirmation and state exactly what they remove.

## 10. Quota and usage status

Quota is an adapter capability and a secondary product area.

- Display remaining quota only when obtained from a supported, trustworthy source.
- If only usage is available, label it as usage rather than implying a limit.
- If no reliable data exists, show “not supported” with the reason.
- Include the source and latest update time.
- Never infer an account plan or remaining quota from local activity.
- Never read browser cookies, intercept network traffic, or call undocumented private endpoints.

## 11. Cost controls

Record model provider, model, trigger, target, status, retry count, and API-reported input/output tokens for each analysis call. Show daily and 30-day analysis-token totals. Show monetary cost only when returned by a trustworthy source; do not assume model pricing.

Safeguards:

- Never call a model when no relevant input changed.
- Never analyze the same content version twice unless explicitly forced.
- Allow at most one structured-output repair request per job.
- Bound retries and honor rate-limit delays.
- Filter noise before chunking oversized sessions.
- Support a user-configured daily analysis-token ceiling.
- Pause automatic analysis when the ceiling is reached and explain why.
- Show the number of sessions affected before an expensive manual action.

## 12. Error handling

- A source or session failure cannot block unrelated sources or sessions.
- Locked or concurrently changing source files remain pending until a later scan.
- Authentication or model-configuration errors pause automatic summary jobs and surface a direct settings action.
- Rate limits use bounded exponential backoff and persist the next retry time.
- Invalid structured output receives one repair attempt; a second failure becomes an actionable job error.
- A failed daily rebuild preserves the last successful summary and marks its missing coverage.
- Application shutdown preserves queued and failed work for the next startup.
- UI errors identify the affected source or job without exposing conversation text, secrets, or full API payloads in logs.

## 13. Testing strategy

### 13.1 Session-source contract tests

Use sanitized fixtures to verify all three initial adapters:

- Installation and path detection.
- Native session ID, timestamps, model, and available metrics.
- Effective interaction counting.
- Malformed, partial, and concurrently written records.
- Cross-midnight sessions.
- Source-format compatibility and explicit unsupported-version errors.
- Idempotent repeat scans.
- Capability declarations and quota labels.

Hermes local storage and quota capabilities require an implementation spike because its public product page does not document local paths, session formats, or a supported remaining-credit API. The adapter must report unsupported capabilities rather than inventing data when the spike cannot establish a reliable method.

### 13.2 Agent and model-adapter tests

Use mock API servers and deterministic responses to verify:

- Anthropic, OpenAI, and compatible request mappings.
- Credential failures, timeouts, and rate limits.
- Structured-output validation and single repair.
- Noise filtering, redaction, and chunking.
- Regeneration after a session content-version change.
- Daily rebuilding from summaries only.
- No raw conversation content in SQLite, cache files, application logs, or renderer IPC.

### 13.3 Intensity tests

Cover:

- Missing metrics and weight redistribution.
- Cold-start stages.
- Zero-activity days.
- Extreme outliers.
- In-progress-day correction.
- Weekday context.
- Time-zone and daylight-saving changes.
- Provider and overall-score consistency.
- Stable explanations for 7-day and 30-day comparisons.

### 13.4 Electron and UI tests

- IPC validation and renderer privilege boundaries.
- Tray/popover open, refresh, retry, and full-client navigation.
- Non-reentrant scheduled refresh.
- Old-summary preservation and stale-coverage indicators.
- Keyboard operation, focus visibility, reduced motion, and contrast.
- Credential clearing and confirmed data deletion.
- Packaged macOS access to real source directories.
- Upgrade and database-migration behavior.

## 14. Delivery sequence

The implementation plan should order work around technical uncertainty and vertical value:

1. Verify local source formats and supported capabilities, especially Hermes.
2. Establish Electron security boundaries, persistence, and typed domain contracts.
3. Implement metadata collection and activity metrics before any model integration.
4. Implement intensity baselines and expose a statistics-only Today view.
5. Add model configuration and two-level summaries.
6. Add the menu-bar experience, history, trends, quota, and privacy controls.
7. Harden packaging, migrations, adapters, accessibility, and failure recovery.

A later Windows phase should preserve domain, database, summarization, and renderer code while replacing path detection and platform credential integration as needed.