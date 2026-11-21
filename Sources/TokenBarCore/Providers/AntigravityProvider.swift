import Foundation

public struct AntigravityProvider: ProviderAdapter {
    public let info = ProviderCatalog.info(for: .antigravity)

    private let paths: Paths

    public init(paths: Paths = Paths()) {
        self.paths = paths
    }

    public func detect() -> ProviderDetection {
        if self.paths.antigravityCLI != nil {
            return .available(source: "agy CLI")
        }
        if self.paths.antigravityAppInstalled {
            return .needsLogin(hint: "安装 agy CLI 并运行 agy 登录 Antigravity")
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
        guard let cli = self.paths.antigravityCLI else {
            throw ProviderError.auth(
                "未找到 agy CLI",
                hint: "安装 Antigravity CLI 后运行 agy 登录")
        }

        let data = try Self.runUsage(cli: cli, paths: self.paths)
        let parsed = Self.parseOutput(data)
        guard !parsed.windows.isEmpty else {
            throw ProviderError(
                "Antigravity 没有返回额度数据",
                hint: "运行 agy 登录 Antigravity 后重试")
        }

        return ProviderSnapshot(
            provider: .antigravity,
            plan: parsed.plan,
            windows: parsed.windows,
            note: parsed.note,
            source: "agy CLI",
            fetchedAt: Date())
    }

    public struct ParsedAntigravity {
        public let plan: String?
        public let windows: [UsageWindow]
        public let note: String?
    }

    public static func parseOutput(_ data: Data) -> ParsedAntigravity {
        if let root = JSONValue.dictionary(data) {
            if let groups = Self.groups(from: root), !groups.isEmpty {
                return self.parseGroups(groups)
            }
            if let text = JSONValue.string(root["response"]) {
                return self.parseText(Data(text.utf8))
            }
        }
        return self.parseText(data)
    }

    private static func groups(from root: [String: Any]) -> [[String: Any]]? {
        guard let command = JSONValue.dictionary(root["command"]),
              let data = JSONValue.dictionary(command["data"]),
              let groups = JSONValue.array(data["groups"])
        else {
            return nil
        }
        return groups.compactMap(JSONValue.dictionary)
    }

    private static func parseGroups(_ groups: [[String: Any]]) -> ParsedAntigravity {
        var main: [UsageWindow] = []
        var extras: [UsageWindow] = []

        for group in groups {
            let groupName = JSONValue.string(group["name"]) ?? "Antigravity"
            let displayGroup = self.groupDisplayName(groupName)
            var windows: [UsageWindow] = []

            for (index, entry) in (JSONValue.array(group["buckets"]) ?? []).enumerated() {
                guard let bucket = JSONValue.dictionary(entry) else { continue }
                let fraction = JSONValue.double(bucket["remaining_fraction"])
                let used = fraction.map { (1 - min(1, max(0, $0))) * 100 }
                let reset = DateParsing.iso8601(JSONValue.string(bucket["reset_time"]))
                let window = JSONValue.string(bucket["window"]) ?? ""
                let name = JSONValue.string(bucket["name"]) ?? ""
                let title = "\(displayGroup) · \(self.windowTitle(window: window, name: name))"
                let id = "antigravity-\(JSONValue.string(bucket["id"]) ?? "\(displayGroup)-\(index)")"
                windows.append(UsageWindow(
                    id: id,
                    title: title,
                    usedPercent: used,
                    resetsAt: reset))
            }

            windows.sort { self.windowOrder($0) < self.windowOrder($1) }
            if displayGroup == "Gemini" || displayGroup == "Claude + GPT" {
                main.append(contentsOf: windows)
            } else {
                extras.append(contentsOf: windows)
            }
        }

        let extrasUsed = extras.contains { ($0.usedPercent ?? 0) > 0 }
        return ParsedAntigravity(
            plan: nil,
            windows: main + (extrasUsed ? extras : []),
            note: nil)
    }

    private static func parseText(_ data: Data) -> ParsedAntigravity {
        guard let text = String(data: data, encoding: .utf8) else {
            return ParsedAntigravity(plan: nil, windows: [], note: nil)
        }

        var main: [UsageWindow] = []
        var extras: [UsageWindow] = []

        for line in text.components(separatedBy: .newlines) {
            let parts = line.components(separatedBy: "\t")
            guard parts.count >= 4 else { continue }
            let groupName = parts[0].trimmingCharacters(in: .whitespacesAndNewlines)
            let name = parts[1].trimmingCharacters(in: .whitespacesAndNewlines)
            let percentRaw = parts[2]
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .replacingOccurrences(of: "%", with: "")
            guard !groupName.isEmpty,
                  let remaining = Double(percentRaw)
            else {
                continue
            }
            let displayGroup = self.groupDisplayName(groupName)
            let reset = DateParsing.iso8601(parts[3].trimmingCharacters(in: .whitespacesAndNewlines))
            let title = "\(displayGroup) · \(self.windowTitle(window: name, name: name))"
            let id = "antigravity-\(displayGroup)-\(name)"
            let window = UsageWindow(
                id: id,
                title: title,
                usedPercent: max(0, min(100, 100 - remaining)),
                resetsAt: reset)
            if displayGroup == "Gemini" || displayGroup == "Claude + GPT" {
                main.append(window)
            } else {
                extras.append(window)
            }
        }

        main.sort { self.windowOrder($0) < self.windowOrder($1) }
        let extrasUsed = extras.contains { ($0.usedPercent ?? 0) > 0 }
        return ParsedAntigravity(
            plan: nil,
            windows: main + (extrasUsed ? extras : []),
            note: nil)
    }

    private static func groupDisplayName(_ raw: String) -> String {
        let lower = raw.lowercased()
        if lower == "gemini models" { return "Gemini" }
        if lower.contains("claude") && lower.contains("gpt") { return "Claude + GPT" }
        return raw
    }

    private static func windowTitle(window: String, name: String) -> String {
        let lowerWindow = window.lowercased()
        if lowerWindow == "5h" || lowerWindow.contains("five hour") { return "5 小时" }
        if lowerWindow.contains("week") { return "每周" }
        if lowerWindow.contains("month") { return "每月" }
        if lowerWindow.contains("day") { return "每日" }

        let lowerName = name.lowercased()
        if lowerName.contains("five hour") { return "5 小时" }
        if lowerName.contains("weekly") { return "每周" }
        if lowerName.contains("monthly") { return "每月" }

        let cleaned = name
            .replacingOccurrences(of: " Limit Remaining", with: "")
            .replacingOccurrences(of: " Limit", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return cleaned.isEmpty ? "额度" : cleaned
    }

    private static func windowOrder(_ window: UsageWindow) -> Int {
        if window.title.contains("5 小时") { return 0 }
        if window.title.contains("每周") { return 1 }
        if window.title.contains("每月") { return 2 }
        return 3
    }

    private static func runUsage(cli: URL, paths: Paths) throws -> Data {
        let process = Process()
        process.executableURL = cli
        process.arguments = ["-p", "/usage", "--output-format", "json"]

        var environment = ProcessInfo.processInfo.environment
        environment["AGY_CLI_DISABLE_AUTO_UPDATE"] = "true"
        // If the CLI is signed out, do not let it open a browser behind our back.
        environment["BROWSER"] = "/usr/bin/false"
        if let helperDirectory = try? self.noBrowserDirectory(paths: paths) {
            environment["PATH"] = "\(helperDirectory.path):\(environment["PATH"] ?? paths.pathEnvironment)"
        }
        process.environment = environment

        let stdout = Pipe()
        process.standardOutput = stdout
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
        } catch {
            throw ProviderError(
                "无法启动 agy",
                hint: "确认 agy 可执行，或设置 ANTIGRAVITY_CLI_PATH")
        }

        let deadline = Date().addingTimeInterval(30)
        while process.isRunning, Date() < deadline {
            usleep(50_000)
        }
        if process.isRunning {
            process.terminate()
            throw ProviderError(
                "agy 响应超时",
                hint: "在终端运行 agy 检查登录状态")
        }

        let data = stdout.fileHandleForReading.readDataToEndOfFile()

        guard process.terminationStatus == 0 else {
            throw ProviderError.auth(
                "agy 未登录或执行失败",
                hint: "运行 agy 登录 Antigravity 后重试")
        }
        guard !data.isEmpty else {
            throw ProviderError("agy 没有返回额度数据")
        }
        return data
    }

    private static func noBrowserDirectory(paths: Paths) throws -> URL {
        let directory = paths.appSupport.appendingPathComponent("agy-no-browser", isDirectory: true)
        try FileManager.default.createDirectory(
            at: directory,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700])

        let open = directory.appendingPathComponent("open")
        if !FileManager.default.fileExists(atPath: open.path) {
            try Data("#!/bin/sh\nexit 1\n".utf8).write(to: open, options: .atomic)
            try FileManager.default.setAttributes(
                [.posixPermissions: 0o700],
                ofItemAtPath: open.path)
        }
        return directory
    }
}
