import Foundation
import VoidhashCore

/// A value an app and a flow exchange: a string, a number, a boolean or a list of strings.
///
/// Inputs, outputs, and the arguments and replies of app actions are dictionaries of these by
/// name. Literals convert on their own:
/// `["firstName": "Ada", "credits": 3, "isMember": true, "interests": ["yoga", "chess"]]`.
public enum FlowValue: Sendable, Hashable {
    case string(String)
    case number(Double)
    case bool(Bool)
    /// An ordered list of strings without repeats, such as the interests an end user picked.
    /// A flow holds at most 100 strings of at most 200 characters, and ignores a longer list.
    case list([String])

    /// The string, or `nil` for any other value.
    public var stringValue: String? {
        guard case .string(let value) = self else {
            return nil
        }
        return value
    }

    /// The number, or `nil` for any other value.
    public var numberValue: Double? {
        guard case .number(let value) = self else {
            return nil
        }
        return value
    }

    /// The boolean, or `nil` for any other value.
    public var boolValue: Bool? {
        guard case .bool(let value) = self else {
            return nil
        }
        return value
    }

    /// The list, or `nil` for any other value.
    public var listValue: [String]? {
        guard case .list(let value) = self else {
            return nil
        }
        return value
    }
}

extension FlowValue: ExpressibleByStringLiteral, ExpressibleByIntegerLiteral,
    ExpressibleByFloatLiteral, ExpressibleByBooleanLiteral, ExpressibleByArrayLiteral
{
    public init(arrayLiteral elements: String...) {
        self = .list(elements)
    }

    public init(stringLiteral value: String) {
        self = .string(value)
    }

    public init(integerLiteral value: Int) {
        self = .number(Double(value))
    }

    public init(floatLiteral value: Double) {
        self = .number(value)
    }

    public init(booleanLiteral value: Bool) {
        self = .bool(value)
    }
}

extension FlowValue: Codable {
    /// Decodes a single JSON string, number, boolean or array of strings.
    public init(from decoder: any Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String].self) {
            self = .list(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "A flow value is a string, a number, a boolean or a list of strings"
            )
        }
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .list(let value):
            try container.encode(value)
        }
    }
}

extension FlowValue {
    /// The value of a flow message field; `nil` for anything but a string, a number, a
    /// boolean or an array of strings.
    init?(json: JSONValue) {
        switch json {
        case .string(let value):
            self = .string(value)
        case .number(let value):
            self = .number(value)
        case .bool(let value):
            self = .bool(value)
        case .array(let items):
            var strings: [String] = []
            for item in items {
                guard case .string(let string) = item else {
                    return nil
                }
                strings.append(string)
            }
            self = .list(strings)
        case .null, .object:
            return nil
        }
    }

    /// The value as `JSONSerialization` writes it.
    var jsonObject: Any {
        switch self {
        case .string(let string):
            return string
        case .number(let number):
            return number
        case .bool(let bool):
            return bool
        case .list(let strings):
            return strings
        }
    }

    /// The values of a flow message's object field, without the entries that are not flow
    /// values.
    static func values(in object: [String: JSONValue]?) -> [String: FlowValue] {
        return (object ?? [:]).compactMapValues(FlowValue.init(json:))
    }

    /// Whether the value can be written as JSON: every value but a number that is not finite.
    var isRepresentable: Bool {
        guard case .number(let value) = self else {
            return true
        }
        return value.isFinite
    }
}

/// Handles an app action a flow calls: receives the call's arguments by name and returns the
/// reply by name, or throws, which the flow handles as a failed call.
///
/// The handler's task is cancelled when the flow ends before it returned.
public typealias FlowActionHandler =
    @Sendable (_ arguments: [String: FlowValue]) async throws -> [String: FlowValue]

/// How a presented flow ended, and what it left for the app.
///
/// Every ending has this shape. A flow that could not be presented is not an ending: presenting
/// it throws a ``FlowError``.
public struct FlowResult: Sendable, Equatable {
    /// The outcome of a flow that ended with a purchase; ``productId`` names what was bought.
    public static let purchased = "purchased"
    /// The outcome of a flow that ended with a restore.
    public static let restored = "restored"
    /// The outcome of a flow the end user closed. Also the outcome when the app dismissed it,
    /// another flow replaced it, the presenting task was cancelled, or the client was shut
    /// down with the flow on screen.
    public static let dismissed = "dismissed"

    /// ``purchased``, ``restored``, ``dismissed``, or the outcome the flow finished with, such
    /// as `completed`.
    public let outcome: String
    /// The flow's outputs by name; empty when it declares none or reported none.
    public let output: [String: FlowValue]
    /// The product bought, when the outcome is ``purchased``.
    public let productId: String?

    public init(outcome: String, output: [String: FlowValue] = [:], productId: String? = nil) {
        self.outcome = outcome
        self.output = output
        self.productId = productId
    }
}
