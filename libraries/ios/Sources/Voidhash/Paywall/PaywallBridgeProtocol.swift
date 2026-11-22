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
    case appAction
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

    func bool(_ key: String) -> Bool? {
        guard case .bool(let value)? = payload?[key] else {
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
/// above and host → flow `configure`, `input`, `status` and `response` envelopes.
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

    /// The app's answer to the `appAction` call `requestId`: the reply by name, or why the call
    /// failed.
    static func appActionResponse(
        requestId: String, _ result: Result<[String: FlowValue], FlowActionError>
    ) -> String {
        switch result {
        case .success(let reply):
            return serialize(
                type: "response", requestId: requestId,
                payload: ["ok": true, "value": jsonObject(reply)])
        case .failure(let error):
            return serialize(
                type: "response", requestId: requestId,
                payload: ["ok": false, "error": error.message])
        }
    }

    /// Tells the flow on screen the permission statuses that changed while it was shown.
    static func permissionsContextMessage(_ statuses: [String: String]) -> String {
        return serialize(type: "context", requestId: nil, payload: ["permissions": statuses])
    }

    /// Changes inputs of the flow on screen.
    static func inputMessage(_ values: [String: FlowValue]) -> String {
        return serialize(type: "input", requestId: nil, payload: ["values": jsonObject(values)])
    }

    private static func jsonObject(_ values: [String: FlowValue]) -> [String: Any] {
        return values.mapValues(\.jsonObject)
    }

    /// Serializes the `configure` envelope. A configuration that cannot be encoded degrades to
    /// no products, so the flow is never left waiting on a configure it cannot act on. It carries
    /// the device's clock as it is when sent (`now`, milliseconds since 1970 UTC, and
    /// `utcOffset`, minutes ahead of UTC), which the flow's logic reads as today's date, and the
    /// seed its random numbers are drawn from (`randomSeed`, a whole number below 2^53, fresh for
    /// each presentation).
    static func configureMessage(
        _ config: FlowConfiguration,
        requestId: String? = nil,
        now: Date = Date(),
        timeZone: TimeZone = .current,
        randomSeed: UInt64 = UInt64.random(in: 0..<(1 << 53)),
        warn: @escaping VoidhashWarningHandler
    ) -> String {
        let clock: [String: Any] = [
            "now": (now.timeIntervalSince1970 * 1000).rounded(),
            "utcOffset": timeZone.secondsFromGMT(for: now) / 60,
            "randomSeed": randomSeed,
        ]
        if let payload = encodedPayload(config) {
            return serialize(
                type: "configure", requestId: requestId,
                payload: payload.merging(clock) { _, clock in clock }, warn: warn)
        }
        warn("Failed to encode the flow configure message; sending it without products")
        var degraded = config
        degraded.products = []
        let payload = encodedPayload(degraded)
            ?? ["products": [], "variables": [String: Any](), "input": [String: Any]()]
        return serialize(
            type: "configure", requestId: requestId,
            payload: payload.merging(clock) { _, clock in clock }, warn: warn)
    }

    /// Serializes the `products` envelope, which sends a flow on screen its products again, as
    /// `configure` gives them, after a purchase or restore changed what the store says of them;
    /// `nil` when they cannot be encoded, which sends nothing: the flow keeps what it had.
    static func productsMessage(
        _ products: [FlowConfigurationProduct], warn: @escaping VoidhashWarningHandler
    ) -> String? {
        guard let data = try? JSONEncoder().encode(products),
            let encoded = try? JSONSerialization.jsonObject(with: data) as? [Any]
        else {
            warn("Failed to encode the flow products message; the flow keeps the products it had")
            return nil
        }
        return serialize(type: "products", requestId: nil, payload: ["products": encoded], warn: warn)
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
            try requireObject(object["output"], field: "output", type: type, optional: true)
        case .appAction:
            try requireNonEmptyString(object["name"], field: "name", type: type)
            try requireObject(object["args"], field: "args", type: type, optional: true)
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
            try requireObject(object["output"], field: "output", type: type, optional: true)
        case .close:
            try requireObject(object["output"], field: "output", type: type, optional: true)
        case .ready, .restore:
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
