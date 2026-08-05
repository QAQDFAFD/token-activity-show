import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = dirname(
  dirname(dirname(dirname(fileURLToPath(import.meta.url))))
)
const temporaryDirectories: string[] = []

function runProbe(root: string) {
  return spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      join(projectRoot, 'scripts', 'probe-sources.ts'),
      '--provider',
      'claude-code',
      '--path',
      root
    ],
    { cwd: projectRoot, encoding: 'utf8' }
  )
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true }))
  )
})

describe('probe-sources', () => {
  it('reports nested JSONL structure without exposing values or real path segments', async () => {
    const root = await mkdtemp(join(tmpdir(), 'token-show-probe-'))
    temporaryDirectories.push(root)
    const realProjectName = 'REAL_PRIVATE_PROJECT_SENTINEL'
    const realSessionName = 'REAL_PRIVATE_SESSION_SENTINEL'
    const nested = join(root, realProjectName, 'nested-private-directory')
    await mkdir(nested, { recursive: true })
    await writeFile(
      join(nested, `${realSessionName}.jsonl`),
      [
        JSON.stringify({
          type: 'user',
          timestamp: '2026-08-05T01:02:03Z',
          message: 'PROMPT_SECRET_SENTINEL',
          cwd: '/Users/private/person'
        }),
        '{malformed',
        JSON.stringify({
          type: 'assistant',
          timestamp: 'not-a-date',
          response: 'RESPONSE_SECRET_SENTINEL',
          apiKey: 'CREDENTIAL_SECRET_SENTINEL'
        }),
        JSON.stringify({
          type: 'unapproved-secret-type',
          timestamp: '2026-08-05T01:02:04Z',
          env: 'ENV_SECRET_SENTINEL'
        })
      ].join('\n')
    )

    const result = runProbe(root)
    expect(result.status).toBe(0)
    const output = result.stdout
    expect(output).toContain('"pathTemplate": "<project>/<session>.jsonl"')
    expect(output).toContain('"topLevelKeys"')
    expect(output).toContain('"typeCounts"')
    expect(output).toContain('"user": 1')
    expect(output).toContain('"assistant": 1')
    expect(output).toContain('"timestampParseability"')
    for (const forbidden of [
      realProjectName,
      realSessionName,
      'nested-private-directory',
      'PROMPT_SECRET_SENTINEL',
      'RESPONSE_SECRET_SENTINEL',
      'CREDENTIAL_SECRET_SENTINEL',
      'ENV_SECRET_SENTINEL',
      'unapproved-secret-type',
      '/Users/private/person'
    ]) {
      expect(output).not.toContain(forbidden)
    }
  })

  it('does not traverse an escaping symlink', async () => {
    const root = await mkdtemp(join(tmpdir(), 'token-show-probe-root-'))
    const outside = await mkdtemp(join(tmpdir(), 'token-show-probe-outside-'))
    temporaryDirectories.push(root, outside)
    await writeFile(
      join(outside, 'ESCAPED_FILE_SENTINEL.jsonl'),
      JSON.stringify({ type: 'user', message: 'ESCAPED_CONTENT_SENTINEL' })
    )
    await symlink(outside, join(root, 'escaping-link'))

    const result = runProbe(root)
    expect(result.status).toBe(0)
    expect(result.stdout).not.toContain('ESCAPED_FILE_SENTINEL')
    expect(result.stdout).not.toContain('ESCAPED_CONTENT_SENTINEL')
  })

  it('bounds oversized lines and the number of traversed files deterministically', async () => {
    const root = await mkdtemp(join(tmpdir(), 'token-show-probe-caps-'))
    temporaryDirectories.push(root)
    await mkdir(join(root, 'private-project'), { recursive: true })
    await writeFile(
      join(root, 'private-project', '000-oversized.jsonl'),
      `${JSON.stringify({ type: 'user', message: `OVERSIZED_SECRET_SENTINEL${'x'.repeat(300_000)}` })}\n${JSON.stringify({ type: 'assistant', timestamp: '2026-08-05T01:02:03Z' })}`
    )
    for (let index = 0; index < 120; index += 1) {
      await writeFile(
        join(
          root,
          'private-project',
          `${String(index + 1).padStart(3, '0')}.jsonl`
        ),
        JSON.stringify({ type: 'user', timestamp: '2026-08-05T01:02:03Z' })
      )
    }

    const first = runProbe(root)
    const second = runProbe(root)
    expect(first.status).toBe(0)
    expect(first.stdout).toBe(second.stdout)
    expect(first.stdout).not.toContain('OVERSIZED_SECRET_SENTINEL')
    const report = JSON.parse(first.stdout) as Array<unknown>
    expect(report.length).toBeLessThanOrEqual(100)
  })
})
