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

    public init(code: String, message: String, statusCode: Int? = nil, tag: String? = nil) {
        self.code = code
        self.message = message
        self.statusCode = statusCode
        self.tag = tag
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
    public static func network(_ underlying: String) -> VoidhashApiError {
        return VoidhashApiError(code: "NETWORK_ERROR", message: underlying)
    }

    /// The response body could not be decoded into the expected shape.
    public static func invalidResponse(_ underlying: String) -> VoidhashApiError {
        return VoidhashApiError(code: "INVALID_RESPONSE", message: underlying)
    }

    /// Maps a non-2xx response onto a stable code, preferring the server supplied message.
    ///
    /// The codes are the ones documented in `libraries/react-native/ERROR_HANDLING.md` and shared
    /// with the Android SDK.
    public static func http(statusCode: Int, tag: String?, message: String?) -> VoidhashApiError {
        let code: String
        switch statusCode {
        case 400:
            code = "INVALID_REQUEST"
        case 401, 403:
            code = "AUTHENTICATION_FAILED"
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
            tag: tag
        )
    }
}
