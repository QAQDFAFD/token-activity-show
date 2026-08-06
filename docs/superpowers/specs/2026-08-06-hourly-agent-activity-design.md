# Hourly Agent Activity Visualization Design

**Date:** 2026-08-06
**Status:** Approved

## Goal

Add a truthful 24-hour stacked bar chart to Today, distinguish Claude Code/Codex/Hermes consistently, and fix refresh feedback styling without changing the local-first data boundary.

## Data contract

TodayViewModel gains `hourlyActivity: HourlyActivity[]` with exactly 24 entries. Each entry contains local hour 0–23, total effective interactions, per-provider counts, and provider availability. Counts are derived only from real non-empty user interactions with event-level timestamps. System, assistant, tool-only, heartbeat, empty, and metadata records are excluded. Providers lacking event-level timestamps return `null` for hourly values and are labeled unavailable; unknown is never converted to zero.

Main process performs all aggregation and timezone conversion. Renderer receives the serialized model through existing typed IPC and never reads source files, SQLite, or raw event content.

## Visualization

Today renders a 24-hour stacked bar chart after the intensity summary and before daily metric details. Bar height represents total effective interactions. Segments represent providers with stable presentation tokens:

- Claude Code: restrained blue;
- Codex: green;
- Hermes: orange.

Every chart has text legend and a provider table/labels; color is never the sole encoding. Keyboard focus and hover expose hour, total, and provider counts. Zero-activity hours remain visible. If all event-level data is unavailable, the chart presents an explicit unavailable state rather than an empty or zero chart. Light/dark themes and reduced-motion behavior are required.

## Refresh feedback

Refresh results use a dedicated `.refresh-feedback` element rather than `.notice`, avoiding the notice's two-column layout. Complete, no-change, unsupported, partial, skipped, and failure variants retain accessible `role=status` or `role=alert`, semantic colors, compact padding, and a menu-bar variant.

## Provider presentation

A shared presentation map supplies label and semantic color token for all provider rows, legend entries, chart segments, and recent-session labels. Text labels remain present in every representation.

## Testing and privacy

Test timezone/hour bucketing, midnight boundaries, unavailable provider precision, zero hours, segment totals, API serialization, accessible chart labels/focus, refresh feedback classes, themes, narrow layouts, and reduced motion. No raw prompt, response, tool data, path, credential, or secret enters hourly models, SQLite, IPC, logs, or fixtures.
