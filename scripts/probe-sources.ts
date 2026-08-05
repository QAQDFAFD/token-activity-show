#!/usr/bin/env node
import { createReadStream } from 'node:fs'
import {
  lstat,
  open,
  opendir,
  realpath,
  stat,
  writeFile
} from 'node:fs/promises'
import { extname, join } from 'node:path'
import { homedir } from 'node:os'
import process from 'node:process'
import { createInterface } from 'node:readline'
import type { ProviderId } from '../src/shared/domain'

interface ProbeOptions {
  provider: ProviderId
  path?: string
  output?: string
}

interface ProbeReport {
  provider: ProviderId
  status: 'detected' | 'not-detected'
  pathTemplate: string
  extension?: string
  byteSize?: number
  topLevelKeys?: string[]
  typeCounts?: Record<string, number>
  timestampParseability?: {
    parseable: number
    unparseable: number
    missing: number
  }
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

// Privacy/resource limits apply across one invocation, not independently per directory.
const MAX_FILES = 100
const MAX_TOTAL_BYTES = 4 * 1024 * 1024
const MAX_FILE_BYTES = 1024 * 1024
const MAX_LINE_BYTES = 256 * 1024
const MAX_RECORDS_PER_FILE = 100
const ALLOWED_RECORD_TYPES = new Set([
  'assistant',
  'file-history-snapshot',
  'progress',
  'queue-operation',
  'summary',
  'system',
  'user'
])
const TIMESTAMP_KEYS = ['timestamp', 'created_at', 'updated_at', 'started_at']

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

function isWithinRoot(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`)
}

function pathTemplate(provider: ProviderId, extension = ''): string {
  if (
    provider === 'claude-code' &&
    (extension === '.jsonl' || extension === '.ndjson')
  ) {
    return `<project>/<session>${extension}`
  }
  return `<source>/<record>${extension || '.unknown'}`
}

function emptyTimestampCounts(): NonNullable<
  ProbeReport['timestampParseability']
> {
  return { parseable: 0, unparseable: 0, missing: 0 }
}

function collectRecord(
  value: unknown,
  keys: Set<string>,
  typeCounts: Record<string, number>,
  timestamps: NonNullable<ProbeReport['timestampParseability']>
): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return
  const record = value as Record<string, unknown>
  for (const key of Object.keys(record)) keys.add(key)

  if (
    typeof record.type === 'string' &&
    ALLOWED_RECORD_TYPES.has(record.type)
  ) {
    typeCounts[record.type] = (typeCounts[record.type] ?? 0) + 1
  }

  const timestamp = TIMESTAMP_KEYS.map((key) => record[key]).find(
    (item) => item !== undefined
  )
  if (timestamp === undefined) timestamps.missing += 1
  else if (
    typeof timestamp === 'string' &&
    !Number.isNaN(Date.parse(timestamp))
  ) {
    timestamps.parseable += 1
  } else timestamps.unparseable += 1
}

async function probeJsonLines(
  path: string,
  provider: ProviderId,
  byteSize: number,
  byteBudget: number
): Promise<ProbeReport> {
  const extension = extname(path).toLowerCase()
  const sampledBytes = Math.min(byteSize, MAX_FILE_BYTES, byteBudget)
  const keys = new Set<string>()
  const typeCounts: Record<string, number> = {}
  const timestamps = emptyTimestampCounts()
  let sampledRecords = 0

  if (sampledBytes > 0) {
    const input = createReadStream(path, {
      start: 0,
      end: sampledBytes - 1,
      encoding: 'utf8'
    })
    const lines = createInterface({ input, crlfDelay: Infinity })
    for await (const line of lines) {
      if (sampledRecords >= MAX_RECORDS_PER_FILE) break
      if (
        Buffer.byteLength(line, 'utf8') > MAX_LINE_BYTES ||
        line.trim() === ''
      )
        continue
      try {
        collectRecord(JSON.parse(line) as unknown, keys, typeCounts, timestamps)
        sampledRecords += 1
      } catch {
        // Malformed records are structural noise and are never echoed.
      }
    }
    lines.close()
    input.destroy()
  }

  return {
    provider,
    status: 'detected',
    pathTemplate: pathTemplate(provider, extension),
    extension,
    byteSize,
    topLevelKeys: [...keys].sort(),
    typeCounts: Object.fromEntries(
      Object.entries(typeCounts).sort(([left], [right]) =>
        left.localeCompare(right)
      )
    ),
    timestampParseability: timestamps
  }
}

async function probeJson(
  path: string,
  provider: ProviderId,
  byteSize: number,
  byteBudget: number
): Promise<ProbeReport> {
  const extension = extname(path).toLowerCase()
  if (byteSize > Math.min(MAX_FILE_BYTES, byteBudget)) {
    return {
      provider,
      status: 'not-detected',
      pathTemplate: pathTemplate(provider, extension),
      extension,
      byteSize,
      reasonCode: 'UNSUPPORTED_STRUCTURE'
    }
  }
  const handle = await open(path, 'r')
  try {
    const contents = await handle.readFile({ encoding: 'utf8' })
    const parsed: unknown = JSON.parse(contents)
    const records = Array.isArray(parsed)
      ? parsed.slice(0, MAX_RECORDS_PER_FILE)
      : [parsed]
    const keys = new Set<string>()
    const typeCounts: Record<string, number> = {}
    const timestamps = emptyTimestampCounts()
    for (const record of records)
      collectRecord(record, keys, typeCounts, timestamps)
    return {
      provider,
      status: 'detected',
      pathTemplate: pathTemplate(provider, extension),
      extension,
      byteSize,
      topLevelKeys: [...keys].sort(),
      typeCounts: Object.fromEntries(
        Object.entries(typeCounts).sort(([left], [right]) =>
          left.localeCompare(right)
        )
      ),
      timestampParseability: timestamps
    }
  } finally {
    await handle.close()
  }
}

async function collectFiles(root: string): Promise<string[]> {
  const files: string[] = []
  const pending = [root]
  while (pending.length > 0 && files.length < MAX_FILES) {
    const directory = pending.shift()
    if (directory === undefined) break
    const entries = []
    for await (const entry of await opendir(directory)) entries.push(entry)
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      if (files.length >= MAX_FILES) break
      const candidate = join(directory, entry.name)
      const metadata = await lstat(candidate)
      if (metadata.isSymbolicLink()) continue
      const canonical = await realpath(candidate)
      if (!isWithinRoot(root, canonical)) continue
      if (metadata.isDirectory()) pending.push(canonical)
      else if (metadata.isFile()) files.push(canonical)
    }
    pending.sort((left, right) => left.localeCompare(right))
  }
  return files
}

async function probeFile(
  path: string,
  provider: ProviderId,
  byteBudget: number
): Promise<ProbeReport> {
  const metadata = await stat(path)
  const extension = extname(path).toLowerCase()
  if (extension === '.jsonl' || extension === '.ndjson') {
    return probeJsonLines(path, provider, metadata.size, byteBudget)
  }
  if (extension === '.json')
    return probeJson(path, provider, metadata.size, byteBudget)
  return {
    provider,
    status: 'not-detected',
    pathTemplate: pathTemplate(provider, extension),
    extension: extension || '<none>',
    byteSize: metadata.size,
    reasonCode: 'UNSUPPORTED_STRUCTURE'
  }
}

async function probeCandidate(
  path: string,
  provider: ProviderId
): Promise<ProbeReport[]> {
  try {
    const canonicalRoot = await realpath(path)
    const metadata = await stat(canonicalRoot)
    const files = metadata.isDirectory()
      ? await collectFiles(canonicalRoot)
      : [canonicalRoot]
    const reports: ProbeReport[] = []
    let remainingBytes = MAX_TOTAL_BYTES
    for (const file of files) {
      if (remainingBytes <= 0) break
      const report = await probeFile(file, provider, remainingBytes)
      reports.push(report)
      remainingBytes -= Math.min(report.byteSize ?? 0, MAX_FILE_BYTES)
    }
    if (reports.length > 0) return reports
    return [
      {
        provider,
        status: 'detected',
        pathTemplate: pathTemplate(provider),
        reasonCode: 'UNSUPPORTED_STRUCTURE'
      }
    ]
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    return [
      {
        provider,
        status: 'not-detected',
        pathTemplate: pathTemplate(provider),
        reasonCode: code === 'ENOENT' ? 'PATH_NOT_FOUND' : 'READ_ERROR'
      }
    ]
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const candidates =
    options.path === undefined
      ? DEFAULT_CANDIDATES[options.provider]
      : [options.path]
  const reports = (
    await Promise.all(
      candidates.map((path) => probeCandidate(path, options.provider))
    )
  ).flat()
  const output = `${JSON.stringify(reports, null, 2)}\n`
  process.stdout.write(output)
  if (options.output !== undefined)
    await writeFile(options.output, output, { encoding: 'utf8', flag: 'wx' })
}

await main()
