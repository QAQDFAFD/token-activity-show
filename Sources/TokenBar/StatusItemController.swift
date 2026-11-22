import AppKit
import Combine
import ServiceManagement
import SwiftUI
import TokenBarCore

@MainActor
final class StatusItemController: NSObject {
    private let store: UsageStore
    private let statusItem: NSStatusItem
    private let panel = PopoverPanel()
    private var hostingController: NSHostingController<PopoverView>?
    private var cancellables = Set<AnyCancellable>()

    private var globalClickMonitor: Any?
    private var escapeKeyMonitor: Any?
    private var appResignObserver: NSObjectProtocol?

    init(store: UsageStore) {
        self.store = store
        self.statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        super.init()
        self.configureButton()
        self.configurePanel()
        self.bindStore()
        self.update()
    }

    private func configureButton() {
        guard let button = self.statusItem.button else { return }
        button.image = MeterIcon.makeImage(percents: [])
        button.imagePosition = .imageLeading
        button.title = "—"
        button.font = NSFont.monospacedDigitSystemFont(ofSize: 10, weight: .medium)
        button.target = self
        button.action = #selector(self.handleClick(_:))
        button.sendAction(on: [.leftMouseUp, .rightMouseUp])
        button.toolTip = "TokenBar"
        button.setAccessibilityLabel("TokenBar 额度")
    }

    private func configurePanel() {
        let root = PopoverView(store: self.store)
        let hosting = NSHostingController(rootView: root)
        hosting.view.wantsLayer = true
        hosting.view.layer?.backgroundColor = NSColor.clear.cgColor
        self.hostingController = hosting
        self.panel.contentViewController = hosting
        self.panel.setFrame(
            self.panelFrame(height: 420, width: AppLayout.panelWidth),
            display: false)
    }

    private func bindStore() {
        self.store.objectWillChange
            .receive(on: RunLoop.main)
            .sink { [weak self] _ in
                DispatchQueue.main.async {
                    self?.update()
                }
            }
            .store(in: &self.cancellables)
    }

    private func update() {
        guard let button = self.statusItem.button else { return }
        let mode = self.store.displayMode
        let active = self.store.activeReports
        let values = MenuBarLayoutResolver.barValues(
            layout: self.store.menuBarLayout,
            reports: active,
            mode: mode)
        button.image = MeterIcon.makeImage(percents: values)

        let title = MenuBarLayoutResolver.titleValue(
            layout: self.store.menuBarLayout,
            reports: active,
            mode: mode)
        let displayValue = title.display
        let worstUsed = title.used
        let titleText = displayValue.map { "\(Int($0.rounded()))%" } ?? "—"
        let color: NSColor = if let worstUsed, worstUsed >= 90 {
            .systemRed
        } else {
            .labelColor
        }
        button.attributedTitle = NSAttributedString(
            string: titleText,
            attributes: [
                .font: NSFont.monospacedDigitSystemFont(ofSize: 10, weight: .medium),
                .foregroundColor: color,
            ])

        if active.isEmpty {
            if self.store.reports.isEmpty {
                button.toolTip = "TokenBar：未检测到本地 AI 订阅"
            } else {
                let hints = self.store.reports.map { "\($0.info.shortName)：\(self.shortState($0.state))" }
                button.toolTip = hints.joined(separator: "\n")
            }
        } else {
            let issues = self.store.reports.count - active.count
            let summary = active.map { report in
                let value = mode.percent(used: report.worstUsedPercent)
                return "\(report.info.shortName) \(Formatting.percent(value)) \(mode.label)"
            }.joined(separator: " · ")
            let titleMetric = MenuBarLayoutResolver.titleMetric(
                layout: self.store.menuBarLayout,
                reports: active)
            let titleLine: String? = if !self.store.menuBarLayout.percent.isEmpty,
                                       let titleMetric
            {
                "菜单栏：\(titleMetric.title) \(Formatting.percent(mode.percent(used: titleMetric.usedPercent))) \(mode.label)"
            } else {
                nil
            }
            button.toolTip = [titleLine, summary, issues > 0 ? "\(issues) 个异常" : nil]
                .compactMap { $0 }
                .joined(separator: "\n")
        }

        let accessibility: String = if let displayValue {
            mode == .used
                ? "最高已用 \(Formatting.percent(displayValue))"
                : "最低剩余 \(Formatting.percent(displayValue))"
        } else {
            "无数据"
        }
        button.setAccessibilityValue(accessibility)
        self.resizePanel(animated: self.panel.isVisible)
    }

    private func shortState(_ state: ProviderState) -> String {
        switch state {
        case .ok: "正常"
        case let .needsLogin(hint): hint
        case let .failed(message, _): message
        }
    }

    private var screenVisibleFrame: NSRect {
        self.statusItem.button?.window?.screen?.visibleFrame
            ?? NSScreen.main?.visibleFrame
            ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
    }

    private func panelFrame(height: CGFloat, width: CGFloat) -> NSRect {
        let visible = self.screenVisibleFrame
        guard let button = self.statusItem.button, let window = button.window else {
            return NSRect(
                x: visible.maxX - width - 8,
                y: visible.maxY - height - 8,
                width: width,
                height: height)
        }

        let buttonRect = window.convertToScreen(button.convert(button.bounds, to: nil))
        let x = min(
            max(buttonRect.midX - width / 2, visible.minX + 8),
            visible.maxX - width - 8)
        let y = min(
            max(buttonRect.minY - height - 6, visible.minY + 8),
            visible.maxY - height - 8)
        return NSRect(x: x, y: y, width: width, height: height)
    }

    private func resizePanel(animated: Bool) {
        let width = AppLayout.panelWidth
        let maxHeight = min(680, max(240, self.screenVisibleFrame.height - 24))
        let measure = NSHostingView(rootView: PopoverView(store: self.store, forMeasurement: true))
        measure.frame = NSRect(x: 0, y: 0, width: width, height: 0)
        measure.layoutSubtreeIfNeeded()
        let height = min(max(measure.fittingSize.height, 180), maxHeight)
        let frame = self.panelFrame(height: height, width: width)
        guard frame != self.panel.frame else { return }

        if self.panel.isVisible, animated {
            NSAnimationContext.runAnimationGroup { context in
                context.duration = 0.16
                self.panel.animator().setFrame(frame, display: true)
            }
        } else {
            self.panel.setFrame(frame, display: false)
        }
    }

    @objc private func handleClick(_ sender: Any?) {
        if let event = NSApp.currentEvent, event.type == .rightMouseUp {
            if self.panel.isVisible {
                self.hidePopover()
            }
            self.showContextMenu()
        } else {
            self.togglePopover()
        }
    }

    private func togglePopover() {
        if self.panel.isVisible {
            self.hidePopover()
        } else {
            self.showPopover()
        }
    }

    func showPopover() {
        guard !self.panel.isVisible else { return }
        self.resizePanel(animated: false)
        self.panel.makeKeyAndOrderFront(nil)
        self.panel.makeKey()
        self.installEventMonitors()
        Task { await self.store.refresh(manual: false) }
    }

    private func hidePopover() {
        guard self.panel.isVisible else { return }
        self.panel.orderOut(nil)
        self.store.isShowingMenuBarSettings = false
        self.removeEventMonitors()
    }

    private func installEventMonitors() {
        self.removeEventMonitors()

        self.globalClickMonitor = NSEvent.addGlobalMonitorForEvents(
            matching: [.leftMouseDown, .rightMouseDown, .otherMouseDown])
        { [weak self] _ in
            Task { @MainActor in
                self?.hidePopover()
            }
        }

        self.escapeKeyMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { [weak self] event in
            guard event.keyCode == 53 else { return event }
            Task { @MainActor in
                self?.hidePopover()
            }
            return nil
        }

        self.appResignObserver = NotificationCenter.default.addObserver(
            forName: NSApplication.didResignActiveNotification,
            object: nil,
            queue: .main)
        { [weak self] _ in
            Task { @MainActor in
                self?.hidePopover()
            }
        }
    }

    private func removeEventMonitors() {
        if let monitor = self.globalClickMonitor {
            NSEvent.removeMonitor(monitor)
            self.globalClickMonitor = nil
        }
        if let monitor = self.escapeKeyMonitor {
            NSEvent.removeMonitor(monitor)
            self.escapeKeyMonitor = nil
        }
        if let observer = self.appResignObserver {
            NotificationCenter.default.removeObserver(observer)
            self.appResignObserver = nil
        }
    }

    private func showContextMenu() {
        let menu = NSMenu()
        let refresh = NSMenuItem(title: "刷新", action: #selector(self.refreshNow), keyEquivalent: "r")
        refresh.target = self
        menu.addItem(refresh)

        let intervalItem = NSMenuItem(title: "刷新间隔", action: nil, keyEquivalent: "")
        let submenu = NSMenu()
        for minutes in [1, 5, 15, 30, 60] {
            let item = NSMenuItem(
                title: "每 \(minutes) 分钟",
                action: #selector(self.selectInterval(_:)),
                keyEquivalent: "")
            item.tag = minutes * 60
            item.target = self
            item.state = Int(self.store.refreshInterval) == minutes * 60 ? .on : .off
            submenu.addItem(item)
        }
        intervalItem.submenu = submenu
        menu.addItem(intervalItem)

        let launch = NSMenuItem(
            title: "开机启动",
            action: #selector(self.toggleLaunchAtLogin),
            keyEquivalent: "")
        launch.target = self
        launch.state = SMAppService.mainApp.status == .enabled ? .on : .off
        menu.addItem(launch)

        menu.addItem(.separator())
        let quit = NSMenuItem(title: "退出 TokenBar", action: #selector(self.quit), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)

        if let button = self.statusItem.button {
            menu.popUp(
                positioning: nil,
                at: NSPoint(x: 0, y: button.bounds.maxY + 4),
                in: button)
        }
    }

    @objc private func refreshNow() {
        Task { await self.store.refresh(manual: true) }
    }

    @objc private func selectInterval(_ sender: NSMenuItem) {
        self.store.refreshInterval = TimeInterval(sender.tag)
        self.update()
    }

    @objc private func toggleLaunchAtLogin() {
        let status = SMAppService.mainApp.status
        do {
            if status == .enabled {
                try SMAppService.mainApp.unregister()
            } else {
                try SMAppService.mainApp.register()
            }
        } catch {
            NSSound.beep()
        }
    }

    @objc private func quit() {
        NSApplication.shared.terminate(nil)
    }
}
