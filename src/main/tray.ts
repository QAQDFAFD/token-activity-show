import { join } from 'node:path'
import { app, Menu, nativeImage, Tray, type Rectangle } from 'electron'

export interface TrayController {
  create(): void
  dispose(): void
}

export function createTrayController(options: {
  onToggle(bounds: Rectangle): void
  onOpenClient(): void
  onQuit(): void
}): TrayController {
  let tray: Tray | null = null
  return {
    create: () => {
      if (tray !== null) return
      const icon = nativeImage.createFromPath(join(app.getAppPath(), 'src/assets/trayTemplate.png'))
      icon.setTemplateImage(true)
      tray = new Tray(icon.resize({ width: 18, height: 18 }))
      tray.setToolTip('Token Activity Show')
      tray.on('click', (_event, bounds) => options.onToggle(bounds))
      tray.setContextMenu(Menu.buildFromTemplate([
        { label: 'Open Token Activity Show', click: options.onOpenClient },
        { type: 'separator' },
        { label: 'Quit', click: options.onQuit }
      ]))
    },
    dispose: () => { tray?.destroy(); tray = null }
  }
}
