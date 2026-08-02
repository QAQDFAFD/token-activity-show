import console from 'node:console'
import { spawnSync } from 'node:child_process'
import { access, mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, relative, sep } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { listPackage } from '@electron/asar'

const required = [
  ['main bundle', 'out/main/'],
  ['preload bundle', 'out/preload/'],
  ['renderer bundle', 'out/renderer/'],
  ['package metadata', 'package.json'],
  ['tray asset', 'src/assets/trayTemplate.png'],
]
const forbiddenSegments = new Set(['tests', 'fixtures'])

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
  if (paths.length === 0) throw new Error(`missing ${description} under release/`)
  if (paths.length > 1) {
    throw new Error(
      `expected one ${description}, found: ${paths.map((path) => basename(path)).join(', ')}`,
    )
  }
  return paths[0]
}

export function validateAsar(asarPath, description = 'app.asar') {
  let packagedPaths
  try {
    packagedPaths = listPackage(asarPath)
      .map((path) => path.replace(/^[/\\]+/u, '').replaceAll('\\', '/'))
      .filter(Boolean)
  } catch (error) {
    throw new Error(
      `could not inspect ${description}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }

  for (const [pathDescription, expectedPath] of required) {
    if (!packagedPaths.some((path) => path === expectedPath || path.startsWith(expectedPath))) {
      throw new Error(`${description} missing ${pathDescription}: ${expectedPath}`)
    }
  }

  for (const path of packagedPaths) {
    const segments = path.split('/')
    const forbiddenSegment = segments.find((segment) => forbiddenSegments.has(segment))
    if (forbiddenSegment) {
      throw new Error(`${description} forbidden packaged path: ${path}`)
    }
    if (path.startsWith('docs/')) throw new Error(`${description} forbidden packaged path: ${path}`)
    if (path.endsWith('.map')) throw new Error(`${description} forbidden source map: ${path}`)
    if (path.includes('evidenced-sessions')) {
      throw new Error(`${description} forbidden E2E fixture module: ${path}`)
    }
  }

  return packagedPaths
}

function runUnzip(args, zipPath, encoding) {
  const result = spawnSync('unzip', [...args, zipPath], {
    encoding,
    maxBuffer: 1024 * 1024 * 1024,
  })
  if (result.status !== 0) {
    const output = result.stderr || result.stdout
    throw new Error(`could not inspect ZIP artifact: ${String(output).trim()}`)
  }
  return result.stdout
}

export async function validateZipAsar(zipPath) {
  const entries = String(runUnzip(['-Z1'], zipPath, 'utf8'))
    .split(/\r?\n/u)
    .filter((path) => path.endsWith('.app/Contents/Resources/app.asar'))
  const asarEntry = selectSingle(entries, 'app.asar in ZIP artifact')
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'token-show-smoke-package-'))
  const extractedAsarPath = join(temporaryDirectory, 'app.asar')

  try {
    const result = spawnSync('unzip', ['-p', zipPath, asarEntry], {
      encoding: 'buffer',
      maxBuffer: 1024 * 1024 * 1024,
    })
    if (result.status !== 0) {
      throw new Error(`could not extract ZIP app.asar: ${String(result.stderr).trim()}`)
    }
    await writeFile(extractedAsarPath, result.stdout)
    return validateAsar(extractedAsarPath, 'ZIP app.asar')
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true })
  }
}

export async function smokePackage(root = process.cwd()) {
  const releaseDirectory = join(root, 'release')
  let releaseEntries
  try {
    releaseEntries = await walk(releaseDirectory)
  } catch {
    throw new Error('missing release/ directory; run pnpm package:mac first')
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

  try {
    await access(asarPath)
  } catch {
    throw new Error(`missing app archive: ${relative(root, asarPath)}`)
  }

  const packagedPaths = validateAsar(asarPath, 'unpacked app.asar')
  await validateZipAsar(zipPath)
  const [{ size: appArchiveSize }, { size: zipSize }] = await Promise.all([
    stat(asarPath),
    stat(zipPath),
  ])
  return `Package smoke check passed: ${basename(appPath)}, ${basename(zipPath)} (${packagedPaths.length} asar paths; app.asar ${appArchiveSize} bytes; ZIP ${zipSize} bytes)`
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) {
  smokePackage()
    .then((message) => console.log(message))
    .catch((error) => {
      console.error(`Package smoke check failed: ${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
    })
}
