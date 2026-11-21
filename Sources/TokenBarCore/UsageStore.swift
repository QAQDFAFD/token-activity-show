import Combine
import Foundation

@MainActor
public final class UsageStore: ObservableObject {
    @Published public private(set) var reports: [ProviderReport] = []
    @Published public private(set) var isRefreshing = false
    @Published public private(set) var lastUpdated: Date?
    @Published public private(set) var lastRefreshFailed = false

    @Published public var refreshInterval: TimeInterval {
        didSet {
            guard self.refreshInterval != oldValue else { return }
            self.defaults.set(self.refreshInterval, forKey: Self.refreshIntervalKey)
            self.startAutoRefresh()
        }
    }

    @Published public var displayMode: UsageDisplayMode {
        didSet {
            self.defaults.set(self.displayMode.rawValue, forKey: Self.displayModeKey)
        }
    }

    @Published public var menuBarLayout: MenuBarLayout = .defaultValue {
        didSet {
            let normalized = self.menuBarLayout.normalized
            guard let data = try? JSONEncoder().encode(normalized) else { return }
            self.defaults.set(data, forKey: Self.menuBarLayoutKey)
        }
    }

    @Published public var isShowingMenuBarSettings = false

    public static let refreshIntervalKey = "TokenBar.refreshInterval"
    public static let displayModeKey = "TokenBar.displayMode"
    public static let menuBarLayoutKey = "TokenBar.menuBarLayout"
    public static let defaultRefreshInterval: TimeInterval = 300

    private let adapters: [any ProviderAdapter]
    private let defaults: UserDefaults
    private var autoRefreshTask: Task<Void, Never>?

    public init(
        paths: Paths = Paths(),
        adapters: [any ProviderAdapter]? = nil,
        refreshInterval: TimeInterval? = nil,
        defaults: UserDefaults = .standard)
    {
        self.defaults = defaults
        self.adapters = adapters ?? ProviderRegistry.adapters(paths: paths)
        let stored = defaults.double(forKey: Self.refreshIntervalKey)
        self.refreshInterval = refreshInterval
            ?? (stored > 0 ? stored : Self.defaultRefreshInterval)
        let storedMode = defaults.string(forKey: Self.displayModeKey)
        self.displayMode = storedMode.flatMap(UsageDisplayMode.init(rawValue:)) ?? .remaining

        if let data = defaults.data(forKey: Self.menuBarLayoutKey),
           let layout = try? JSONDecoder().decode(MenuBarLayout.self, from: data)
        {
            self.menuBarLayout = layout.normalized
        }
    }

    /// Test/preview initializer: no adapters, no network.
    public init(
        previewReports: [ProviderReport],
        refreshInterval: TimeInterval = 300,
        displayMode: UsageDisplayMode = .used,
        defaults: UserDefaults = .standard)
    {
        self.defaults = defaults
        self.adapters = []
        self.refreshInterval = refreshInterval
        self.reports = ProviderSort.ordered(previewReports)
        self.lastUpdated = Date()
        self.displayMode = displayMode
    }

    public var activeReports: [ProviderReport] {
        self.reports.filter(\.isOK)
    }

    public var worstUsedPercent: Double? {
        self.activeReports.compactMap(\.worstUsedPercent).max()
    }

    public func refresh(manual: Bool = false) async {
        guard !self.isRefreshing else { return }
        self.isRefreshing = true
        defer { self.isRefreshing = false }

        let adapters = self.adapters
        let detections = await Task.detached(priority: .userInitiated) {
            adapters.map { adapter in
                (adapter, adapter.detect())
            }
        }.value
        let active = detections.filter { $0.1.isAvailable }
        let needsLogin = detections.filter { $0.1.needsLogin }
        // A manual refresh may recover an expired token or retry a source that needs a fresh file,
        // so it also visits providers that auto-detection could only mark as "needs login".
        let fetchable = manual ? active + needsLogin : active

        guard !fetchable.isEmpty else {
            self.reports = ProviderSort.ordered(needsLogin.map { adapter, detection in
                let hint: String = {
                    if case let .needsLogin(hint) = detection { return hint }
                    return adapter.info.loginHint
                }()
                return ProviderReport(info: adapter.info, state: .needsLogin(hint))
            })
            self.lastRefreshFailed = !self.reports.isEmpty
            return
        }

        var results: [ProviderReport] = await withTaskGroup(of: ProviderReport.self) { group in
            for (adapter, _) in fetchable {
                group.addTask {
                    await adapter.fetch()
                }
            }
            var collected: [ProviderReport] = []
            for await report in group {
                collected.append(report)
            }
            return collected
        }

        // When nothing is signed in successfully, surface the providers that only need a login.
        if !results.contains(where: \.isOK), needsLogin.count > 0 {
            let reported = Set(results.map(\.info.id))
            for (adapter, detection) in needsLogin where !reported.contains(adapter.info.id) {
                if case let .needsLogin(hint) = detection {
                    results.append(ProviderReport(info: adapter.info, state: .needsLogin(hint)))
                }
            }
        }

        self.reports = ProviderSort.ordered(results)
        if results.contains(where: \.isOK) {
            self.lastUpdated = Date()
            self.lastRefreshFailed = false
        } else {
            self.lastRefreshFailed = !results.isEmpty
        }
    }

    public func startAutoRefresh() {
        self.autoRefreshTask?.cancel()
        let interval = self.refreshInterval
        guard interval > 0 else { return }
        self.autoRefreshTask = Task { [weak self] in
            while !Task.isCancelled {
                do {
                    try await Task.sleep(for: .seconds(interval))
                } catch {
                    return
                }
                guard let self, !Task.isCancelled else { return }
                await self.refresh(manual: false)
            }
        }
    }

    public func stopAutoRefresh() {
        self.autoRefreshTask?.cancel()
        self.autoRefreshTask = nil
    }

    deinit {
        self.autoRefreshTask?.cancel()
    }
}
