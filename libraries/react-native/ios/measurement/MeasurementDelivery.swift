import Foundation

struct MeasurementNativeDeliveryResult {
    let accepted: Int
    let scheduled: Int
    let quarantined: Int
    let policyBlocked: Int
}

final class MeasurementDelivery {
    private let store: MeasurementStore
    private let publishableKey: String
    private let ingestOrigin: URL
    private let session: URLSession

    init(store: MeasurementStore, publishableKey: String, ingestOrigin: URL, session: URLSession = .shared) {
        self.store = store
        self.publishableKey = publishableKey
        self.ingestOrigin = ingestOrigin
        self.session = session
    }

    func flush() async -> MeasurementNativeDeliveryResult {
        do {
            let records = try store.peekEligible(limit: 100)
            guard !records.isEmpty else { return .empty }
            let deletions = records.filter { $0.recordType == "measurement.deletion_requested.v1" }
            var deletionResult = MeasurementNativeDeliveryResult.empty
            for record in deletions {
                deletionResult = combine(deletionResult, await deliverDeletion(record))
            }
            let protected = await prepareProtectedEvidence(
                records.filter { $0.recordType != "measurement.deletion_requested.v1" }
            )
            return combine(deletionResult, combine(protected.result, await deliver(protected.ready)))
        } catch {
            return .empty
        }
    }

    private func deliverDeletion(
        _ record: MeasurementStoredOutboxRecord
    ) async -> MeasurementNativeDeliveryResult {
        let response: (Data, HTTPURLResponse)
        do {
            response = try await sendDeletion(record)
        } catch {
            schedule([record], retryAfterMs: nil)
            return MeasurementNativeDeliveryResult(accepted: 0, scheduled: 1, quarantined: 0, policyBlocked: 0)
        }
        if response.1.statusCode == 429 || response.1.statusCode >= 500 {
            let retryAfter = response.1.value(forHTTPHeaderField: "retry-after")
                .flatMap(Int64.init)
                .map { $0 * 1_000 }
            schedule([record], retryAfterMs: retryAfter)
            return MeasurementNativeDeliveryResult(accepted: 0, scheduled: 1, quarantined: 0, policyBlocked: 0)
        }
        if (200...299).contains(response.1.statusCode) {
            _ = try? store.acknowledge(recordId: record.recordId)
            return MeasurementNativeDeliveryResult(accepted: 1, scheduled: 0, quarantined: 0, policyBlocked: 0)
        }
        _ = try? store.reject(recordId: record.recordId, reason: "deletion_http_\(response.1.statusCode)")
        return MeasurementNativeDeliveryResult(accepted: 0, scheduled: 0, quarantined: 1, policyBlocked: 0)
    }

    private func prepareProtectedEvidence(
        _ records: [MeasurementStoredOutboxRecord]
    ) async -> (ready: [MeasurementStoredOutboxRecord], result: MeasurementNativeDeliveryResult) {
        var ready: [MeasurementStoredOutboxRecord] = []
        var scheduled = 0
        var quarantined = 0
        var outcomes: [String: ProtectedOutcome] = [:]
        for record in records {
            guard let reference = record.protectedPayloadRef else {
                ready.append(record)
                continue
            }
            let outcome: ProtectedOutcome
            if let existing = outcomes[reference] {
                outcome = existing
            } else {
                outcome = await uploadProtectedEvidence(reference)
                outcomes[reference] = outcome
            }
            switch outcome {
            case .accepted:
                ready.append(record)
            case .retry:
                _ = try? store.scheduleRetry(
                    recordId: record.recordId,
                    eligibleAtMs: Int64(Date().timeIntervalSince1970 * 1_000) + 1_000
                )
                scheduled += 1
            case .rejected:
                _ = try? store.reject(recordId: record.recordId, reason: "protected_evidence_rejected")
                quarantined += 1
            }
        }
        return (
            ready,
            MeasurementNativeDeliveryResult(
                accepted: 0,
                scheduled: scheduled,
                quarantined: quarantined,
                policyBlocked: 0
            )
        )
    }

    private func uploadProtectedEvidence(_ blobId: String) async -> ProtectedOutcome {
        guard let evidence = try? store.getProtectedUpload(blobId: blobId) else {
            return .rejected
        }
        if evidence.uploadState == "acknowledged" { return .accepted }
        guard evidence.uploadState == "pending",
              evidence.deletionState == "active",
              evidence.ciphertext != nil else { return .rejected }
        let now = Int64(Date().timeIntervalSince1970 * 1_000)
        if evidence.eligibleAtMs > now { return .retry }
        let response: (Data, HTTPURLResponse)
        do {
            response = try await sendProtected(evidence)
        } catch {
            scheduleProtected(evidence, retryAfterMs: nil)
            return .retry
        }
        if (200...299).contains(response.1.statusCode) {
            _ = try? store.acknowledgeProtectedUpload(blobId: blobId)
            return .accepted
        }
        if response.1.statusCode == 429 || response.1.statusCode >= 500 {
            let retryAfter = response.1.value(forHTTPHeaderField: "retry-after")
                .flatMap(Int64.init)
                .map { $0 * 1_000 }
            scheduleProtected(evidence, retryAfterMs: retryAfter)
            return .retry
        }
        _ = try? store.rejectProtectedUpload(blobId: blobId)
        return .rejected
    }

    private func deliver(_ records: [MeasurementStoredOutboxRecord]) async -> MeasurementNativeDeliveryResult {
        guard !records.isEmpty else { return .empty }
        let response: (Data, HTTPURLResponse)
        do {
            response = try await send(records)
        } catch {
            schedule(records, retryAfterMs: nil)
            return MeasurementNativeDeliveryResult(accepted: 0, scheduled: records.count, quarantined: 0, policyBlocked: 0)
        }
        if response.1.statusCode == 413 {
            if records.count == 1 {
                _ = try? store.reject(recordId: records[0].recordId, reason: "payload_too_large", quarantine: true)
                return MeasurementNativeDeliveryResult(accepted: 0, scheduled: 0, quarantined: 1, policyBlocked: 0)
            }
            let middle = records.count / 2
            return combine(
                await deliver(Array(records[..<middle])),
                await deliver(Array(records[middle...]))
            )
        }
        if response.1.statusCode == 429 || response.1.statusCode >= 500 {
            let retryAfter = response.1.value(forHTTPHeaderField: "retry-after")
                .flatMap(Int64.init)
                .map { $0 * 1_000 }
            schedule(records, retryAfterMs: retryAfter)
            return MeasurementNativeDeliveryResult(accepted: 0, scheduled: records.count, quarantined: 0, policyBlocked: 0)
        }
        guard (200...299).contains(response.1.statusCode) else {
            for record in records {
                _ = try? store.reject(recordId: record.recordId, reason: "http_\(response.1.statusCode)")
            }
            return MeasurementNativeDeliveryResult(accepted: 0, scheduled: 0, quarantined: records.count, policyBlocked: 0)
        }
        guard let body = try? JSONSerialization.jsonObject(with: response.0) as? [String: Any] else {
            schedule(records, retryAfterMs: nil)
            return MeasurementNativeDeliveryResult(accepted: 0, scheduled: records.count, quarantined: 0, policyBlocked: 0)
        }
        let acceptedIds = body["accepted"] as? [String] ?? []
        let rejected = body["rejected"] as? [[String: Any]] ?? []
        var accepted = 0
        for id in acceptedIds where (try? store.acknowledge(recordId: id)) == true { accepted += 1 }
        var quarantined = 0
        for item in rejected {
            guard let id = item["recordId"] as? String, let reason = item["reason"] as? String else { continue }
            if (try? store.reject(recordId: id, reason: reason)) == true { quarantined += 1 }
        }
        let handled = Set(acceptedIds).union(rejected.compactMap { $0["recordId"] as? String })
        let missing = records.filter { !handled.contains($0.recordId) }
        schedule(missing, retryAfterMs: nil)
        return MeasurementNativeDeliveryResult(
            accepted: accepted,
            scheduled: missing.count,
            quarantined: quarantined,
            policyBlocked: 0
        )
    }

    private func send(_ records: [MeasurementStoredOutboxRecord]) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: ingestOrigin.appendingPathComponent("i/v1/batch"))
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue("application/json", forHTTPHeaderField: "accept")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "token": publishableKey,
            "sent_at": ISO8601DateFormatter().string(from: Date()),
            "events": records.map(captureEvent),
        ], options: [.sortedKeys])
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        return (data, http)
    }

    private func sendProtected(
        _ evidence: MeasurementStoredProtectedUpload
    ) async throws -> (Data, HTTPURLResponse) {
        var request = URLRequest(url: ingestOrigin.appendingPathComponent("i/v1/measurement/protected"))
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue("application/json", forHTTPHeaderField: "accept")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "blobId": evidence.blobId,
            "ciphertext": evidence.ciphertext?.base64EncodedString() ?? "",
            "consentRevision": evidence.consentRevision,
            "deletionState": evidence.deletionState,
            "encryptionKeyVersion": evidence.encryptionKeyVersion,
            "installationId": try store.snapshot().installationId,
            "purpose": evidence.purpose,
            "retentionClass": evidence.retentionClass,
            "token": publishableKey,
        ], options: [.sortedKeys])
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        return (data, http)
    }

    private func sendDeletion(
        _ record: MeasurementStoredOutboxRecord
    ) async throws -> (Data, HTTPURLResponse) {
        guard let data = record.publicPayload.data(using: .utf8),
              let envelope = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw URLError(.cannotParseResponse)
        }
        let payload = envelope["publicPayload"] as? [String: Any] ?? [:]
        let identity = envelope["identity"] as? [String: Any] ?? [:]
        var body: [String: Any] = [
            "installationId": envelope["installationId"] as? String ?? "",
            "requestId": payload["requestId"] as? String ?? record.recordId,
            "requestedAt": envelope["occurredAt"] as? String ?? ISO8601DateFormatter().string(from: Date()),
            "token": publishableKey,
        ]
        if let personId = identity["personId"] as? String, !personId.isEmpty {
            body["personId"] = personId
        }
        var request = URLRequest(url: ingestOrigin.appendingPathComponent("i/v1/measurement/delete"))
        request.httpMethod = "POST"
        request.timeoutInterval = 15
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.setValue("application/json", forHTTPHeaderField: "accept")
        request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        let (responseData, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw URLError(.badServerResponse) }
        return (responseData, http)
    }

    private func captureEvent(_ record: MeasurementStoredOutboxRecord) -> [String: Any] {
        guard let data = record.publicPayload.data(using: .utf8),
              let envelope = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return ["uuid": record.recordId, "event": record.recordType]
        }
        let identity = envelope["identity"] as? [String: Any] ?? [:]
        let consent = envelope["consent"] as? [String: Any] ?? [:]
        var event: [String: Any] = [
            "uuid": record.recordId,
            "event": record.recordType,
            "timestamp": envelope["occurredAt"] as? String ?? ISO8601DateFormatter().string(from: Date()),
            "distinct_id": identity["distinctId"] as? String ?? envelope["installationId"] as? String ?? "unknown",
            "properties": envelope["publicPayload"] as? [String: Any] ?? [:],
            "context": [
                "schemaVersion": 1,
                "installation": [
                    "id": envelope["installationId"] as? String ?? "",
                    "sequence": envelope["installationSequence"] as? Int64 ?? record.sequence,
                ],
                "identity": identity,
                "consentRevision": consent["revision"] as? Int64 ?? 0,
                "app": envelope["app"] as? [String: Any] ?? [:],
                "device": envelope["device"] as? [String: Any] ?? [:],
                "measurement": [
                    "recordType": record.recordType,
                    "source": envelope["source"] as? String ?? "native",
                ],
            ],
        ]
        if let session = envelope["session"] as? [String: Any], let id = session["id"] as? String {
            event["session_id"] = id
        }
        return event
    }

    private func schedule(_ records: [MeasurementStoredOutboxRecord], retryAfterMs: Int64?) {
        let now = Int64(Date().timeIntervalSince1970 * 1_000)
        for record in records {
            let exponent = min(record.attemptCount, 12)
            let exponential = min(Int64(3_600_000), Int64(1_000) << exponent)
            let stableHash = record.recordId.utf8.reduce(UInt64(2_166_136_261)) {
                ($0 ^ UInt64($1)) &* 16_777_619
            }
            let jitter = Int64(800 + stableHash % 401)
            let computed = exponential * jitter / 1_000
            _ = try? store.scheduleRetry(
                recordId: record.recordId,
                eligibleAtMs: now + max(computed, retryAfterMs ?? 0)
            )
        }
    }

    private func scheduleProtected(_ evidence: MeasurementStoredProtectedUpload, retryAfterMs: Int64?) {
        let exponent = min(evidence.attemptCount, 12)
        let exponential = min(Int64(3_600_000), Int64(1_000) << exponent)
        let stableHash = evidence.blobId.utf8.reduce(UInt64(2_166_136_261)) {
            ($0 ^ UInt64($1)) &* 16_777_619
        }
        let jitter = Int64(800 + stableHash % 401)
        let computed = exponential * jitter / 1_000
        _ = try? store.scheduleProtectedUpload(
            blobId: evidence.blobId,
            eligibleAtMs: Int64(Date().timeIntervalSince1970 * 1_000) + max(computed, retryAfterMs ?? 0)
        )
    }

    private func combine(_ left: MeasurementNativeDeliveryResult, _ right: MeasurementNativeDeliveryResult) -> MeasurementNativeDeliveryResult {
        MeasurementNativeDeliveryResult(
            accepted: left.accepted + right.accepted,
            scheduled: left.scheduled + right.scheduled,
            quarantined: left.quarantined + right.quarantined,
            policyBlocked: left.policyBlocked + right.policyBlocked
        )
    }
}

private enum ProtectedOutcome {
    case accepted
    case retry
    case rejected
}

private extension MeasurementNativeDeliveryResult {
    static let empty = MeasurementNativeDeliveryResult(accepted: 0, scheduled: 0, quarantined: 0, policyBlocked: 0)
}
