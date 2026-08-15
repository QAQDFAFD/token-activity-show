import path from 'node:path'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { createHermesSource } from '../../../src/main/sources/hermes'

const fixtureRoot = path.resolve('fixtures/sources/hermes')
const sentinel = 'PRIVATE_SENTINEL_DO_NOT_PERSIST'
const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

function unix(isoTimestamp: string): number {
  return Date.parse(isoTimestamp) / 1000
}

async function createDatabaseFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'token-show-hermes-db-'))
  temporaryRoots.push(root)
  const databasePath = path.join(root, 'state.db')
  const database = new Database(databasePath)
  database.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      source TEXT,
      model TEXT,
      system_prompt TEXT,
      started_at REAL,
      ended_at REAL,
      message_count INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cache_read_tokens INTEGER,
      cache_write_tokens INTEGER,
      reasoning_tokens INTEGER
    );
    CREATE TABLE messages (
      id INTEGER PRIMARY KEY,
      session_id TEXT,
      role TEXT,
      content TEXT,
      timestamp REAL
    );
  `)
  database
    .prepare(
      `INSERT INTO sessions (
        id, source, model, system_prompt, started_at, ended_at, message_count,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, reasoning_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'generic-session',
      'cli',
      'generic-model',
      sentinel,
      unix('2026-01-01T00:00:00.000Z'),
      unix('2026-01-01T00:05:00.000Z'),
      3,
      11,
      7,
      0,
      0,
      0
    )
  const insertMessage = database.prepare(
    'INSERT INTO messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)'
  )
  insertMessage.run(
    'generic-session',
    'user',
    'generic request',
    unix('2026-01-01T00:01:00.000Z')
  )
  insertMessage.run('generic-session', 'assistant', sentinel, unix('2026-01-01T00:02:00.000Z'))
  insertMessage.run(
    'generic-session',
    'user',
    'generic follow-up',
    unix('2026-01-01T00:05:00.000Z')
  )
  database.close()
  return databasePath
}

describe('Hermes source', () => {
  it('parses jsonl and session JSON without returning body content or request dumps', async () => {
    const source = createHermesSource({ roots: [fixtureRoot] })
    const detection = await source.detect()
    const result = await source.scan({})

    expect(detection.available).toBe(true)
    expect(detection.candidates.map((candidate) => candidate.kind).sort()).toEqual(['json', 'jsonl'])
    expect(result.sessions).toEqual([
      expect.objectContaining({
        id: 'hermes:20260101_000000_abcd1234',
        sourceSessionId: '20260101_000000_abcd1234',
        startedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:05:00.000Z',
        projectName: null,
        workingDirectory: null,
        model: 'generic-model',
        interactionCount: 2,
        interactionEvents: ['2026-01-01T00:01:00.000Z', '2026-01-01T00:05:00.000Z'],
        tokenUsage: null,
        activeDurationSeconds: null
      }),
      expect.objectContaining({
        id: 'hermes:generic-session',
        sourceSessionId: 'generic-session',
        startedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:05:00.000Z',
        projectName: null,
        workingDirectory: null,
        model: 'generic-model',
        interactionCount: 1,
        interactionEvents: [],
        tokenUsage: null,
        activeDurationSeconds: null
      })
    ])
    expect(result.sessions.every((session) => /^[a-f0-9]{64}$/u.test(session.contentVersion))).toBe(
      true
    )
    expect(result.capabilities).toMatchObject({
      interactions: true,
      tokens: false,
      activeDuration: false,
      model: true,
      trustworthyQuota: false
    })
    expect(result.warnings).toEqual([expect.objectContaining({ code: 'MALFORMED_RECORD' })])
    expect(JSON.stringify(result)).not.toContain(sentinel)
    expect(JSON.stringify(result)).not.toContain('ignored-dump')
    expect(await source.scan({ previousFingerprint: result.fingerprint })).toEqual(result)
  })

  it('parses the native state database without returning body content', async () => {
    const databasePath = await createDatabaseFixture()
    await writeFile(path.join(path.dirname(databasePath), 'session_ignored.json'), '{}')
    const source = createHermesSource({
      databasePath,
      roots: [path.dirname(databasePath)]
    })
    const detection = await source.detect()
    const result = await source.scan({})

    expect(detection).toMatchObject({ available: true, candidates: [{ kind: 'sqlite' }] })
    expect(result.sessions).toEqual([
      expect.objectContaining({
        id: 'hermes:generic-session',
        sourceSessionId: 'generic-session',
        startedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:05:00.000Z',
        projectName: null,
        workingDirectory: null,
        model: 'generic-model',
        interactionCount: 2,
        interactionEvents: ['2026-01-01T00:01:00.000Z', '2026-01-01T00:05:00.000Z'],
        tokenUsage: 18,
        activeDurationSeconds: null
      })
    ])
    expect(result.capabilities).toMatchObject({
      interactions: true,
      tokens: true,
      activeDuration: false,
      model: true,
      trustworthyQuota: false
    })
    expect(JSON.stringify(result)).not.toContain(sentinel)
    expect(result.sessions).toHaveLength(1)
    expect(await source.scan({ previousFingerprint: result.fingerprint })).toEqual(result)
  })
})
