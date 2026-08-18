import Foundation
#if os(iOS)
import StoreKit
#endif

enum ConversionValueCoarse: String, Codable, Sendable {
    case low
    case medium
    case high
}

struct ConversionValueRule: Codable, Equatable, Sendable {
    let eventName: String
    let minimumCount: Int
    let fineValue: Int
    let coarseValue: ConversionValueCoarse?
    let lockWindow: Bool
    let window: Int
}

struct ConversionValueEvaluation: Equatable, Sendable {
    let fineValue: Int
    let coarseValue: ConversionValueCoarse?
    let lockWindow: Bool
    let window: Int
    let trace: [ConversionValueTraceEntry]
}

struct ConversionValueTraceEntry: Codable, Equatable, Sendable {
    let eventName: String
    let matched: Bool
    let minimumCount: Int
    let observedCount: Int
    let window: Int
}

struct ConversionValueUpdate: Equatable, Sendable {
    let fineValue: Int
    let coarseValue: ConversionValueCoarse?
    let lockWindow: Bool
    let window: Int
}

enum ConversionValueUpdateOutcome: String, Codable, Sendable {
    case succeeded
    case failed
    case policyBlocked
}

struct ConversionValueEvidence: Codable, Equatable, Sendable {
    let ruleVersion: Int64
    let fineValue: Int
    let coarseValue: ConversionValueCoarse?
    let lockWindow: Bool
    let window: Int
    let outcome: ConversionValueUpdateOutcome
    let errorCode: String?
    let trace: [ConversionValueTraceEntry]
}

enum ConversionValueEngineError: Error, Equatable {
    case invalidRules
    case versionReplay
}

protocol ConversionValuePlatformAdapter: Sendable {
    var supportsSKAdNetwork: Bool { get }
    var supportsAdAttributionKit: Bool { get }
    func updateSKAdNetwork(_ update: ConversionValueUpdate) async throws
    func updateAdAttributionKit(_ update: ConversionValueUpdate) async throws
}

struct SystemConversionValuePlatformAdapter: ConversionValuePlatformAdapter {
    var supportsSKAdNetwork: Bool {
        #if os(iOS)
        if #available(iOS 14.0, *) { return true }
        #endif
        return false
    }

    var supportsAdAttributionKit: Bool { false }

    func updateSKAdNetwork(_ update: ConversionValueUpdate) async throws {
        #if os(iOS)
        if #available(iOS 16.1, *) {
            let coarse = update.coarseValue.map {
                switch $0 {
                case .low: return SKAdNetwork.CoarseConversionValue.low
                case .medium: return SKAdNetwork.CoarseConversionValue.medium
                case .high: return SKAdNetwork.CoarseConversionValue.high
                }
            }
            try await withCheckedThrowingContinuation { continuation in
                SKAdNetwork.updatePostbackConversionValue(
                    update.fineValue,
                    coarseValue: coarse,
                    lockWindow: update.lockWindow
                ) { error in
                    if let error { continuation.resume(throwing: error) }
                    else { continuation.resume() }
                }
            }
            return
        }
        if #available(iOS 14.0, *) {
            SKAdNetwork.updateConversionValue(update.fineValue)
            return
        }
        #endif
        throw ConversionValuePlatformError.unsupported
    }

    func updateAdAttributionKit(_ update: ConversionValueUpdate) async throws {
        _ = update
        throw ConversionValuePlatformError.unsupported
    }
}

private enum ConversionValuePlatformError: Error { case unsupported }

final class ConversionValueEngine: @unchecked Sendable {
    typealias PersistRules = @Sendable (_ version: Int64, _ rules: [ConversionValueRule]) throws -> Bool
    typealias EvidenceSink = @Sendable (ConversionValueEvidence) throws -> Void

    private let adapter: ConversionValuePlatformAdapter
    private let evidenceSink: EvidenceSink
    private let persistRules: PersistRules
    private let lock = NSLock()
    private var rules: [ConversionValueRule]
    private var version: Int64
    private var lockedWindows = Set<Int>()

    init(
        version: Int64 = 0,
        rules: [ConversionValueRule] = [],
        adapter: ConversionValuePlatformAdapter,
        persistRules: @escaping PersistRules,
        evidenceSink: @escaping EvidenceSink
    ) {
        self.version = version
        self.rules = rules
        self.adapter = adapter
        self.persistRules = persistRules
        self.evidenceSink = evidenceSink
    }

    var capabilityState: String {
        lock.withLock {
            if rules.isEmpty { return "noRules" }
            if !adapter.supportsSKAdNetwork && !adapter.supportsAdAttributionKit { return "unavailable" }
            return "available"
        }
    }

    func applyRules(version: Int64, rules: [ConversionValueRule]) throws {
        guard version > 0, rules.allSatisfy(Self.validRule) else {
            throw ConversionValueEngineError.invalidRules
        }
        try lock.withLock {
            guard version > self.version else { throw ConversionValueEngineError.versionReplay }
            guard try persistRules(version, rules) else { throw ConversionValueEngineError.versionReplay }
            self.version = version
            self.rules = rules
        }
    }

    static func conversionWindow(elapsedSinceFirstLaunch: TimeInterval) -> Int? {
        guard elapsedSinceFirstLaunch >= 0 else { return nil }
        let day: TimeInterval = 24 * 60 * 60
        if elapsedSinceFirstLaunch < 2 * day { return 1 }
        if elapsedSinceFirstLaunch < 7 * day { return 2 }
        if elapsedSinceFirstLaunch < 35 * day { return 3 }
        return nil
    }

    static func evaluate(
        rules: [ConversionValueRule],
        eventCounts: [String: Int],
        window: Int
    ) -> ConversionValueEvaluation? {
        let windowRules = rules.filter { $0.window == window }
        let trace = windowRules.map { rule in
            let observed = max(0, eventCounts[rule.eventName] ?? 0)
            return ConversionValueTraceEntry(
                eventName: rule.eventName,
                matched: observed >= rule.minimumCount,
                minimumCount: rule.minimumCount,
                observedCount: observed,
                window: rule.window
            )
        }
        guard let selected = zip(windowRules, trace)
            .filter({ $0.1.matched })
            .map(\.0)
            .sorted(by: {
                if $0.fineValue != $1.fineValue { return $0.fineValue > $1.fineValue }
                return $0.eventName < $1.eventName
            })
            .first
        else { return nil }
        return ConversionValueEvaluation(
            fineValue: selected.fineValue,
            coarseValue: selected.coarseValue,
            lockWindow: selected.lockWindow,
            window: window,
            trace: trace
        )
    }

    @discardableResult
    func update(
        eventCounts: [String: Int],
        elapsedSinceFirstLaunch: TimeInterval,
        attributionAllowed: Bool
    ) async -> ConversionValueEvidence? {
        guard let window = Self.conversionWindow(elapsedSinceFirstLaunch: elapsedSinceFirstLaunch) else {
            return recordFailure(window: 3, eventCounts: eventCounts, code: "windowClosed")
        }
        let snapshot = lock.withLock { (version, rules, lockedWindows.contains(window)) }
        guard let evaluation = Self.evaluate(rules: snapshot.1, eventCounts: eventCounts, window: window) else {
            return nil
        }
        if !attributionAllowed {
            return record(evaluation, version: snapshot.0, outcome: .policyBlocked, errorCode: "policyDenied")
        }
        if snapshot.2 {
            return record(evaluation, version: snapshot.0, outcome: .failed, errorCode: "windowLocked")
        }

        let update = ConversionValueUpdate(
            fineValue: evaluation.fineValue,
            coarseValue: evaluation.coarseValue,
            lockWindow: evaluation.lockWindow,
            window: evaluation.window
        )
        do {
            if adapter.supportsSKAdNetwork { try await adapter.updateSKAdNetwork(update) }
            if adapter.supportsAdAttributionKit { try await adapter.updateAdAttributionKit(update) }
            if !adapter.supportsSKAdNetwork && !adapter.supportsAdAttributionKit {
                return record(evaluation, version: snapshot.0, outcome: .failed, errorCode: "frameworkUnavailable")
            }
            if evaluation.lockWindow { lock.withLock { _ = lockedWindows.insert(window) } }
            return record(evaluation, version: snapshot.0, outcome: .succeeded, errorCode: nil)
        } catch {
            return record(evaluation, version: snapshot.0, outcome: .failed, errorCode: "platformApiFailed")
        }
    }

    private static func validRule(_ rule: ConversionValueRule) -> Bool {
        !rule.eventName.isEmpty && rule.minimumCount > 0 && (0 ... 63).contains(rule.fineValue) &&
            (1 ... 3).contains(rule.window)
    }

    private func recordFailure(
        window: Int,
        eventCounts: [String: Int],
        code: String
    ) -> ConversionValueEvidence? {
        let snapshot = lock.withLock { (version, rules) }
        guard let evaluation = Self.evaluate(rules: snapshot.1, eventCounts: eventCounts, window: window) else {
            return nil
        }
        return record(evaluation, version: snapshot.0, outcome: .failed, errorCode: code)
    }

    private func record(
        _ evaluation: ConversionValueEvaluation,
        version: Int64,
        outcome: ConversionValueUpdateOutcome,
        errorCode: String?
    ) -> ConversionValueEvidence {
        let evidence = ConversionValueEvidence(
            ruleVersion: version,
            fineValue: evaluation.fineValue,
            coarseValue: evaluation.coarseValue,
            lockWindow: evaluation.lockWindow,
            window: evaluation.window,
            outcome: outcome,
            errorCode: errorCode,
            trace: evaluation.trace
        )
        try? evidenceSink(evidence)
        return evidence
    }
}
