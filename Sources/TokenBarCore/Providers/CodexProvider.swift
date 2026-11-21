import Foundation

public struct CodexAuth: Sendable, Equatable {
    public let accessToken: String
    public let accountID: String?
    public let idToken: String?

    public init(accessToken: String, accountID: String?, idToken: String?) {
        self.accessToken = accessToken
        self.accountID = accountID
        self.idToken = idToken
    }

    public static func parse(_ data: Data) -> CodexAuth? {
        guard let root = JSONValue.dictionary(data),
              let tokens = JSONValue.dictionary(root["tokens"]),
              let accessToken = JSONValue.string(tokens["access_token"]),
              !accessToken.isEmpty
        else {
            return nil
        }
        return CodexAuth(
            accessToken: accessToken,
            accountID: JSONValue.string(tokens["account_id"]),
            idToken: JSONValue.string(tokens["id_token"]))
    }

    public var planFromIDToken: String? {
        guard let claims = JWT.payload(self.idToken) else { return nil }
        if let auth = claims["https://api.openai.com/auth"] as? [String: Any],
           let plan = JSONValue.string(auth["chatgpt_plan_type"])
        {
            return Formatting.planLabel(plan)
        }
        return nil
    }
}

public struct CodexProvider: ProviderAdapter {
    public let info = ProviderCatalog.info(for: .codex)

    private let paths: Paths

    public init(paths: Paths = Paths()) {
        self.paths = paths
    }

    public func detect() -> ProviderDetection {
        if let data = self.paths.data(at: self.paths.codexAuth), CodexAuth.parse(data) != nil {
            return .available(source: "Codex auth.json")
        }
        if self.paths.fileExists(self.paths.codexAuth) || self.paths.codexCLIInstalled {
            return .needsLogin(hint: "运行 codex login 登录")
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
        guard let data = self.paths.data(at: self.paths.codexAuth),
              let auth = CodexAuth.parse(data)
        else {
            throw ProviderError.auth(
                "未找到 Codex 登录凭据",
                hint: "运行 codex login 登录")
        }

        if let expiry = JWT.expiry(auth.accessToken), expiry < Date().addingTimeInterval(120) {
            throw ProviderError.auth(
                "Codex 登录已过期",
                hint: "运行 codex login 重新登录")
        }

        var headers: [String: String] = [
            "Authorization": "Bearer \(auth.accessToken)",
            "Accept": "application/json",
        ]
        if let accountID = auth.accountID, !accountID.isEmpty {
            headers["ChatGPT-Account-Id"] = accountID
        }

        guard let url = URL(string: "https://chatgpt.com/backend-api/wham/usage") else {
            throw ProviderError("Codex 额度端点无效")
        }
        let response = try await HTTPClient.shared.get(url, headers: headers, timeout: 25)

        switch response.statusCode {
        case 200:
            break
        case 401, 403:
            throw ProviderError.auth(
                "Codex 登录已失效",
                hint: "运行 codex login 重新登录")
        case 429:
            throw ProviderError("Codex 额度接口请求过于频繁", hint: "稍等几分钟后再刷新")
        default:
            throw ProviderError("Codex 额度请求失败（HTTP \(response.statusCode)）")
        }

        let parsed = Self.parseUsage(response.data, fallbackPlan: auth.planFromIDToken)
        guard !parsed.windows.isEmpty else {
            throw ProviderError("Codex 未返回可用的额度窗口")
        }

        return ProviderSnapshot(
            provider: .codex,
            plan: parsed.plan,
            windows: parsed.windows,
            creditBalance: parsed.creditBalance,
            source: "OAuth",
            fetchedAt: Date())
    }

    public struct ParsedUsage {
        public let plan: String?
        public let windows: [UsageWindow]
        public let creditBalance: String?
    }

    public static func parseUsage(_ data: Data, fallbackPlan: String? = nil) -> ParsedUsage {
        guard let root = JSONValue.dictionary(data) else {
            return ParsedUsage(plan: fallbackPlan, windows: [], creditBalance: nil)
        }

        let plan = JSONValue.string(root["plan_type"]).flatMap(Formatting.planLabel) ?? fallbackPlan
        var windows: [UsageWindow] = []

        if let rateLimit = JSONValue.dictionary(root["rate_limit"]) {
            if let primary = JSONValue.dictionary(rateLimit["primary_window"]) {
                let seconds = JSONValue.int(primary["limit_window_seconds"])
                let used = JSONValue.double(primary["used_percent"])
                let reset = DateParsing.epoch(primary["reset_at"])
                if used != nil || reset != nil {
                    let title = seconds == 18_000 ? "5 小时" : (seconds == nil ? "会话" : Formatting.windowTitle(seconds: seconds))
                    windows.append(UsageWindow(
                        id: "codex-primary",
                        title: title,
                        usedPercent: used,
                        resetsAt: reset,
                        windowMinutes: seconds.map { $0 / 60 }))
                }
            }

            if let secondary = JSONValue.dictionary(rateLimit["secondary_window"]) {
                let seconds = JSONValue.int(secondary["limit_window_seconds"])
                let used = JSONValue.double(secondary["used_percent"])
                let reset = DateParsing.epoch(secondary["reset_at"])
                if used != nil || reset != nil {
                    let title = seconds == 604_800 ? "每周" : (seconds == nil ? "每周" : Formatting.windowTitle(seconds: seconds))
                    windows.append(UsageWindow(
                        id: "codex-secondary",
                        title: title,
                        usedPercent: used,
                        resetsAt: reset,
                        windowMinutes: seconds.map { $0 / 60 }))
                }
            }
        }

        if windows.isEmpty, let individual = JSONValue.dictionary(root["individual_limit"]) {
            let used = JSONValue.double(individual["used"])
            let limit = JSONValue.double(individual["limit"])
            let remaining = JSONValue.double(individual["remaining_percent"])
            let percent: Double? = if let remaining {
                100 - remaining
            } else if let used, let limit, limit > 0 {
                used / limit * 100
            } else {
                nil
            }
            if percent != nil || individual["reset_at"] != nil || individual["resets_at"] != nil {
                windows.append(UsageWindow(
                    id: "codex-individual",
                    title: "每月",
                    usedPercent: percent,
                    resetsAt: DateParsing.epoch(individual["reset_at"] ?? individual["resets_at"]),
                    detail: {
                        guard let used, let limit, limit > 0 else { return nil }
                        return "\(Formatting.credits(used) ?? "0") / \(Formatting.credits(limit) ?? "0")"
                    }()))
            }
        }

        var creditBalance: String?
        if let credits = JSONValue.dictionary(root["credits"]) {
            let unlimited = JSONValue.bool(credits["unlimited"]) == true
            if unlimited {
                creditBalance = "额度无限"
            } else if JSONValue.bool(credits["has_credits"]) == true,
                      let balance = JSONValue.double(credits["balance"])
            {
                creditBalance = "余额 \(Formatting.credits(balance) ?? "0")"
            }
        }

        return ParsedUsage(plan: plan, windows: windows, creditBalance: creditBalance)
    }
}
