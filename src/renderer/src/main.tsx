import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { createI18n, I18nProvider } from './i18n'
import { applyTheme, readThemePreference } from './theme'
import './styles.css'

applyTheme(readThemePreference())

const root = document.getElementById('root')

if (!root) throw new Error('Renderer root element is missing')

const i18n = createI18n()

document.documentElement.lang = i18n.locale

createRoot(root).render(
  <StrictMode>
    <I18nProvider value={i18n}>
      <App />
    </I18nProvider>
  </StrictMode>
)
