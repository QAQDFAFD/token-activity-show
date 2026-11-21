import XCTest
@testable import TokenBarCore

final class ConfigStoreTests: XCTestCase {
    func testConfigFileParsing() throws {
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }

        let file = directory.appendingPathComponent("config.json")
        let json = """
        {
          "githubToken": "gho_test",
          "claudeAccessToken": "sk-ant-test",
          "kimiAccessToken": "kimi-test"
        }
        """
        try Data(json.utf8).write(to: file)

        let store = ConfigStore(url: file)
        let config = store.config()
        XCTAssertEqual(config.githubToken, "gho_test")
        XCTAssertEqual(config.claudeAccessToken, "sk-ant-test")
        XCTAssertEqual(config.kimiAccessToken, "kimi-test")
        XCTAssertNil(config.nousAccessToken)
    }

    func testMissingConfigFileIsEmpty() {
        let file = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        let config = ConfigStore(url: file).config()
        XCTAssertNil(config.githubToken)
        XCTAssertNil(config.claudeAccessToken)
    }
}
