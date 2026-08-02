# System Blue Accent Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove purple renderer accents and replace them with a restrained macOS system-blue family.

**Architecture:** Update only semantic accent tokens and remove legacy purple literals so all controls inherit blue through existing theme variables.

**Tech Stack:** Native CSS, React, Vitest.

## Global Constraints

- No gradients, glows, or decorative blue surfaces.
- Blue remains limited to selection, action, switch, and focus states.
- Preserve layout, locale, themes, and behavior.

---

### Task 1: Migrate accent colors

- [ ] Replace light accent, hover, soft selection, and focus values.
- [ ] Replace dark accent text, solid control, hover, and soft selection values.
- [ ] Remove every legacy purple literal from renderer CSS.

### Task 2: Verify and ship

- [ ] Search for legacy purple values and require zero matches.
- [ ] Run renderer tests, typecheck, lint, full tests, and build.
- [ ] Inspect real Electron Light and Dark modes, commit, and push.
