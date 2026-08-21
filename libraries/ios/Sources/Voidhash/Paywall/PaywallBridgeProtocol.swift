import Foundation
import VoidhashCore

/// Page → native message types.
public enum PaywallBridgeActionType: String, Sendable, Equatable, CaseIterable {
    case ready
    case close
    case purchase
    case restore
    case openExternal
    case event
    case log
}

/// Purchase/restore progress reported back to the page.
public enum PaywallBridgeStatus: String, Sendable, Equatable {
    case purchasing
    case purchased
    case cancelled
    case failed
    case restoring
    case restored
}

/// A parsed page → native envelope: `{version: 1, type, requestId?, payload}`.
public struct PaywallBridgeEnvelope: Sendable, Equatable {
    /// Envelope type.
    public let type: PaywallBridgeActionType
    /// Correlation id the response and status envelopes echo back.
    public let requestId: String?
    /// Type-specific payload, absent for payload-less envelopes.
    public let payload: [String: JSONValue]?

    public init(
        type: PaywallBridgeActionType, requestId: String? = nil,
        payload: [String: JSONValue]? = nil
    ) {
        self.type = type
        self.requestId = requestId
        self.payload = payload
    }

    /// Reads a string field out of the payload.
    public func string(_ key: String) -> String? {
        guard case .string(let value)? = payload?[key] else {
            return nil
        }
        return value
    }

    /// Reads an object field out of the payload.
    public func object(_ key: String) -> [String: JSONValue]? {
        guard case .object(let value)? = payload?[key] else {
            return nil
        }
        return value
    }
}

/// Raised when a page → native message cannot be parsed.
///
/// Codes match `src/internal/paywall-bridge/parser.ts`.
public struct PaywallBridgeParseError: Error, Sendable, Equatable, CustomStringConvertible,
    LocalizedError
{
    /// Stable parse error code.
    public let code: String
    /// Human readable message.
    public let message: String

    public init(code: String, message: String) {
        self.code = code
        self.message = message
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

/// Parses and serializes the paywall bridge envelopes.
///
/// Port of `src/internal/paywall-bridge/{parser,protocol}.ts`. The wire format is a
/// cross-platform contract: version `1`, page → native action types and native → page
/// `response`/`status`/`configure` envelopes.
public enum PaywallBridgeProtocol {
    /// Parses a raw page → native message.
    public static func parse(_ raw: String) throws -> PaywallBridgeEnvelope {
        guard let data = raw.data(using: .utf8),
            let parsed = try? JSONSerialization.jsonObject(with: data)
        else {
            throw PaywallBridgeParseError(
                code: "INVALID_JSON",
                message: "Invalid paywall bridge payload: failed to parse JSON")
        }

        guard let envelope = parsed as? [String: Any] else {
            throw PaywallBridgeParseError(
                code: "INVALID_ENVELOPE",
                message: "Invalid paywall bridge payload: expected object envelope")
        }

        guard let version = envelope["version"] as? NSNumber,
            version.intValue == PaywallBridge.version
        else {
            throw PaywallBridgeParseError(
                code: "UNSUPPORTED_VERSION",
                message:
                    "Unsupported paywall bridge version: \(describe(envelope["version"]))")
        }

        guard let rawType = envelope["type"] as? String,
            let type = PaywallBridgeActionType(rawValue: rawType)
        else {
            throw PaywallBridgeParseError(
                code: "UNSUPPORTED_TYPE",
                message:
                    "Unsupported paywall bridge message type: \(describe(envelope["type"]))")
        }

        var requestId: String?
        if let rawRequestId = envelope["requestId"], !(rawRequestId is NSNull) {
            guard let value = rawRequestId as? String, !value.isEmpty else {
                throw PaywallBridgeParseError(
                    code: "INVALID_ENVELOPE",
                    message:
                        "Invalid paywall bridge payload: 'requestId' must be a non-empty string when present"
                )
            }
            requestId = value
        }

        let payload = try validatePayload(type: type, raw: envelope["payload"])
        return PaywallBridgeEnvelope(type: type, requestId: requestId, payload: payload)
    }

    /// Serializes a `status` envelope.
    public static func statusMessage(
        _ status: PaywallBridgeStatus,
        requestId: String? = nil,
        productId: String? = nil,
        error: String? = nil
    ) -> String {
        var payload: [String: Any] = ["status": status.rawValue]
        if let productId {
            payload["productId"] = productId
        }
        if let error {
            payload["error"] = error
        }

        return serialize(type: "status", requestId: requestId, payload: payload)
    }

    /// Serializes a successful `response` envelope.
    public static func successResponse(
        _ action: PaywallBridgeActionType,
        requestId: String? = nil,
        data: [String: Any]? = nil
    ) -> String {
        var payload: [String: Any] = ["action": action.rawValue, "status": "success"]
        if let data {
            payload["data"] = data
        }

        return serialize(type: "response", requestId: requestId, payload: payload)
    }

    /// Serializes a failed `response` envelope.
    public static func errorResponse(
        _ action: PaywallBridgeActionType,
        code: String,
        message: String,
        requestId: String? = nil
    ) -> String {
        return serialize(
            type: "response", requestId: requestId,
            payload: [
                "action": action.rawValue,
                "status": "error",
                "error": ["code": code, "message": message],
            ])
    }

    /// Serializes the `configure` envelope carrying the runtime config.
    ///
    /// When the config cannot be encoded the envelope degrades to an empty product list with the
    /// release's variables preserved — mirroring the React Native fallback, so a bundle is never
    /// left waiting on a configure it can't act on.
    ///
    /// - Parameter warn: Receives a diagnostic whenever the full config could not be encoded.
    public static func configureMessage(
        _ config: PaywallRuntimeConfig,
        requestId: String? = nil,
        warn: @escaping VoidhashWarningHandler = VoidhashWarnings.standard
    ) -> String {
        if let payload = encodedPayload(config) {
            return serialize(type: "configure", requestId: requestId, payload: payload, warn: warn)
        }

        warn("Failed to encode the paywall configure message; sending a degraded config")

        let degraded = PaywallRuntimeConfig(
            products: [],
            variables: config.variables,
            locale: config.locale,
            platform: config.platform
        )
        let payload =
            encodedPayload(degraded)
            ?? ["products": [], "variables": [String: Any]()]

        return serialize(type: "configure", requestId: requestId, payload: payload, warn: warn)
    }

    private static func encodedPayload(_ config: PaywallRuntimeConfig) -> [String: Any]? {
        guard let data = try? JSONEncoder().encode(config) else {
            return nil
        }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private static func validatePayload(type: PaywallBridgeActionType, raw: Any?) throws
        -> [String: JSONValue]?
    {
        guard let raw, !(raw is NSNull) else {
            switch type {
            case .purchase, .openExternal, .event, .log:
                throw PaywallBridgeParseError(
                    code: "INVALID_PAYLOAD",
                    message:
                        "Invalid paywall bridge payload for '\(type.rawValue)': payload is required"
                )
            case .ready, .close, .restore:
                return nil
            }
        }

        guard let object = raw as? [String: Any] else {
            throw PaywallBridgeParseError(
                code: "INVALID_PAYLOAD",
                message:
                    "Invalid paywall bridge payload for '\(type.rawValue)': payload must be an object"
            )
        }

        switch type {
        case .purchase:
            try requireNonEmptyString(object["productId"], field: "productId", type: type)
        case .openExternal:
            try requireNonEmptyString(object["url"], field: "url", type: type)
        case .event:
            try requireNonEmptyString(object["name"], field: "name", type: type)
            if let properties = object["properties"], !(properties is NSNull),
                !(properties is [String: Any])
            {
                throw PaywallBridgeParseError(
                    code: "INVALID_PAYLOAD",
                    message:
                        "Invalid paywall bridge payload for 'event': 'properties' must be an object when present"
                )
            }
        case .log:
            let level = object["level"] as? String
            guard level == "debug" || level == "info" || level == "warn" || level == "error" else {
                throw PaywallBridgeParseError(
                    code: "INVALID_PAYLOAD",
                    message:
                        "Invalid paywall bridge payload for 'log': 'level' must be debug|info|warn|error"
                )
            }
            try requireNonEmptyString(object["message"], field: "message", type: type)
        case .ready, .close, .restore:
            break
        }

        return jsonObject(object)
    }

    private static func requireNonEmptyString(
        _ value: Any?, field: String, type: PaywallBridgeActionType
    ) throws {
        guard let string = value as? String, !string.isEmpty else {
            throw PaywallBridgeParseError(
                code: "INVALID_PAYLOAD",
                message:
                    "Invalid paywall bridge payload for '\(type.rawValue)': '\(field)' must be a non-empty string"
            )
        }
    }

    private static func serialize(
        type: String, requestId: String?, payload: [String: Any],
        warn: VoidhashWarningHandler = VoidhashWarnings.standard
    ) -> String {
        var envelope: [String: Any] = [
            "payload": payload,
            "type": type,
            "version": PaywallBridge.version,
        ]
        if let requestId {
            envelope["requestId"] = requestId
        }

        // `JSONSerialization.data` raises an Objective-C exception — uncatchable from Swift — for
        // values it cannot represent, so the envelope is validated before it is encoded.
        guard JSONSerialization.isValidJSONObject(envelope),
            let data = try? JSONSerialization.data(withJSONObject: envelope, options: []),
            let json = String(data: data, encoding: .utf8)
        else {
            warn("Failed to serialize the paywall bridge '\(type)' message")
            return "{}"
        }
        return json
    }

    private static func describe(_ value: Any?) -> String {
        guard let value, !(value is NSNull) else {
            return "undefined"
        }
        return String(describing: value)
    }

    static func jsonObject(_ object: [String: Any]) -> [String: JSONValue] {
        var result: [String: JSONValue] = [:]
        for (key, value) in object {
            result[key] = jsonValue(value)
        }
        return result
    }

    static func jsonValue(_ value: Any) -> JSONValue {
        switch value {
        case is NSNull:
            return .null
        case let number as NSNumber:
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                return .bool(number.boolValue)
            }
            return .number(number.doubleValue)
        case let string as String:
            return .string(string)
        case let array as [Any]:
            return .array(array.map(jsonValue))
        case let object as [String: Any]:
            return .object(jsonObject(object))
        default:
            return .null
        }
    }
}
