import Foundation

public struct MenuBarLayout: Codable, Sendable, Equatable {
    /// Three bar slots. An empty string means "automatic" (next most constrained provider).
    public var bars: [String]
    /// Title percentage. An empty string means "automatic" (most constrained provider).
    public var percent: String

    public init(bars: [String] = ["", "", ""], percent: String = "") {
        self.bars = bars
        self.percent = percent
    }

    public static let defaultValue = MenuBarLayout()

    public var normalized: MenuBarLayout {
        var slots = self.bars
        while slots.count < 3 { slots.append("") }
        return MenuBarLayout(bars: Array(slots.prefix(3)), percent: self.percent)
    }
}

public struct MenuBarMetric: Identifiable, Sendable, Equatable {
    public let id: String
    public let provider: ProviderID
    public let title: String
    public let usedPercent: Double?
    public let isProviderSummary: Bool

    public init(
        id: String,
        provider: ProviderID,
        title: String,
        usedPercent: Double?,
        isProviderSummary: Bool)
    {
        self.id = id
        self.provider = provider
        self.title = title
        self.usedPercent = usedPercent
        self.isProviderSummary = isProviderSummary
    }
}

public enum MenuBarLayoutResolver {
    public static func metrics(from reports: [ProviderReport]) -> [MenuBarMetric] {
        var metrics: [MenuBarMetric] = []
        for report in reports {
            guard let snapshot = report.state.snapshot else { continue }
            let shortName = report.info.shortName
            metrics.append(MenuBarMetric(
                id: self.summaryID(for: report.info.id),
                provider: report.info.id,
                title: "\(shortName) · 最紧张",
                usedPercent: snapshot.worstUsedPercent,
                isProviderSummary: true))
            for window in snapshot.windows {
                metrics.append(MenuBarMetric(
                    id: self.windowID(provider: report.info.id, window: window.id),
                    provider: report.info.id,
                    title: "\(shortName) · \(window.title)",
                    usedPercent: window.usedPercent,
                    isProviderSummary: false))
            }
        }
        return metrics
    }

    public static func barValues(
        layout: MenuBarLayout,
        reports: [ProviderReport],
        mode: UsageDisplayMode) -> [Double]
    {
        let layout = layout.normalized
        let metrics = self.metrics(from: reports)
        let summaries = metrics
            .filter(\.isProviderSummary)
            .sorted { ($0.usedPercent ?? -1) > ($1.usedPercent ?? -1) }

        var explicit: [Int: MenuBarMetric] = [:]
        for (index, selection) in layout.bars.enumerated() where !selection.isEmpty {
            if let metric = metrics.first(where: { $0.id == selection }) {
                explicit[index] = metric
            }
        }

        let explicitProviders = Set(explicit.values.map(\.provider))
        var autoPool = summaries.filter { !explicitProviders.contains($0.provider) }
        var values: [Double] = []

        for index in 0 ..< layout.bars.count {
            if let metric = explicit[index] {
                values.append(mode.percent(used: metric.usedPercent) ?? 0)
            } else if !autoPool.isEmpty {
                let metric = autoPool.removeFirst()
                values.append(mode.percent(used: metric.usedPercent) ?? 0)
            }
        }
        return values
    }

    public static func titleMetric(
        layout: MenuBarLayout,
        reports: [ProviderReport]) -> MenuBarMetric?
    {
        let metrics = self.metrics(from: reports)
        if !layout.percent.isEmpty,
           let selected = metrics.first(where: { $0.id == layout.percent })
        {
            return selected
        }
        return metrics
            .filter(\.isProviderSummary)
            .sorted { ($0.usedPercent ?? -1) > ($1.usedPercent ?? -1) }
            .first
    }

    public static func titleValue(
        layout: MenuBarLayout,
        reports: [ProviderReport],
        mode: UsageDisplayMode) -> (display: Double?, used: Double?)
    {
        guard let metric = self.titleMetric(layout: layout, reports: reports) else {
            return (nil, nil)
        }
        return (mode.percent(used: metric.usedPercent), metric.usedPercent)
    }

    public static func summaryID(for provider: ProviderID) -> String {
        "\(provider.rawValue):*"
    }

    public static func windowID(provider: ProviderID, window: String) -> String {
        "\(provider.rawValue):\(window)"
    }
}
