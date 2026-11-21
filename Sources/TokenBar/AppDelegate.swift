import AppKit
import TokenBarCore

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var store: UsageStore?
    private var statusController: StatusItemController?
    private var wakeObserver: NSObjectProtocol?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)

        let store = UsageStore()
        self.store = store
        self.statusController = StatusItemController(store: store)
        store.startAutoRefresh()

        Task { await store.refresh(manual: false) }

        if CommandLine.arguments.contains("--show-popover") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self] in
                self?.statusController?.showPopover()
            }
        }

        self.wakeObserver = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didWakeNotification,
            object: nil,
            queue: .main)
        { [weak self] _ in
            Task { @MainActor in
                await self?.store?.refresh(manual: false)
            }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        self.store?.stopAutoRefresh()
        if let wakeObserver = self.wakeObserver {
            NSWorkspace.shared.notificationCenter.removeObserver(wakeObserver)
        }
    }
}
