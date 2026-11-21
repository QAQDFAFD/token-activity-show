import Foundation

public final class GitHubTokenStore: @unchecked Sendable {
    public let paths: Paths
    private let configStore: ConfigStore

    public init(paths: Paths = Paths(), configStore: ConfigStore = .shared) {
        self.paths = paths
        self.configStore = configStore
    }

    public func token() -> String? {
        for key in ["GH_TOKEN", "GITHUB_TOKEN"] {
            if let value = Paths.clean(self.paths.environment[key]) {
                return value
            }
        }

        if let content = try? String(contentsOf: self.paths.ghHosts, encoding: .utf8),
           let token = Self.parseHosts(content)
        {
            return token
        }

        if let token = Paths.clean(self.configStore.config().githubToken) {
            return token
        }

        return nil
    }

    public static func parseHosts(_ content: String) -> String? {
        var inGitHub = false
        for rawLine in content.components(separatedBy: .newlines) {
            let line = rawLine.trimmingCharacters(in: .whitespaces)
            if line.isEmpty || line.hasPrefix("#") { continue }

            if !rawLine.hasPrefix(" ") && !rawLine.hasPrefix("\t") && line.hasSuffix(":") {
                inGitHub = line == "github.com:"
                continue
            }

            if inGitHub, line.hasPrefix("oauth_token:") {
                let value = line.dropFirst("oauth_token:".count)
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                    .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
                return value.isEmpty ? nil : value
            }
        }
        return nil
    }
}

public struct CopilotProvider: ProviderAdapter {
    public let info = ProviderCatalog.info(for: .copilot)

    private let paths: Paths
    private let tokenStore: GitHubTokenStore

    public init(paths: Paths = Paths(), configStore: ConfigStore = .shared) {
        self.paths = paths
        self.tokenStore = GitHubTokenStore(paths: paths, configStore: configStore)
    }

    public func detect() -> ProviderDetection {
        if let token = self.tokenStore.token(), !token.isEmpty {
            return .available(source: "GitHub token")
        }
        if self.paths.ghCLIInstalled || self.paths.fileExists(self.paths.ghHosts) {
            return .needsLogin(hint: "把 GitHub token 写入 tokenbar 配置文件（githubToken）")
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
        guard let token = self.tokenStore.token(), !token.isEmpty else {
            throw ProviderError.auth(
                "未找到 GitHub token",
                hint: "运行 gh auth token，把输出写入 ~/.config/tokenbar/config.json 的 githubToken")
        }

        guard let url = URL(string: "https://api.github.com/copilot_internal/user") else {
            throw ProviderError("Copilot 额度端点无效")
        }
        let headers = [
            "Authorization": "token \(token)",
            "Accept": "application/json",
            "Editor-Version": "vscode/1.96.2",
            "Editor-Plugin-Version": "copilot-chat/0.26.7",
            "User-Agent": "GitHubCopilotChat/0.26.7",
            "X-Github-Api-Version": "2025-04-01",
        ]
        let response = try await HTTPClient.shared.get(url, headers: headers, timeout: 25)

        switch response.statusCode {
        case 200:
            break
        case 401, 403:
            throw ProviderError.auth(
                "GitHub 登录已失效或缺少 Copilot 权限",
                hint: "运行 gh auth login 并确认账号已订阅 Copilot")
        case 404:
            throw ProviderError(
                "当前 GitHub 账号没有可用的 Copilot 订阅",
                hint: "在 GitHub 设置中启用 Copilot")
        case 429:
            throw ProviderError("GitHub 接口请求过于频繁", hint: "稍等几分钟后再刷新")
        default:
            throw ProviderError("Copilot 额度请求失败（HTTP \(response.statusCode)）")
        }

        let parsed = Self.parseUsage(response.data)
        if parsed.subscriptionEnded {
            throw ProviderError(
                "Copilot 订阅已结束",
                hint: "在 GitHub 设置中续订 Copilot")
        }

        return ProviderSnapshot(
            provider: .copilot,
            plan: parsed.plan,
            windows: parsed.windows,
            note: parsed.note,
            source: "GitHub token",
            fetchedAt: Date())
    }

    public struct ParsedUsage {
        public let plan: String?
        public let windows: [UsageWindow]
        public let note: String?
        public let subscriptionEnded: Bool
    }

    public static func parseUsage(_ data: Data) -> ParsedUsage {
        guard let root = JSONValue.dictionary(data) else {
            return ParsedUsage(plan: nil, windows: [], note: nil, subscriptionEnded: false)
        }

        let ended = JSONValue.string(root["access_type_sku"]) == "subscription_ended"
        let rawPlan = JSONValue.string(root["copilot_plan"])
        let plan = rawPlan.flatMap(Self.planLabel)
        let reset = DateParsing.loose(JSONValue.string(root["quota_reset_date"]))
        let tokenBased = JSONValue.bool(root["token_based_billing"]) == true
        let snapshots = JSONValue.dictionary(root["quota_snapshots"]) ?? [:]

        var windows: [UsageWindow] = []
        var creditsUsed: Double?

        func append(_ key: String, id: String, title: String) {
            guard let snapshot = JSONValue.dictionary(snapshots[key]) else { return }
            let unlimited = JSONValue.bool(snapshot["unlimited"]) == true
            let percentRemaining = JSONValue.double(snapshot["percent_remaining"])
            let entitlement = JSONValue.double(snapshot["entitlement"])
            let remaining = JSONValue.double(snapshot["remaining"])
            if let value = JSONValue.double(snapshot["credits_used"]) {
                creditsUsed = max(creditsUsed ?? 0, value)
            }
            if unlimited {
                windows.append(UsageWindow(
                    id: id,
                    title: title,
                    usedPercent: nil,
                    resetsAt: reset,
                    detail: "无限"))
                return
            }
            // GitHub sometimes reports an all-zero placeholder for token-billed seats.
            if entitlement == 0, remaining == 0, percentRemaining == nil || percentRemaining == 100 {
                return
            }
            let used: Double? = if let percentRemaining {
                100 - percentRemaining
            } else if let entitlement, let remaining, entitlement > 0 {
                (entitlement - remaining) / entitlement * 100
            } else {
                nil
            }
            guard used != nil else { return }
            windows.append(UsageWindow(
                id: id,
                title: title,
                usedPercent: used,
                resetsAt: reset))
        }

        append("premium_interactions", id: "copilot-premium", title: "Premium requests")
        append("chat", id: "copilot-chat", title: "Chat")

        if let creditsUsed, creditsUsed > 0, !windows.isEmpty {
            let detail = "已用 \(Formatting.credits(creditsUsed) ?? "0") credits"
            let first = windows.removeFirst()
            windows.insert(UsageWindow(
                id: first.id,
                title: first.title,
                usedPercent: first.usedPercent,
                resetsAt: first.resetsAt,
                windowMinutes: first.windowMinutes,
                detail: detail), at: 0)
        }

        let note: String? = if windows.isEmpty && tokenBased {
            "当前席位使用 token 计费，GitHub 未返回百分比额度"
        } else if windows.isEmpty {
            "GitHub 未返回可用的百分比额度"
        } else {
            nil
        }

        return ParsedUsage(
            plan: plan,
            windows: windows,
            note: note,
            subscriptionEnded: ended)
    }

    private static func planLabel(_ raw: String) -> String? {
        switch raw.lowercased() {
        case "individual": return "Individual"
        case "business": return "Business"
        case "enterprise": return "Enterprise"
        case "free": return "Free"
        default: return Formatting.planLabel(raw)
        }
    }
}
