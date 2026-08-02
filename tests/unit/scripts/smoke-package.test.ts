import { spawnSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPackage } from '@electron/asar'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))

const temporaryDirectories: string[] = []

async function createAsar(path: string, forbidden = false): Promise<void> {
  const source = `${path}-source`
  const files = [
    'out/main/index.js',
    'out/preload/index.js',
    'out/renderer/index.html',
    'package.json',
    'src/assets/trayTemplate.png',
  ]
  if (forbidden) files.push('node_modules/example/tests/forbidden.js')
  for (const file of files) {
    const filePath = join(source, file)
    await mkdir(join(filePath, '..'), { recursive: true })
    await writeFile(filePath, file)
  }
  await createPackage(source, path)
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })))
})

describe('smokePackage', () => {
  it('rejects a forbidden ZIP ASAR even when the unpacked app ASAR is clean', async () => {
    const root = await mkdtemp(join(tmpdir(), 'token-show-smoke-test-'))
    temporaryDirectories.push(root)
    const release = join(root, 'release')
    const app = join(release, 'mac-arm64', 'Token Show.app')
    const resources = join(app, 'Contents', 'Resources')
    await mkdir(resources, { recursive: true })
    await createAsar(join(resources, 'app.asar'))

    const zipRoot = join(root, 'zip-root')
    const zipResources = join(zipRoot, 'Token Show.app', 'Contents', 'Resources')
    await mkdir(zipResources, { recursive: true })
    await createAsar(join(zipResources, 'app.asar'), true)
    const zipPath = join(release, 'Token Show.zip')
    const zip = spawnSync('zip', ['-q', '-r', zipPath, 'Token Show.app'], { cwd: zipRoot })
    expect(zip.status).toBe(0)

    const result = spawnSync(process.execPath, [join(projectRoot, 'scripts', 'smoke-package.mjs')], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(
      'ZIP app.asar forbidden packaged path: node_modules/example/tests',
    )
  })
})
