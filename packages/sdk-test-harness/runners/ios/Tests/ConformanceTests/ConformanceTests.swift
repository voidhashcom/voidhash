import XCTest

@testable import ConformanceCore

final class ConformanceTests: XCTestCase {
    func testMobileCoreSuite() throws {
        let baseUrlString = ProcessInfo.processInfo.environment["HARNESS_URL"]
            ?? "http://127.0.0.1:4919"
        guard let baseUrl = URL(string: baseUrlString) else {
            XCTFail("invalid HARNESS_URL: \(baseUrlString)")
            return
        }
        try ConformanceRunner.run(suiteName: "mobile/core", baseUrl: baseUrl)
    }
}
