import Foundation
import SQLite3

public struct WindsurfProvider: ProviderAdapter {
    public let info = ProviderCatalog.info(for: .windsurf)

    private let paths: Paths

    public init(paths: Paths = Paths()) {
        self.paths = paths
    }

    public func detect() -> ProviderDetection {
        if (try? self.readPlanData()) != nil {
            return .available(source: "Windsurf 本地缓存")
        }
        if self.paths.fileExists(self.paths.windsurfDatabase)
            || FileManager.default.fileExists(atPath: "/Applications/Windsurf.app")
        {
            return .needsLogin(hint: "打开 Windsurf 并登录，随后启动一次应用")
        }
        return .notInstalled
    }

    public func fetch() async -> ProviderReport {
        do {
            let json = try self.readPlanData()
            let parsed = Self.parsePlan(json)
            return ProviderReport(
                info: self.info,
                state: .ok(ProviderSnapshot(
                    provider: .windsurf,
                    plan: parsed.plan,
                    windows: parsed.windows,
                    note: "来自 Windsurf 本地缓存，可能不是最新数据",
                    source: "本地缓存",
                    fetchedAt: Date())))
        } catch {
            return self.failureReport(error)
        }
    }

    private func readPlanData() throws -> Data {
        guard self.paths.fileExists(self.paths.windsurfDatabase) else {
            throw ProviderError("未找到 Windsurf 本地数据", hint: "打开 Windsurf 并登录")
        }

        do {
            if let data = try Self.queryPlan(path: self.paths.windsurfDatabase.path, immutable: false) {
                return data
            }
        } catch {
            // See Cursor: an idle WAL-mode database may need immutable mode.
        }

        if let data = try Self.queryPlan(path: self.paths.windsurfDatabase.path, immutable: true) {
            return data
        }

        throw ProviderError("Windsurf 本地缓存中没有额度数据", hint: "打开 Windsurf 并登录后再试")
    }

    private static func queryPlan(path: String, immutable: Bool) throws -> Data? {
        var database: OpaquePointer?
        let filename = immutable
            ? URL(fileURLWithPath: path).absoluteString + "?immutable=1"
            : path
        let flags = immutable ? SQLITE_OPEN_READONLY | SQLITE_OPEN_URI : SQLITE_OPEN_READONLY
        guard sqlite3_open_v2(filename, &database, flags, nil) == SQLITE_OK else {
            let message = database.map { String(cString: sqlite3_errmsg($0)) } ?? "unknown"
            sqlite3_close(database)
            throw ProviderError("无法读取 Windsurf 数据库", hint: message)
        }
        defer { sqlite3_close(database) }
        sqlite3_busy_timeout(database, 250)

        let query = "SELECT value FROM ItemTable WHERE key = 'windsurf.settings.cachedPlanInfo' LIMIT 1;"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, query, -1, &statement, nil) == SQLITE_OK else {
            let message = database.map { String(cString: sqlite3_errmsg($0)) } ?? "unknown"
            throw ProviderError("无法查询 Windsurf 本地数据", hint: message)
        }
        defer { sqlite3_finalize(statement) }

        guard sqlite3_step(statement) == SQLITE_ROW else {
            return nil
        }
        return Self.decodeColumn(statement, index: 0)
    }

    private static func decodeColumn(_ statement: OpaquePointer?, index: Int32) -> Data? {
        switch sqlite3_column_type(statement, index) {
        case SQLITE_TEXT:
            guard let text = sqlite3_column_text(statement, index) else { return nil }
            return String(cString: text).data(using: .utf8)
        case SQLITE_BLOB:
            guard let bytes = sqlite3_column_blob(statement, index) else { return nil }
            let data = Data(bytes: bytes, count: Int(sqlite3_column_bytes(statement, index)))
            if let text = String(data: data, encoding: .utf8),
               (try? JSONSerialization.jsonObject(with: Data(text.utf8))) != nil
            {
                return Data(text.utf8)
            }
            if let text = String(data: data, encoding: .utf16LittleEndian),
               (try? JSONSerialization.jsonObject(with: Data(text.utf8))) != nil
            {
                return Data(text.utf8)
            }
            return data
        default:
            return nil
        }
    }

    public struct ParsedPlan {
        public let plan: String?
        public let windows: [UsageWindow]
    }

    public static func parsePlan(_ data: Data) -> ParsedPlan {
        guard let root = JSONValue.dictionary(data) else {
            return ParsedPlan(plan: nil, windows: [])
        }
        let plan = JSONValue.string(root["planName"]).flatMap(Formatting.planLabel)
        var windows: [UsageWindow] = []

        if let quota = JSONValue.dictionary(root["quotaUsage"]) {
            if let dailyRemaining = JSONValue.double(quota["dailyRemainingPercent"]) {
                windows.append(UsageWindow(
                    id: "windsurf-daily",
                    title: "每日",
                    usedPercent: 100 - min(100, max(0, dailyRemaining)),
                    resetsAt: DateParsing.unixSeconds(quota["dailyResetAtUnix"])))
            }
            if let weeklyRemaining = JSONValue.double(quota["weeklyRemainingPercent"]) {
                windows.append(UsageWindow(
                    id: "windsurf-weekly",
                    title: "每周",
                    usedPercent: 100 - min(100, max(0, weeklyRemaining)),
                    resetsAt: DateParsing.unixSeconds(quota["weeklyResetAtUnix"])))
            }
        }

        if windows.isEmpty, let usage = JSONValue.dictionary(root["usage"]) {
            if let window = Self.countWindow(
                usage,
                id: "windsurf-messages",
                title: "Messages",
                usedKey: "usedMessages",
                totalKey: "messages",
                remainingKey: "remainingMessages")
            {
                windows.append(window)
            }
            if let window = Self.countWindow(
                usage,
                id: "windsurf-flow",
                title: "Flow Actions",
                usedKey: "usedFlowActions",
                totalKey: "flowActions",
                remainingKey: "remainingFlowActions")
            {
                windows.append(window)
            }
        }

        return ParsedPlan(plan: plan, windows: windows)
    }

    private static func countWindow(
        _ usage: [String: Any],
        id: String,
        title: String,
        usedKey: String,
        totalKey: String,
        remainingKey: String) -> UsageWindow?
    {
        let total = JSONValue.double(usage[totalKey])
        let used = JSONValue.double(usage[usedKey])
        let remaining = JSONValue.double(usage[remainingKey])
        let percent: Double? = if let used, let total, total > 0 {
            used / total * 100
        } else if let remaining, let total, total > 0 {
            (total - remaining) / total * 100
        } else {
            nil
        }
        guard percent != nil else { return nil }
        return UsageWindow(
            id: id,
            title: title,
            usedPercent: percent,
            detail: {
                guard let used, let total, total > 0 else { return nil }
                return "\(Int(used)) / \(Int(total))"
            }())
    }
}
