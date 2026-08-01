import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createClaudeCodeSource } from '../../../src/main/sources/claude-code'

const fixtureRoot = path.resolve('fixtures/sources/claude')

describe('Claude Code source', () => {
  it('reports the unsupported fixture as an established unsupported state', async () => {
    const source = createClaudeCodeSource({ root: fixtureRoot })

    await expect(source.detect()).resolves.toMatchObject({
      available: false,
      reason: 'FORMAT_NOT_ESTABLISHED',
      candidates: [{ kind: 'json' }]
    })
    await expect(source.scan({})).resolves.toMatchObject({
      sessions: [],
      capabilities: {
        interactions: false,
        tokens: false,
        activeDuration: false,
        model: false,
        trustworthyQuota: false
      },
      warnings: [{ code: 'FORMAT_NOT_ESTABLISHED' }]
    })
  })
})
