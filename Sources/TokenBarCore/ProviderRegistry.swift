import Foundation

public enum ProviderRegistry {
    public static func adapters(paths: Paths = Paths()) -> [any ProviderAdapter] {
        let configStore = ConfigStore(url: paths.tokenBarConfig)
        return [
            ClaudeProvider(paths: paths, configStore: configStore),
            CodexProvider(paths: paths),
            AntigravityProvider(paths: paths),
            CursorProvider(paths: paths),
            CopilotProvider(paths: paths, configStore: configStore),
            KimiProvider(paths: paths, configStore: configStore),
            NousProvider(paths: paths, configStore: configStore),
            WindsurfProvider(paths: paths),
        ]
    }
}
