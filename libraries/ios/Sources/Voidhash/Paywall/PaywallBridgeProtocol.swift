import Foundation
import VoidhashCore

/// Flow → host message types.
enum PaywallBridgeActionType: String, Sendable, Equatable, CaseIterable {
    case ready
    case close
    case purchase
    case restore
    case openExternal
    case log
    case finish
    case requestPermission
    case setAttribute
    case track
    case screen
    case state
}

/// Purchase/restore progress reported back to the flow.
enum PaywallBridgeStatus: String, Sendable, Equatable {
    case purchasing
    case purchased
    case cancelled
    case failed
    case restoring
    case restored
}

/// A parsed flow → host envelope: `{version: 1, type, requestId?, payload}`.
struct PaywallBridgeEnvelope: Sendable, Equatable {
    let type: PaywallBridgeActionType
    /// Correlation id the response and status envelopes echo back.
    let requestId: String?
    /// Type-specific payload, absent for payload-less envelopes.
    let payload: [String: JSONValue]?

    init(
        type: PaywallBridgeActionType, requestId: String? = nil,
        payload: [String: JSONValue]? = nil
    ) {
        self.type = type
        self.requestId = requestId
        self.payload = payload
    }

    func string(_ key: String) -> String? {
        guard case .string(let value)? = payload?[key] else {
            return nil
        }
        return value
    }

    func number(_ key: String) -> Double? {
        guard case .number(let value)? = payload?[key] else {
            return nil
        }
        return value
    }

    func object(_ key: String) -> [String: JSONValue]? {
        guard case .object(let value)? = payload?[key] else {
            return nil
        }
        return value
    }
}

/// Raised when a flow → host message cannot be parsed.
struct PaywallBridgeParseError: Error, Sendable, Equatable, CustomStringConvertible {
    /// Stable parse error code.
    let code: String
    let message: String

    var description: String {
        return "\(code): \(message)"
    }
}

/// Parses and serializes the envelopes a flow and its host exchange.
///
/// The wire format is a cross-platform contract: version `1`, the flow → host message types
/// above and host → flow `configure`, `status` and `response` envelopes.
enum PaywallBridgeProtocol {
    static func parse(_ raw: String) throws -> PaywallBridgeEnvelope {
        guard let data = raw.data(using: .utf8),
            let parsed = try? JSONSerialization.jsonObject(with: data)
        else {
            throw PaywallBridgeParseError(
                code: "INVALID_JSON", message: "Invalid flow message: failed to parse JSON")
        }

        guard let envelope = parsed as? [String: Any] else {
            throw PaywallBridgeParseError(
                code: "INVALID_ENVELOPE", message: "Invalid flow message: expected object envelope")
        }

        guard let version = envelope["version"] as? NSNumber,
            version.intValue == PaywallBridge.version
        else {
            throw PaywallBridgeParseError(
                code: "UNSUPPORTED_VERSION",
                message: "Unsupported flow message version: \(describe(envelope["version"]))")
        }

        guard let rawType = envelope["type"] as? String,
            let type = PaywallBridgeActionType(rawValue: rawType)
        else {
            throw PaywallBridgeParseError(
                code: "UNSUPPORTED_TYPE",
                message: "Unsupported flow message type: \(describe(envelope["type"]))")
        }

        var requestId: String?
        if let rawRequestId = envelope["requestId"], !(rawRequestId is NSNull) {
            guard let value = rawRequestId as? String, !value.isEmpty else {
                throw PaywallBridgeParseError(
                    code: "INVALID_ENVELOPE",
                    message:
                        "Invalid flow message: 'requestId' must be a non-empty string when present")
            }
            requestId = value
        }

        let payload = try validatePayload(type: type, raw: envelope["payload"])
        return PaywallBridgeEnvelope(type: type, requestId: requestId, payload: payload)
    }

    static func statusMessage(
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

    static func successResponse(
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

    static func errorResponse(
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

    /// Serializes the `configure` envelope. A configuration that cannot be encoded degrades to
    /// no products, so the flow is never left waiting on a configure it cannot act on.
    static func configureMessage(
        _ config: FlowConfiguration,
        requestId: String? = nil,
        warn: @escaping VoidhashWarningHandler
    ) -> String {
        if let payload = encodedPayload(config) {
            return serialize(type: "configure", requestId: requestId, payload: payload, warn: warn)
        }
        warn("Failed to encode the flow configure message; sending it without products")
        var degraded = config
        degraded.products = []
        let payload = encodedPayload(degraded) ?? ["products": [], "variables": [String: Any]()]
        return serialize(type: "configure", requestId: requestId, payload: payload, warn: warn)
    }

    private static func encodedPayload(_ config: FlowConfiguration) -> [String: Any]? {
        guard let data = try? JSONEncoder().encode(config) else {
            return nil
        }
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
    }

    private static let logLevels: Set<String> = ["debug", "info", "warn", "warning", "error"]

    private static func validatePayload(type: PaywallBridgeActionType, raw: Any?) throws
        -> [String: JSONValue]?
    {
        guard let raw, !(raw is NSNull) else {
            switch type {
            case .ready, .close, .restore:
                return nil
            default:
                throw invalidPayload(type, "payload is required")
            }
        }

        guard let object = raw as? [String: Any] else {
            throw invalidPayload(type, "payload must be an object")
        }

        switch type {
        case .purchase:
            try requireNonEmptyString(object["productId"], field: "productId", type: type)
        case .openExternal:
            try requireNonEmptyString(object["url"], field: "url", type: type)
        case .log:
            guard let level = object["level"] as? String, logLevels.contains(level) else {
                throw invalidPayload(type, "'level' must be debug|info|warn|warning|error")
            }
            try requireNonEmptyString(object["message"], field: "message", type: type)
        case .finish:
            guard object["result"] is String else {
                throw invalidPayload(type, "'result' must be a string")
            }
            try requireObject(object["variables"], field: "variables", type: type, optional: true)
        case .requestPermission:
            try requireNonEmptyString(object["permission"], field: "permission", type: type)
        case .setAttribute:
            try requireNonEmptyString(object["name"], field: "name", type: type)
        case .track:
            try requireNonEmptyString(object["name"], field: "name", type: type)
            try requireObject(object["properties"], field: "properties", type: type, optional: true)
        case .screen:
            guard object["index"] is NSNumber else {
                throw invalidPayload(type, "'index' must be a number")
            }
        case .state:
            try requireObject(object["variables"], field: "variables", type: type, optional: false)
        case .ready, .close, .restore:
            break
        }

        return jsonObject(object)
    }

    private static func invalidPayload(_ type: PaywallBridgeActionType, _ reason: String)
        -> PaywallBridgeParseError
    {
        return PaywallBridgeParseError(
            code: "INVALID_PAYLOAD",
            message: "Invalid flow message payload for '\(type.rawValue)': \(reason)")
    }

    private static func requireNonEmptyString(
        _ value: Any?, field: String, type: PaywallBridgeActionType
    ) throws {
        guard let string = value as? String, !string.isEmpty else {
            throw invalidPayload(type, "'\(field)' must be a non-empty string")
        }
    }

    private static func requireObject(
        _ value: Any?, field: String, type: PaywallBridgeActionType, optional: Bool
    ) throws {
        if optional, value == nil || value is NSNull {
            return
        }
        guard value is [String: Any] else {
            throw invalidPayload(type, "'\(field)' must be an object")
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
            warn("Failed to serialize the flow '\(type)' message")
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
