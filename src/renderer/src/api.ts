import type { RendererApi } from '../../shared/api'

declare global {
  interface Window {
    tokenShow: RendererApi
  }
}

export function getRendererApi(): RendererApi {
  return window.tokenShow
}
