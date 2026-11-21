import AppKit
import SwiftUI
import TokenBarCore

@main
enum TokenBarMain {
    @MainActor
    static func main() async {
        let arguments = CommandLine.arguments
        if arguments.contains("--help") || arguments.contains("-h") {
            print(Self.usage)
            return
        }

        if let path = Self.value(after: "--preview", in: arguments) {
            let appearance = Self.value(after: "--appearance", in: arguments)
            Self.renderPreview(
                path: path,
                appearance: appearance,
                empty: arguments.contains("--preview-empty"))
            return
        }

        if arguments.contains("--dump") {
            let store = UsageStore()
            let start = Date()
            await store.refresh(manual: false)
            print("refreshed in \(String(format: "%.2f", Date().timeIntervalSince(start)))s")
            for report in store.reports {
                switch report.state {
                case let .ok(snapshot):
                    let windows = snapshot.windows.map { "\($0.title)=\(Formatting.percent($0.usedPercent))" }
                    print("\(report.info.id.rawValue): ok plan=\(snapshot.plan ?? "-") \(windows.joined(separator: " "))")
                case let .needsLogin(hint):
                    print("\(report.info.id.rawValue): needsLogin \(hint)")
                case let .failed(message, hint):
                    print("\(report.info.id.rawValue): failed \(message) \(hint ?? "")")
                }
            }
            return
        }

        if arguments.contains("--probe") {
            let provider = Self.value(after: "--provider", in: arguments).flatMap(Self.providerID)
            let json = arguments.contains("--json")
            let output = await ProbeRunner.run(
                provider: provider,
                json: json)
            print(output)
            return
        }

        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)
        app.run()
    }

    private static func value(after flag: String, in arguments: [String]) -> String? {
        guard let index = arguments.firstIndex(of: flag),
              index + 1 < arguments.count
        else {
            return nil
        }
        return arguments[index + 1]
    }

    private static func providerID(_ raw: String) -> ProviderID? {
        switch raw.lowercased() {
        case "openai", "openai-codex", "chatgpt": return .codex
        case "claude-code": return .claude
        case "gemini", "antigravity-cli": return .antigravity
        case "github": return .copilot
        case "nous-portal", "hermes": return .nous
        default: return ProviderID(rawValue: raw.lowercased())
        }
    }

    @MainActor
    private static func renderPreview(path: String, appearance: String?, empty: Bool) {
        let app = NSApplication.shared
        app.setActivationPolicy(.prohibited)
        if appearance == "light" {
            app.appearance = NSAppearance(named: .aqua)
        } else if appearance == "dark" {
            app.appearance = NSAppearance(named: .darkAqua)
        }

        let store = UsageStore(previewReports: empty ? [] : PreviewData.reports)
        if CommandLine.arguments.contains("--remaining") {
            store.displayMode = .remaining
        }
        if CommandLine.arguments.contains("--preview-settings") {
            store.isShowingMenuBarSettings = true
        }
        if CommandLine.arguments.contains("--preview-configured") {
            store.menuBarLayout = MenuBarLayout(
                bars: [
                    MenuBarLayoutResolver.windowID(provider: .cursor, window: "cursor-plan"),
                    "",
                    "",
                ],
                percent: MenuBarLayoutResolver.windowID(
                    provider: .antigravity,
                    window: "antigravity-gemini-weekly"))
        }
        let view = PopoverView(store: store)
        let measure = NSHostingView(rootView: view)
        measure.frame = NSRect(x: 0, y: 0, width: 360, height: 0)
        measure.layoutSubtreeIfNeeded()
        let height = max(measure.fittingSize.height, 180)
        let hosting = NSHostingView(rootView: view)
        hosting.frame = NSRect(x: 0, y: 0, width: 360, height: height)
        hosting.layoutSubtreeIfNeeded()

        guard let representation = hosting.bitmapImageRepForCachingDisplay(in: hosting.bounds) else {
            print("Could not render preview")
            return
        }
        hosting.cacheDisplay(in: hosting.bounds, to: representation)
        guard let png = representation.representation(using: .png, properties: [:]) else {
            print("Could not encode preview")
            return
        }
        do {
            try png.write(to: URL(fileURLWithPath: path))
            print("Preview written to \(path)")
        } catch {
            print("Could not write preview: \(error.localizedDescription)")
        }
    }

    private static let usage = """
    TokenBar 0.1.0

    用法:
      TokenBar                      启动菜单栏应用
      TokenBar --probe [--json]     读取本机订阅并打印额度（不输出密钥）
        --provider <id>             只探测指定来源：claude codex antigravity cursor copilot kimi nous windsurf
        --json                      输出逐行 JSON
      TokenBar --dump               走完整刷新流程并打印脱敏结果
      TokenBar --preview <path>     用示例数据渲染弹窗 PNG
        --appearance light|dark     预览外观
        --preview-empty             渲染空状态
        --preview-settings          渲染菜单栏显示设置
        --preview-configured        预览中使用示例菜单栏配置
        --remaining                 预览“剩余额度”视角

    构建:
      swift build -c release
      ./scripts/package_app.sh
      open dist/TokenBar.app
    """
}
