import { describe, expect, it } from 'vitest'
import { secureWebPreferences } from '../../../src/main/security/window-options'

describe('secureWebPreferences', () => {
  it('isolates renderers from Node and enables sandboxing', () => {
    expect(secureWebPreferences('/app/preload.js')).toEqual({
      preload: '/app/preload.js',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    })
  })
})
