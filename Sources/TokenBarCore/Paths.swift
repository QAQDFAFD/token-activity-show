import Foundation

public struct Paths: Sendable {
    public let home: URL
    public let environment: [String: String]

    public init(home: URL? = nil, environment: [String: String] = ProcessInfo.processInfo.environment) {
        if let home {
            self.home = home
        } else if let override = Paths.clean(environment["TOKENBAR_HOME"]) {
            self.home = URL(
                fileURLWithPath: NSString(string: override).expandingTildeInPath,
                isDirectory: true)
        } else {
            self.home = FileManager.default.homeDirectoryForCurrentUser
        }
        self.environment = environment
    }

    public var appSupport: URL {
        self.home.appendingPathComponent("Library/Application Support/TokenBar", isDirectory: true)
    }

    public var credentialCache: URL {
        self.appSupport.appendingPathComponent("credentials.json")
    }

    public var tokenBarConfig: URL {
        if let xdg = self.environment["XDG_CONFIG_HOME"].flatMap(Self.clean) {
            return URL(fileURLWithPath: Self.expand(xdg, home: self.home), isDirectory: true)
                .appendingPathComponent("tokenbar/config.json")
        }
        return self.home.appendingPathComponent(".config/tokenbar/config.json")
    }

    public var claudeDirectory: URL {
        self.home.appendingPathComponent(".claude", isDirectory: true)
    }

    public var claudeCredentials: URL {
        let override = self.environment["CLAUDE_CONFIG_DIR"].flatMap(Self.clean)
        if let override {
            return URL(fileURLWithPath: Self.expand(override, home: self.home), isDirectory: true)
                .appendingPathComponent(".credentials.json")
        }
        return self.claudeDirectory.appendingPathComponent(".credentials.json")
    }

    public var codexHome: URL {
        if let override = self.environment["CODEX_HOME"].flatMap(Self.clean) {
            return URL(fileURLWithPath: Self.expand(override, home: self.home), isDirectory: true)
        }
        return self.home.appendingPathComponent(".codex", isDirectory: true)
    }

    public var codexAuth: URL {
        self.codexHome.appendingPathComponent("auth.json")
    }

    public var antigravityCLI: URL? {
        if let raw = self.environment["ANTIGRAVITY_CLI_PATH"] {
            guard let clean = Self.clean(raw) else { return nil }
            let url = URL(fileURLWithPath: Self.expand(clean, home: self.home))
            return FileManager.default.isExecutableFile(atPath: url.path) ? url : nil
        }
        return self.executable(named: "agy")
    }

    public var antigravityAppInstalled: Bool {
        self.fileExists(URL(fileURLWithPath: "/Applications/Antigravity.app"))
            || self.fileExists(self.home.appendingPathComponent("Applications/Antigravity.app"))
    }

    public var kimiDirectory: URL {
        if let override = self.environment["KIMI_CODE_HOME"].flatMap(Self.clean) {
            return URL(fileURLWithPath: Self.expand(override, home: self.home), isDirectory: true)
        }
        return self.home.appendingPathComponent(".kimi-code", isDirectory: true)
    }

    public var kimiCredentials: URL {
        self.kimiDirectory.appendingPathComponent("credentials/kimi-code.json")
    }

    public var hermesDirectory: URL {
        if let override = self.environment["HERMES_HOME"].flatMap(Self.clean) {
            return URL(fileURLWithPath: Self.expand(override, home: self.home), isDirectory: true)
        }
        return self.home.appendingPathComponent(".hermes", isDirectory: true)
    }

    public var hermesAuth: URL {
        self.hermesDirectory.appendingPathComponent("auth.json")
    }

    public var hermesSharedAuth: URL {
        self.hermesDirectory.appendingPathComponent("shared/nous_auth.json")
    }

    public var ghHosts: URL {
        if let xdg = self.environment["XDG_CONFIG_HOME"].flatMap(Self.clean) {
            return URL(fileURLWithPath: Self.expand(xdg, home: self.home), isDirectory: true)
                .appendingPathComponent("gh/hosts.yml")
        }
        return self.home.appendingPathComponent(".config/gh/hosts.yml")
    }

    public var cursorDatabase: URL {
        self.home.appendingPathComponent(
            "Library/Application Support/Cursor/User/globalStorage/state.vscdb")
    }

    public var windsurfDatabase: URL {
        self.home.appendingPathComponent(
            "Library/Application Support/Windsurf/User/globalStorage/state.vscdb")
    }

    public var zedSettings: URL {
        self.home.appendingPathComponent(".config/zed/settings.json")
    }

    public func fileExists(_ url: URL) -> Bool {
        FileManager.default.fileExists(atPath: url.path)
    }

    public func data(at url: URL) -> Data? {
        try? Data(contentsOf: url)
    }

    public func json(at url: URL) -> [String: Any]? {
        guard let data = self.data(at: url) else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    public var pathEnvironment: String {
        self.environment["PATH"] ?? "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
    }

    public func executable(named name: String) -> URL? {
        var candidates: [String] = []
        for directory in self.pathEnvironment.split(separator: ":") {
            let path = String(directory)
            guard path.hasPrefix("/") else { continue }
            candidates.append("\(path)/\(name)")
        }
        switch name {
        case "claude":
            candidates.append(contentsOf: [
                "\(self.home.path)/.local/bin/claude",
                "\(self.home.path)/.claude/local/claude",
                "/opt/homebrew/bin/claude",
                "/usr/local/bin/claude",
            ])
        case "codex":
            candidates.append(contentsOf: [
                "/opt/homebrew/bin/codex",
                "/usr/local/bin/codex",
                "\(self.home.path)/.local/bin/codex",
                "\(self.home.path)/.npm-global/bin/codex",
            ])
        case "agy":
            candidates.append(contentsOf: [
                "\(self.home.path)/.local/bin/agy",
                "/opt/homebrew/bin/agy",
                "/usr/local/bin/agy",
            ])
        case "gh":
            candidates.append(contentsOf: [
                "/opt/homebrew/bin/gh",
                "/usr/local/bin/gh",
            ])
        case "kimi":
            candidates.append(contentsOf: [
                "\(self.home.path)/.kimi-code/bin/kimi",
                "\(self.home.path)/.local/bin/kimi",
                "/opt/homebrew/bin/kimi",
            ])
        case "hermes":
            candidates.append(contentsOf: [
                "\(self.home.path)/.local/bin/hermes",
                "/opt/homebrew/bin/hermes",
            ])
        default:
            break
        }

        for candidate in candidates where FileManager.default.isExecutableFile(atPath: candidate) {
            return URL(fileURLWithPath: candidate)
        }
        return nil
    }

    public var codexCLIInstalled: Bool {
        self.executable(named: "codex") != nil
    }

    public var claudeCLIInstalled: Bool {
        self.executable(named: "claude") != nil
    }

    public var antigravityCLIInstalled: Bool {
        self.antigravityCLI != nil
    }

    public var ghCLIInstalled: Bool {
        self.executable(named: "gh") != nil
    }

    public var kimiCLIInstalled: Bool {
        self.executable(named: "kimi") != nil
    }

    public var hermesCLIInstalled: Bool {
        self.executable(named: "hermes") != nil
    }

    static func clean(_ raw: String?) -> String? {
        guard let value = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
            return nil
        }
        return value
    }

    static func expand(_ path: String, home: URL) -> String {
        if path == "~" { return home.path }
        if path.hasPrefix("~/") {
            return home.path + String(path.dropFirst())
        }
        return path
    }
}
