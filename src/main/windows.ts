import { join } from 'node:path'
import { BrowserWindow, type Rectangle } from 'electron'
import { secureWebPreferences } from './security/window-options'

export interface WindowController {
  showClient(): void
  showMenuBar(bounds: Rectangle): void
  hideMenuBar(): void
  toggleMenuBar(bounds: Rectangle): void
  broadcast(channel: string, value: unknown): void
  dispose(): void
}

export function createWindowController(): WindowController {
  let client: BrowserWindow | null = null
  let menu: BrowserWindow | null = null
  const preload = join(__dirname, '../preload/index.cjs')
  const renderer = process.env['ELECTRON_RENDERER_URL']
  const load = (window: BrowserWindow, route: string): void => {
    if (renderer) void window.loadURL(`${renderer}#/${route}`)
    else void window.loadFile(join(__dirname, '../renderer/index.html'), { hash: `/${route}` })
  }
  const clientWindow = (): BrowserWindow => {
    if (client && !client.isDestroyed()) return client
    client = new BrowserWindow({ width: 960, height: 720, minWidth: 720, minHeight: 560, show: false, title: 'Token Activity Show', webPreferences: secureWebPreferences(preload) })
    client.on('closed', () => { client = null })
    load(client, 'today')
    return client
  }
  const menuWindow = (): BrowserWindow => {
    if (menu && !menu.isDestroyed()) return menu
    menu = new BrowserWindow({ width: 360, height: 520, show: false, frame: false, resizable: false, skipTaskbar: true, alwaysOnTop: true, webPreferences: secureWebPreferences(preload) })
    menu.on('blur', () => { if (!menu?.webContents.isDevToolsOpened()) menu?.hide() })
    menu.on('closed', () => { menu = null })
    load(menu, 'menu')
    return menu
  }
  const showClient = (): void => { const window = clientWindow(); if (window.isMinimized()) window.restore(); window.show(); window.focus() }
  const showMenuBar = (bounds: Rectangle): void => { const window = menuWindow(); const width = window.getSize()[0] ?? 360; window.setPosition(Math.round(bounds.x + bounds.width / 2 - width / 2), Math.round(bounds.y + bounds.height + 4), false); window.show(); window.focus() }
  const hideMenuBar = (): void => menu?.hide()
  return {
    showClient,
    showMenuBar,
    hideMenuBar,
    toggleMenuBar: (bounds) => menu?.isVisible() ? hideMenuBar() : showMenuBar(bounds),
    broadcast: (channel, value) => { for (const window of [client, menu]) if (window && !window.isDestroyed()) window.webContents.send(channel, value) },
    dispose: () => { menu?.destroy(); client?.destroy(); menu = null; client = null }
  }
}
