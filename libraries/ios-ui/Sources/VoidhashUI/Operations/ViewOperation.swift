import Foundation

/// A prop value in the flow commit protocol's encoding (views protocol, "Values").
package enum PropValue: Equatable, Sendable {
    case undefined
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([PropValue])
    case object([String: PropValue])

    /// A finite number, or `nil`.
    package var number: Double? {
        guard case .number(let value) = self, value.isFinite else {
            return nil
        }
        return value
    }

    package var string: String? {
        guard case .string(let value) = self else {
            return nil
        }
        return value
    }

    package var bool: Bool? {
        guard case .bool(let value) = self else {
            return nil
        }
        return value
    }

    package var array: [PropValue]? {
        guard case .array(let value) = self else {
            return nil
        }
        return value
    }

    package var object: [String: PropValue]? {
        guard case .object(let value) = self else {
            return nil
        }
        return value
    }

    /// The entry `key` of an object.
    package subscript(key: String) -> PropValue? {
        return object?[key]
    }

    /// The finite numbers of an array, `nil` unless every entry is one.
    package var numbers: [Double]? {
        guard let array else {
            return nil
        }
        let numbers = array.compactMap(\.number)
        return numbers.count == array.count ? numbers : nil
    }
}

/// A view's frame in its parent, in logical pixels.
package struct ViewFrame: Equatable, Sendable {
    package var x: Float
    package var y: Float
    package var width: Float
    package var height: Float

    package init(x: Float, y: Float, width: Float, height: Float) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }

    package var rect: CGRect {
        let finite = { (value: Float) -> CGFloat in value.isFinite ? CGFloat(value) : 0 }
        return CGRect(
            x: finite(x), y: finite(y), width: max(0, finite(width)), height: max(0, finite(height)))
    }
}

/// One view operation of a batch (views protocol, "Operation batches").
package enum ViewOperation: Equatable, Sendable {
    /// Release every view except the root; the whole tree follows.
    case reset
    case create(id: Int32, kind: UInt8)
    /// Props to merge; `.null` returns a key to its default.
    case props(id: Int32, props: [String: PropValue])
    case frame(id: Int32, frame: ViewFrame)
    /// The view's subviews, in paint order.
    case children(id: Int32, children: [Int32])
    case delete(id: Int32)
    /// A canvas's next draw list and the images it references by index.
    case canvas(id: Int32, images: [String], drawList: [UInt8])
    /// Give a `textInput` view the keyboard.
    case textFocus(id: Int32)
    /// Take the keyboard from a `textInput` view, when it has it.
    case textBlur(id: Int32)
    /// Set a `textInput` view's text and selection, when its revision is still `base`.
    case textSet(TextSet)
}

/// A `TEXT_SET` (views protocol, "Revisions"). Its text is the end user's: it is never part of
/// a description, so it cannot reach a log through one.
package struct TextSet: Equatable, Sendable, CustomStringConvertible, CustomDebugStringConvertible,
    CustomReflectable
{
    /// `base` of a set that applies whatever the field holds (`VHV_TEXT_ANY_REVISION`).
    package static let anyRevision = UInt64.max

    package var id: Int32
    package var base: UInt64
    package var revision: UInt64
    /// UTF-16 code units of `text`.
    package var selectionBase: Int
    package var selectionExtent: Int
    package var text: String

    package init(
        id: Int32, base: UInt64, revision: UInt64, selectionBase: Int, selectionExtent: Int,
        text: String
    ) {
        self.id = id
        self.base = base
        self.revision = revision
        self.selectionBase = selectionBase
        self.selectionExtent = selectionExtent
        self.text = text
    }

    package var description: String {
        return "TEXT_SET(\(id), base \(base), revision \(revision))"
    }

    package var debugDescription: String {
        return description
    }

    package var customMirror: Mirror {
        return Mirror(self, children: ["id": id, "base": base, "revision": revision])
    }
}

/// A batch the host cannot apply at all.
package enum OperationBatchError: Error, Equatable, CustomStringConvertible {
    case wrongMagic
    case unsupportedVersion(UInt16)
    case truncated

    package var description: String {
        switch self {
        case .wrongMagic:
            return "the view operation batch has the wrong magic"
        case .unsupportedVersion(let version):
            return "view operation batch version \(version) is not supported"
        case .truncated:
            return "the view operation batch is truncated"
        }
    }
}

/// Decodes view operation batches, tolerant exactly as the protocol requires: an unknown
/// operation is skipped by its length, payload bytes after the known fields and unknown prop
/// keys are left alone, and a batch of another magic or version is rejected.
package enum OperationBatch {
    /// `VHVO` read as a little-endian `u32`.
    package static let magic: UInt32 = 0x4F56_4856
    package static let version: UInt16 = 1
    /// Magic, version, flags and operation count.
    package static let headerBytes = 12

    /// The decoded operations, and a reason for every operation whose payload could not be
    /// read (it is skipped; the rest of the batch applies).
    package static func decode(_ bytes: [UInt8]) throws -> (
        operations: [ViewOperation], skipped: [String]
    ) {
        var reader = ByteReader(bytes[...])
        guard let magic = reader.u32() else {
            throw OperationBatchError.truncated
        }
        guard magic == Self.magic else {
            throw OperationBatchError.wrongMagic
        }
        guard let version = reader.u16(), reader.u16() != nil, let count = reader.u32() else {
            throw OperationBatchError.truncated
        }
        guard version == Self.version else {
            throw OperationBatchError.unsupportedVersion(version)
        }
        var operations: [ViewOperation] = []
        var skipped: [String] = []
        operations.reserveCapacity(Int(min(count, 65_536)))
        for _ in 0..<count {
            guard let code = reader.u8(), let length = reader.u32(),
                let payload = reader.take(Int(length))
            else {
                throw OperationBatchError.truncated
            }
            var operation = ByteReader(payload)
            switch decodeOperation(code: code, &operation) {
            case .operation(let decoded):
                operations.append(decoded)
            case .unknown:
                break
            case .malformed:
                skipped.append("operation \(code) has a malformed payload")
            }
        }
        return (operations, skipped)
    }

    private enum Decoded {
        case operation(ViewOperation)
        /// An operation this version does not know.
        case unknown
        case malformed
    }

    private static func decodeOperation(code: UInt8, _ reader: inout ByteReader) -> Decoded {
        switch code {
        case 1:
            return .operation(.reset)
        case 2:
            guard let id = reader.i32(), let kind = reader.u8() else { return .malformed }
            return .operation(.create(id: id, kind: kind))
        case 3:
            guard let id = reader.i32(), case .object(let props)? = reader.value() else {
                return .malformed
            }
            return .operation(.props(id: id, props: props))
        case 4:
            guard let id = reader.i32(), let x = reader.f32(), let y = reader.f32(),
                let width = reader.f32(), let height = reader.f32()
            else { return .malformed }
            return .operation(.frame(id: id, frame: ViewFrame(x: x, y: y, width: width, height: height)))
        case 5:
            guard let id = reader.i32(), let count = reader.u32(),
                Int(count) <= reader.remaining / 4
            else { return .malformed }
            var children: [Int32] = []
            children.reserveCapacity(Int(count))
            for _ in 0..<count {
                guard let child = reader.i32() else { return .malformed }
                children.append(child)
            }
            return .operation(.children(id: id, children: children))
        case 6:
            guard let id = reader.i32() else { return .malformed }
            return .operation(.delete(id: id))
        case 7:
            guard let id = reader.i32(), let count = reader.u32(),
                Int(count) <= reader.remaining / 4
            else { return .malformed }
            var images: [String] = []
            for _ in 0..<count {
                guard let url = reader.string() else { return .malformed }
                images.append(url)
            }
            guard let length = reader.u32(), let list = reader.take(Int(length)) else {
                return .malformed
            }
            return .operation(.canvas(id: id, images: images, drawList: Array(list)))
        case 8:
            guard let id = reader.i32() else { return .malformed }
            return .operation(.textFocus(id: id))
        case 9:
            guard let id = reader.i32() else { return .malformed }
            return .operation(.textBlur(id: id))
        case 10:
            guard let id = reader.i32(), let base = reader.u64(), let revision = reader.u64(),
                let selectionBase = reader.u32(), let selectionExtent = reader.u32(),
                let text = reader.string()
            else { return .malformed }
            return .operation(
                .textSet(
                    TextSet(
                        id: id, base: base, revision: revision,
                        selectionBase: Int(selectionBase), selectionExtent: Int(selectionExtent),
                        text: text)))
        default:
            return .unknown
        }
    }
}

/// Reads little-endian values; every read returns `nil` past the end.
package struct ByteReader {
    private let bytes: ArraySlice<UInt8>
    private var at: Int

    package init(_ bytes: ArraySlice<UInt8>) {
        self.bytes = bytes
        at = bytes.startIndex
    }

    package var remaining: Int {
        return bytes.endIndex - at
    }

    package mutating func take(_ count: Int) -> ArraySlice<UInt8>? {
        guard count >= 0, count <= remaining else {
            return nil
        }
        defer { at += count }
        return bytes[at..<at + count]
    }

    private mutating func integer<T: FixedWidthInteger>(_: T.Type) -> T? {
        guard let slice = take(MemoryLayout<T>.size) else {
            return nil
        }
        var value: T = 0
        for (shift, byte) in slice.enumerated() {
            value |= T(truncatingIfNeeded: byte) << (shift * 8)
        }
        return value
    }

    package mutating func u8() -> UInt8? { integer(UInt8.self) }
    package mutating func u16() -> UInt16? { integer(UInt16.self) }
    package mutating func u32() -> UInt32? { integer(UInt32.self) }
    package mutating func u64() -> UInt64? { integer(UInt64.self) }
    package mutating func i32() -> Int32? { integer(Int32.self) }
    package mutating func f32() -> Float? { u32().map(Float.init(bitPattern:)) }
    package mutating func f64() -> Double? { u64().map(Double.init(bitPattern:)) }

    package mutating func string() -> String? {
        guard let length = u32(), let bytes = take(Int(length)) else {
            return nil
        }
        return String(decoding: bytes, as: UTF8.self)
    }

    /// A value in the commit protocol's encoding; `nil` when malformed or of a tag that never
    /// appears in props.
    package mutating func value(depth: Int = 0) -> PropValue? {
        guard depth < 64, let tag = u8() else {
            return nil
        }
        switch tag {
        case 0: return .undefined
        case 1: return .null
        case 2: return .bool(false)
        case 3: return .bool(true)
        case 4: return f64().map(PropValue.number)
        case 5: return string().map(PropValue.string)
        case 6:
            guard let count = u32(), Int(count) <= remaining else { return nil }
            var items: [PropValue] = []
            items.reserveCapacity(Int(count))
            for _ in 0..<count {
                guard let item = value(depth: depth + 1) else { return nil }
                items.append(item)
            }
            return .array(items)
        case 7:
            guard let count = u32(), Int(count) <= remaining else { return nil }
            var entries: [String: PropValue] = [:]
            entries.reserveCapacity(Int(count))
            for _ in 0..<count {
                guard let key = string(), let item = value(depth: depth + 1) else { return nil }
                entries[key] = item
            }
            return .object(entries)
        default:
            return nil
        }
    }
}
