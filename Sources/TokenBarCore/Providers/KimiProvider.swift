import Foundation

public struct KimiCredentials: Sendable, Equatable {
    public let accessToken: String
    public let refreshToken: String?
    public let expiresAt: Date?

    public init(accessToken: String, refreshToken: String?, expiresAt: Date?) {
        self.accessToken = accessToken
        self.refreshToken = refreshToken
        self.expiresAt = expiresAt
    }

    public static func parse(_ data: Data) -> KimiCredentials? {
        guard let root = JSONValue.dictionary(data),
              let accessToken = JSONValue.string(root["access_token"]),
              !accessToken.isEmpty
        else {
            return nil
        }
        return KimiCredentials(
            accessToken: accessToken,
            refreshToken: JSONValue.string(root["refresh_token"]),
            expiresAt: DateParsing.epoch(root["expires_at"]))
    }

    public var isExpired: Bool {
        guard let expiresAt else { return JWT.expiry(self.accessToken).map { $0 < Date() } ?? false }
        return Date() >= expiresAt.addingTimeInterval(-60)
    }
}

public struct KimiProvider: ProviderAdapter {
    public let info = ProviderCatalog.info(for: .kimi)

    private let paths: Paths
    private let configStore: ConfigStore

    public init(paths: Paths = Paths(), configStore: ConfigStore = .shared) {
        self.paths = paths
        self.configStore = configStore
    }

    private var isInternational: Bool {
        self.paths.environment["KIMI_CODE_REGION"]?.lowercased() == "international"
    }

    private var apiBaseURL: URL {
        URL(string: self.isInternational ? "https://api.kimi.ai" : "https://api.kimi.com")!
    }

    public func detect() -> ProviderDetection {
        if let data = self.paths.data(at: self.paths.kimiCredentials),
           KimiCredentials.parse(data) != nil
        {
            return .available(source: "Kimi Code CLI")
        }
        if self.configStore.config().kimiAccessToken?.isEmpty == false {
            return .available(source: "tokenbar config")
        }
        if self.paths.fileExists(self.paths.kimiCredentials) || self.paths.kimiCLIInstalled {
            return .needsLogin(hint: "运行 kimi 登录")
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
        let credentials: KimiCredentials
        if let configToken = Paths.clean(self.configStore.config().kimiAccessToken) {
            credentials = KimiCredentials(accessToken: configToken, refreshToken: nil, expiresAt: nil)
        } else if let data = self.paths.data(at: self.paths.kimiCredentials),
                  let stored = KimiCredentials.parse(data)
        {
            credentials = stored
        } else {
            throw ProviderError.auth(
                "未找到 Kimi Code 登录凭据",
                hint: "运行 kimi 登录，或在 tokenbar 配置文件中设置 kimiAccessToken")
        }

        if credentials.isExpired {
            throw ProviderError.auth(
                "Kimi Code 登录已过期",
                hint: "运行 kimi 刷新登录；TokenBar 不会改写 Kimi 的凭据")
        }

        let url = self.apiBaseURL.appendingPathComponent("coding/v1/usages")
        let response = try await HTTPClient.shared.get(
            url,
            headers: [
                "Authorization": "Bearer \(credentials.accessToken)",
                "Accept": "application/json",
            ],
            timeout: 25)

        switch response.statusCode {
        case 200:
            break
        case 401, 403:
            throw ProviderError.auth(
                "Kimi Code 登录已失效",
                hint: "运行 kimi 重新登录")
        case 429:
            throw ProviderError("Kimi 额度接口请求过于频繁", hint: "稍等几分钟后再刷新")
        default:
            throw ProviderError("Kimi 额度请求失败（HTTP \(response.statusCode)）")
        }

        let parsed = Self.parseUsage(response.data)
        guard !parsed.windows.isEmpty else {
            throw ProviderError("Kimi 未返回可用的额度窗口")
        }

        return ProviderSnapshot(
            provider: .kimi,
            plan: parsed.plan,
            windows: parsed.windows,
            source: "Kimi Code CLI",
            fetchedAt: Date())
    }

    public struct ParsedUsage {
        public let plan: String?
        public let windows: [UsageWindow]
    }

    public static func parseUsage(_ data: Data) -> ParsedUsage {
        guard let root = JSONValue.dictionary(data) else {
            return ParsedUsage(plan: nil, windows: [])
        }

        let plan = Self.planName(root)
        var windows: [UsageWindow] = []

        if let pools = JSONValue.dictionary(root["usages"]) {
            func append(_ key: String, id: String, title: String) {
                guard let pool = JSONValue.dictionary(pools[key]),
                      let ratio = JSONValue.double(pool["used_ratio"])
                else {
                    return
                }
                windows.append(UsageWindow(
                    id: id,
                    title: title,
                    usedPercent: min(1, max(0, ratio)) * 100,
                    resetsAt: DateParsing.iso8601(JSONValue.string(pool["reset_time"]))))
            }
            append("limit_5h", id: "kimi-5h", title: "5 小时")
            append("limit_7d", id: "kimi-weekly", title: "每周")
            append("limit_month_total", id: "kimi-monthly", title: "本月")
        }

        if windows.isEmpty, let usage = JSONValue.dictionary(root["usage"]) {
            if let window = Self.legacyWindow(usage, id: "kimi-legacy", title: "每周") {
                windows.append(window)
            }
        }

        if let limits = JSONValue.array(root["limits"]), !limits.isEmpty {
            for (index, entry) in limits.enumerated() {
                guard let limit = JSONValue.dictionary(entry),
                      let detail = JSONValue.dictionary(limit["detail"]),
                      let window = Self.legacyWindow(
                          detail,
                          id: "kimi-limit-\(index)",
                          title: Self.limitTitle(limit["window"]))
                else {
                    continue
                }
                if !windows.contains(where: { $0.title == window.title }) {
                    windows.append(window)
                }
            }
        }

        return ParsedUsage(plan: plan, windows: windows)
    }

    private static func legacyWindow(_ dictionary: [String: Any], id: String, title: String) -> UsageWindow? {
        let limit = JSONValue.double(dictionary["limit"])
        let used = JSONValue.double(dictionary["used"])
        let remaining = JSONValue.double(dictionary["remaining"])
        let percent: Double? = if let used, let limit, limit > 0 {
            used / limit * 100
        } else if let remaining, let limit, limit > 0 {
            (limit - remaining) / limit * 100
        } else {
            nil
        }
        let reset = DateParsing.iso8601(JSONValue.string(dictionary["resetTime"]))
            ?? DateParsing.iso8601(JSONValue.string(dictionary["reset_time"]))
        guard percent != nil || reset != nil else { return nil }
        return UsageWindow(
            id: id,
            title: title,
            usedPercent: percent,
            resetsAt: reset,
            detail: {
                guard let used, let limit, limit > 0 else { return nil }
                return "\(Int(used)) / \(Int(limit))"
            }())
    }

    private static func limitTitle(_ window: Any?) -> String {
        guard let window = JSONValue.dictionary(window),
              let duration = JSONValue.int(window["duration"])
        else {
            return "额度"
        }
        switch JSONValue.string(window["timeUnit"]) {
        case "TIME_UNIT_MINUTE":
            if duration == 300 { return "5 小时" }
            return "\(duration) 分钟"
        case "TIME_UNIT_HOUR":
            return "\(duration) 小时"
        case "TIME_UNIT_DAY":
            return "\(duration) 天"
        default:
            return "额度"
        }
    }

    private static func planName(_ root: [String: Any]) -> String? {
        guard let user = JSONValue.dictionary(root["user"]),
              let membership = JSONValue.dictionary(user["membership"]),
              let level = JSONValue.string(membership["level"])
        else {
            return nil
        }
        switch level {
        case "LEVEL_FREE": return "Adagio"
        case "LEVEL_TRIAL": return "Andante"
        case "LEVEL_BASIC": return "Moderato"
        case "LEVEL_INTERMEDIATE": return "Allegretto"
        case "LEVEL_ADVANCED": return "Allegro"
        case "LEVEL_UNSPECIFIED": return nil
        default: return Formatting.planLabel(level)
        }
    }
}
