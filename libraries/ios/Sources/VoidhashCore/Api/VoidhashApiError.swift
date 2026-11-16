import Foundation

/// Error raised by ``VoidhashApiClient``.
///
/// Like ``VoidhashStoreError`` the string form is `"CODE: message"` so callers can branch on the
/// prefix regardless of platform.
public struct VoidhashApiError: Error, Equatable, Sendable, CustomStringConvertible,
    LocalizedError
{
    /// Stable uppercase error code, e.g. `AUTHENTICATION_FAILED`.
    public let code: String
    /// Human readable message describing the failure.
    public let message: String
    /// HTTP status code, when the failure came from a response.
    public let statusCode: Int?
    /// Server error tag (`_tag`), when the response carried one.
    public let tag: String?
    /// Delay requested by `Retry-After`, in milliseconds, when the response carried one.
    public let retryAfterMilliseconds: Double?
    /// Whether the request failed on the device before anything was sent, for example because
    /// its body could not be encoded. Such a failure says nothing about the backend: it is not
    /// retried and never counts against the host.
    public let isLocal: Bool
    /// Whether the request failed because the device has no usable network
    /// (see ``NetworkPolicy/isDeviceOffline(_:)``). It is retried like any transport failure,
    /// but never counts against the host.
    public let isDeviceOffline: Bool

    public init(
        code: String,
        message: String,
        statusCode: Int? = nil,
        tag: String? = nil,
        retryAfterMilliseconds: Double? = nil,
        isLocal: Bool = false,
        isDeviceOffline: Bool = false
    ) {
        self.code = code
        self.message = message
        self.statusCode = statusCode
        self.tag = tag
        self.retryAfterMilliseconds = retryAfterMilliseconds
        self.isLocal = isLocal
        self.isDeviceOffline = isDeviceOffline
    }

    /// `_tag` of the backend's answer to a person read for an identity it has no person for.
    ///
    /// Only this tagged `404` means "no person"; any other `404` came from something in front of
    /// the backend and must not erase cached entitlements.
    public static let personNotFoundTag = "Api/SdkPersonNotFoundError"

    /// `_tag` of the backend's verdict that it can never accept a store receipt as sent: the store
    /// is not configured for the app, the transaction is unknown or invalid, or its environment
    /// does not match. Its `reason` says which.
    public static let transactionRejectedTag = "Api/SdkTransactionRejectedError"

    /// `_tag` of the backend's refusal to sign a promotional offer: the App Store is not enabled
    /// for the app, or the product's App Store mapping lists no such offer.
    public static let promotionalOfferUnavailableTag = "Api/SdkPromotionalOfferUnavailableError"

    /// `_tag` of the backend's `409` to an identify whose alias is already linked to a different
    /// identified person: the alias's history stays with that person, and no merge happens.
    public static let personAlreadyIdentifiedTag = "Api/SdkPersonAlreadyIdentifiedError"

    /// `_tag` of the backend's `401` to a publishable key that is missing, malformed, expired or
    /// unknown.
    public static let authenticationTag = "Api/AuthenticationError"

    /// Code of the failure raised without sending anything while outbound traffic is paused
    /// after the publishable key was rejected.
    public static let outboundPausedCode = "OUTBOUND_PAUSED"

    /// Code of the failure raised without sending anything while a host's circuit breaker is open.
    public static let circuitOpenCode = "CIRCUIT_OPEN"

    /// Whether the SDK refused the request itself because traffic is paused or the host's circuit
    /// is open. Nothing was sent, so the failure says nothing new about the backend, and the
    /// request is worth making once traffic resumes.
    public var isRefusedLocally: Bool {
        return code == VoidhashApiError.outboundPausedCode
            || code == VoidhashApiError.circuitOpenCode
    }

    /// Whether the SDK should try this request again later, per
    /// ``NetworkPolicy/classify(statusCode:tag:)``.
    ///
    /// Transport failures, throttling, every `5xx` and untagged `4xx` are; local failures,
    /// a rejected publishable key and tagged verdicts are not.
    public var isRetryable: Bool {
        return !isLocal && NetworkPolicy.isRetryable(statusCode: statusCode, tag: tag)
    }

    /// Whether this failure is evidence that the host is unhealthy and counts towards opening
    /// its circuit breaker.
    public var countsTowardsCircuitBreaker: Bool {
        return !isLocal && !isDeviceOffline
            && NetworkPolicy.countsTowardsCircuitBreaker(statusCode: statusCode, tag: tag)
    }

    /// Whether the backend rejected the request with a tagged `4xx` it will repeat, as opposed to
    /// a transient failure or a rejected publishable key.
    public var isVerdict: Bool {
        return !isLocal && NetworkPolicy.classify(statusCode: statusCode, tag: tag) == .verdict
    }

    /// Whether the backend rejected the publishable key: a `401`/`403` it tagged. One that is
    /// not tagged came from something in front of it and is transient.
    public var isAuthFailure: Bool {
        return !isLocal
            && NetworkPolicy.classify(statusCode: statusCode, tag: tag) == .authentication
    }

    public var description: String {
        return "\(code): \(message)"
    }

    public var errorDescription: String? {
        return description
    }

    public var localizedDescription: String {
        return description
    }
}

extension VoidhashApiError {
    /// Transport failure — the request never produced an HTTP response.
    ///
    /// - Parameter isDeviceOffline: The device had no usable network, see
    ///   ``isDeviceOffline``.
    public static func network(_ underlying: String, isDeviceOffline: Bool = false)
        -> VoidhashApiError
    {
        return VoidhashApiError(
            code: "NETWORK_ERROR", message: underlying, isDeviceOffline: isDeviceOffline)
    }

    /// The response body could not be decoded into the expected shape.
    ///
    /// - Parameter statusCode: The `2xx` status an undecodable JSON object arrived with; `nil`
    ///   for any other body. The failure stays transient either way, but the status tells an
    ///   answer of the backend's, which accepted the request, from one that is not its own.
    public static func invalidResponse(_ underlying: String, statusCode: Int? = nil)
        -> VoidhashApiError
    {
        return VoidhashApiError(
            code: "INVALID_RESPONSE", message: underlying, statusCode: statusCode)
    }

    /// The request body could not be encoded, so nothing was sent.
    public static func requestEncodingFailed(_ underlying: String) -> VoidhashApiError {
        return VoidhashApiError(
            code: "REQUEST_ENCODING_FAILED", message: underlying, isLocal: true)
    }

    /// Maps a non-2xx response onto a stable code, reading `_tag` and `message` (or `cause`,
    /// `reason`, or the ingest endpoint's `error`) from the body when it is a Voidhash API error.
    public static func http(
        statusCode: Int,
        body: Data,
        retryAfterMilliseconds: Double? = nil
    ) -> VoidhashApiError {
        let object = (try? JSONSerialization.jsonObject(with: body)) as? [String: Any]
        return http(
            statusCode: statusCode,
            tag: object?["_tag"] as? String,
            message: object?["message"] as? String ?? object?["cause"] as? String
                ?? object?["reason"] as? String ?? object?["error"] as? String,
            retryAfterMilliseconds: retryAfterMilliseconds)
    }

    /// Maps a non-2xx response onto a stable code, preferring the server supplied message.
    ///
    /// The codes are the ones documented in `libraries/react-native/ERROR_HANDLING.md` and shared
    /// with the Android SDK.
    public static func http(
        statusCode: Int,
        tag: String?,
        message: String?,
        retryAfterMilliseconds: Double? = nil
    ) -> VoidhashApiError {
        let code: String
        switch statusCode {
        case 400:
            code = "INVALID_REQUEST"
        case 401, 403:
            // Untagged, it is a page from something in front of the backend, which must not be
            // reported as a rejected publishable key.
            code = tag?.isEmpty == false ? "AUTHENTICATION_FAILED" : "API_ERROR"
        case 404:
            code = "NOT_FOUND"
        case 409:
            code = "ALREADY_IDENTIFIED"
        case 429:
            code = "RATE_LIMIT_EXCEEDED"
        default:
            code = "API_ERROR"
        }

        return VoidhashApiError(
            code: code,
            message: message ?? "Request failed with status \(statusCode)",
            statusCode: statusCode,
            tag: tag,
            retryAfterMilliseconds: retryAfterMilliseconds
        )
    }
}
