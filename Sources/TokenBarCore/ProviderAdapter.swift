import Foundation

public protocol ProviderAdapter: Sendable {
    var info: ProviderInfo { get }
    func detect() -> ProviderDetection
    func fetch() async -> ProviderReport
}

public extension ProviderAdapter {
    func failureReport(_ error: Error) -> ProviderReport {
        if let providerError = error as? ProviderError {
            return ProviderReport(
                info: self.info,
                state: .failed(message: providerError.message, hint: providerError.hint))
        }
        return ProviderReport(
            info: self.info,
            state: .failed(message: error.localizedDescription, hint: nil))
    }
}
