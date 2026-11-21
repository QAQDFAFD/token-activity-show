import Foundation
import SQLite3

public struct CursorIdentity: Sendable, Equatable {
    public let subject: String
    public let email: String?
    public let expiry: Date?
    public let accessToken: String

    public init(subject: String, email: String?, expiry: Date?, accessToken: String) {
        self.subject = subject
        self.email = email
        self.expiry = expiry
        self.accessToken = accessToken
    }

    public static func parse(token: String) -> CursorIdentity? {
        if token.contains("::") {
            let parts = token.components(separatedBy: "::")
            guard let last = parts.last, !last.isEmpty else { return nil }
            let subject = parts.dropLast().joined(separator: "::")
            return CursorIdentity(
                subject: subject,
                email: nil,
                expiry: JWT.expiry(last),
                accessToken: last)
        }
        guard let payload = JWT.payload(token) else { return nil }
        let rawSubject = JSONValue.string(payload["sub"]) ?? ""
        let subject = rawSubject.split(separator: "|").last.map(String.init) ?? rawSubject
        guard !subject.isEmpty else { return nil }
        return CursorIdentity(
            subject: subject,
            email: JSONValue.string(payload["email"]),
            expiry: (payload["exp"] as? Double).map { Date(timeIntervalSince1970: $0) },
            accessToken: token)
    }

    public var cookieHeader: String {
        "WorkosCursorSessionToken=\(self.subject)%3A%3A\(self.accessToken)"
    }
}

public struct CursorToken: Sendable, Equatable {
    public let raw: String

    public init(raw: String) {
        self.raw = raw
    }

    public var isEncrypted: Bool {
        self.raw.hasPrefix("cursor-safe-storage:")
    }
}

public struct CursorProvider: ProviderAdapter {
    public let info = ProviderCatalog.info(for: .cursor)

    private let paths: Paths

    public init(paths: Paths = Paths()) {
        self.paths = paths
    }

    public func detect() -> ProviderDetection {
        if let token = try? self.readToken(), !token.isEncrypted {
            return .available(source: "Cursor.app")
        }
        if self.paths.fileExists(self.paths.cursorDatabase)
            || FileManager.default.fileExists(atPath: "/Applications/Cursor.app")
        {
            return .needsLogin(hint: "打开 Cursor 并确认已登录")
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
        let token = try self.readToken()
        if token.isEncrypted {
            throw ProviderError(
                "Cursor 使用加密后的登录凭据",
                hint: "请在 Cursor 中退出后重新登录，等待后续版本支持加密凭据")
        }
        guard let identity = CursorIdentity.parse(token: token.raw),
              let exp = identity.expiry
        else {
            throw ProviderError.auth(
                "Cursor 登录凭据无法识别",
                hint: "打开 Cursor 重新登录")
        }
        if exp < Date().addingTimeInterval(60) {
            throw ProviderError.auth(
                "Cursor 登录已过期",
                hint: "打开 Cursor 重新登录")
        }

        guard let url = URL(string: "https://cursor.com/api/usage-summary") else {
            throw ProviderError("Cursor 额度端点无效")
        }
        let headers = [
            "Cookie": identity.cookieHeader,
            "Accept": "application/json",
            "Origin": "https://cursor.com",
            "Referer": "https://cursor.com/dashboard?tab=usage",
            "User-Agent": "TokenBar/0.1 (macOS)",
        ]
        let response = try await HTTPClient.shared.get(url, headers: headers, timeout: 25)

        switch response.statusCode {
        case 200:
            break
        case 401, 403:
            throw ProviderError.auth(
                "Cursor 登录已失效",
                hint: "打开 Cursor 或 cursor.com 重新登录")
        case 429:
            throw ProviderError("Cursor 额度接口请求过于频繁", hint: "稍等几分钟后再刷新")
        default:
            throw ProviderError("Cursor 额度请求失败（HTTP \(response.statusCode)）")
        }

        let parsed = Self.parseUsage(response.data)
        guard !parsed.windows.isEmpty else {
            throw ProviderError("Cursor 未返回可用的额度窗口")
        }

        return ProviderSnapshot(
            provider: .cursor,
            plan: parsed.plan,
            windows: parsed.windows,
            source: "Cursor.app",
            fetchedAt: Date())
    }

    private func readToken() throws -> CursorToken {
        guard self.paths.fileExists(self.paths.cursorDatabase) else {
            throw ProviderError.auth("未找到 Cursor 本地登录数据", hint: "打开 Cursor 并登录")
        }

        do {
            if let value = try Self.queryToken(path: self.paths.cursorDatabase.path, immutable: false),
               !value.isEmpty
            {
                return CursorToken(raw: value)
            }
        } catch {
            // An idle WAL-mode database can keep WAL in its header after Cursor exits. A read-only
            // connection then cannot create the shared-memory file; immutable mode reads the main
            // database without touching Cursor's directory.
        }

        if let value = try Self.queryToken(path: self.paths.cursorDatabase.path, immutable: true),
           !value.isEmpty
        {
            return CursorToken(raw: value)
        }

        throw ProviderError.auth("Cursor 尚未登录", hint: "打开 Cursor 并登录")
    }

    private static func queryToken(path: String, immutable: Bool) throws -> String? {
        var database: OpaquePointer?
        let filename = immutable
            ? URL(fileURLWithPath: path).absoluteString + "?immutable=1"
            : path
        let flags = immutable ? SQLITE_OPEN_READONLY | SQLITE_OPEN_URI : SQLITE_OPEN_READONLY
        guard sqlite3_open_v2(filename, &database, flags, nil) == SQLITE_OK else {
            let message = database.map { String(cString: sqlite3_errmsg($0)) } ?? "unknown"
            sqlite3_close(database)
            throw ProviderError("无法读取 Cursor 数据库", hint: message)
        }
        defer { sqlite3_close(database) }
        sqlite3_busy_timeout(database, 250)

        let query = "SELECT value FROM ItemTable WHERE key = 'cursorAuth/accessToken' LIMIT 1;"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, query, -1, &statement, nil) == SQLITE_OK else {
            let message = database.map { String(cString: sqlite3_errmsg($0)) } ?? "unknown"
            throw ProviderError("无法查询 Cursor 登录数据", hint: message)
        }
        defer { sqlite3_finalize(statement) }

        guard sqlite3_step(statement) == SQLITE_ROW else {
            return nil
        }
        return Self.decodeColumn(statement, index: 0)
    }

    private static func decodeColumn(_ statement: OpaquePointer?, index: Int32) -> String? {
        switch sqlite3_column_type(statement, index) {
        case SQLITE_TEXT:
            guard let text = sqlite3_column_text(statement, index) else { return nil }
            return String(cString: text)
        case SQLITE_BLOB:
            guard let bytes = sqlite3_column_blob(statement, index) else { return nil }
            let data = Data(bytes: bytes, count: Int(sqlite3_column_bytes(statement, index)))
            if let utf8 = String(data: data, encoding: .utf8) {
                return utf8
            }
            return String(data: data, encoding: .utf16LittleEndian)
        default:
            return nil
        }
    }

    public struct ParsedUsage {
        public let plan: String?
        public let windows: [UsageWindow]
    }

    public static func parseUsage(_ data: Data) -> ParsedUsage {
        guard let root = JSONValue.dictionary(data) else {
            return ParsedUsage(plan: nil, windows: [])
        }

        let billingEnd = DateParsing.iso8601(JSONValue.string(root["billingCycleEnd"]))
        let membership = JSONValue.string(root["membershipType"])
        let plan = membership.flatMap(Self.planLabel)

        var windows: [UsageWindow] = []

        let individual = JSONValue.dictionary(root["individualUsage"])
        let planBlock = JSONValue.dictionary(individual?["plan"])
        let overall = JSONValue.dictionary(individual?["overall"])

        let usedCents = JSONValue.int(planBlock?["used"]) ?? JSONValue.int(overall?["used"])
        let limitCents = JSONValue.int(planBlock?["limit"]) ?? JSONValue.int(overall?["limit"])
        let totalPercent = JSONValue.double(planBlock?["totalPercentUsed"])
        let autoPercent = JSONValue.double(planBlock?["autoPercentUsed"])
        let apiPercent = JSONValue.double(planBlock?["apiPercentUsed"])
        let derivedPercent: Double? = if let totalPercent {
            totalPercent
        } else if let autoPercent, let apiPercent {
            (autoPercent + apiPercent) / 2
        } else if let apiPercent {
            apiPercent
        } else if let autoPercent {
            autoPercent
        } else if let usedCents, let limitCents, limitCents > 0 {
            Double(usedCents) / Double(limitCents) * 100
        } else {
            nil
        }

        if derivedPercent != nil || usedCents != nil || limitCents != nil {
            windows.append(UsageWindow(
                id: "cursor-plan",
                title: "本月额度",
                usedPercent: derivedPercent,
                resetsAt: billingEnd,
                detail: {
                    guard let usedCents, let limitCents, limitCents > 0 else { return nil }
                    return "\(Formatting.money(cents: usedCents) ?? "") / \(Formatting.money(cents: limitCents) ?? "")"
                }()))
        }

        if let onDemand = JSONValue.dictionary(individual?["onDemand"]) {
            let used = JSONValue.int(onDemand["used"])
            let limit = JSONValue.int(onDemand["limit"])
            if (used ?? 0) > 0 || (limit ?? 0) > 0 {
                let percent: Double? = if let used, let limit, limit > 0 {
                    Double(used) / Double(limit) * 100
                } else {
                    nil
                }
                windows.append(UsageWindow(
                    id: "cursor-on-demand",
                    title: "按需用量",
                    usedPercent: percent,
                    resetsAt: billingEnd,
                    detail: {
                        guard let used else { return nil }
                        if let limit, limit > 0 {
                            return "\(Formatting.money(cents: used) ?? "") / \(Formatting.money(cents: limit) ?? "")"
                        }
                        return "\(Formatting.money(cents: used) ?? "") 已用"
                    }()))
            }
        }

        if windows.isEmpty, let team = JSONValue.dictionary(root["teamUsage"]),
           let pooled = JSONValue.dictionary(team["pooled"])
        {
            let used = JSONValue.int(pooled["used"])
            let limit = JSONValue.int(pooled["limit"])
            if let used, let limit, limit > 0 {
                windows.append(UsageWindow(
                    id: "cursor-team",
                    title: "团队额度",
                    usedPercent: Double(used) / Double(limit) * 100,
                    resetsAt: billingEnd,
                    detail: "\(Formatting.money(cents: used) ?? "") / \(Formatting.money(cents: limit) ?? "")"))
            }
        }

        return ParsedUsage(plan: plan, windows: windows)
    }

    private static func planLabel(_ raw: String) -> String? {
        let normalized = raw.lowercased()
        switch normalized {
        case "pro": return "Pro"
        case "pro_plus", "pro+": return "Pro+"
        case "ultra": return "Ultra"
        case "free": return "Free"
        case "business": return "Business"
        case "team": return "Team"
        case "enterprise": return "Enterprise"
        default: return Formatting.planLabel(raw)
        }
    }
}
