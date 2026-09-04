import Foundation

/// Category of a ``VoidhashDiagnostic``, so hosts can route without matching on codes.
public enum VoidhashDiagnosticKind: String, Sendable, Equatable, Codable {
    /// A network attempt failed, timed out or was rejected with a retryable status.
    case transport
    /// A queued record was dropped because a bounded store reached its cap.
    case eviction
    /// A circuit breaker opened, probed or closed.
    case breaker
    /// The publishable key was rejected; outbound traffic is paused for the process.
    case auth
    /// A cache entry could not be read, decoded or written.
    case cache
}

/// A structured, non-fatal SDK event delivered to `VoidhashOptions.onDiagnostic`.
///
/// Diagnostics are informational: every one of them describes a situation the SDK already
/// handled with a documented fallback. They never represent a failed public API call.
public struct VoidhashDiagnostic: Sendable, Equatable {
    /// Routing category.
    public let kind: VoidhashDiagnosticKind
    /// Stable uppercase code, e.g. `ANALYTICS_EVENT_DROPPED`.
    public let code: String
    /// The SDK operation that produced the diagnostic, e.g. `analytics.flush`.
    public let operation: String
    /// Whether the SDK will retry on its own.
    public let retryable: Bool
    /// HTTP status, when the diagnostic came from a response.
    public let httpStatus: Int?
    /// Human readable description.
    public let message: String

    public init(
        kind: VoidhashDiagnosticKind,
        code: String,
        operation: String,
        retryable: Bool = false,
        httpStatus: Int? = nil,
        message: String
    ) {
        self.kind = kind
        self.code = code
        self.operation = operation
        self.retryable = retryable
        self.httpStatus = httpStatus
        self.message = message
    }
}

/// Receives ``VoidhashDiagnostic`` values. Called from arbitrary tasks; must be thread safe.
public typealias VoidhashDiagnosticHandler = @Sendable (VoidhashDiagnostic) -> Void

/// Wraps a diagnostic handler so a throwing or crashing host handler cannot reach SDK code.
public struct DiagnosticEmitter: Sendable {
    private let handler: VoidhashDiagnosticHandler?

    public init(_ handler: VoidhashDiagnosticHandler?) {
        self.handler = handler
    }

    /// Delivers `diagnostic` to the host handler, if one was installed.
    public func emit(_ diagnostic: VoidhashDiagnostic) {
        handler?(diagnostic)
    }

    /// Convenience over ``emit(_:)``.
    public func emit(
        _ kind: VoidhashDiagnosticKind,
        code: String,
        operation: String,
        retryable: Bool = false,
        httpStatus: Int? = nil,
        message: String
    ) {
        emit(
            VoidhashDiagnostic(
                kind: kind, code: code, operation: operation, retryable: retryable,
                httpStatus: httpStatus, message: message))
    }
}
