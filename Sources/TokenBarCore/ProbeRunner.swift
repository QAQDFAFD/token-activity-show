import Foundation

public enum ProbeRunner {
    public static func run(
        paths: Paths = Paths(),
        provider: ProviderID? = nil,
        json: Bool = false) async -> String
    {
        let adapters = ProviderRegistry.adapters(paths: paths)
            .filter { provider == nil || $0.info.id == provider }

        var lines: [String] = []
        if !json {
            lines.append("TokenBar probe · 不输出 token / 邮箱 / 对话内容")
        }

        for adapter in adapters {
            let detection = adapter.detect()
            switch detection {
            case .notInstalled:
                if !json {
                    lines.append("\(adapter.info.id.rawValue.padding(toLength: 9, withPad: " ", startingAt: 0)) 未检测到")
                }
            case let .needsLogin(hint):
                if !json {
                    lines.append("\(adapter.info.id.rawValue.padding(toLength: 9, withPad: " ", startingAt: 0)) 需要登录  \(hint)")
                }
            case let .available(source):
                let report = await adapter.fetch()
                if json {
                    lines.append(Self.jsonLine(report: report, detection: "available(\(source))"))
                } else {
                    lines.append(Self.textLine(report: report, source: source))
                }
            }
        }

        return lines.joined(separator: "\n")
    }

    private static func textLine(report: ProviderReport, source: String) -> String {
        let prefix = report.info.id.rawValue.padding(toLength: 9, withPad: " ", startingAt: 0)
        switch report.state {
        case let .ok(snapshot):
            let windows = snapshot.windows.map { window in
                let percent = Formatting.percent(window.usedPercent)
                let reset = window.resetsAt.map { " @\(ISO8601DateFormatter().string(from: $0))" } ?? ""
                return "\(window.title)=\(percent)\(reset)"
            }.joined(separator: "  ")
            let plan = snapshot.plan.map { "[\($0)] " } ?? ""
            let credits = snapshot.creditBalance.map { "  \($0)" } ?? ""
            return "\(prefix) ok        \(plan)\(windows)\(credits)  (\(source))"
        case let .needsLogin(hint):
            return "\(prefix) 需要登录  \(hint)"
        case let .failed(message, hint):
            let suffix = hint.map { "  → \($0)" } ?? ""
            return "\(prefix) 失败      \(message)\(suffix)"
        }
    }

    private static func jsonLine(report: ProviderReport, detection: String) -> String {
        var payload: [String: Any] = [
            "provider": report.info.id.rawValue,
            "detection": detection,
        ]
        switch report.state {
        case let .ok(snapshot):
            payload["state"] = "ok"
            payload["plan"] = snapshot.plan
            payload["source"] = snapshot.source
            payload["windows"] = snapshot.windows.map { window -> [String: Any] in
                var item: [String: Any] = [
                    "id": window.id,
                    "title": window.title,
                ]
                if let used = window.usedPercent { item["usedPercent"] = used }
                if let resetsAt = window.resetsAt { item["resetsAt"] = ISO8601DateFormatter().string(from: resetsAt) }
                if let detail = window.detail { item["detail"] = detail }
                return item
            }
            if let credits = snapshot.creditBalance { payload["creditBalance"] = credits }
        case let .needsLogin(hint):
            payload["state"] = "needsLogin"
            payload["hint"] = hint
        case let .failed(message, hint):
            payload["state"] = "failed"
            payload["error"] = message
            payload["hint"] = hint
        }
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
              let string = String(data: data, encoding: .utf8)
        else {
            return "{\"provider\":\"\(report.info.id.rawValue)\",\"state\":\"encodeFailed\"}"
        }
        return string
    }
}
