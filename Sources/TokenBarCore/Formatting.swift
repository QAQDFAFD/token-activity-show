import Foundation

public enum Formatting {
    public static func percent(_ value: Double?) -> String {
        guard let value else { return "—" }
        return "\(Int(value.rounded()))%"
    }

    public static func resetDescription(_ date: Date?, now: Date = Date()) -> String? {
        guard let date else { return nil }
        let interval = date.timeIntervalSince(now)
        if interval <= 0 { return "即将重置" }
        if interval < 60 { return "1 分钟内重置" }
        if interval < 3600 {
            let minutes = max(1, Int(interval / 60))
            return "\(minutes) 分钟后重置"
        }
        if interval < 86_400 {
            let hours = Int(interval / 3600)
            let minutes = Int(interval.truncatingRemainder(dividingBy: 3600) / 60)
            if minutes == 0 { return "\(hours) 小时后重置" }
            return "\(hours) 小时 \(minutes) 分后重置"
        }
        if interval < 7 * 86_400 {
            let days = Int(interval / 86_400)
            let hours = Int(interval.truncatingRemainder(dividingBy: 86_400) / 3600)
            if hours == 0 { return "\(days) 天后重置" }
            return "\(days) 天 \(hours) 小时后重置"
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "M月d日 HH:mm 重置"
        return formatter.string(from: date)
    }

    public static func updatedDescription(_ date: Date?, now: Date = Date()) -> String {
        guard let date else { return "尚未刷新" }
        let interval = now.timeIntervalSince(date)
        if interval < 45 { return "刚刚更新" }
        if interval < 3600 { return "\(Int(interval / 60)) 分钟前更新" }
        if interval < 86_400 { return "\(Int(interval / 3600)) 小时前更新" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.dateFormat = "M月d日 HH:mm"
        return "\(formatter.string(from: date)) 更新"
    }

    public static func planLabel(_ raw: String?) -> String? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        let normalized = raw.lowercased()
        if normalized.contains("max_20x") || normalized.contains("max 20x") { return "Max 20×" }
        if normalized.contains("max_5x") || normalized.contains("max 5x") { return "Max 5×" }
        switch normalized {
        case "pro": return "Pro"
        case "max": return "Max"
        case "plus": return "Plus"
        case "free": return "Free"
        case "team": return "Team"
        case "business": return "Business"
        case "enterprise": return "Enterprise"
        case "edu", "education": return "Education"
        case "individual": return "Individual"
        case "go": return "Go"
        case "ultra": return "Ultra"
        case "trial": return "Trial"
        case "student": return "Student"
        default:
            return raw.prefix(1).uppercased() + raw.dropFirst()
        }
    }

    public static func credits(_ value: Double?) -> String? {
        guard let value else { return nil }
        if value >= 1000 {
            return String(format: "%.1fk", value / 1000)
        }
        if value.rounded() == value {
            return String(Int(value))
        }
        return String(format: "%g", value)
    }

    public static func money(cents: Int?) -> String? {
        guard let cents else { return nil }
        return String(format: "$%.2f", Double(cents) / 100)
    }

    public static func money(_ value: Double?) -> String? {
        guard let value else { return nil }
        return String(format: "$%.2f", value)
    }

    public static func windowTitle(seconds: Int?) -> String {
        guard let seconds else { return "额度" }
        switch seconds {
        case 18_000: return "5 小时"
        case 86_400: return "每日"
        case 604_800: return "每周"
        case 2_592_000: return "每月"
        default:
            if seconds < 3600 { return "\(max(1, seconds / 60)) 分钟" }
            if seconds < 86_400 { return "\(seconds / 3600) 小时" }
            return "\(seconds / 86_400) 天"
        }
    }
}
