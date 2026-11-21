import Foundation

public struct ClaudeCredentials: Sendable, Equatable {
    public let accessToken: String
    public let refreshToken: String?
    public let expiresAt: Date?
    public let subscriptionType: String?
    public let rateLimitTier: String?
    public let scopes: [String]

    public init(
        accessToken: String,
        refreshToken: String?,
        expiresAt: Date?,
        subscriptionType: String?,
        rateLimitTier: String?,
        scopes: [String])
    {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
        self.subscriptionType = subscriptionType
        self.rateLimitTier = rateLimitTier
        self.scopes = scopes
    }

    public static func parse(_ data: Data) -> ClaudeCredentials? {
        guard let root = JSONValue.dictionary(data),
              let oauth = JSONValue.dictionary(root["claudeAiOauth"]),
              let accessToken = JSONValue.string(oauth["accessToken"]),
              !accessToken.isEmpty
        else {
            return nil
        }
        return ClaudeCredentials(
            accessToken: accessToken,
            refreshToken: JSONValue.string(oauth["refreshToken"]),
            expiresAt: JSONValue.double(oauth["expiresAt"]).map { Date(timeIntervalSince1970: $0 / 1000) },
            subscriptionType: JSONValue.string(oauth["subscriptionType"]),
            rateLimitTier: JSONValue.string(oauth["rateLimitTier"]),
            scopes: (oauth["scopes"] as? [String]) ?? [])
    }

    public var isExpired: Bool {
        guard let expiresAt else { return false }
        return Date() >= expiresAt.addingTimeInterval(-60)
    }

    public var plan: String? {
        if let subscriptionType = self.subscriptionType {
            return Formatting.planLabel(subscriptionType)
        }
        if let rateLimitTier = self.rateLimitTier {
            return Formatting.planLabel(rateLimitTier)
        }
        return nil
    }
}

public struct ClaudeProvider: ProviderAdapter {
    public let info = ProviderCatalog.info(for: .claude)

    private let paths: Paths
    private let cache: CredentialCache
    private let configStore: ConfigStore
    private let oauthClientID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e"

    public init(
        paths: Paths = Paths(),
        cache: CredentialCache = .shared,
        configStore: ConfigStore = .shared)
    {
        self.paths = paths
        self.cache = cache
        self.configStore = configStore
    }

    public func detect() -> ProviderDetection {
        if let data = self.paths.data(at: self.paths.claudeCredentials),
           ClaudeCredentials.parse(data) != nil
        {
            return .available(source: "Claude Code credentials")
        }
        if let cached = self.cache.claude(),
           !cached.accessToken.isEmpty,
           !cached.isExpired || cached.refreshToken != nil
        {
            return .available(source: "TokenBar cache")
        }
        let config = self.configStore.config()
        if config.claudeAccessToken?.isEmpty == false || config.claudeRefreshToken?.isEmpty == false {
            return .available(source: "tokenbar config")
        }
        if self.paths.claudeCLIInstalled || self.paths.fileExists(self.paths.claudeDirectory) {
            return .needsLogin(hint: "在 ~/.config/tokenbar/config.json 设置 claudeAccessToken（不读取钥匙串）")
        }
        return .notInstalled
    }

    public func fetch() async -> ProviderReport {
        do {
            let snapshot = try await self.fetchSnapshot()
            return ProviderReport(info: self.info, state: .ok(snapshot))
        } catch {
            return self.failureReport(error)
        }
    }

    private func fetchSnapshot() async throws -> ProviderSnapshot {
        var credentials = try self.loadCredentials()

        if credentials.accessToken.isEmpty || credentials.isExpired {
            guard let refreshToken = credentials.refreshToken, !refreshToken.isEmpty else {
                throw ProviderError.auth(
                    "Claude 登录已过期",
                    hint: "运行 claude 登录，或更新 tokenbar 配置文件中的 claudeAccessToken")
            }
            credentials = try await self.refresh(credentials: credentials, refreshToken: refreshToken)
        }

        let response = try await self.fetchUsage(accessToken: credentials.accessToken)
        let windows = Self.parseWindows(response.data)
        guard !windows.isEmpty else {
            throw ProviderError("Claude 没有返回可用的额度窗口")
        }

        return ProviderSnapshot(
            provider: .claude,
            plan: credentials.plan,
            windows: windows,
            source: "OAuth",
            fetchedAt: Date())
    }

    private func loadCredentials() throws -> ClaudeCredentials {
        var candidates: [ClaudeCredentials] = []

        if let data = self.paths.data(at: self.paths.claudeCredentials),
           let credentials = ClaudeCredentials.parse(data)
        {
            candidates.append(credentials)
        }

        if let cached = self.cache.claude(), !cached.accessToken.isEmpty {
            candidates.append(ClaudeCredentials(
                accessToken: cached.accessToken,
                refreshToken: cached.refreshToken,
                expiresAt: cached.expiresAt,
                subscriptionType: nil,
                rateLimitTier: nil,
                scopes: []))
        }

        let config = self.configStore.config()
        if let accessToken = Paths.clean(config.claudeAccessToken) {
            candidates.append(ClaudeCredentials(
                accessToken: accessToken,
                refreshToken: Paths.clean(config.claudeRefreshToken),
                expiresAt: nil,
                subscriptionType: nil,
                rateLimitTier: nil,
                scopes: []))
        } else if let refreshToken = Paths.clean(config.claudeRefreshToken) {
            candidates.append(ClaudeCredentials(
                accessToken: "",
                refreshToken: refreshToken,
                expiresAt: .distantPast,
                subscriptionType: nil,
                rateLimitTier: nil,
                scopes: []))
        }

        if let fresh = candidates.first(where: { !$0.accessToken.isEmpty && !$0.isExpired }) {
            return fresh
        }
        if let refreshable = candidates.first(where: { $0.refreshToken?.isEmpty == false }) {
            return refreshable
        }
        if let candidate = candidates.first {
            return candidate
        }

        throw ProviderError.auth(
            "未找到 Claude Code 登录凭据",
            hint: "运行 claude 登录，或在 ~/.config/tokenbar/config.json 设置 claudeAccessToken")
    }

    private func refresh(credentials: ClaudeCredentials, refreshToken: String) async throws -> ClaudeCredentials {
        guard let url = URL(string: "https://platform.claude.com/v1/oauth/token") else {
            throw ProviderError("Claude OAuth 端点无效")
        }
        let response = try await HTTPClient.shared.postForm(
            url,
            pairs: [
                ("grant_type", "refresh_token"),
                ("refresh_token", refreshToken),
                ("client_id", self.oauthClientID),
            ],
            headers: ["Accept": "application/json"])
        guard response.statusCode == 200 else {
            throw ProviderError.auth(
                "Claude 登录已失效",
                hint: "运行 claude 登录后重试")
        }
        guard let json = JSONValue.dictionary(response.data),
              let accessToken = JSONValue.string(json["access_token"])
        else {
            throw ProviderError("Claude 刷新响应无法解析")
        }
        let expiresIn = JSONValue.double(json["expires_in"]) ?? 3600
        let newRefresh = JSONValue.string(json["refresh_token"]) ?? refreshToken
        let updated = ClaudeCredentials(
            accessToken: accessToken,
            refreshToken: newRefresh,
            expiresAt: Date().addingTimeInterval(expiresIn),
            subscriptionType: credentials.subscriptionType,
            rateLimitTier: credentials.rateLimitTier,
            scopes: credentials.scopes)
        self.cache.setClaude(CachedOAuthCredential(
            accessToken: updated.accessToken,
            refreshToken: updated.refreshToken,
            expiresAt: updated.expiresAt))
        return updated
    }

    private func fetchUsage(accessToken: String) async throws -> HTTPResponse {
        guard let url = URL(string: "https://api.anthropic.com/api/oauth/usage?cedar_ember=1") else {
            throw ProviderError("Claude 额度端点无效")
        }
        let headers = [
            "Authorization": "Bearer \(accessToken)",
            "anthropic-beta": "oauth-2025-04-20",
            "Content-Type": "application/json",
            "User-Agent": "claude-cli/2.1.0 (external, cli)",
        ]
        var response = try await HTTPClient.shared.get(url, headers: headers, timeout: 25)

        if response.statusCode == 400 || response.statusCode == 403 {
            let body = String(data: response.data, encoding: .utf8) ?? ""
            if !body.contains("user:profile") {
                var retryHeaders = headers
                retryHeaders["User-Agent"] = "claude-cli/2.1.0 (external, cli)"
                guard let retryURL = URL(string: "https://api.anthropic.com/api/oauth/usage") else {
                    throw ProviderError("Claude 额度端点无效")
                }
                response = try await HTTPClient.shared.get(retryURL, headers: retryHeaders, timeout: 25)
            }
        }

        switch response.statusCode {
        case 200:
            return response
        case 401:
            throw ProviderError.auth(
                "Claude 登录已失效",
                hint: "运行 claude 登录后重试")
        case 403:
            throw ProviderError.auth(
                "Claude 登录缺少用量读取权限",
                hint: "运行 claude 登录并授权 user:profile 权限")
        case 429:
            throw ProviderError("Claude 额度接口请求过于频繁", hint: "稍等几分钟后再刷新")
        default:
            throw ProviderError("Claude 额度请求失败（HTTP \(response.statusCode)）")
        }
    }

    public static func parseWindows(_ data: Data) -> [UsageWindow] {
        guard let root = JSONValue.dictionary(data) else { return [] }
        var windows: [UsageWindow] = []

        func append(_ key: String, id: String, title: String) {
            guard let window = JSONValue.dictionary(root[key]) else { return }
            let used = JSONValue.double(window["utilization"])
            let reset = DateParsing.iso8601(JSONValue.string(window["resets_at"]))
            if used == nil, reset == nil, window.isEmpty { return }
            windows.append(UsageWindow(
                id: "claude-\(id)",
                title: title,
                usedPercent: used,
                resetsAt: reset))
        }

        append("five_hour", id: "session", title: "5 小时")
        append("seven_day", id: "weekly", title: "每周")

        if let opus = JSONValue.dictionary(root["seven_day_opus"]),
           JSONValue.double(opus["utilization"]) != nil
        {
            windows.append(UsageWindow(
                id: "claude-weekly-opus",
                title: "每周 · Opus",
                usedPercent: JSONValue.double(opus["utilization"]),
                resetsAt: DateParsing.iso8601(JSONValue.string(opus["resets_at"]))))
        }
        if let sonnet = JSONValue.dictionary(root["seven_day_sonnet"]),
           JSONValue.double(sonnet["utilization"]) != nil
        {
            windows.append(UsageWindow(
                id: "claude-weekly-sonnet",
                title: "每周 · Sonnet",
                usedPercent: JSONValue.double(sonnet["utilization"]),
                resetsAt: DateParsing.iso8601(JSONValue.string(sonnet["resets_at"]))))
        }

        if let extra = JSONValue.dictionary(root["extra_usage"]),
           JSONValue.bool(extra["is_enabled"]) == true
        {
            let used = JSONValue.double(extra["used_credits"])
            let limit = JSONValue.double(extra["monthly_limit"])
            let detail: String? = {
                guard let used, let limit, limit > 0 else { return nil }
                return "\(Formatting.money(used) ?? "") / \(Formatting.money(limit) ?? "")"
            }()
            windows.append(UsageWindow(
                id: "claude-extra",
                title: "额外用量",
                usedPercent: JSONValue.double(extra["utilization"]),
                detail: detail))
        }

        return windows
    }
}
