import Foundation
import XCTest
@testable import VoidhashPurchaseCoordinators

final class PushCollectorTests: XCTestCase {
    func testAPNSTokenConversionIsZeroPaddedLowercaseHex() {
        let collector = VoidhashPushCollector.shared
        collector.didRegister(
            deviceToken: Data([0x00, 0x01, 0x0f, 0x10, 0xab, 0xff]),
            environment: .development
        )
        XCTAssertEqual(collector.currentToken()?.token, "00010f10abff")
        XCTAssertEqual(collector.currentToken()?.environment, .development)
    }

    func testCollectorEmitsTokenChangeAndTypedFailureWithoutTokenMaterial() {
        let collector = VoidhashPushCollector.shared
        var events: [String] = []
        let subscription = collector.subscribe { event in
            switch event {
            case .tokenChanged: events.append("changed")
            case .registrationError(let code): events.append(code)
            }
        }
        defer { collector.unsubscribe(subscription) }
        collector.didRegister(deviceToken: Data([0xde, 0xad]), environment: .production)
        collector.didFailToRegister(code: "APNS_DISABLED")
        XCTAssertEqual(events, ["changed", "APNS_DISABLED"])
        XCTAssertFalse(events.joined().contains("dead"))
    }
}
