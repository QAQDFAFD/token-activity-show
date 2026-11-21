import XCTest
import TokenBarCore

final class MenuBarLayoutTests: XCTestCase {
    private func report(
        _ id: ProviderID,
        windows: [(String, String, Double)]) -> ProviderReport
    {
        let snapshot = ProviderSnapshot(
            provider: id,
            plan: nil,
            windows: windows.map { entry in
                UsageWindow(id: entry.0, title: entry.1, usedPercent: entry.2)
            },
            source: "test")
        return ProviderReport(info: ProviderCatalog.info(for: id), state: .ok(snapshot))
    }

    private var reports: [ProviderReport] {
        [
            self.report(.codex, windows: [
                ("codex-primary", "5 小时", 80),
                ("codex-secondary", "每周", 0),
            ]),
            self.report(.antigravity, windows: [
                ("antigravity-gemini-weekly", "Gemini · 每周", 20),
            ]),
            self.report(.cursor, windows: [
                ("cursor-plan", "本月额度", 0),
            ]),
        ]
    }

    func testAutomaticLayoutUsesMostConstrainedProviders() {
        let layout = MenuBarLayout.defaultValue
        XCTAssertEqual(
            MenuBarLayoutResolver.barValues(layout: layout, reports: self.reports, mode: .used),
            [80, 20, 0])
        XCTAssertEqual(
            MenuBarLayoutResolver.barValues(layout: layout, reports: self.reports, mode: .remaining),
            [20, 80, 100])

        let used = MenuBarLayoutResolver.titleValue(layout: layout, reports: self.reports, mode: .used)
        XCTAssertEqual(used.used, 80)
        XCTAssertEqual(used.display, 80)
        let remaining = MenuBarLayoutResolver.titleValue(layout: layout, reports: self.reports, mode: .remaining)
        XCTAssertEqual(remaining.used, 80)
        XCTAssertEqual(remaining.display, 20)
    }

    func testSpecificBarsAndPercent() {
        let cursorPlan = MenuBarLayoutResolver.windowID(provider: .cursor, window: "cursor-plan")
        let antigravityWeekly = MenuBarLayoutResolver.windowID(
            provider: .antigravity,
            window: "antigravity-gemini-weekly")
        let layout = MenuBarLayout(
            bars: [cursorPlan, "", ""],
            percent: antigravityWeekly)

        XCTAssertEqual(
            MenuBarLayoutResolver.barValues(layout: layout, reports: self.reports, mode: .used),
            [0, 80, 20])

        let title = MenuBarLayoutResolver.titleValue(
            layout: layout,
            reports: self.reports,
            mode: .remaining)
        XCTAssertEqual(title.used, 20)
        XCTAssertEqual(title.display, 80)
    }

    func testLayoutNormalizationAndRoundTrip() throws {
        let layout = MenuBarLayout(bars: ["one"], percent: "two").normalized
        XCTAssertEqual(layout.bars.count, 3)
        XCTAssertEqual(layout.bars[0], "one")
        XCTAssertEqual(layout.bars[1], "")
        XCTAssertEqual(layout.bars[2], "")

        let data = try JSONEncoder().encode(layout)
        let decoded = try JSONDecoder().decode(MenuBarLayout.self, from: data)
        XCTAssertEqual(decoded, layout)
    }
}
