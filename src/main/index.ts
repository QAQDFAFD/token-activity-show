import { app } from 'electron'
import { createApplication, type TokenActivityShowApplication } from './application'

let application: TokenActivityShowApplication | null = null

void app.whenReady().then(() => {
  application = createApplication()
  application.start()
  app.on('activate', () => application?.activate())
})

app.once('before-quit', () => application?.dispose())
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
