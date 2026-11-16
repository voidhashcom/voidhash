import Foundation

/// Type-erased JSON value, used for the free-form parts of the SDK wire format
/// (person traits, paywall runtime variables).
public enum JSONValue: Codable, Sendable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container, debugDescription: "Unsupported JSON value")
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null:
            try container.encodeNil()
        case .bool(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .string(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        }
    }
}

extension JSONValue {
    /// Replaces every non-finite number (`NaN`, `±infinity`) in `properties` with `null`.
    ///
    /// JSON cannot represent such numbers and `JSONEncoder` refuses to write them, so one of them
    /// would otherwise fail the whole request body or queue record it sits in. Callers sanitize
    /// host input once, where it enters the SDK, and report the returned key paths.
    ///
    /// - Returns: The sanitized properties and the sorted key paths of the replaced numbers
    ///   (`score`, `nested.depth`, `list[2]`).
    public static func replacingNonFiniteNumbers(in properties: [String: JSONValue]) -> (
        properties: [String: JSONValue], nonFiniteKeyPaths: [String]
    ) {
        var keyPaths: [String] = []
        let sanitized = properties.reduce(into: [String: JSONValue]()) { result, entry in
            result[entry.key] = entry.value.replacingNonFiniteNumbers(
                keyPath: entry.key, keyPaths: &keyPaths)
        }
        return (keyPaths.isEmpty ? properties : sanitized, keyPaths.sorted())
    }

    private func replacingNonFiniteNumbers(keyPath: String, keyPaths: inout [String]) -> JSONValue {
        switch self {
        case .number(let number) where !number.isFinite:
            keyPaths.append(keyPath)
            return .null
        case .array(let array):
            return .array(
                array.enumerated().map { index, element in
                    element.replacingNonFiniteNumbers(
                        keyPath: "\(keyPath)[\(index)]", keyPaths: &keyPaths)
                })
        case .object(let object):
            return .object(
                object.reduce(into: [String: JSONValue]()) { result, entry in
                    result[entry.key] = entry.value.replacingNonFiniteNumbers(
                        keyPath: "\(keyPath).\(entry.key)", keyPaths: &keyPaths)
                })
        case .null, .bool, .number, .string:
            return self
        }
    }
}
