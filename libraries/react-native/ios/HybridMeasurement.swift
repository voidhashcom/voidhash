import Foundation
import NitroModules

final class HybridMeasurement: HybridMeasurementSpec {
    private struct RemoteConfiguration: Decodable {
        struct Rule: Decodable {
            let coarseValue: ConversionValueCoarse?
            let eventName: String
            let fineValue: Int
            let lockWindow: Bool?
            let minimumCount: Int
            let window: Int
        }
        let conversionRules: [Rule]
        let schemaVersion: Int
    }
    private var readiness = "uninitialized"
    private var consentRevision = 0.0
    private var configurationRevision = 0.0
    private var listeners: [String: (MeasurementBridgeEvent) -> Void] = [:]
    private var publishableKey: String?
    private var ingestOrigin: URL?
    private lazy var store: MeasurementStore = {
        do { return try MeasurementStore() }
        catch { fatalError("MEASUREMENT_STORE_INITIALIZATION_FAILED") }
    }()
    private lazy var conversionEngine = ConversionValueEngine(
        adapter: SystemConversionValuePlatformAdapter(),
        persistRules: { _, _ in true },
        evidenceSink: { _ in }
    )

    private func snapshot() throws -> MeasurementStateBridge {
        let state = try store.snapshot()
        return MeasurementStateBridge(
            installationId: state.installationId,
            firstOpenedAt: state.firstOpenedAt,
            installationSequence: Double(state.sequence),
            readiness: readiness,
            currentSessionId: nil,
            currentSessionSequence: nil,
            consentRevision: consentRevision,
            configurationRevision: configurationRevision,
            outboxCritical: Double(state.counts["critical"] ?? 0),
            outboxHigh: Double(state.counts["high"] ?? 0),
            outboxNormal: Double(state.counts["normal"] ?? 0),
            outboxLow: Double(state.counts["low"] ?? 0),
            oldestRecordAgeMs: state.oldestQueuedAtMs.map {
                Double(max(0, Int64(Date().timeIntervalSince1970 * 1_000) - $0))
            }
        )
    }

    func initialize(publishableKey: String, configuration: MeasurementInitializeConfiguration) throws -> Promise<MeasurementStateBridge> {
        guard !publishableKey.isEmpty else { throw RuntimeError.error(withMessage: "INVALID_PUBLISHABLE_KEY") }
        return Promise.async {
            _ = try self.store.snapshot()
            self.publishableKey = publishableKey
            self.ingestOrigin = URL(string: configuration.ingestUrl)
            self.configurationRevision += 1
            self.readiness = "sdkReady"
            return try self.snapshot()
        }
    }

    func enqueue(command: MeasurementCommand) throws -> Promise<MeasurementCommandResult> {
        let publicPayload = Data(bytes: command.publicPayload.data, count: command.publicPayload.size)
        return Promise.async {
            let recordId = command.commandId
            let sequence = try self.store.enqueue(
                recordId: recordId,
                recordType: command.recordType,
                occurredAt: command.occurredAt,
                priority: String(describing: command.priority),
                source: String(describing: command.source),
                publicPayload: String(decoding: publicPayload, as: UTF8.self),
                protectedPayloadRef: command.protectedEvidenceRef
            )
            if let consent = command.consent { self.consentRevision = consent.revision }
            return MeasurementCommandResult(
                accepted: true,
                recordId: recordId,
                installationSequence: Double(sequence),
                error: nil
            )
        }
    }

    func flush() throws -> Promise<MeasurementFlushBridgeResult> {
        Promise.async {
            guard let key = self.publishableKey, let origin = self.ingestOrigin else {
                let count = try self.store.peekEligible(limit: Int.max).count
                return MeasurementFlushBridgeResult(accepted: 0, scheduled: Double(count), quarantined: 0, policyBlocked: 0)
            }
            let result = await MeasurementDelivery(
                store: self.store,
                publishableKey: key,
                ingestOrigin: origin
            ).flush()
            return MeasurementFlushBridgeResult(
                accepted: Double(result.accepted),
                scheduled: Double(result.scheduled),
                quarantined: Double(result.quarantined),
                policyBlocked: Double(result.policyBlocked)
            )
        }
    }

    func getInstallationId() throws -> Promise<String> {
        Promise.async { try self.store.snapshot().installationId }
    }

    func getState() throws -> Promise<MeasurementStateBridge> { Promise.async { try self.snapshot() } }

    func subscribe(subscriptionId: String, listener: @escaping (MeasurementBridgeEvent) -> Void) throws {
        listeners[subscriptionId] = listener
    }

    func unsubscribe(subscriptionId: String) throws { listeners.removeValue(forKey: subscriptionId) }

    func peekInbox(limit: Double) throws -> Promise<[MeasurementInboxEntry]> {
        Promise.async {
            try self.store.peekInbox(limit: Int(limit)).map {
                MeasurementInboxEntry(
                    id: $0.id,
                    kind: $0.kind,
                    source: $0.source,
                    appState: $0.appState,
                    receivedAt: $0.receivedAt,
                    protectedEvidenceRef: $0.protectedPayloadRef
                )
            }
        }
    }

    func acknowledgeInbox(entryId: String) throws -> Promise<Bool> {
        Promise.async { try self.store.acknowledgeInbox(id: entryId) }
    }

    func readProtectedEvidence(blobId: String) throws -> Promise<ArrayBuffer> {
        Promise.async {
            guard let evidence = try self.store.getProtectedEvidence(blobId: blobId) else {
                throw RuntimeError.error(withMessage: "PROTECTED_EVIDENCE_NOT_FOUND")
            }
            return try ArrayBuffer.copy(data: evidence.value)
        }
    }

    func putProtectedEvidence(input: MeasurementProtectedEvidenceInput) throws -> Promise<String> {
        let value = Data(bytes: input.value.data, count: input.value.size)
        return Promise.async {
            try self.store.putProtectedEvidence(
                blobId: input.blobId,
                purpose: input.purpose.stringValue,
                consentRevision: Int64(input.consentRevision),
                retentionClass: input.retentionClass.stringValue,
                value: value
            )
        }
    }

    func deleteProtectedEvidence(blobId: String) throws -> Promise<Bool> {
        Promise.async { try self.store.deleteProtectedEvidence(blobId: blobId) }
    }

    func deleteProtectedData(requestId: String) throws -> Promise<Bool> {
        Promise.async { try self.store.deleteProtectedData(requestId: requestId) }
    }

    func getMeasurementConfigurationState() throws -> Promise<MeasurementConfigurationStateBridge> {
        Promise.async {
            let state = try self.store.measurementConfigurationState()
            return MeasurementConfigurationStateBridge(
                version: Double(state.version),
                payload: try state.payload.map { try ArrayBuffer.copy(data: $0) }
            )
        }
    }

    func persistMeasurementConfigurationState(version: Double, payload: ArrayBuffer) throws -> Promise<Bool> {
        let bytes = Data(bytes: payload.data, count: payload.size)
        return Promise.async {
            try self.store.persistMeasurementConfiguration(version: Int64(version), payload: bytes)
        }
    }

    func applyMeasurementConfiguration(version: Double, payload: ArrayBuffer) throws -> Promise<Void> {
        let bytes = Data(bytes: payload.data, count: payload.size)
        return Promise.async {
            let configuration = try JSONDecoder().decode(RemoteConfiguration.self, from: bytes)
            guard configuration.schemaVersion == 1 else {
                throw RuntimeError.error(withMessage: "MEASUREMENT_CONFIGURATION_INVALID")
            }
            let rules = configuration.conversionRules.map {
                ConversionValueRule(
                    eventName: $0.eventName,
                    minimumCount: $0.minimumCount,
                    fineValue: $0.fineValue,
                    coarseValue: $0.coarseValue,
                    lockWindow: $0.lockWindow ?? false,
                    window: $0.window
                )
            }
            try self.conversionEngine.applyRules(version: Int64(version), rules: rules)
        }
    }

    func applyMeasurementStorageLimits(
        maxOutboxRecords: Double,
        maxOutboxBytes: Double,
        maxProtectedBytes: Double
    ) throws -> Promise<Void> {
        Promise.async {
            try self.store.applyStorageLimits(
                maxOutboxRecords: Int64(maxOutboxRecords),
                maxOutboxBytes: Int64(maxOutboxBytes),
                maxProtectedBytes: Int64(maxProtectedBytes)
            )
        }
    }

    func getPushRegistrationState() throws -> Promise<MeasurementConfigurationStateBridge> {
        Promise.async {
            let state = try self.store.pushRegistrationState()
            return MeasurementConfigurationStateBridge(
                version: Double(state.version),
                payload: try state.payload.map { try ArrayBuffer.copy(data: $0) }
            )
        }
    }

    func persistPushRegistrationState(payload: ArrayBuffer) throws -> Promise<Bool> {
        let bytes = Data(bytes: payload.data, count: payload.size)
        return Promise.async { try self.store.persistPushRegistration(payload: bytes) }
    }

    func clearPushRegistrationState() throws -> Promise<Bool> {
        Promise.async { try self.store.clearPushRegistration() }
    }

    func getTestDeviceState() throws -> Promise<Bool> {
        Promise.async { try self.store.testDeviceState() }
    }

    func persistTestDeviceState(enabled: Bool) throws -> Promise<Bool> {
        Promise.async { try self.store.persistTestDeviceState(enabled) }
    }

    func checkAndSetDedupe(namespace: String, key: String, expiresAtMs: Double) throws -> Promise<Bool> {
        Promise.async {
            try self.store.checkAndSetDedupe(
                namespace: namespace,
                key: key,
                expiresAtMs: Int64(expiresAtMs)
            )
        }
    }


    func hasDedupe(namespace: String, key: String) throws -> Promise<Bool> {
        Promise.async { try self.store.hasDedupe(namespace: namespace, key: key) }
    }
}
