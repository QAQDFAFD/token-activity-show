import console from 'node:console'
import { spawnSync } from 'node:child_process'
import { access, readdir, stat } from 'node:fs/promises'
import { basename, join, relative, sep } from 'node:path'
import process from 'node:process'
import { listPackage } from '@electron/asar'

const root = process.cwd()
const releaseDirectory = join(root, 'release')

function fail(message) {
  console.error(`Package smoke check failed: ${message}`)
  process.exit(1)
}

async function walk(directory) {
  const paths = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) paths.push(...(await walk(path)))
    else paths.push(path)
  }
  return paths
}

function selectSingle(paths, description) {
  if (paths.length === 0) fail(`missing ${description} under release/`)
  if (paths.length > 1) {
    fail(`expected one ${description}, found: ${paths.map((path) => basename(path)).join(', ')}`)
  }
  return paths[0]
}

let releaseEntries
try {
  releaseEntries = await walk(releaseDirectory)
} catch {
  fail('missing release/ directory; run pnpm package:mac first')
}

const appResources = releaseEntries
  .filter((path) => path.endsWith(`${sep}Contents${sep}Resources${sep}app.asar`))
  .map((path) => join(path, '..', '..', '..'))
const appPath = selectSingle(appResources, 'macOS .app bundle')
const zipPath = selectSingle(
  releaseEntries.filter((path) => path.endsWith('.zip')),
  'ZIP artifact',
)
const asarPath = join(appPath, 'Contents', 'Resources', 'app.asar')

const zipResult = spawnSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
if (zipResult.status !== 0) {
  fail(`could not inspect ZIP artifact: ${(zipResult.stderr || zipResult.stdout).trim()}`)
}
if (!zipResult.stdout.split(/\r?\n/u).some((path) => path.endsWith('.app/Contents/Resources/app.asar'))) {
  fail(`ZIP artifact is missing .app/Contents/Resources/app.asar: ${basename(zipPath)}`)
}

try {
  await access(asarPath)
} catch {
  fail(`missing app archive: ${relative(root, asarPath)}`)
}

let packagedPaths
try {
  packagedPaths = listPackage(asarPath)
    .map((path) => path.replace(/^[/\\]+/u, '').replaceAll('\\', '/'))
    .filter(Boolean)
} catch (error) {
  fail(`could not inspect app.asar: ${error instanceof Error ? error.message : String(error)}`)
}

const required = [
  ['main bundle', 'out/main/'],
  ['preload bundle', 'out/preload/'],
  ['renderer bundle', 'out/renderer/'],
  ['package metadata', 'package.json'],
  ['tray asset', 'src/assets/trayTemplate.png'],
]
for (const [description, expectedPath] of required) {
  if (!packagedPaths.some((path) => path === expectedPath || path.startsWith(expectedPath))) {
    fail(`missing ${description}: ${expectedPath}`)
  }
}

const forbiddenPrefixes = ['tests/', 'fixtures/', 'docs/']
for (const path of packagedPaths) {
  const forbiddenPrefix = forbiddenPrefixes.find((prefix) => path.startsWith(prefix))
  if (forbiddenPrefix) fail(`forbidden packaged path: ${path}`)
  if (path.endsWith('.map')) fail(`forbidden source map: ${path}`)
  if (path.includes('evidenced-sessions')) fail(`forbidden E2E fixture module: ${path}`)
}

const [{ size: appArchiveSize }, { size: zipSize }] = await Promise.all([
  stat(asarPath),
  stat(zipPath),
])
console.log(
  `Package smoke check passed: ${basename(appPath)}, ${basename(zipPath)} (${packagedPaths.length} asar paths; app.asar ${appArchiveSize} bytes; ZIP ${zipSize} bytes)`,
)
