import { createHash } from 'node:crypto'

export function contentVersion(parts: readonly string[]): string {
  const hash = createHash('sha256')

  for (const part of parts) {
    const bytes = Buffer.from(part, 'utf8')
    const length = Buffer.allocUnsafe(4)
    length.writeUInt32BE(bytes.length)
    hash.update(length)
    hash.update(bytes)
  }

  return hash.digest('hex')
}
