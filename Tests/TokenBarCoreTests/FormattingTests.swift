import XCTest
import TokenBarCore

final class FormattingTests: XCTestCase {
    func testPercentRoundsAndHandlesUnknown() {
        XCTAssertEqual(Formatting.percent(42.4), "42%")
        XCTAssertEqual(Formatting.percent(42.6), "43%")
        XCTAssertEqual(Formatting.percent(nil), "—")
    }

    func testResetDescription() {
        let now = Date(timeIntervalSince1970: 1_000_000)
        XCTAssertEqual(
            Formatting.resetDescription(now.addingTimeInterval(2 * 3600 + 13 * 60), now: now),
            "2 小时 13 分后重置")
        XCTAssertEqual(
            Formatting.resetDescription(now.addingTimeInterval(26 * 3600), now: now),
            "1 天 2 小时后重置")
        XCTAssertEqual(
            Formatting.resetDescription(now.addingTimeInterval(-1), now: now),
            "即将重置")
    }

    func testPlanLabels() {
        XCTAssertEqual(Formatting.planLabel("max"), "Max")
        XCTAssertEqual(Formatting.planLabel("default_claude_max_5x"), "Max 5×")
        XCTAssertEqual(Formatting.planLabel("default_claude_max_20x"), "Max 20×")
        XCTAssertEqual(Formatting.planLabel("individual"), "Individual")
    }

    func testEpochAndISO8601() {
        XCTAssertEqual(
            DateParsing.epoch(1_795_280_936)?.timeIntervalSince1970,
            1_795_280_936)
        XCTAssertEqual(
            DateParsing.epoch(1_795_280_936_000)?.timeIntervalSince1970,
            1_795_280_936)
        XCTAssertNotNil(DateParsing.iso8601("2026-11-21T18:00:00Z"))
    }

    func testDisplayModePercent() {
        XCTAssertEqual(UsageDisplayMode.used.percent(used: 25), 25)
        XCTAssertEqual(UsageDisplayMode.remaining.percent(used: 25), 75)
        XCTAssertEqual(UsageDisplayMode.remaining.percent(used: 100), 0)
        XCTAssertNil(UsageDisplayMode.remaining.percent(used: nil))
    }
}

final class TokenStoreTests: XCTestCase {
    func testGitHubHostsToken() {
        let yaml = """
        github.com:
            git_protocol: https
            oauth_token: gho_test_token
            user: octocat
        """
        XCTAssertEqual(GitHubTokenStore.parseHosts(yaml), "gho_test_token")
    }

    func testGitHubHostsWithoutToken() {
        let yaml = """
        github.com:
            git_protocol: https
            user: octocat
        """
        XCTAssertNil(GitHubTokenStore.parseHosts(yaml))
    }
}
