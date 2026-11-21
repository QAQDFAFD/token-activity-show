import Foundation

public struct NousCredential: Sendable, Equatable {
    public let accessToken: String
    public let portalBaseURL: String?
    public let expiresAt: Date?

    public init(accessToken: String, portalBaseURL: String?, expiresAt: Date?) {
        self.accessToken = accessToken
        self.portalBaseURL = portalBaseURL
        self.expiresAt = expiresAt
    }

    public var isExpired: Bool {
        if let expiresAt { return Date() >= expiresAt.addingTimeInterval(-60) }
        guard let expiry = JWT.expiry(self.accessToken) else { return false }
        return expiry < Date()
    }
}

public struct NousProvider: ProviderAdapter {
    public let info = ProviderCatalog.info(for: .nous)

    private let paths: Paths
    private let configStore: ConfigStore

    public init(paths: Paths = Paths(), configStore: ConfigStore = .shared) {
        self.paths = paths
        self.configStore = configStore
    }

    public func detect() -> ProviderDetection {
        if let credential = self.credential(), !credential.isExpired {
            return .available(source: "Hermes auth.json")
        }
        if self.paths.fileExists(self.paths.hermesDirectory) || self.paths.hermesCLIInstalled {
            return .needsLogin(hint: "运行 hermes auth add nous 登录")
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
        guard let credential = self.credential() else {
            throw ProviderError.auth(
                "未找到 Nous Portal 登录凭据",
                hint: "运行 hermes auth add nous 登录，或在 tokenbar 配置文件中设置 nousAccessToken")
        }
        if credential.isExpired {
            throw ProviderError.auth(
                "Nous Portal 登录已过期",
                hint: "运行任意 hermes 命令刷新登录；TokenBar 不会改写 Hermes 的凭据")
        }

        let base = self.trustedPortal(credential.portalBaseURL)
        guard let url = URL(string: base.absoluteString + "/api/oauth/account") else {
            throw ProviderError("Nous Portal 端点无效")
        }
        let response = try await HTTPClient.shared.get(
            url,
            headers: [
                "Authorization": "Bearer \(credential.accessToken)",
                "Accept": "application/json",
            ],
            timeout: 25)

        switch response.statusCode {
        case 200:
            break
        case 401, 403:
            throw ProviderError.auth(
                "Nous Portal 登录已失效",
                hint: "运行 hermes auth add nous 重新登录")
        case 429:
            throw ProviderError("Nous Portal 请求过于频繁", hint: "稍等几分钟后再刷新")
        default:
            throw ProviderError("Nous Portal 请求失败（HTTP \(response.statusCode)）")
        }

        let parsed = Self.parseAccount(response.data)
        return ProviderSnapshot(
            provider: .nous,
            plan: parsed.plan,
            windows: parsed.windows,
            creditBalance: parsed.creditBalance,
            source: "Hermes OAuth",
            fetchedAt: Date())
    }

    private func credential() -> NousCredential? {
        var files: [URL] = []
        if let home = Paths.clean(self.paths.environment["HERMES_HOME"]) {
            let root = URL(fileURLWithPath: Paths.expand(home, home: self.paths.home), isDirectory: true)
            files = [root.appendingPathComponent("auth.json"), root.appendingPathComponent("shared/nous_auth.json")]
        } else {
            files = [self.paths.hermesAuth, self.paths.hermesSharedAuth]
        }

        var expired: NousCredential?
        for file in files {
            guard let data = self.paths.data(at: file),
                  let credential = Self.parseCredential(data)
            else {
                continue
            }
            if !credential.isExpired { return credential }
            expired = expired ?? credential
        }
        if let token = Paths.clean(self.configStore.config().nousAccessToken) {
            return NousCredential(
                accessToken: token,
                portalBaseURL: nil,
                expiresAt: JWT.expiry(token))
        }
        return expired
    }

    public static func parseCredential(_ data: Data) -> NousCredential? {
        guard let root = JSONValue.dictionary(data) else { return nil }

        if let providers = JSONValue.dictionary(root["providers"]),
           let nous = JSONValue.dictionary(providers["nous"]),
           let credential = self.credential(from: nous)
        {
            return credential
        }

        if let pool = JSONValue.dictionary(root["credential_pool"]),
           let entries = JSONValue.array(pool["nous"])
        {
            for entry in entries {
                guard let dictionary = JSONValue.dictionary(entry),
                      let credential = self.credential(from: dictionary)
                else {
                    continue
                }
                return credential
            }
        }

        if let credential = self.credential(from: root) {
            return credential
        }

        if let auth = JSONValue.dictionary(root["auth"]),
           let credential = self.credential(from: auth)
        {
            return credential
        }

        return nil
    }

    private static func credential(from dictionary: [String: Any]) -> NousCredential? {
        guard let token = JSONValue.string(dictionary["access_token"]),
              !token.isEmpty
        else {
            return nil
        }
        return NousCredential(
            accessToken: token,
            portalBaseURL: JSONValue.string(dictionary["portal_base_url"]),
            expiresAt: DateParsing.iso8601(JSONValue.string(dictionary["expires_at"])))
    }

    private func trustedPortal(_ stored: String?) -> URL {
        let defaultURL = URL(string: "https://portal.nousresearch.com")!
        if let override = Paths.clean(self.paths.environment["NOUS_PORTAL_BASE_URL"])
            ?? Paths.clean(self.paths.environment["HERMES_PORTAL_BASE_URL"]),
            let url = URL(string: override),
            url.scheme?.lowercased() == "https"
        {
            return url
        }
        if let stored, let url = URL(string: stored),
           let host = url.host?.lowercased(),
           host == "nousresearch.com" || host.hasSuffix(".nousresearch.com")
        {
            return url
        }
        return defaultURL
    }

    public struct ParsedAccount {
        public let plan: String?
        public let windows: [UsageWindow]
        public let creditBalance: String?
    }

    public static func parseAccount(_ data: Data) -> ParsedAccount {
        guard let root = JSONValue.dictionary(data) else {
            return ParsedAccount(plan: nil, windows: [], creditBalance: nil)
        }

        let subscription = JSONValue.dictionary(root["subscription"]) ?? [:]
        let monthly = JSONValue.double(subscription["monthly_credits"])
        let remaining = JSONValue.double(subscription["credits_remaining"])
        let periodEnd = DateParsing.iso8601(JSONValue.string(subscription["current_period_end"]))
        let plan = JSONValue.string(subscription["plan"]).flatMap(Formatting.planLabel)

        var windows: [UsageWindow] = []
        if let monthly, monthly > 0, let remaining {
            windows.append(UsageWindow(
                id: "nous-monthly",
                title: "本月额度",
                usedPercent: (monthly - remaining) / monthly * 100,
                resetsAt: periodEnd,
                detail: "\(Formatting.credits(remaining) ?? "0") / \(Formatting.credits(monthly) ?? "0")"))
        }

        let purchased = JSONValue.double(root["purchased_credits_remaining"])
        let total = JSONValue.double(JSONValue.nested(root, "paid_service_access", "total_usable_credits"))
        let creditBalance: String? = {
            if let total {
                return "可用 \(Formatting.credits(total) ?? "0") credits"
            }
            if let purchased, purchased > 0 {
                return "充值 \(Formatting.credits(purchased) ?? "0") credits"
            }
            return nil
        }()

        return ParsedAccount(
            plan: plan,
            windows: windows,
            creditBalance: creditBalance)
    }
}
