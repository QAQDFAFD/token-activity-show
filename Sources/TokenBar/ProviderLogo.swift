import AppKit
import SwiftUI
import TokenBarCore

enum ProviderIconAssets {
    static func image(for id: ProviderID) -> NSImage? {
        let name = "ProviderIcon-\(id.rawValue)"
        guard let url = Bundle.module.url(forResource: name, withExtension: "png") else {
            return nil
        }
        return NSImage(contentsOf: url)
    }

    /// Monochrome official glyphs are rendered as template images so they adapt to light/dark mode.
    static func isTemplate(_ id: ProviderID) -> Bool {
        switch id {
        case .cursor, .copilot, .kimi, .nous, .windsurf:
            return true
        case .claude, .codex, .antigravity:
            return false
        }
    }

    static func tint(_ id: ProviderID) -> Color {
        switch id {
        case .windsurf:
            return Color(hex: "#0EA5E9")
        default:
            return .primary
        }
    }
}

struct ProviderLogo: View {
    let info: ProviderInfo

    var body: some View {
        Group {
            if let image = ProviderIconAssets.image(for: info.id) {
                Image(nsImage: image)
                    .renderingMode(ProviderIconAssets.isTemplate(info.id) ? .template : .original)
                    .resizable()
                    .interpolation(.high)
                    .aspectRatio(contentMode: .fit)
                    .foregroundStyle(ProviderIconAssets.tint(info.id))
            } else {
                Image(systemName: info.symbolName)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Color(hex: info.tintHex))
            }
        }
        .frame(width: 20, height: 20)
    }
}
