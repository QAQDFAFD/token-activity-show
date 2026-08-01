#!/usr/bin/env node
import { stat, readFile, writeFile } from 'node:fs/promises'
import { extname, join, relative, resolve } from 'node:path'
import { homedir } from 'node:os'
import process from 'node:process'
import Database from 'better-sqlite3'
import type { ProviderId } from '../src/shared/domain'

interface ProbeOptions {
  provider: ProviderId
  path?: string
  output?: string
}

interface StructuralSample {
  timestamp: string | null
  type: string | null
}

interface ProbeReport {
  provider: ProviderId
  status: 'detected' | 'not-detected'
  candidatePath: string
  extension?: string
  byteSize?: number
  topLevelKeys?: string[]
  sqlite?: Array<{ table: string; columns: string[] }>
  recordCount?: number
  samples?: StructuralSample[]
  reasonCode?: 'PATH_NOT_FOUND' | 'UNSUPPORTED_STRUCTURE' | 'READ_ERROR'
}

const DEFAULT_CANDIDATES: Record<ProviderId, string[]> = {
  'claude-code': [join(homedir(), '.claude', 'projects')],
  codex: [join(homedir(), '.codex', 'sessions')],
  hermes: [
    join(homedir(), '.hermes', 'sessions'),
    join(homedir(), '.config', 'hermes')
  ]
}

const SENSITIVE_KEY =
  /(content|message|prompt|response|text|token|secret|cookie|credential|environment|api.?key)/i
const TIMESTAMP_KEY =
  /^(created_at|updated_at|started_at|timestamp|time|date)$/i
const TYPE_KEY = /^(type|kind|role|event_type)$/i

function usage(): never {
  console.error(
    'Usage: probe-sources --provider <claude-code|codex|hermes> [--path <path>] [--output <file>]'
  )
  process.exit(2)
}

function parseArgs(argv: string[]): ProbeOptions {
  const values = new Map<string, string>()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith('--') || value === undefined) usage()
    values.set(flag, value)
  }
  const provider = values.get('--provider')
  if (
    provider !== 'claude-code' &&
    provider !== 'codex' &&
    provider !== 'hermes'
  )
    usage()
  for (const key of values.keys()) {
    if (!['--provider', '--path', '--output'].includes(key)) usage()
  }
  const path = values.get('--path')
  const output = values.get('--output')
  return {
    provider,
    ...(path === undefined ? {} : { path }),
    ...(output === undefined ? {} : { output })
  }
}

function displayPath(path: string): string {
  const home = resolve(homedir())
  const absolute = resolve(path)
  const withinHome = relative(home, absolute)
  return withinHome === ''
    ? '~'
    : withinHome.startsWith('..')
      ? '<external-path>'
      : `~/${withinHome}`
}

function safeKeys(value: unknown): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return []
  return Object.keys(value)
    .filter((key) => !SENSITIVE_KEY.test(key))
    .sort()
}

function structuralSample(value: unknown): StructuralSample {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { timestamp: null, type: null }
  }
  const entries = Object.entries(value)
  const timestamp = entries.find(
    ([key, item]) => TIMESTAMP_KEY.test(key) && typeof item === 'string'
  )?.[1]
  const type = entries.find(
    ([key, item]) => TYPE_KEY.test(key) && typeof item === 'string'
  )?.[1]
  return {
    timestamp:
      typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp))
        ? timestamp
        : null,
    type:
      typeof type === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(type)
        ? type
        : null
  }
}

async function probeJson(
  path: string,
  provider: ProviderId,
  byteSize: number
): Promise<ProbeReport> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
  const records = Array.isArray(parsed) ? parsed : [parsed]
  return {
    provider,
    status: 'detected',
    candidatePath: displayPath(path),
    extension: extname(path).toLowerCase() || '<none>',
    byteSize,
    topLevelKeys: safeKeys(Array.isArray(parsed) ? parsed[0] : parsed),
    recordCount: records.length,
    samples: records.slice(0, 3).map(structuralSample)
  }
}

async function probeJsonLines(
  path: string,
  provider: ProviderId,
  byteSize: number
): Promise<ProbeReport> {
  const lines = (await readFile(path, 'utf8'))
    .split(/\r?\n/u)
    .filter((line) => line.trim() !== '')
  const records = lines.slice(0, 3).map((line) => JSON.parse(line) as unknown)
  return {
    provider,
    status: 'detected',
    candidatePath: displayPath(path),
    extension: extname(path).toLowerCase() || '<none>',
    byteSize,
    topLevelKeys: safeKeys(records[0]),
    recordCount: lines.length,
    samples: records.map(structuralSample)
  }
}

function probeSqlite(
  path: string,
  provider: ProviderId,
  byteSize: number
): ProbeReport {
  const database = new Database(path, { readonly: true, fileMustExist: true })
  try {
    const tables = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as Array<{ name: string }>
    return {
      provider,
      status: 'detected',
      candidatePath: displayPath(path),
      extension: extname(path).toLowerCase() || '<none>',
      byteSize,
      sqlite: tables.map(({ name }) => ({
        table: name,
        columns: (
          database
            .prepare(`PRAGMA table_info(${JSON.stringify(name)})`)
            .all() as Array<{ name: string }>
        ).map((column) => column.name)
      }))
    }
  } finally {
    database.close()
  }
}

async function probeCandidate(
  path: string,
  provider: ProviderId
): Promise<ProbeReport> {
  const candidatePath = displayPath(path)
  try {
    const metadata = await stat(path)
    if (!metadata.isFile()) {
      return {
        provider,
        status: 'detected',
        candidatePath,
        reasonCode: 'UNSUPPORTED_STRUCTURE'
      }
    }
    const extension = extname(path).toLowerCase()
    if (extension === '.json')
      return await probeJson(path, provider, metadata.size)
    if (extension === '.jsonl' || extension === '.ndjson')
      return await probeJsonLines(path, provider, metadata.size)
    if (
      extension === '.sqlite' ||
      extension === '.sqlite3' ||
      extension === '.db'
    ) {
      return probeSqlite(path, provider, metadata.size)
    }
    return {
      provider,
      status: 'not-detected',
      candidatePath,
      extension: extension || '<none>',
      byteSize: metadata.size,
      reasonCode: 'UNSUPPORTED_STRUCTURE'
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return {
      provider,
      status: 'not-detected',
      candidatePath,
      reasonCode: code === 'ENOENT' ? 'PATH_NOT_FOUND' : 'READ_ERROR'
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const candidates =
    options.path === undefined
      ? DEFAULT_CANDIDATES[options.provider]
      : [options.path]
  const reports = await Promise.all(
    candidates.map((path) => probeCandidate(path, options.provider))
  )
  const output = `${JSON.stringify(reports, null, 2)}\n`
  process.stdout.write(output)
  if (options.output !== undefined)
    await writeFile(options.output, output, { encoding: 'utf8', flag: 'wx' })
}

await main()
