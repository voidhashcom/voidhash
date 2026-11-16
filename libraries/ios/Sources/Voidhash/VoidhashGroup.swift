import CryptoKit
import Foundation
import VoidhashCore

/// A group the end user belongs to, such as their company or workspace, as
/// ``VoidhashClient/setGroups(_:)`` takes it.
///
/// A string literal makes a group with that id and no properties:
///
/// ```swift
/// await voidhash.setGroups([
///     "company": VoidhashGroup(id: "acme", properties: ["plan": .string("pro")]),
///     "team": "design",
/// ])
/// ```
public struct VoidhashGroup: Sendable, Equatable, ExpressibleByStringLiteral {
    /// Identifies the group within its type: 1 to 256 characters.
    public var id: String
    /// The group's own properties, such as its `name` and `plan`: strings, numbers or booleans.
    public var properties: [String: JSONValue]

    public init(id: String, properties: [String: JSONValue] = [:]) {
        self.id = id
        self.properties = properties
    }

    public init(stringLiteral value: String) {
        self.init(id: value)
    }

    /// Digest of the id and properties, the same for equal groups whatever the order of their
    /// properties and across launches.
    var digest: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let group: [String: JSONValue] = ["id": .string(id), "properties": .object(properties)]
        let canonical = (try? encoder.encode(group)) ?? Data()
        return SHA256.hash(data: canonical).map { String(format: "%02x", $0) }.joined()
    }
}
