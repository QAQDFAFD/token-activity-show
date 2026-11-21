import Foundation

public enum ProviderID: String, CaseIterable, Codable, Sendable, Identifiable {
    case claude
    case codex
    case antigravity
    case cursor
    case copilot
    case kimi
    case nous
    case windsurf

    public var id: String { rawValue }
}

public struct ProviderInfo: Sendable, Equatable {
    public let id: ProviderID
    public let name: String
    public let shortName: String
    public let symbolName: String
    public let tintHex: String
    public let dashboardURL: URL?
    public let loginHint: String

    public init(
        id: ProviderID,
        name: String,
        shortName: String,
        symbolName: String,
        tintHex: String,
        dashboardURL: URL?,
        loginHint: String)
    {
        self.id = id
        self.name = name
        self.shortName = shortName
        self.symbolName = symbolName
        self.tintHex = tintHex
        self.dashboardURL = dashboardURL
        self.loginHint = loginHint
    }
}

public struct UsageWindow: Identifiable, Sendable, Equatable {
    public let id: String
    public let title: String
    public let usedPercent: Double?
    public let resetsAt: Date?
    public let windowMinutes: Int?
    public let detail: String?

    public init(
        id: String,
        title: String,
        usedPercent: Double?,
        resetsAt: Date? = nil,
        windowMinutes: Int? = nil,
        detail: String? = nil)
    {
        self.id = id
        self.title = title
        self.usedPercent = usedPercent.map { min(100, max(0, $0)) }
        self.resetsAt = resetsAt
        self.windowMinutes = windowMinutes
        self.detail = detail
    }

    public var remainingPercent: Double? {
        self.usedPercent.map { max(0, 100 - $0) }
    }
}

public struct ProviderSnapshot: Identifiable, Sendable, Equatable {
    public let provider: ProviderID
    public let plan: String?
    public let windows: [UsageWindow]
    public let creditBalance: String?
    public let note: String?
    public let source: String
    public let fetchedAt: Date

    public init(
        provider: ProviderID,
        plan: String?,
        windows: [UsageWindow],
        creditBalance: String? = nil,
        note: String? = nil,
        source: String,
        fetchedAt: Date = Date())
    {
        self.provider = provider
        self.plan = plan
        self.windows = windows
        self.creditBalance = creditBalance
        self.note = note
        self.source = source
        self.fetchedAt = fetchedAt
    }

    public var id: String { self.provider.rawValue }

    public var worstUsedPercent: Double? {
        self.windows.compactMap(\.usedPercent).max()
    }
}

public enum ProviderState: Sendable, Equatable {
    case ok(ProviderSnapshot)
    case needsLogin(String)
    case failed(message: String, hint: String?)

    public var snapshot: ProviderSnapshot? {
        guard case let .ok(snapshot) = self else { return nil }
        return snapshot
    }
}

public struct ProviderReport: Identifiable, Sendable, Equatable {
    public let info: ProviderInfo
    public let state: ProviderState

    public init(info: ProviderInfo, state: ProviderState) {
        self.info = info
        self.state = state
    }

    public var id: String { self.info.id.rawValue }

    public var worstUsedPercent: Double? {
        self.state.snapshot?.worstUsedPercent
    }

    public var isOK: Bool {
        if case .ok = self.state { return true }
        return false
    }
}

public enum ProviderDetection: Sendable, Equatable {
    case available(source: String)
    case needsLogin(hint: String)
    case notInstalled

    public var isAvailable: Bool {
        if case .available = self { return true }
        return false
    }

    public var needsLogin: Bool {
        if case .needsLogin = self { return true }
        return false
    }
}

public struct ProviderError: Error, Sendable, Equatable, LocalizedError {
    public let message: String
    public let hint: String?
    public let isAuthenticationFailure: Bool

    public init(_ message: String, hint: String? = nil, isAuthenticationFailure: Bool = false) {
        self.message = message
        self.hint = hint
        self.isAuthenticationFailure = isAuthenticationFailure
    }

    public var errorDescription: String? { self.message }

    public static func auth(_ message: String, hint: String? = nil) -> ProviderError {
        ProviderError(message, hint: hint, isAuthenticationFailure: true)
    }
}

public enum ProviderSort {
    /// Healthy providers first, most-consumed first. Failures next, then providers that only need sign-in.
    public static func ordered(_ reports: [ProviderReport]) -> [ProviderReport] {
        reports.sorted { lhs, rhs in
            let lhsRank = Self.rank(lhs)
            let rhsRank = Self.rank(rhs)
            if lhsRank != rhsRank { return lhsRank < rhsRank }

            switch (lhs.worstUsedPercent, rhs.worstUsedPercent) {
            case let (l?, r?):
                if l != r { return l > r }
            case (nil, _?):
                return false
            case (_?, nil):
                return true
            case (nil, nil):
                break
            }

            return Self.index(lhs.info.id) < Self.index(rhs.info.id)
        }
    }

    private static func rank(_ report: ProviderReport) -> Int {
        switch report.state {
        case .ok: 0
        case .failed: 1
        case .needsLogin: 2
        }
    }

    private static func index(_ id: ProviderID) -> Int {
        ProviderID.allCases.firstIndex(of: id) ?? Int.max
    }
}
