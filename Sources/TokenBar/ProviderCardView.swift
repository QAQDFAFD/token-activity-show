import AppKit
import SwiftUI
import TokenBarCore

struct ProviderCardView: View {
    let report: ProviderReport
    let now: Date
    let displayMode: UsageDisplayMode

    private var tint: Color {
        Color(hex: report.info.tintHex)
    }

    var body: some View {
        switch report.state {
        case let .ok(snapshot):
            self.okView(snapshot)
        case let .needsLogin(hint):
            self.messageView(
                title: report.info.name,
                message: "需要登录",
                detail: hint,
                messageColor: .secondary)
        case let .failed(message, hint):
            self.messageView(
                title: report.info.name,
                message: message,
                detail: hint,
                messageColor: .orange)
        }
    }

    private func okView(_ snapshot: ProviderSnapshot) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack(spacing: 8) {
                ProviderLogo(info: self.report.info)
                Text(self.report.info.name)
                    .font(.system(size: 12.5, weight: .semibold))
                if let plan = snapshot.plan {
                    PlanPill(text: plan)
                }
                Spacer(minLength: 0)
            }

            if !snapshot.windows.isEmpty {
                VStack(spacing: 7) {
                    ForEach(snapshot.windows) { window in
                        UsageWindowRow(
                            window: window,
                            tint: self.tint,
                            now: self.now,
                            displayMode: self.displayMode)
                    }
                }
                .padding(.leading, 28)
            }

            if let credits = snapshot.creditBalance {
                HStack(spacing: 5) {
                    Image(systemName: "creditcard")
                        .font(.system(size: 9))
                    Text(credits)
                        .font(.system(size: 10))
                }
                .foregroundStyle(.secondary)
                .padding(.leading, 28)
            }

            if let note = snapshot.note, !snapshot.windows.isEmpty {
                Text(note)
                    .font(.system(size: 9.5))
                    .foregroundStyle(.tertiary)
                    .padding(.leading, 28)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .contentShape(Rectangle())
        .contextMenu {
            if let url = self.report.info.dashboardURL {
                Button("打开用量页面") {
                    NSWorkspace.shared.open(url)
                }
            }
        }
    }

    private func messageView(
        title: String,
        message: String,
        detail: String?,
        messageColor: Color) -> some View
    {
        HStack(alignment: .top, spacing: 8) {
            ProviderLogo(info: self.report.info)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 12.5, weight: .semibold))
                Text(message)
                    .font(.system(size: 10.5))
                    .foregroundStyle(messageColor)
                if let detail {
                    Text(detail)
                        .font(.system(size: 9.5))
                        .foregroundStyle(.tertiary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .contextMenu {
            if let url = self.report.info.dashboardURL {
                Button("打开用量页面") {
                    NSWorkspace.shared.open(url)
                }
            }
        }
    }
}

private struct PlanPill: View {
    let text: String

    var body: some View {
        Text("· \(text)")
            .font(.system(size: 10))
            .foregroundStyle(.secondary)
            .lineLimit(1)
    }
}

private struct UsageWindowRow: View {
    let window: UsageWindow
    let tint: Color
    let now: Date
    let displayMode: UsageDisplayMode

    private var fillColor: Color {
        SeverityColor.color(for: window.usedPercent, tint: self.tint)
    }

    private var percentColor: Color {
        guard let used = self.window.usedPercent else { return .secondary }
        return used >= 90 ? .red : .primary
    }

    var body: some View {
        let displayedPercent = self.window.percent(for: self.displayMode)

        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 5) {
                Text(self.window.title)
                    .font(.system(size: 11.5))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)

                if let reset = Formatting.resetDescription(self.window.resetsAt, now: self.now) {
                    Text("· \(reset)")
                        .font(.system(size: 9.5))
                        .foregroundStyle(.tertiary)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }

                Spacer(minLength: 6)

                Text(Formatting.percent(displayedPercent))
                    .font(.system(size: 11.5, weight: .medium, design: .monospaced))
                    .foregroundStyle(self.percentColor)
                if self.window.usedPercent != nil {
                    Text(self.displayMode.label)
                        .font(.system(size: 9))
                        .foregroundStyle(.tertiary)
                }
            }

            UsageBar(percent: displayedPercent, color: self.fillColor)

            if let detail = self.window.detail {
                Text(detail)
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

private struct UsageBar: View {
    let percent: Double?
    let color: Color

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule(style: .continuous)
                    .fill(Color.primary.opacity(0.07))
                if let percent, percent > 0 {
                    Capsule(style: .continuous)
                        .fill(self.color)
                        .frame(width: max(2, proxy.size.width * CGFloat(min(100, max(0, percent)) / 100)))
                }
            }
        }
        .frame(height: 3.5)
    }
}
