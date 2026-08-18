import XCTest
@testable import VoidhashPurchaseCoordinators

private final class LockedValue<Value>: @unchecked Sendable {
    private let lock = NSLock()
    private var value: Value
    init(_ value: Value) { self.value = value }
    func get() -> Value { lock.withLock { value } }
    func update(_ body: (inout Value) -> Void) { lock.withLock { body(&value) } }
}

final class AppleIdentifierPolicyTests: XCTestCase {
    func testAttObserverEmitsEachTransitionExactlyOnce() {
        let status = LockedValue("notDetermined")
        let observer = AppleAttTransitionObserver { status.get() }
        XCTAssertEqual(
            observer.observe(source: "system", observedAt: "2026-01-01T00:00:00Z"),
            AppleAttTransition(
                previous: nil,
                current: "notDetermined",
                source: "system",
                observedAt: "2026-01-01T00:00:00Z"
            )
        )
        XCTAssertNil(observer.observe(source: "application", observedAt: "2026-01-01T00:00:01Z"))
        status.update { $0 = "authorized" }
        XCTAssertEqual(
            observer.observe(source: "system", observedAt: "2026-01-01T00:00:02Z")?.previous,
            "notDetermined"
        )
        XCTAssertNil(observer.observe(source: "system", observedAt: "2026-01-01T00:00:03Z"))
    }

    func testIdfaRequiresAuthorizedAttAndStrictBuildNeverReadsProvider() {
        let reads = LockedValue(0)
        let collector = AppleIdentifierCollector(
            providers: [.idfa: {
                reads.update { $0 += 1 }
                return "idfa-secret"
            }],
            vault: { _, _ in "protected-idfa" }
        )
        let denied = collector.collect(.idfa, policy: AppleIdentifierPolicy(
            advertisingIdentifiers: true,
            vendorIdentifiers: true,
            collectionOptOut: false,
            attStatus: "denied",
            strictNoIdfa: false
        ))
        let strict = collector.collect(.idfa, policy: AppleIdentifierPolicy(
            advertisingIdentifiers: true,
            vendorIdentifiers: true,
            collectionOptOut: false,
            attStatus: "authorized",
            strictNoIdfa: true
        ))
        XCTAssertEqual(denied.outcome, "permissionDenied")
        XCTAssertEqual(strict.outcome, "permissionDenied")
        XCTAssertEqual(reads.get(), 0)
    }

    func testAllowedIdentifiersReturnOnlyOpaqueProtectedReference() {
        let vaultedValue = LockedValue<String?>(nil)
        let collector = AppleIdentifierCollector(
            providers: [.idfv: { "vendor-secret" }],
            vault: { _, value in vaultedValue.update { $0 = value }; return "protected-vendor" }
        )
        let result = collector.collect(.idfv, policy: AppleIdentifierPolicy(
            advertisingIdentifiers: false,
            vendorIdentifiers: true,
            collectionOptOut: false,
            attStatus: "notDetermined",
            strictNoIdfa: true
        ))
        XCTAssertEqual(result.protectedReference, "protected-vendor")
        XCTAssertEqual(vaultedValue.get(), "vendor-secret")
        XCTAssertFalse(String(describing: result).contains("vendor-secret"))
    }
}
