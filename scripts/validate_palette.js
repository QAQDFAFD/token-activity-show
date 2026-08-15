#!/usr/bin/env node
'use strict'

const SURFACES = { light: '#FFFFFF', dark: '#27282E' }
const PALETTES = {
  light: ['#0A66D9', '#1E8E3E', '#C2410C', '#777985'],
  dark: ['#8CC2FF', '#7FD88F', '#F5A623', '#777985']
}

function luminance(hex) {
  const value = hex.replace('#', '')
  const channels = [0, 2, 4].map((offset) => {
    const channel = parseInt(value.slice(offset, offset + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(foreground, background) {
  const lighter = Math.max(luminance(foreground), luminance(background))
  const darker = Math.min(luminance(foreground), luminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

function parseArguments() {
  const modeIndex = process.argv.indexOf('--mode')
  const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : 'light'
  const colors = process.argv
    .slice(2)
    .filter((argument) => argument !== '--mode' && argument !== mode && !argument.startsWith('--'))
    .flatMap((argument) => argument.split(/\s+/))
    .filter(Boolean)
  return { mode, colors }
}

const { mode, colors } = parseArguments()

if (colors.length === 0) {
  const modes = ['light', 'dark']
  let failed = false
  for (const mode of modes) {
    console.log(`Validating built-in ${mode} palette against ${SURFACES[mode]}`)
    const result = validate(mode, PALETTES[mode])
    failed = failed || result
  }
  if (failed) process.exit(1)
  process.exit(0)
}

const failures = validate(mode, colors)
if (failures) process.exit(1)

function validate(mode, palette) {
  const surface = SURFACES[mode]
  if (surface === undefined) {
    console.error(`Unknown mode "${mode}". Use --mode light or --mode dark.`)
    return true
  }
  const threshold = 3
  const failures = []
  for (const color of palette) {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      failures.push(`${color}: not a 6-digit hex color`)
      continue
    }
    const ratio = contrast(color, surface)
    const ok = ratio >= threshold
    console.log(`${ok ? 'PASS' : 'FAIL'} ${color} vs ${surface}: ${ratio.toFixed(2)}:1 (requires ${threshold}:1)`)
    if (!ok) failures.push(`${color} vs ${surface}: ${ratio.toFixed(2)}:1`)
  }
  if (failures.length > 0) {
    console.error(`Palette rejected for ${mode} mode:`)
    for (const failure of failures) console.error(`  - ${failure}`)
    return true
  }
  return false
}
