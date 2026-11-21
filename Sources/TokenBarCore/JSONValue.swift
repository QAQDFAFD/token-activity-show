import Foundation

public enum JSONValue {
    public static func dictionary(_ data: Data) -> [String: Any]? {
        try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    public static func array(_ data: Data) -> [Any]? {
        try? JSONSerialization.jsonObject(with: data) as? [Any]
    }

    public static func string(_ value: Any?) -> String? {
        switch value {
        case let value as String:
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        case let value as NSNumber:
            return value.stringValue
        default:
            return nil
        }
    }

    public static func double(_ value: Any?) -> Double? {
        switch value {
        case let value as Double:
            return value.isFinite ? value : nil
        case let value as Int:
            return Double(value)
        case let value as NSNumber:
            let double = value.doubleValue
            return double.isFinite ? double : nil
        case let value as String:
            guard let double = Double(value.trimmingCharacters(in: .whitespacesAndNewlines)),
                  double.isFinite
            else { return nil }
            return double
        default:
            return nil
        }
    }

    public static func int(_ value: Any?) -> Int? {
        switch value {
        case let value as Int:
            return value
        case let value as Double:
            guard value.isFinite, value >= Double(Int.min), value <= Double(Int.max) else { return nil }
            return Int(value)
        case let value as NSNumber:
            return value.intValue
        case let value as String:
            return Int(value.trimmingCharacters(in: .whitespacesAndNewlines))
        default:
            return nil
        }
    }

    public static func bool(_ value: Any?) -> Bool? {
        switch value {
        case let value as Bool:
            return value
        case let value as NSNumber:
            return value.boolValue
        case let value as String:
            switch value.lowercased() {
            case "true", "1", "yes": return true
            case "false", "0", "no": return false
            default: return nil
            }
        default:
            return nil
        }
    }

    public static func nested(_ dictionary: [String: Any], _ keys: String...) -> Any? {
        var current: Any? = dictionary
        for key in keys {
            guard let value = current as? [String: Any] else { return nil }
            current = value[key]
        }
        return current
    }

    public static func dictionary(_ value: Any?) -> [String: Any]? {
        value as? [String: Any]
    }

    public static func array(_ value: Any?) -> [Any]? {
        value as? [Any]
    }
}

public enum FlexibleNumber {
    public static func double<K: CodingKey>(_ container: KeyedDecodingContainer<K>, _ key: K) -> Double? {
        if let value = try? container.decodeIfPresent(Double.self, forKey: key) {
            return value.isFinite ? value : nil
        }
        if let value = try? container.decodeIfPresent(Int.self, forKey: key) {
            return Double(value)
        }
        if let value = try? container.decodeIfPresent(String.self, forKey: key) {
            return Double(value.trimmingCharacters(in: .whitespacesAndNewlines))
        }
        return nil
    }
}
