import XCTest
@testable import VoidhashPurchaseCoordinators

private enum FakeConversionError: Error { case failed }

private final class LockedValues<Value>: @unchecked Sendable {
    private let lock = NSLock()
    private var values: [Value] = []

    func append(_ value: Value) { lock.withLock { values.append(value) } }
    func snapshot() -> [Value] { lock.withLock { values } }
}

private final class FakeConversionAdapter: ConversionValuePlatformAdapter, @unchecked Sendable {
    let supportsSKAdNetwork: Bool
    let supportsAdAttributionKit: Bool
    var fail = false
    private(set) var skanUpdates: [ConversionValueUpdate] = []
    private(set) var attributionKitUpdates: [ConversionValueUpdate] = []

    init(skan: Bool = true, attributionKit: Bool = true) {
        supportsSKAdNetwork = skan
        supportsAdAttributionKit = attributionKit
    }

    func updateSKAdNetwork(_ update: ConversionValueUpdate) async throws {
        if fail { throw FakeConversionError.failed }
        skanUpdates.append(update)
    }

    func updateAdAttributionKit(_ update: ConversionValueUpdate) async throws {
        if fail { throw FakeConversionError.failed }
        attributionKitUpdates.append(update)
    }
}

final class ConversionValueEngineTests: XCTestCase {
    private let rules = [
        ConversionValueRule(
            eventName: "trial_started", minimumCount: 1, fineValue: 12,
            coarseValue: .medium, lockWindow: false, window: 1
        ),
        ConversionValueRule(
            eventName: "purchase", minimumCount: 2, fineValue: 31,
            coarseValue: .high, lockWindow: true, window: 1
        ),
    ]

    func testWindowBoundariesMatchThreeAppleConversionWindows() {
        let day: TimeInterval = 86_400
        XCTAssertEqual(ConversionValueEngine.conversionWindow(elapsedSinceFirstLaunch: 0), 1)
        XCTAssertEqual(ConversionValueEngine.conversionWindow(elapsedSinceFirstLaunch: 2 * day), 2)
        XCTAssertEqual(ConversionValueEngine.conversionWindow(elapsedSinceFirstLaunch: 7 * day), 3)
        XCTAssertNil(ConversionValueEngine.conversionWindow(elapsedSinceFirstLaunch: 35 * day))
    }

    func testEvaluationSelectsHighestMatchingValueAndProducesSafeTrace() throws {
        let result = try XCTUnwrap(ConversionValueEngine.evaluate(
            rules: rules,
            eventCounts: ["trial_started": 1, "purchase": 2],
            window: 1
        ))
        XCTAssertEqual(result.fineValue, 31)
        XCTAssertEqual(result.coarseValue, .high)
        XCTAssertTrue(result.lockWindow)
        let encoded = String(decoding: try JSONEncoder().encode(result.trace), as: UTF8.self)
        XCTAssertFalse(encoded.contains("token"))
        XCTAssertFalse(encoded.contains("identifier"))
        XCTAssertFalse(encoded.contains("properties"))
    }

    func testUpdateCallsBothFrameworksAndWritesExactlyOneEvidence() async throws {
        let adapter = FakeConversionAdapter()
        let evidence = LockedValues<ConversionValueEvidence>()
        let engine = ConversionValueEngine(
            adapter: adapter,
            persistRules: { _, _ in true },
            evidenceSink: { evidence.append($0) }
        )
        try engine.applyRules(version: 7, rules: rules)
        let result = await engine.update(
            eventCounts: ["purchase": 2],
            elapsedSinceFirstLaunch: 100,
            attributionAllowed: true
        )
        XCTAssertEqual(result?.outcome, .succeeded)
        XCTAssertEqual(adapter.skanUpdates.count, 1)
        XCTAssertEqual(adapter.attributionKitUpdates.count, 1)
        XCTAssertEqual(evidence.snapshot().count, 1)
        XCTAssertEqual(evidence.snapshot().first?.ruleVersion, 7)
    }

    func testLockedWindowAndPlatformFailureAreRecordedWithoutIllegalCall() async throws {
        let adapter = FakeConversionAdapter()
        let evidence = LockedValues<ConversionValueEvidence>()
        let engine = ConversionValueEngine(
            adapter: adapter,
            persistRules: { _, _ in true },
            evidenceSink: { evidence.append($0) }
        )
        try engine.applyRules(version: 1, rules: rules)
        _ = await engine.update(eventCounts: ["purchase": 2], elapsedSinceFirstLaunch: 1, attributionAllowed: true)
        let locked = await engine.update(eventCounts: ["purchase": 2], elapsedSinceFirstLaunch: 2, attributionAllowed: true)
        XCTAssertEqual(locked?.errorCode, "windowLocked")
        XCTAssertEqual(adapter.skanUpdates.count, 1)
        XCTAssertEqual(evidence.snapshot().count, 2)
    }

    func testNoRulesAndPolicyDenialNeverCallPlatformApis() async throws {
        let adapter = FakeConversionAdapter()
        let evidence = LockedValues<ConversionValueEvidence>()
        let engine = ConversionValueEngine(
            adapter: adapter,
            persistRules: { _, _ in true },
            evidenceSink: { evidence.append($0) }
        )
        XCTAssertEqual(engine.capabilityState, "noRules")
        let noRules = await engine.update(
            eventCounts: ["purchase": 2], elapsedSinceFirstLaunch: 1, attributionAllowed: true
        )
        XCTAssertNil(noRules)
        try engine.applyRules(version: 1, rules: rules)
        let blocked = await engine.update(
            eventCounts: ["purchase": 2], elapsedSinceFirstLaunch: 1, attributionAllowed: false
        )
        XCTAssertEqual(blocked?.outcome, .policyBlocked)
        XCTAssertTrue(adapter.skanUpdates.isEmpty)
        XCTAssertTrue(adapter.attributionKitUpdates.isEmpty)
        XCTAssertEqual(evidence.snapshot().count, 1)
    }

    func testRuleVersionsAreStrictlyMonotonicAndPersisted() throws {
        let persisted = LockedValues<Int64>()
        let engine = ConversionValueEngine(
            adapter: FakeConversionAdapter(),
            persistRules: { version, _ in persisted.append(version); return true },
            evidenceSink: { _ in }
        )
        try engine.applyRules(version: 3, rules: rules)
        XCTAssertThrowsError(try engine.applyRules(version: 2, rules: rules))
        XCTAssertEqual(persisted.snapshot(), [3])
    }
}
