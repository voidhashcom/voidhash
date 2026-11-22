import Foundation

/// The images a flow package lists, read without the renderer: every URL a node can show, for
/// fetching them before the flow is shown, and the SHA-256 the build recorded for each image it
/// pinned, which a host verifies the bytes it shows against. Everything else in a package is the
/// renderer's to decode and validate. For the SDK's flow renderer, not the documented API.
@_spi(VoidhashFlows)
public struct FlowPackageImages: Sendable, Equatable {
    /// Every image URL a node of the package can show, as its `META` section lists them under
    /// `images`, without duplicates and in the order listed.
    public let urls: [String]
    /// The lowercase hex SHA-256 its build recorded for each uploaded image the package shows,
    /// by URL (`META` `imageSha256`). An image URL missing here was typed by a designer or is
    /// worked out on the device, or the package was built before builds recorded hashes: it is
    /// shown unverified.
    public let sha256: [String: String]

    public init(urls: [String] = [], sha256: [String: String] = [:]) {
        self.urls = urls
        self.sha256 = sha256
    }

    /// The images `package` lists.
    ///
    /// None for bytes that are not a readable package: the renderer reports a package it cannot
    /// show, and a package this reader cannot read pins no image.
    public init(package: Data) {
        self = FlowPackageMetadata.images(in: package)
    }
}

enum FlowPackageMetadata {
    /// `VHFP`, read as a little-endian integer.
    private static let magic: UInt32 = 0x5046_4856
    /// Deepest nesting of a metadata value that is followed; real metadata is two levels deep.
    private static let maxDepth = 16

    static func images(in package: Data) -> FlowPackageImages {
        var reader = Reader(package)
        guard reader.u32() == magic, reader.u16() != nil, reader.u16() != nil,
            let sectionCount = reader.u32()
        else {
            return FlowPackageImages()
        }
        var strings: [String]?
        var metadata: Data?
        for _ in 0..<sectionCount {
            guard let tag = reader.bytes(4), let length = reader.u32(),
                let body = reader.bytes(Int(length))
            else {
                return FlowPackageImages()
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
        guard let strings, let metadata, let entries = imageEntries(in: metadata, strings: strings)
        else {
            return FlowPackageImages()
        }
        var seen: Set<String> = []
        return FlowPackageImages(
            urls: entries.urls.filter { seen.insert($0).inserted }, sha256: entries.sha256)
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

    /// The metadata object's `images` and `imageSha256`; `nil` for metadata that is not an
    /// object of well-formed values.
    private static func imageEntries(in metadata: Data, strings: [String])
        -> (urls: [String], sha256: [String: String])?
    {
        var reader = Reader(metadata)
        guard reader.u8() == ValueTag.object, let count = reader.u32() else {
            return nil
        }
        func string() -> String? {
            guard reader.u8() == ValueTag.string, let index = reader.u32(),
                strings.indices.contains(Int(index))
            else {
                return nil
            }
            return strings[Int(index)]
        }
        var urls: [String] = []
        var sha256: [String: String] = [:]
        for _ in 0..<count {
            guard let key = reader.u32(), strings.indices.contains(Int(key)) else {
                return nil
            }
            switch strings[Int(key)] {
            case "images":
                guard reader.u8() == ValueTag.array, let entries = reader.u32() else {
                    return nil
                }
                for _ in 0..<entries {
                    guard let url = string() else {
                        return nil
                    }
                    urls.append(url)
                }
            case "imageSha256":
                guard reader.u8() == ValueTag.object, let entries = reader.u32() else {
                    return nil
                }
                for _ in 0..<entries {
                    guard let url = reader.u32(), strings.indices.contains(Int(url)),
                        let hash = string()
                    else {
                        return nil
                    }
                    sha256[strings[Int(url)]] = hash.lowercased()
                }
            default:
                guard reader.skipValue(depth: 0) else {
                    return nil
                }
            }
        }
        return (urls, sha256)
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
