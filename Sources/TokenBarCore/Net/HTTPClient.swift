import Foundation

public struct HTTPResponse: Sendable {
    public let data: Data
    public let statusCode: Int

    public init(data: Data, statusCode: Int) {
        self.data = data
        self.statusCode = statusCode
    }
}

public enum HTTPError: Error, LocalizedError, Sendable, Equatable {
    case invalidResponse
    case status(Int)
    case timedOut
    case network(String)

    public var errorDescription: String? {
        switch self {
        case .invalidResponse: "服务器返回了无法识别的响应"
        case let .status(code): "HTTP \(code)"
        case .timedOut: "请求超时"
        case let .network(message): message
        }
    }
}

public enum FormURLEncoding {
    public static func body(_ pairs: [(String, String)]) -> Data {
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")
        let encoded = pairs.map { key, value in
            let k = key.addingPercentEncoding(withAllowedCharacters: allowed) ?? key
            let v = value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
            return "\(k)=\(v)"
        }.joined(separator: "&")
        return Data(encoded.utf8)
    }
}

public final class HTTPClient: @unchecked Sendable {
    public static var shared = HTTPClient()

    private let session: URLSession
    private let redirectGuard: RedirectGuard

    public init(configuration: URLSessionConfiguration = HTTPClient.defaultConfiguration()) {
        let redirect = RedirectGuard()
        self.redirectGuard = redirect
        self.session = URLSession(
            configuration: configuration,
            delegate: redirect,
            delegateQueue: nil)
    }

    public static func defaultConfiguration() -> URLSessionConfiguration {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 20
        configuration.timeoutIntervalForResource = 35
        configuration.httpShouldSetCookies = false
        configuration.httpCookieStorage = nil
        configuration.urlCache = nil
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        return configuration
    }

    public func get(
        _ url: URL,
        headers: [String: String] = [:],
        timeout: TimeInterval = 20) async throws -> HTTPResponse
    {
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeout)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("TokenBar/0.1 (macOS)", forHTTPHeaderField: "User-Agent")
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        return try await self.perform(request)
    }

    public func postForm(
        _ url: URL,
        pairs: [(String, String)],
        headers: [String: String] = [:],
        timeout: TimeInterval = 20) async throws -> HTTPResponse
    {
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.httpBody = FormURLEncoding.body(pairs)
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("TokenBar/0.1 (macOS)", forHTTPHeaderField: "User-Agent")
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        return try await self.perform(request)
    }

    public func postJSON(
        _ url: URL,
        body: [String: Any],
        headers: [String: String] = [:],
        timeout: TimeInterval = 20) async throws -> HTTPResponse
    {
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeout)
        request.httpMethod = "POST"
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("TokenBar/0.1 (macOS)", forHTTPHeaderField: "User-Agent")
        for (key, value) in headers {
            request.setValue(value, forHTTPHeaderField: key)
        }
        return try await self.perform(request)
    }

    private func perform(_ request: URLRequest) async throws -> HTTPResponse {
        do {
            let (data, response) = try await self.session.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw HTTPError.invalidResponse
            }
            return HTTPResponse(data: data, statusCode: http.statusCode)
        } catch let error as HTTPError {
            throw error
        } catch let error as URLError where error.code == .timedOut {
            throw HTTPError.timedOut
        } catch let error as URLError {
            if error.code == .cancelled { throw CancellationError() }
            throw HTTPError.network(error.localizedDescription)
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            throw HTTPError.network(error.localizedDescription)
        }
    }

    private final class RedirectGuard: NSObject, URLSessionTaskDelegate {
        func urlSession(
            _ session: URLSession,
            task: URLSessionTask,
            willPerformHTTPRedirection response: HTTPURLResponse,
            newRequest request: URLRequest,
            completionHandler: @escaping (URLRequest?) -> Void)
        {
            // Never forward credentials to a different host.
            guard let originalHost = task.originalRequest?.url?.host,
                  let newHost = request.url?.host,
                  originalHost.caseInsensitiveCompare(newHost) == .orderedSame
            else {
                completionHandler(nil)
                return
            }
            completionHandler(request)
        }
    }
}
