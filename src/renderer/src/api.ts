import type { RendererApi } from '../../shared/api'

declare global {
  interface Window {
    tokenActivityShow: RendererApi
  }
}

export function getRendererApi(): RendererApi {
  return window.tokenActivityShow
}
