import Foundation

public struct CachedOAuthCredential: Codable, Sendable, Equatable {
    public var accessToken: String
    public var refreshToken: String?
    public var expiresAt: Date?

    public init(accessToken: String, refreshToken: String?, expiresAt: Date?) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
    }

    public var isExpired: Bool {
        guard let expiresAt else { return false }
        return Date() >= expiresAt.addingTimeInterval(-60)
    }
}

private struct CredentialCacheFile: Codable {
    var claude: CachedOAuthCredential?
}

public final class CredentialCache: @unchecked Sendable {
    public static let shared = CredentialCache()

    private let url: URL
    private let lock = NSLock()
    private var file: CredentialCacheFile

    public init(url: URL = Paths().credentialCache) {
        self.url = url
        self.file = Self.load(from: url)
    }

    public func claude() -> CachedOAuthCredential? {
        self.lock.lock()
        defer { self.lock.unlock() }
        return self.file.claude
    }

    public func setClaude(_ credential: CachedOAuthCredential?) {
        self.lock.lock()
        defer { self.lock.unlock() }
        self.file.claude = credential
        self.saveLocked()
    }

    private func saveLocked() {
        let directory = self.url.deletingLastPathComponent()
        do {
            try FileManager.default.createDirectory(
                at: directory,
                withIntermediateDirectories: true,
                attributes: [.posixPermissions: 0o700])
            let encoder = JSONEncoder()
            encoder.dateEncodingStrategy = .secondsSince1970
            let data = try encoder.encode(self.file)
            try data.write(to: self.url, options: [.atomic])
            try? FileManager.default.setAttributes(
                [.posixPermissions: 0o600],
                ofItemAtPath: self.url.path)
        } catch {
            // Caching is best-effort; never surface credential contents in logs.
        }
    }

    private static func load(from url: URL) -> CredentialCacheFile {
        guard let data = try? Data(contentsOf: url) else { return CredentialCacheFile() }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .secondsSince1970
        return (try? decoder.decode(CredentialCacheFile.self, from: data)) ?? CredentialCacheFile()
    }
}
