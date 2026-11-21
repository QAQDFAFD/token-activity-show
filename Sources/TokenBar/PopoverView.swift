import AppKit
import Combine
import ServiceManagement
import SwiftUI
import TokenBarCore

struct PopoverView: View {
    @ObservedObject var store: UsageStore

    @State private var now = Date()
    @State private var launchAtLogin = SMAppService.mainApp.status == .enabled

    private let timer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    var body: some View {
        Group {
            if self.store.isShowingMenuBarSettings {
                MenuBarSettingsView(store: self.store)
            } else {
                self.mainView
            }
        }
        .frame(width: 360)
        .background {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.regularMaterial)
        }
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
        }
        .onReceive(self.timer) { now = $0 }
        .onAppear {
            self.launchAtLogin = SMAppService.mainApp.status == .enabled
        }
    }

    private var mainView: some View {
        VStack(spacing: 0) {
            self.header
            Divider()
            self.content
            Divider()
            self.footer
        }
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 1) {
                Text("TokenBar")
                    .font(.system(size: 13.5, weight: .semibold))
                Text(self.subtitle)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 8)
            Picker("", selection: self.$store.displayMode) {
                ForEach(UsageDisplayMode.allCases) { mode in
                    Text(mode.label).tag(mode)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
            .controlSize(.mini)
            .frame(width: 92)
            Button {
                Task { await self.store.refresh(manual: true) }
            } label: {
                if self.store.isRefreshing {
                    ProgressView()
                        .controlSize(.small)
                        .frame(width: 16, height: 16)
                } else {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12, weight: .medium))
                        .frame(width: 16, height: 16)
                        .contentShape(Rectangle())
                }
            }
            .buttonStyle(.plain)
            .disabled(self.store.isRefreshing)
            .help("立即刷新")
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var subtitle: String {
        if self.store.isRefreshing {
            return "正在刷新…"
        }
        let active = self.store.activeReports.count
        let issues = self.store.reports.count - active
        if active > 0 {
            return issues > 0 ? "\(active) 个可用 · \(issues) 个异常" : "\(active) 个可用"
        }
        if !self.store.reports.isEmpty {
            return "\(self.store.reports.count) 个异常"
        }
        return "自动发现本机订阅"
    }

    @ViewBuilder
    private var content: some View {
        if self.store.reports.isEmpty {
            self.emptyState
        } else {
            ScrollView(.vertical, showsIndicators: false) {
                LazyVStack(spacing: 0) {
                    ForEach(Array(self.store.reports.enumerated()), id: \.element.id) { index, report in
                        ProviderCardView(
                            report: report,
                            now: self.now,
                            displayMode: self.store.displayMode)
                        if index < self.store.reports.count - 1 {
                            Divider()
                                .padding(.leading, 42)
                        }
                    }
                }
            }
            .frame(maxHeight: 600)
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 11) {
            HStack(spacing: 8) {
                Image(systemName: "gauge.with.dots.needle.0percent")
                    .font(.system(size: 16))
                    .foregroundStyle(.secondary)
                VStack(alignment: .leading, spacing: 1) {
                    Text("未检测到本地 AI 订阅")
                        .font(.system(size: 12.5, weight: .medium))
                    Text("登录任一工具后，额度会自动出现在菜单栏。")
                        .font(.system(size: 10.5))
                        .foregroundStyle(.secondary)
                }
            }

            VStack(alignment: .leading, spacing: 5) {
                LoginCommandRow(command: "codex login", label: "OpenAI Codex")
                LoginCommandRow(command: "agy", label: "Antigravity")
                LoginCommandRow(command: "kimi", label: "Kimi Code")
                LoginCommandRow(command: "hermes auth add nous", label: "Nous Portal")
                LoginCommandRow(command: "~/.config/tokenbar/config.json", label: "Claude / Copilot")
            }
            .padding(10)
            .background {
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(Color.primary.opacity(0.04))
            }

            Text("TokenBar 不读取 macOS 钥匙串；Claude 和 Copilot 的 token 请写入配置文件。")
                .font(.system(size: 9.5))
                .foregroundStyle(.tertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
    }

    private var footer: some View {
        HStack(spacing: 8) {
            Text("每 \(Int(self.store.refreshInterval / 60)) 分钟 · \(Formatting.updatedDescription(self.store.lastUpdated, now: self.now))")
                .font(.system(size: 9.5))
                .foregroundStyle(.tertiary)
                .lineLimit(1)
            Spacer(minLength: 4)
            self.settingsMenu
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 7)
    }

    private var settingsMenu: some View {
        Menu {
            Button {
                self.store.isShowingMenuBarSettings = true
            } label: {
                Label("菜单栏显示…", systemImage: "menubar.rectangle")
            }

            Divider()

            Menu("刷新间隔") {
                ForEach([60.0, 300.0, 900.0, 1800.0, 3600.0], id: \.self) { interval in
                    Button {
                        self.store.refreshInterval = interval
                    } label: {
                        if self.store.refreshInterval == interval {
                            Label("每 \(Int(interval / 60)) 分钟", systemImage: "checkmark")
                        } else {
                            Text("每 \(Int(interval / 60)) 分钟")
                        }
                    }
                }
            }

            Divider()

            Button {
                self.setLaunchAtLogin(!self.launchAtLogin)
            } label: {
                if self.launchAtLogin {
                    Label("开机启动", systemImage: "checkmark")
                } else {
                    Text("开机启动")
                }
            }

            Divider()

            Button("退出 TokenBar") {
                NSApplication.shared.terminate(nil)
            }
        } label: {
            Image(systemName: "gearshape")
                .font(.system(size: 11, weight: .medium))
                .frame(width: 16, height: 16)
                .contentShape(Rectangle())
        }
        .menuStyle(.borderlessButton)
        .menuIndicator(.hidden)
        .fixedSize()
        .help("设置")
    }

    private func setLaunchAtLogin(_ enabled: Bool) {
        do {
            if enabled {
                try SMAppService.mainApp.register()
            } else {
                try SMAppService.mainApp.unregister()
            }
            self.launchAtLogin = enabled
        } catch {
            self.launchAtLogin = SMAppService.mainApp.status == .enabled
        }
    }
}

private struct LoginCommandRow: View {
    let command: String
    let label: String

    var body: some View {
        HStack(spacing: 6) {
            Text(self.label)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .frame(width: 104, alignment: .leading)
            Text(self.command)
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(.primary.opacity(0.75))
                .lineLimit(1)
            Spacer(minLength: 0)
        }
    }
}
