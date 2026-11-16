import Foundation

/// Reads the one thing the SDK needs from a flow package without the renderer: the images the
/// package lists, so they can be fetched before the flow is shown. Everything else in a package
/// is the renderer's to decode and validate.
enum FlowPackageMetadata {
    /// `VHFP`, read as a little-endian integer.
    private static let magic: UInt32 = 0x5046_4856
    /// Deepest nesting of a metadata value that is followed; real metadata is two levels deep.
    private static let maxDepth = 16

    /// Every image URL a node of `package` can show, as its `META` section lists them under
    /// `images`, without duplicates and in the order listed.
    ///
    /// Empty for bytes that are not a readable package: fetching images ahead is never a
    /// reason to fail, and the renderer reports a package it cannot show.
    static func imageUrls(in package: Data) -> [String] {
        var reader = Reader(package)
        guard reader.u32() == magic, reader.u16() != nil, reader.u16() != nil,
            let sectionCount = reader.u32()
        else {
            return []
        }
        var strings: [String]?
        var metadata: Data?
        for _ in 0..<sectionCount {
            guard let tag = reader.bytes(4), let length = reader.u32(),
                let body = reader.bytes(Int(length))
            else {
                return []
            }
            switch String(decoding: tag, as: UTF8.self) {
            case "STRS":
                strings = stringTable(body)
            case "META":
                metadata = body
            default:
                break
            }
        }
        guard let strings, let metadata else {
            return []
        }
        var seen: Set<String> = []
        return imageIndices(in: metadata, strings: strings)
            .compactMap { strings.indices.contains($0) ? strings[$0] : nil }
            .filter { seen.insert($0).inserted }
    }

    private static func stringTable(_ body: Data) -> [String]? {
        var reader = Reader(body)
        guard let count = reader.u32() else {
            return nil
        }
        var strings: [String] = []
        for _ in 0..<count {
            guard let length = reader.u32(), let bytes = reader.bytes(Int(length)) else {
                return nil
            }
            strings.append(String(decoding: bytes, as: UTF8.self))
        }
        return strings
    }

    /// String indices of the entries of the metadata object's `images` array.
    private static func imageIndices(in metadata: Data, strings: [String]) -> [Int] {
        var reader = Reader(metadata)
        guard reader.u8() == ValueTag.object, let count = reader.u32() else {
            return []
        }
        for _ in 0..<count {
            guard let key = reader.u32() else {
                return []
            }
            guard strings.indices.contains(Int(key)), strings[Int(key)] == "images" else {
                guard reader.skipValue(depth: 0) else {
                    return []
                }
                continue
            }
            guard reader.u8() == ValueTag.array, let entries = reader.u32() else {
                return []
            }
            var indices: [Int] = []
            for _ in 0..<entries {
                guard reader.u8() == ValueTag.string, let index = reader.u32() else {
                    return []
                }
                indices.append(Int(index))
            }
            return indices
        }
        return []
    }

    private enum ValueTag {
        static let number: UInt8 = 3
        static let string: UInt8 = 4
        static let array: UInt8 = 5
        static let object: UInt8 = 6
    }

    /// Reads little-endian integers off `data`, answering `nil` past its end.
    private struct Reader {
        private let data: Data
        private var offset: Int

        init(_ data: Data) {
            self.data = data
            offset = data.startIndex
        }

        mutating func bytes(_ count: Int) -> Data? {
            guard count >= 0, count <= data.endIndex - offset else {
                return nil
            }
            defer { offset += count }
            return data.subdata(in: offset..<(offset + count))
        }

        mutating func u8() -> UInt8? {
            return bytes(1)?.first
        }

        mutating func u16() -> UInt16? {
            return bytes(2).map { $0.reversed().reduce(0) { $0 << 8 | UInt16($1) } }
        }

        mutating func u32() -> UInt32? {
            return bytes(4).map { $0.reversed().reduce(0) { $0 << 8 | UInt32($1) } }
        }

        /// Moves past one value; `false` for a value that is cut short, unknown or nested deeper
        /// than any metadata is.
        mutating func skipValue(depth: Int) -> Bool {
            guard depth < FlowPackageMetadata.maxDepth, let tag = u8() else {
                return false
            }
            switch tag {
            case 0, 1, 2:
                return true
            case ValueTag.number:
                return bytes(8) != nil
            case ValueTag.string:
                return bytes(4) != nil
            case ValueTag.array:
                guard let count = u32() else {
                    return false
                }
                for _ in 0..<count {
                    guard skipValue(depth: depth + 1) else {
                        return false
                    }
                }
                return true
            case ValueTag.object:
                guard let count = u32() else {
                    return false
                }
                for _ in 0..<count {
                    guard bytes(4) != nil, skipValue(depth: depth + 1) else {
                        return false
                    }
                }
                return true
            default:
                return false
            }
        }
    }
}
