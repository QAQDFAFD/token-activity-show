import Foundation
import SQLite3
import XCTest
@testable import TokenBarCore

// MARK: - URLProtocol mock

final class MockURLProtocol: URLProtocol {
    typealias Handler = (URLRequest) throws -> (Data, Int)
    private static let lock = NSLock()
    nonisolated(unsafe) private static var storedHandler: Handler?

    static func setHandler(_ handler: Handler?) {
        self.lock.lock()
        self.storedHandler = handler
        self.lock.unlock()
    }

    private static func handler() -> Handler? {
        self.lock.lock()
        defer { self.lock.unlock() }
        return self.storedHandler
    }

    override class func canInit(with request: URLRequest) -> Bool { true }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler() else {
            self.client?.urlProtocol(self, didFailWithError: URLError(.resourceUnavailable))
            return
        }

        do {
            let (data, status) = try handler(self.request)
            guard let url = self.request.url,
                  let response = HTTPURLResponse(
                      url: url,
                      statusCode: status,
                      httpVersion: "HTTP/1.1",
                      headerFields: ["Content-Type": "application/json"])
            else {
                throw URLError(.badServerResponse)
            }
            self.client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            self.client?.urlProtocol(self, didLoad: data)
            self.client?.urlProtocolDidFinishLoading(self)
        } catch {
            self.client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

// MARK: - End-to-end tests

final class RequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var records: [String: [String: String]] = [:]

    func reset() {
        self.lock.lock()
        self.records.removeAll()
        self.lock.unlock()
    }

    func record(_ key: String, request: URLRequest) {
        let headerNames = [
            "Authorization",
            "ChatGPT-Account-Id",
            "anthropic-beta",
            "Cookie",
            "Editor-Version",
            "Editor-Plugin-Version",
        ]
        var headers: [String: String] = [:]
        for name in headerNames {
            if let value = request.value(forHTTPHeaderField: name) {
                headers[name.lowercased()] = value
            }
        }
        self.lock.lock()
        self.records[key] = headers
        self.lock.unlock()
    }

    func headers(_ key: String) -> [String: String]? {
        self.lock.lock()
        defer { self.lock.unlock() }
        return self.records[key]
    }
}

@MainActor
final class EndToEndTests: XCTestCase {
    private var home: URL!
    private var defaults: UserDefaults!
    private var suiteName: String!
    private var fakeAgy: URL!
    private let recorder = RequestRecorder()

    override func setUp() async throws {
        try await super.setUp()

        self.recorder.reset()
        self.home = FileManager.default.temporaryDirectory
            .appendingPathComponent("TokenBarE2E-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: self.home, withIntermediateDirectories: true)

        self.suiteName = "TokenBarE2E.\(UUID().uuidString)"
        self.defaults = UserDefaults(suiteName: self.suiteName)
        self.defaults.removePersistentDomain(forName: self.suiteName)

        try self.writeFixtures()
        try self.installMockHTTP()
    }

    override func tearDown() async throws {
        MockURLProtocol.setHandler(nil)
        HTTPClient.shared = HTTPClient()
        self.defaults.removePersistentDomain(forName: self.suiteName)
        try? FileManager.default.removeItem(at: self.home)
        try await super.tearDown()
    }

    // MARK: Fixtures

    private var paths: Paths {
        var environment: [String: String] = [
            "PATH": "/usr/bin:/bin:/usr/sbin:/sbin",
            "TOKENBAR_HOME": self.home.path,
        ]
        if let fakeAgy = self.fakeAgy {
            environment["ANTIGRAVITY_CLI_PATH"] = fakeAgy.path
        }
        return Paths(home: self.home, environment: environment)
    }

    private func writeFixtures() throws {
        let future = Date().addingTimeInterval(86_400).timeIntervalSince1970
        let codexJWT = self.fakeJWT(sub: "codex-e2e", exp: future)
        let cursorJWT = self.fakeJWT(sub: "auth0|user_e2e", exp: future)

        try self.writeJSON(
            [
                "claudeAccessToken": "claude-e2e-token",
                "githubToken": "github-e2e-token",
                "kimiAccessToken": "kimi-e2e-token",
                "nousAccessToken": "nous-e2e-token",
            ],
            to: self.paths.tokenBarConfig)

        try self.writeJSON(
            ["tokens": ["access_token": codexJWT, "account_id": "acct_e2e"]],
            to: self.paths.codexAuth)

        try self.createStateDB(
            at: self.paths.cursorDatabase,
            key: "cursorAuth/accessToken",
            value: cursorJWT)

        try self.createStateDB(
            at: self.paths.windsurfDatabase,
            key: "windsurf.settings.cachedPlanInfo",
            value: """
            {"planName":"Pro","quotaUsage":{"dailyRemainingPercent":80,"weeklyRemainingPercent":60,"dailyResetAtUnix":1795280936,"weeklyResetAtUnix":1795879023}}
            """)

        let agyDirectory = self.home.appendingPathComponent("bin", isDirectory: true)
        try FileManager.default.createDirectory(at: agyDirectory, withIntermediateDirectories: true)
        self.fakeAgy = agyDirectory.appendingPathComponent("agy")
        let antigravityJSON = """
        {"command":{"name":"usage","data":{"groups":[{"name":"Gemini Models","buckets":[{"id":"gemini-weekly","name":"Weekly Limit Remaining","window":"weekly","remaining_fraction":0.75,"reset_time":"2026-11-29T00:00:00Z"},{"id":"gemini-5h","name":"Five Hour Limit Remaining","window":"5h","remaining_fraction":1,"reset_time":"2026-11-22T05:00:00Z"}]},{"name":"Claude and GPT models","buckets":[{"id":"3p-weekly","name":"Weekly Limit Remaining","window":"weekly","remaining_fraction":1,"reset_time":"2026-11-29T00:00:00Z"},{"id":"3p-5h","name":"Five Hour Limit Remaining","window":"5h","remaining_fraction":1,"reset_time":"2026-11-22T05:00:00Z"}]}]}}}
        """
        let script = "#!/bin/sh\nprintf '%s' '\(antigravityJSON)'\n"
        try Data(script.utf8).write(to: self.fakeAgy)
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o755],
            ofItemAtPath: self.fakeAgy.path)
    }

    private func writeJSON(_ object: [String: Any], to url: URL) throws {
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true)
        let data = try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted])
        try data.write(to: url)
    }

    private func createStateDB(at url: URL, key: String, value: String) throws {
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true)

        var database: OpaquePointer?
        guard sqlite3_open(url.path, &database) == SQLITE_OK else {
            throw URLError(.cannotCreateFile)
        }
        defer { sqlite3_close(database) }

        guard sqlite3_exec(
            database,
            "CREATE TABLE IF NOT EXISTS ItemTable (key TEXT PRIMARY KEY, value BLOB);",
            nil,
            nil,
            nil) == SQLITE_OK
        else {
            throw URLError(.cannotWriteToFile)
        }

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(
            database,
            "INSERT OR REPLACE INTO ItemTable(key, value) VALUES (?, ?);",
            -1,
            &statement,
            nil) == SQLITE_OK
        else {
            throw URLError(.cannotWriteToFile)
        }
        defer { sqlite3_finalize(statement) }

        let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
        sqlite3_bind_text(statement, 1, (key as NSString).utf8String, -1, transient)
        sqlite3_bind_text(statement, 2, (value as NSString).utf8String, -1, transient)
        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw URLError(.cannotWriteToFile)
        }
    }

    private func fakeJWT(sub: String, exp: TimeInterval) -> String {
        func encode(_ object: [String: Any]) -> String {
            let data = try! JSONSerialization.data(withJSONObject: object)
            return data.base64EncodedString()
                .replacingOccurrences(of: "+", with: "-")
                .replacingOccurrences(of: "/", with: "_")
                .replacingOccurrences(of: "=", with: "")
        }
        let header = encode(["alg": "none", "typ": "JWT"])
        let payload = encode(["sub": sub, "exp": Int(exp), "email": "e2e@example.com"])
        return "\(header).\(payload).signature"
    }

    // MARK: HTTP mock

    private func installMockHTTP(failKimi: Bool = false) throws {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [MockURLProtocol.self]
        configuration.httpShouldSetCookies = false
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        HTTPClient.shared = HTTPClient(configuration: configuration)

        let recorder = self.recorder
        MockURLProtocol.setHandler { request in
            guard let url = request.url else { throw URLError(.badURL) }
            recorder.record("\(url.host ?? "")\(url.path)", request: request)
            switch (url.host, url.path) {
            case ("api.anthropic.com", "/api/oauth/usage"):
                return (Data(Self.claudeJSON.utf8), 200)
            case ("chatgpt.com", "/backend-api/wham/usage"):
                return (Data(Self.codexJSON.utf8), 200)
            case ("cursor.com", "/api/usage-summary"):
                return (Data(Self.cursorJSON.utf8), 200)
            case ("api.github.com", "/copilot_internal/user"):
                return (Data(Self.copilotJSON.utf8), 200)
            case ("api.kimi.com", "/coding/v1/usages"):
                return (Data(failKimi ? "{}".utf8 : Self.kimiJSON.utf8), failKimi ? 503 : 200)
            case ("portal.nousresearch.com", "/api/oauth/account"):
                return (Data(Self.nousJSON.utf8), 200)
            default:
                return (Data("{}".utf8), 404)
            }
        }
    }

    // MARK: Tests

    func testFullRefreshPipelineAcrossAllLocalSources() async throws {
        let store = UsageStore(paths: self.paths, defaults: self.defaults)
        await store.refresh(manual: false)

        XCTAssertEqual(
            store.reports.count,
            8,
            "Expected all eight providers, got: \(store.reports.map(\.id))")
        for report in store.reports {
            guard case let .ok(snapshot) = report.state else {
                XCTFail("\(report.info.id) did not refresh successfully: \(report.state)")
                continue
            }
            XCTAssertFalse(snapshot.windows.isEmpty, "\(report.info.id) has no windows")
        }

        let byID = Dictionary(uniqueKeysWithValues: store.reports.map { ($0.info.id, $0) })

        let codex = try XCTUnwrap(byID[.codex])
        XCTAssertEqual(codex.state.snapshot?.plan, "Plus")
        XCTAssertEqual(codex.state.snapshot?.windows.first(where: { $0.title == "5 小时" })?.usedPercent, 100)
        XCTAssertEqual(codex.state.snapshot?.windows.first(where: { $0.title == "每周" })?.usedPercent, 0)
        XCTAssertEqual(codex.state.snapshot?.creditBalance, "余额 12.5")

        let antigravity = try XCTUnwrap(byID[.antigravity])
        XCTAssertEqual(antigravity.state.snapshot?.windows.count, 4)
        XCTAssertEqual(
            antigravity.state.snapshot?.windows.first(where: { $0.title == "Gemini · 每周" })?.usedPercent,
            25)
        XCTAssertEqual(
            antigravity.state.snapshot?.windows.first(where: { $0.title == "Claude + GPT · 5 小时" })?.usedPercent,
            0)

        let cursor = try XCTUnwrap(byID[.cursor])
        XCTAssertEqual(cursor.state.snapshot?.plan, "Pro")
        XCTAssertEqual(
            cursor.state.snapshot?.windows.first(where: { $0.id == "cursor-plan" })?.usedPercent,
            5)
        XCTAssertEqual(
            cursor.state.snapshot?.windows.first(where: { $0.id == "cursor-on-demand" })?.usedPercent,
            10)

        let claude = try XCTUnwrap(byID[.claude])
        XCTAssertEqual(claude.state.snapshot?.windows.count, 3)
        XCTAssertEqual(
            claude.state.snapshot?.windows.first(where: { $0.title == "5 小时" })?.usedPercent,
            40)
        XCTAssertEqual(
            claude.state.snapshot?.windows.first(where: { $0.title == "每周" })?.usedPercent,
            60)

        let copilot = try XCTUnwrap(byID[.copilot])
        XCTAssertEqual(copilot.state.snapshot?.plan, "Individual")
        XCTAssertEqual(
            copilot.state.snapshot?.windows.first(where: { $0.title == "Premium requests" })?.usedPercent,
            75)
        XCTAssertEqual(
            copilot.state.snapshot?.windows.first(where: { $0.title == "Chat" })?.usedPercent,
            50)

        let kimi = try XCTUnwrap(byID[.kimi])
        XCTAssertEqual(kimi.state.snapshot?.plan, "Moderato")
        XCTAssertEqual(kimi.state.snapshot?.windows.count, 3)
        XCTAssertEqual(
            kimi.state.snapshot?.windows.first(where: { $0.title == "5 小时" })?.usedPercent,
            20)
        XCTAssertEqual(
            kimi.state.snapshot?.windows.first(where: { $0.title == "本月" })?.usedPercent,
            60)

        let nous = try XCTUnwrap(byID[.nous])
        XCTAssertEqual(nous.state.snapshot?.plan, "Ultra")
        XCTAssertEqual(
            nous.state.snapshot?.windows.first(where: { $0.title == "本月额度" })?.usedPercent,
            30)
        XCTAssertEqual(nous.state.snapshot?.creditBalance, "可用 80 credits")

        let windsurf = try XCTUnwrap(byID[.windsurf])
        XCTAssertEqual(windsurf.state.snapshot?.plan, "Pro")
        XCTAssertEqual(
            windsurf.state.snapshot?.windows.first(where: { $0.title == "每日" })?.usedPercent,
            20)
        XCTAssertEqual(
            windsurf.state.snapshot?.windows.first(where: { $0.title == "每周" })?.usedPercent,
            40)

        XCTAssertEqual(store.worstUsedPercent, 100)

        let claudeHeaders = try XCTUnwrap(
            self.recorder.headers("api.anthropic.com/api/oauth/usage"))
        XCTAssertEqual(claudeHeaders["authorization"], "Bearer claude-e2e-token")
        XCTAssertEqual(claudeHeaders["anthropic-beta"], "oauth-2025-04-20")

        let codexHeaders = try XCTUnwrap(
            self.recorder.headers("chatgpt.com/backend-api/wham/usage"))
        XCTAssertEqual(codexHeaders["chatgpt-account-id"], "acct_e2e")
        XCTAssertTrue(codexHeaders["authorization"]?.hasPrefix("Bearer ") == true)

        let cursorHeaders = try XCTUnwrap(
            self.recorder.headers("cursor.com/api/usage-summary"))
        let cursorCookie = try XCTUnwrap(cursorHeaders["cookie"])
        XCTAssertTrue(cursorCookie.contains("WorkosCursorSessionToken="))
        XCTAssertTrue(cursorCookie.contains("user_e2e"))

        let copilotHeaders = try XCTUnwrap(
            self.recorder.headers("api.github.com/copilot_internal/user"))
        XCTAssertEqual(copilotHeaders["authorization"], "token github-e2e-token")
        XCTAssertEqual(copilotHeaders["editor-version"], "vscode/1.96.2")

        let kimiHeaders = try XCTUnwrap(
            self.recorder.headers("api.kimi.com/coding/v1/usages"))
        XCTAssertEqual(kimiHeaders["authorization"], "Bearer kimi-e2e-token")

        let nousHeaders = try XCTUnwrap(
            self.recorder.headers("portal.nousresearch.com/api/oauth/account"))
        XCTAssertEqual(nousHeaders["authorization"], "Bearer nous-e2e-token")
    }

    func testPartialProviderFailureIsIsolated() async throws {
        try self.installMockHTTP(failKimi: true)

        let store = UsageStore(paths: self.paths, defaults: self.defaults)
        await store.refresh(manual: false)

        XCTAssertEqual(store.reports.count, 8)
        XCTAssertEqual(store.activeReports.count, 7)

        guard let kimi = store.reports.first(where: { $0.info.id == .kimi }) else {
            XCTFail("Kimi report missing")
            return
        }
        guard case let .failed(message, _) = kimi.state else {
            XCTFail("Kimi should be a failed report, got \(kimi.state)")
            return
        }
        XCTAssertTrue(message.contains("503"), message)

        XCTAssertTrue(store.reports.first(where: { $0.info.id == .codex })?.isOK == true)
        XCTAssertTrue(store.reports.first(where: { $0.info.id == .antigravity })?.isOK == true)
        XCTAssertTrue(store.reports.first(where: { $0.info.id == .cursor })?.isOK == true)

        let title = MenuBarLayoutResolver.titleValue(
            layout: .defaultValue,
            reports: store.activeReports,
            mode: .remaining)
        XCTAssertNotNil(title.display)
    }

    func testConfigurableMenuBarLayoutAndPersistence() async throws {        let store = UsageStore(paths: self.paths, defaults: self.defaults)
        await store.refresh(manual: false)
        store.displayMode = .remaining

        let layout = MenuBarLayout(
            bars: [
                MenuBarLayoutResolver.windowID(provider: .codex, window: "codex-primary"),
                MenuBarLayoutResolver.windowID(provider: .antigravity, window: "antigravity-gemini-weekly"),
                MenuBarLayoutResolver.windowID(provider: .cursor, window: "cursor-plan"),
            ],
            percent: MenuBarLayoutResolver.windowID(provider: .claude, window: "claude-weekly"))
        store.menuBarLayout = layout

        let bars = MenuBarLayoutResolver.barValues(
            layout: layout,
            reports: store.activeReports,
            mode: .remaining)
        XCTAssertEqual(bars, [0, 75, 95])

        let title = MenuBarLayoutResolver.titleValue(
            layout: layout,
            reports: store.activeReports,
            mode: .remaining)
        XCTAssertEqual(title.used, 60)
        XCTAssertEqual(title.display, 40)

        let reloaded = UsageStore(paths: self.paths, adapters: [], defaults: self.defaults)
        XCTAssertEqual(reloaded.menuBarLayout, layout.normalized)
        XCTAssertEqual(reloaded.displayMode, .remaining)
    }

    // MARK: Fixture JSON

    private static let claudeJSON = """
    {
      "five_hour": {"utilization": 40, "resets_at": "2026-12-01T05:00:00Z"},
      "seven_day": {"utilization": 60, "resets_at": "2026-12-08T00:00:00Z"},
      "seven_day_sonnet": {"utilization": 10, "resets_at": "2026-12-08T00:00:00Z"}
    }
    """

    private static let codexJSON = """
    {
      "plan_type": "plus",
      "rate_limit": {
        "primary_window": {
          "used_percent": 100,
          "limit_window_seconds": 18000,
          "reset_at": 1795280936
        },
        "secondary_window": {
          "used_percent": 0,
          "limit_window_seconds": 604800,
          "reset_at": 1795879023
        }
      },
      "credits": {"has_credits": true, "unlimited": false, "balance": "12.5"}
    }
    """

    private static let cursorJSON = """
    {
      "billingCycleEnd": "2026-12-01T00:00:00Z",
      "membershipType": "pro",
      "individualUsage": {
        "plan": {"used": 100, "limit": 2000, "totalPercentUsed": 5},
        "onDemand": {"used": 100, "limit": 1000}
      }
    }
    """

    private static let copilotJSON = """
    {
      "copilot_plan": "individual",
      "quota_reset_date": "2026-12-01",
      "quota_snapshots": {
        "premium_interactions": {
          "percent_remaining": 25,
          "entitlement": 50,
          "remaining": 12.5,
          "credits_used": 5
        },
        "chat": {
          "percent_remaining": 50,
          "entitlement": 100,
          "remaining": 50
        }
      }
    }
    """

    private static let kimiJSON = """
    {
      "usages": {
        "limit_5h": {"used_ratio": 0.2, "reset_time": "2026-12-01T05:00:00Z"},
        "limit_7d": {"used_ratio": 0.4, "reset_time": "2026-12-08T00:00:00Z"},
        "limit_month_total": {"used_ratio": 0.6, "reset_time": "2027-01-01T00:00:00Z"}
      },
      "user": {"membership": {"level": "LEVEL_BASIC"}}
    }
    """

    private static let nousJSON = """
    {
      "subscription": {
        "monthly_credits": 100,
        "credits_remaining": 70,
        "current_period_end": "2026-12-01T00:00:00Z",
        "plan": "ultra"
      },
      "purchased_credits_remaining": 10,
      "paid_service_access": {"total_usable_credits": 80}
    }
    """
}
