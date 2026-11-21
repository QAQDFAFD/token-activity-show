import Foundation

public struct TokenBarConfig: Codable, Sendable, Equatable {
    public var claudeAccessToken: String?
    public var claudeRefreshToken: String?
    public var githubToken: String?
    public var kimiAccessToken: String?
    public var nousAccessToken: String?

    public init(
        claudeAccessToken: String? = nil,
        claudeRefreshToken: String? = nil,
        githubToken: String? = nil,
        kimiAccessToken: String? = nil,
        nousAccessToken: String? = nil)
    {
        self.claudeAccessToken = claudeAccessToken
        self.claudeRefreshToken = claudeRefreshToken
        self.githubToken = githubToken
        self.kimiAccessToken = kimiAccessToken
        self.nousAccessToken = nousAccessToken
    }
}

/// Reads the optional plaintext token file at `~/.config/tokenbar/config.json`.
///
/// TokenBar deliberately does **not** read the macOS Keychain. Reading another app's Keychain item
/// prompts for authorization, and ad-hoc signed development builds invalidate "Always Allow" on every
/// rebuild. Providers therefore use their own credential files, environment variables, or this file.
public final class ConfigStore: @unchecked Sendable {
    public static let shared = ConfigStore()

    private let url: URL
    private let lock = NSLock()
    private var cached: TokenBarConfig?
    private var cachedModificationDate: Date?

    public init(url: URL = Paths().tokenBarConfig) {
        self.url = url
    }

    public func config() -> TokenBarConfig {
        self.lock.lock()
        defer { self.lock.unlock() }

        let modificationDate: Date? = (try? FileManager.default
            .attributesOfItem(atPath: self.url.path))?[.modificationDate] as? Date
        if let cached, modificationDate == self.cachedModificationDate {
            return cached
        }

        let loaded = self.load()
        self.cached = loaded
        self.cachedModificationDate = modificationDate
        return loaded
    }

    public func reload() -> TokenBarConfig {
        self.lock.lock()
        defer { self.lock.unlock() }
        let loaded = self.load()
        self.cached = loaded
        self.cachedModificationDate = (try? FileManager.default
            .attributesOfItem(atPath: self.url.path))?[.modificationDate] as? Date
        return loaded
    }

    public var fileURL: URL { self.url }

    private func load() -> TokenBarConfig {
        guard let data = try? Data(contentsOf: self.url) else {
            return TokenBarConfig()
        }
        do {
            return try JSONDecoder().decode(TokenBarConfig.self, from: data)
        } catch {
            return TokenBarConfig()
        }
    }
}
