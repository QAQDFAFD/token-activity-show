import AppKit
import SwiftUI
import TokenBarCore

struct MenuBarSettingsView: View {
    @ObservedObject var store: UsageStore

    private var layout: MenuBarLayout {
        self.store.menuBarLayout.normalized
    }

    private var metrics: [MenuBarMetric] {
        MenuBarLayoutResolver.metrics(from: self.store.activeReports)
    }

    var body: some View {
        VStack(spacing: 0) {
            self.header
            Divider()
            ScrollView(.vertical, showsIndicators: false) {
                VStack(alignment: .leading, spacing: 14) {
                    self.preview
                    self.sectionTitle("左侧柱子")
                    ForEach(0 ..< 3, id: \.self) { index in
                        self.slotRow(
                            label: "柱子 \(index + 1)",
                            selection: self.bindingForBar(index))
                    }
                    self.sectionTitle("右侧百分比")
                    self.slotRow(
                        label: "百分比",
                        selection: self.bindingForPercent)
                    Text("“自动”会按额度紧张程度填充；选择具体来源或窗口后，该位置固定显示对应额度。")
                        .font(.system(size: 9.5))
                        .foregroundStyle(.tertiary)
                        .fixedSize(horizontal: false, vertical: true)
                    Button("恢复默认") {
                        self.store.menuBarLayout = .defaultValue
                    }
                    .buttonStyle(.plain)
                    .font(.system(size: 10.5))
                    .foregroundStyle(.secondary)
                }
                .padding(14)
            }
            .frame(maxHeight: 520)
        }
    }

    private var header: some View {
        HStack(spacing: 8) {
            Button {
                self.store.isShowingMenuBarSettings = false
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 11, weight: .semibold))
                    .frame(width: 16, height: 16)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            Text("菜单栏显示")
                .font(.system(size: 13, weight: .semibold))
            Spacer()
            Button("完成") {
                self.store.isShowingMenuBarSettings = false
            }
            .buttonStyle(.plain)
            .font(.system(size: 10.5))
            .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
    }

    private var preview: some View {
        let values = MenuBarLayoutResolver.barValues(
            layout: self.store.menuBarLayout,
            reports: self.store.activeReports,
            mode: self.store.displayMode)
        let title = MenuBarLayoutResolver.titleValue(
            layout: self.store.menuBarLayout,
            reports: self.store.activeReports,
            mode: self.store.displayMode)
        let color: Color = if let used = title.used, used >= 90 {
            .red
        } else {
            .primary
        }

        return VStack(alignment: .leading, spacing: 6) {
            Text("菜单栏预览")
                .font(.system(size: 9))
                .foregroundStyle(.tertiary)
            HStack(spacing: 7) {
                Image(nsImage: MeterIcon.makeImage(percents: values))
                    .resizable()
                    .interpolation(.high)
                    .foregroundStyle(.primary)
                    .frame(width: 24, height: 18)
                Text(title.display.map(Formatting.percent) ?? "—")
                    .font(.system(size: 12, weight: .medium, design: .monospaced))
                    .foregroundStyle(color)
            }
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .padding(10)
        .background {
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.primary.opacity(0.05))
        }
    }

    private func sectionTitle(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 9.5, weight: .medium))
            .foregroundStyle(.tertiary)
    }

    private func slotRow(label: String, selection: Binding<String>) -> some View {
        HStack(spacing: 8) {
            Text(label)
                .font(.system(size: 11.5))
                .frame(width: 58, alignment: .leading)
            Spacer(minLength: 4)
            Picker("", selection: selection) {
                Text("自动").tag("")
                ForEach(self.metrics) { metric in
                    Text(metric.title).tag(metric.id)
                }
                if !selection.wrappedValue.isEmpty,
                   !self.metrics.contains(where: { $0.id == selection.wrappedValue })
                {
                    Text("当前选择（暂不可用）").tag(selection.wrappedValue)
                }
            }
            .pickerStyle(.menu)
            .labelsHidden()
            .controlSize(.small)
            .frame(width: 240)
        }
    }

    private func bindingForBar(_ index: Int) -> Binding<String> {
        Binding(
            get: {
                let bars = self.layout.bars
                return index < bars.count ? bars[index] : ""
            },
            set: { value in
                var bars = self.layout.bars
                while bars.count < 3 { bars.append("") }
                bars[index] = value
                self.store.menuBarLayout = MenuBarLayout(bars: bars, percent: self.layout.percent)
            })
    }

    private var bindingForPercent: Binding<String> {
        Binding(
            get: { self.layout.percent },
            set: { value in
                self.store.menuBarLayout = MenuBarLayout(bars: self.layout.bars, percent: value)
            })
    }
}
