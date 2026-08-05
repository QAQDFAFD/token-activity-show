import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createClaudeCodeSource } from '../../../src/main/sources/claude-code'

const fixtureRoot = path.resolve('fixtures/sources/claude')
const sentinel = 'PRIVATE_SENTINEL_DO_NOT_PERSIST'

describe('Claude Code source', () => {
  it('parses one native file as one session without returning body content', async () => {
    const source = createClaudeCodeSource({ root: fixtureRoot })
    const detection = await source.detect()
    const result = await source.scan({})

    expect(detection).toMatchObject({ available: true, candidates: [{ kind: 'jsonl' }] })
    expect(result.sessions).toEqual([expect.objectContaining({
      id: 'claude-code:generic-session', sourceSessionId: 'generic-session',
      startedAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:05:00.000Z',
      projectName: 'generic-project', workingDirectory: null, model: null,
      interactionCount: 1, tokenUsage: null, activeDurationSeconds: null
    })])
    const session = result.sessions.at(0)
    expect(session).toBeDefined()
    if (session === undefined) throw new Error('Expected one parsed Claude Code session')
    expect(session.contentVersion).toMatch(/^[a-f0-9]{64}$/u)
    expect(result.warnings).toEqual([expect.objectContaining({ code: 'MALFORMED_RECORD' })])
    expect(JSON.stringify(result)).not.toContain(sentinel)
    expect(await source.scan({ previousFingerprint: result.fingerprint })).toEqual(result)
  })
})
