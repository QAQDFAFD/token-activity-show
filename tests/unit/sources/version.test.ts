import { describe, expect, it } from 'vitest'
import { contentVersion } from '../../../src/main/sources/version'

describe('contentVersion', () => {
  it('is deterministic and order-sensitive', () => {
    expect(contentVersion(['alpha', 'beta'])).toBe(
      contentVersion(['alpha', 'beta'])
    )
    expect(contentVersion(['alpha', 'beta'])).not.toBe(
      contentVersion(['beta', 'alpha'])
    )
  })

  it('does not contain original input text', () => {
    const version = contentVersion([
      'private prompt text',
      'secret-token-value'
    ])

    expect(version).toMatch(/^[a-f0-9]{64}$/)
    expect(version).not.toContain('private')
    expect(version).not.toContain('secret-token-value')
  })

  it('preserves part boundaries', () => {
    expect(contentVersion(['ab', 'c'])).not.toBe(contentVersion(['a', 'bc']))
  })
})
