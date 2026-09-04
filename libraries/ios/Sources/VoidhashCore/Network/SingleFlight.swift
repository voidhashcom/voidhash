import Foundation

/// Coalesces concurrent work sharing a key so only one request is ever in flight.
///
/// Late callers await the running task instead of issuing a duplicate request, which is what
/// keeps a foreground burst of reads from turning into a thundering herd on the origin.
public actor SingleFlight<Value: Sendable> {
    private var inFlight: [String: Task<Value, any Error>] = [:]

    public init() {}

    /// Runs `operation` for `key`, or joins the run already in progress.
    public func run(
        key: String,
        operation: @escaping @Sendable () async throws -> Value
    ) async throws -> Value {
        if let existing = inFlight[key] {
            return try await existing.value
        }
        let task = Task { try await operation() }
        inFlight[key] = task
        defer { inFlight[key] = nil }
        return try await task.value
    }

    /// The task currently running for `key`, if any. Lets a caller apply a freshness budget by
    /// racing the shared task against a timeout without cancelling it.
    public func task(for key: String) -> Task<Value, any Error>? {
        return inFlight[key]
    }

    /// Whether work is in flight for `key`.
    public func isInFlight(key: String) -> Bool {
        return inFlight[key] != nil
    }
}
