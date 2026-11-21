import Foundation
import TokenBarCore

enum PreviewData {
    static var reports: [ProviderReport] {
        [
            ProviderReport(
                info: ProviderCatalog.info(for: .codex),
                state: .ok(ProviderSnapshot(
                    provider: .codex,
                    plan: "Plus",
                    windows: [
                        UsageWindow(
                            id: "codex-primary",
                            title: "5 小时",
                            usedPercent: 100,
                            resetsAt: Date().addingTimeInterval(6_714)),
                        UsageWindow(
                            id: "codex-secondary",
                            title: "每周",
                            usedPercent: 0,
                            resetsAt: Date().addingTimeInterval(604_800)),
                    ],
                    source: "OAuth"))),
            ProviderReport(
                info: ProviderCatalog.info(for: .claude),
                state: .ok(ProviderSnapshot(
                    provider: .claude,
                    plan: "Max 5×",
                    windows: [
                        UsageWindow(
                            id: "claude-session",
                            title: "5 小时",
                            usedPercent: 38,
                            resetsAt: Date().addingTimeInterval(2 * 3600 + 13 * 60)),
                        UsageWindow(
                            id: "claude-weekly",
                            title: "每周",
                            usedPercent: 61,
                            resetsAt: Date().addingTimeInterval(3 * 86_400)),
                        UsageWindow(
                            id: "claude-sonnet",
                            title: "每周 · Sonnet",
                            usedPercent: 12,
                            resetsAt: Date().addingTimeInterval(3 * 86_400)),
                    ],
                    source: "OAuth"))),
            ProviderReport(
                info: ProviderCatalog.info(for: .cursor),
                state: .ok(ProviderSnapshot(
                    provider: .cursor,
                    plan: "Pro",
                    windows: [
                        UsageWindow(
                            id: "cursor-plan",
                            title: "本月额度",
                            usedPercent: 5,
                            resetsAt: Date().addingTimeInterval(9 * 86_400),
                            detail: "$1.00 / $20.00"),
                        UsageWindow(
                            id: "cursor-on-demand",
                            title: "按需用量",
                            usedPercent: 10,
                            resetsAt: Date().addingTimeInterval(9 * 86_400),
                            detail: "$1.00 / $10.00"),
                    ],
                    source: "Cursor.app"))),
            ProviderReport(
                info: ProviderCatalog.info(for: .copilot),
                state: .ok(ProviderSnapshot(
                    provider: .copilot,
                    plan: "Individual",
                    windows: [
                        UsageWindow(
                            id: "copilot-premium",
                            title: "Premium requests",
                            usedPercent: 100,
                            resetsAt: Date().addingTimeInterval(9 * 86_400),
                            detail: "已用 5 credits"),
                        UsageWindow(
                            id: "copilot-chat",
                            title: "Chat",
                            usedPercent: 0,
                            resetsAt: Date().addingTimeInterval(9 * 86_400)),
                    ],
                    source: "GitHub CLI"))),
            ProviderReport(
                info: ProviderCatalog.info(for: .kimi),
                state: .failed(
                    message: "Kimi Code 登录已过期",
                    hint: "运行 kimi 刷新登录；TokenBar 不会改写 Kimi 的凭据")),
            ProviderReport(
                info: ProviderCatalog.info(for: .antigravity),
                state: .ok(ProviderSnapshot(
                    provider: .antigravity,
                    plan: nil,
                    windows: [
                        UsageWindow(
                            id: "antigravity-gemini-5h",
                            title: "Gemini · 5 小时",
                            usedPercent: 0,
                            resetsAt: Date().addingTimeInterval(5 * 3600)),
                        UsageWindow(
                            id: "antigravity-gemini-weekly",
                            title: "Gemini · 每周",
                            usedPercent: 25,
                            resetsAt: Date().addingTimeInterval(6 * 86_400)),
                        UsageWindow(
                            id: "antigravity-3p-weekly",
                            title: "Claude + GPT · 每周",
                            usedPercent: 0,
                            resetsAt: Date().addingTimeInterval(6 * 86_400)),
                    ],
                    source: "agy CLI"))),
        ]
    }
}
