import Foundation

public enum ProviderCatalog {
    public static let all: [ProviderInfo] = [
        ProviderInfo(
            id: .claude,
            name: "Claude Code",
            shortName: "Claude",
            symbolName: "sparkles",
            tintHex: "#D97757",
            dashboardURL: URL(string: "https://claude.ai/settings/usage"),
            loginHint: "运行 claude 登录"),
        ProviderInfo(
            id: .codex,
            name: "OpenAI Codex",
            shortName: "Codex",
            symbolName: "terminal",
            tintHex: "#10A37F",
            dashboardURL: URL(string: "https://chatgpt.com/codex/cloud/settings/analytics#usage"),
            loginHint: "运行 codex login 登录"),
        ProviderInfo(
            id: .antigravity,
            name: "Antigravity",
            shortName: "Antigravity",
            symbolName: "sparkles",
            tintHex: "#4285F4",
            dashboardURL: URL(string: "https://antigravity.google"),
            loginHint: "运行 agy 登录 Antigravity"),
        ProviderInfo(
            id: .cursor,
            name: "Cursor",
            shortName: "Cursor",
            symbolName: "cursorarrow.rays",
            tintHex: "#7C6CFF",
            dashboardURL: URL(string: "https://cursor.com/dashboard?tab=usage"),
            loginHint: "打开 Cursor 并登录"),
        ProviderInfo(
            id: .copilot,
            name: "GitHub Copilot",
            shortName: "Copilot",
            symbolName: "chevron.left.forwardslash.chevron.right",
            tintHex: "#8957E5",
            dashboardURL: URL(string: "https://github.com/settings/copilot"),
            loginHint: "运行 gh auth login 登录"),
        ProviderInfo(
            id: .kimi,
            name: "Kimi Code",
            shortName: "Kimi",
            symbolName: "moon.stars.fill",
            tintHex: "#8B5CF6",
            dashboardURL: URL(string: "https://www.kimi.com/code/console"),
            loginHint: "运行 kimi 登录"),
        ProviderInfo(
            id: .nous,
            name: "Nous Portal",
            shortName: "Nous",
            symbolName: "brain.head.profile",
            tintHex: "#D4A017",
            dashboardURL: URL(string: "https://portal.nousresearch.com"),
            loginHint: "运行 hermes auth add nous 登录"),
        ProviderInfo(
            id: .windsurf,
            name: "Windsurf",
            shortName: "Windsurf",
            symbolName: "wind",
            tintHex: "#0EA5E9",
            dashboardURL: URL(string: "https://windsurf.com/profile"),
            loginHint: "打开 Windsurf 并登录"),
    ]

    public static func info(for id: ProviderID) -> ProviderInfo {
        self.all.first { $0.id == id } ?? self.all[0]
    }
}
