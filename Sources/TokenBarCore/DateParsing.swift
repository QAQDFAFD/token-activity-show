import Foundation

public enum DateParsing {
    public static func iso8601(_ raw: String?) -> Date? {
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: raw) { return date }

        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        if let date = plain.date(from: raw) { return date }

        // Some providers return an ISO date without a timezone.
        let local = DateFormatter()
        local.locale = Locale(identifier: "en_US_POSIX")
        local.timeZone = TimeZone(secondsFromGMT: 0)
        local.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return local.date(from: raw)
    }

    public static func loose(_ raw: String?) -> Date? {
        if let date = self.iso8601(raw) { return date }
        guard let raw = raw?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: raw)
    }

    public static func epoch(_ value: Any?) -> Date? {
        guard let number = JSONValue.double(value), number > 0 else { return nil }
        // Providers use both seconds and milliseconds.
        if number > 10_000_000_000 {
            return Date(timeIntervalSince1970: number / 1000)
        }
        return Date(timeIntervalSince1970: number)
    }

    public static func unixSeconds(_ value: Any?) -> Date? {
        guard let number = JSONValue.double(value), number > 0 else { return nil }
        return Date(timeIntervalSince1970: number)
    }
}

public enum JWT {
    public static func payload(_ token: String?) -> [String: Any]? {
        guard let token = token?.trimmingCharacters(in: .whitespacesAndNewlines), !token.isEmpty else {
            return nil
        }
        let parts = token.split(separator: ".", omittingEmptySubsequences: false)
        guard parts.count >= 2 else { return nil }
        var payload = String(parts[1])
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        while payload.count % 4 != 0 {
            payload.append("=")
        }
        guard let data = Data(base64Encoded: payload),
              let dictionary = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return nil
        }
        return dictionary
    }

    public static func expiry(_ token: String?) -> Date? {
        guard let exp = self.payload(token)?["exp"] as? Double else { return nil }
        return Date(timeIntervalSince1970: exp)
    }

    public static func string(_ token: String?, _ key: String) -> String? {
        JSONValue.string(self.payload(token)?[key])
    }

    public static func string(_ token: String?, path: [String]) -> String? {
        guard var current = self.payload(token), let last = path.last else { return nil }
        for key in path.dropLast() {
            guard let next = current[key] as? [String: Any] else { return nil }
            current = next
        }
        return JSONValue.string(current[last])
    }
}
