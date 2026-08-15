import type { ProviderId } from '../../shared/domain'

export interface ProviderPresentation {
  label: string
  colorToken: string
  className: string
}

const presentations: Record<ProviderId, ProviderPresentation> = {
  'claude-code': {
    label: 'Claude Code',
    colorToken: 'var(--provider-claude-code)',
    className: 'provider-claude-code'
  },
  codex: {
    label: 'Codex',
    colorToken: 'var(--provider-codex)',
    className: 'provider-codex'
  },
  hermes: {
    label: 'Hermes',
    colorToken: 'var(--provider-hermes)',
    className: 'provider-hermes'
  }
}

export const PROVIDER_PRESENTATIONS = Object.freeze(presentations)

export function providerPresentation(providerId: ProviderId): ProviderPresentation {
  return presentations[providerId]
}
