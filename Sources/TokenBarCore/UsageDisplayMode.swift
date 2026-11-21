import Foundation

public enum UsageDisplayMode: String, CaseIterable, Codable, Sendable, Identifiable {
    case remaining
    case used

    public var id: String { rawValue }

    public var label: String {
        switch self {
        case .used: "已用"
        case .remaining: "剩余"
        }
    }

    public func percent(used: Double?) -> Double? {
        guard let used else { return nil }
        switch self {
        case .used:
            return min(100, max(0, used))
        case .remaining:
            return min(100, max(0, 100 - used))
        }
    }
}

public extension UsageWindow {
    func percent(for mode: UsageDisplayMode) -> Double? {
        mode.percent(used: self.usedPercent)
    }
}
