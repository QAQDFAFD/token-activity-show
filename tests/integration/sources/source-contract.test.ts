import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createClaudeCodeSource } from '../../../src/main/sources/claude-code'
import { createCodexSource } from '../../../src/main/sources/codex'
import { createHermesSource } from '../../../src/main/sources/hermes'
import type { SessionSource } from '../../../src/main/sources/session-source'

const sources: SessionSource[] = [
  createClaudeCodeSource({ root: path.resolve('fixtures/sources/claude') }),
  createCodexSource({ root: path.resolve('fixtures/sources/codex') }),
  createHermesSource({ roots: [path.resolve('fixtures/sources/hermes')] })
]

describe.each(sources)('$providerId source contract', (source) => {
  it('is explicit, truthful, idempotent, and content-free', async () => {
    const detection = await source.detect()
    const first = await source.scan({})
    const second = await source.scan({ previousFingerprint: first.fingerprint })

    expect(first).toEqual(second)
    expect(first.fingerprint).toMatch(/^[a-f0-9]{64}$/u)
    expect(JSON.stringify(first)).not.toMatch(/prompt|response|message content/iu)
    expect(detection.available).toBe(true)
    expect(first.sessions.length).toBeGreaterThanOrEqual(1)
    expect(first.capabilities.interactions).toBe(true)
    expect(first.sessions.every((session) => session.providerId === source.providerId)).toBe(true)
  })
})

it('exposes each native provider ID exactly once', () => {
  expect(sources.map((source) => source.providerId)).toEqual([
    'claude-code',
    'codex',
    'hermes'
  ])
  expect(new Set(sources.map((source) => source.providerId)).size).toBe(
    sources.length
  )
})
