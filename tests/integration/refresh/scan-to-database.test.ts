import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, copyFile, readFile, rm, appendFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createClaudeCodeSource } from '../../../src/main/sources/claude-code'
import { openDatabase } from '../../../src/main/db/open-database'
import { SessionRepository } from '../../../src/main/db/session-repository'
import { RefreshCoordinator } from '../../../src/main/refresh/refresh-coordinator'
import { createSourceRegistry } from '../../../src/main/sources/source-registry'

const databases: ReturnType<typeof openDatabase>[] = []
const temporaryDirectories: string[] = []

const fixture = path.resolve('fixtures/sources/claude/generic-project/generic-session.jsonl')
const sentinel = 'PRIVATE_SENTINEL_DO_NOT_PERSIST'

afterEach(async () => {
  for (const database of databases.splice(0)) database.close()
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('scan to database', () => {
  it('imports Claude metadata idempotently, updates changed content, and stores no raw body', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'claude-source-'))
    temporaryDirectories.push(root)
    const project = path.join(root, 'generic-project')
    await mkdir(project)
    const sessionFile = path.join(project, 'generic-session.jsonl')
    await copyFile(fixture, sessionFile)
    const databaseFile = path.join(root, 'sessions.sqlite')
    const database = openDatabase(databaseFile)
    databases.push(database)
    const sessions = new SessionRepository(database)
    const coordinator = new RefreshCoordinator({
      registry: createSourceRegistry([createClaudeCodeSource({ root })]),
      sessions,
      getSettings: () => ({ enabledSources: { 'claude-code': true, codex: false, hermes: false }, refreshIntervalMinutes: 10 })
    })

    expect(await coordinator.refresh('manual')).toMatchObject({ inserted: 1, updated: 0 })
    expect(await coordinator.refresh('manual')).toMatchObject({ inserted: 0, updated: 0, unchanged: 1 })
    await appendFile(sessionFile, '{"type":"user","session_id":"generic-session","timestamp":"2026-01-01T00:06:00.000Z","content":"generic follow-up"}\n')
    expect(await coordinator.refresh('manual')).toMatchObject({ inserted: 0, updated: 1 })
    expect((await readFile(databaseFile)).includes(Buffer.from(sentinel))).toBe(false)
  })

  it('persists sessions and avoids rewriting unchanged scans', async () => {
    const database = openDatabase(':memory:')
    databases.push(database)
    const sessions = new SessionRepository(database)
    const scan = vi.fn(async () => ({
      sessions: [{
        id: 'codex:native-one',
        providerId: 'codex' as const,
        sourceSessionId: 'native-one',
        startedAt: '2026-08-02T01:00:00.000Z',
        updatedAt: '2026-08-02T01:05:00.000Z',
        projectName: 'token-activity-show',
        workingDirectory: null,
        model: null,
        interactionCount: null,
        interactionEvents: [],
        tokenUsage: null,
        activeDurationSeconds: null,
        contentVersion: 'stable'
      }],
      warnings: [],
      capabilities: {
        interactions: false,
        tokens: false,
        activeDuration: false,
        model: false,
        trustworthyQuota: false
      },
      fingerprint: 'stable'
    }))
    const coordinator = new RefreshCoordinator({
      registry: createSourceRegistry([{
        providerId: 'codex',
        detect: vi.fn(),
        scan
      }]),
      sessions,
      getSettings: () => ({
        enabledSources: { 'claude-code': false, codex: true, hermes: false },
        refreshIntervalMinutes: 10
      })
    })

    expect(await coordinator.refresh('manual')).toMatchObject({
      status: 'complete', inserted: 1, unchanged: 0
    })
    expect(await coordinator.refresh('scheduled')).toMatchObject({
      status: 'complete', inserted: 0, unchanged: 1
    })
    expect(sessions.listByLocalDate('2026-08-02', 'UTC')).toHaveLength(1)
  })
})
