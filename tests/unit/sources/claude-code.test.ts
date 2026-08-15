import path from 'node:path'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { createClaudeCodeSource } from '../../../src/main/sources/claude-code'

const fixtureRoot = path.resolve('fixtures/sources/claude')
const sentinel = 'PRIVATE_SENTINEL_DO_NOT_PERSIST'
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

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
      interactionCount: 1, interactionEvents: ['2026-01-01T00:01:00.000Z'], tokenUsage: null, activeDurationSeconds: null
    })])
    const session = result.sessions.at(0)
    expect(session).toBeDefined()
    if (session === undefined) throw new Error('Expected one parsed Claude Code session')
    expect(session.contentVersion).toMatch(/^[a-f0-9]{64}$/u)
    expect(result.warnings).toEqual([expect.objectContaining({ code: 'MALFORMED_RECORD' })])
    expect(JSON.stringify(result)).not.toContain(sentinel)
    expect(await source.scan({ previousFingerprint: result.fingerprint })).toEqual(result)
  })

  it('keeps fallback identities distinct for equal basenames in separate projects', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'token-show-claude-source-'))
    temporaryRoots.push(root)
    const record = JSON.stringify({ type: 'user', timestamp: '2026-01-01T00:00:00.000Z', message: 'synthetic' })
    await Promise.all(['project-a', 'project-b'].map(async (project) => {
      const directory = path.join(root, project)
      await mkdir(directory)
      await writeFile(path.join(directory, 'session.jsonl'), `${record}\n`)
    }))

    const result = await createClaudeCodeSource({ root }).scan({})

    expect(result.sessions).toHaveLength(2)
    expect(new Set(result.sessions.map((session) => session.id)).size).toBe(2)
    expect(result.sessions.every((session) => /^[a-f0-9]{64}$/u.test(session.sourceSessionId))).toBe(true)
  })
})
