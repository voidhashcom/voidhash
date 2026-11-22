import CryptoKit
import Foundation
import VoidhashCore

/// Why a flow package could not be loaded.
struct FlowPackageLoadError: Error, Sendable, Equatable, CustomStringConvertible {
    /// What went wrong, as flow analytics report it.
    enum Failure: Sendable, Equatable {
        /// The package could not be downloaded.
        case download
        /// The downloaded bytes did not hash to the package's SHA-256.
        case integrity
        /// The backend withdrew the package: it is not shown, whichever answer names it.
        case withdrawn
    }

    let message: String
    let failure: Failure

    init(message: String, failure: Failure = .download) {
        self.message = message
        self.failure = failure
    }

    var description: String {
        return "FLOW_PACKAGE_UNAVAILABLE: \(message)"
    }
}

/// The verified bytes of a flow package.
struct LoadedFlowPackage: Sendable, Equatable {
    let data: Data
    /// Whether the bytes were already on the device: no download was needed.
    let fromCache: Bool

    init(data: Data, fromCache: Bool) {
        self.data = data
        self.fromCache = fromCache
    }
}

/// Why a download for a flow was refused.
public enum FlowDownloadError: LocalizedError, Sendable, Equatable, CustomStringConvertible {
    /// The server answered with a status other than 2xx.
    case status(Int)
    /// The content is larger than the download may be.
    case tooLarge(maxBytes: Int)
    /// ``FlowUrlPolicy`` refuses the URL, or the one a redirect ended at.
    case refusedUrl

    public var description: String {
        switch self {
        case .status(let statusCode):
            return "HTTP \(statusCode)"
        case .tooLarge(let maxBytes):
            return "larger than \(maxBytes / (1024 * 1024)) MB"
        case .refusedUrl:
            return "URL refused: flows download only over https, from hosts on the internet"
        }
    }

    public var errorDescription: String? {
        return description
    }
}

/// Which URLs may be downloaded for a flow: its package, the images it shows and the runtime
/// module it runs on. Each must be `https`, written plainly (no whitespace, control characters
/// or backslashes, `//` after the scheme, a host), carry no user name or password, and name a host
/// on the internet rather than the device itself or a network it is on: not `localhost` or a name
/// under it, not a `.local` name, which multicast DNS answers on the local network, and not an IP
/// address in a loopback, private, shared, link-local, multicast or reserved range
/// (``isLocalNetwork(_:)``). A flow names its images itself, and may compute them on the device:
/// it must not make the app read its own files or probe the networks the device is on.
///
/// The app's own backend is trusted in every build: the host of the `baseUrl` it configured is
/// downloaded from over `https` whatever its address, and so is an image the flow's package pins
/// (`imageSha256`), which the backend recorded from its own library and which is verified
/// against its hash, along with the redirects such a download follows. Only a debug build makes
/// an exception for `http`, for a local development server: one on the device itself
/// (`localhost`, `127.0.0.0/8`, `::1`), or the host of a `baseUrl` the app configured with
/// `http`, which it also downloads from over `http`. A redirect may lead to such a server only
/// from another one. ``FlowDownload`` refuses any other URL, and any redirect to one, before it
/// is requested. Hosts are read as `URLSession` reads them, from `URL.host`.
///
/// The rule is the one `libraries/test-fixtures/flow-url-policy.json` lists cases of, which the
/// Android SDK and the flow compiler share. An image a flow carries in a `data:` URL is shown
/// without a download, and only as ``dataImage(_:)`` reads it.
public enum FlowUrlPolicy {
    private final class Hosts: @unchecked Sendable {
        private let lock = NSLock()
        private var hosts: Set<String> = []

        func insert(_ host: String) { lock.withLock { _ = hosts.insert(host) } }
        var all: Set<String> { lock.withLock { hosts } }
    }

    private static let localHosts = Hosts()
    private static let backendHosts = Hosts()

    /// Largest image a `data:` URL may carry: as large as a downloaded image may be
    /// (``FlowImageStore/maxImageBytes``). One a package carries counts against its
    /// ``FlowDownload/maxPackageBytes`` as well; one a component makes on the device has no
    /// other bound.
    public static let maxDataImageBytes = FlowImageStore.maxImageBytes

    /// Whether this is a debug build, the only kind that downloads flows from a local server.
    #if DEBUG
        static let allowsLocalServers = true
    #else
        static let allowsLocalServers = false
    #endif

    /// Whether `url` may be downloaded for a flow; `pinned` for an image its package pins.
    public static func permits(_ url: URL, pinned: Bool = false) -> Bool {
        return decide(
            url, from: nil, localServers: allowsLocalServers, localHosts: localHosts.all,
            backendHosts: backendHosts.all, pinned: pinned)
    }

    /// Whether a download of `from` may follow a redirect to `to`; `pinned` for an image its
    /// package pins.
    public static func permitsRedirect(from: URL, to: URL, pinned: Bool = false) -> Bool {
        return decide(
            to, from: from, localServers: allowsLocalServers, localHosts: localHosts.all,
            backendHosts: backendHosts.all, pinned: pinned)
    }

    /// The image a `data:` URL (RFC 2397) carries, for a flow to show without a download: its
    /// bytes, base64 or percent-encoded, when its media type is an image (`image/…`) and they are
    /// at most ``maxDataImageBytes``. `nil` for any other URL and for a malformed one.
    public static func dataImage(_ url: String) -> Data? {
        guard url.hasPrefix("data:"), let comma = url.firstIndex(of: ",") else {
            return nil
        }
        let parameters = url[url.index(url.startIndex, offsetBy: 5)..<comma]
            .split(separator: ";", omittingEmptySubsequences: false)
        guard parameters.first?.lowercased().hasPrefix("image/") == true else {
            return nil
        }
        let payload = url[url.index(after: comma)...]
        // No encoding spends more than four characters on a byte: a longer payload is refused
        // before it is decoded.
        guard payload.utf8.count <= 4 * maxDataImageBytes, let decoded = percentDecoded(payload)
        else {
            return nil
        }
        let bytes =
            parameters.dropFirst().contains(where: { $0.lowercased() == "base64" })
            ? Data(base64Encoded: decoded, options: .ignoreUnknownCharacters) : decoded
        return bytes.flatMap { $0.count <= maxDataImageBytes ? $0 : nil }
    }

    /// `text`'s UTF-8 bytes with each `%XX` escape decoded to its byte; `nil` for a malformed
    /// escape.
    private static func percentDecoded(_ text: Substring) -> Data? {
        var bytes = Data(capacity: text.utf8.count)
        var iterator = text.utf8.makeIterator()
        while let byte = iterator.next() {
            guard byte == UInt8(ascii: "%") else {
                bytes.append(byte)
                continue
            }
            guard let high = iterator.next().flatMap(hexValue),
                let low = iterator.next().flatMap(hexValue)
            else {
                return nil
            }
            bytes.append(high << 4 | low)
        }
        return bytes
    }

    private static func hexValue(_ byte: UInt8) -> UInt8? {
        switch byte {
        case UInt8(ascii: "0")...UInt8(ascii: "9"): return byte - UInt8(ascii: "0")
        case UInt8(ascii: "a")...UInt8(ascii: "f"): return byte - UInt8(ascii: "a") + 10
        case UInt8(ascii: "A")...UInt8(ascii: "F"): return byte - UInt8(ascii: "A") + 10
        default: return nil
        }
    }

    /// Trusts the host of `baseUrl`, the app's own backend, over `https` in every build. The
    /// client does this when it is configured; hosts are never removed, so this holds for the
    /// process.
    static func trustBackend(_ baseUrl: URL) {
        if let host = host(of: baseUrl) {
            backendHosts.insert(host)
        }
    }

    /// Accepts `http` downloads from the host of `baseUrl` when it is an `http` URL. Called for
    /// a debug build only; hosts are never removed, so this holds for the process.
    static func acceptLocalBaseUrl(_ baseUrl: URL) {
        guard baseUrl.scheme?.lowercased() == "http", let host = host(of: baseUrl) else {
            return
        }
        localHosts.insert(host)
    }

    /// Whether `url` may be downloaded: written plainly, without credentials, over `https` from
    /// a host not on the device or its networks, from one of `backendHosts`, or anywhere when
    /// `pinned`; with `localServers`, also from a loopback host or one of `localHosts`, over
    /// `http` too, and for a redirect only from such a host.
    static func decide(
        _ url: URL, from: URL?, localServers: Bool, localHosts: Set<String>,
        backendHosts: Set<String> = [], pinned: Bool = false
    ) -> Bool {
        guard isPlainlyWritten(url.absoluteString),
            let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http",
            let host = host(of: url), url.user == nil, url.password == nil, isWellFormed(host)
        else {
            return false
        }
        let isDevelopmentServer = { (candidate: URL) -> Bool in
            guard let host = Self.host(of: candidate) else {
                return false
            }
            return isLoopback(host) || localHosts.contains(host)
        }
        if localServers, isDevelopmentServer(url) {
            return from.map(isDevelopmentServer) ?? true
        }
        return scheme == "https"
            && (pinned || backendHosts.contains(host) || !isLocalNetwork(host))
    }

    /// Whether `url` is written so that every URL parser reads the same host from it: its
    /// scheme followed by `//`, an authority (up to the first `/`, `?` or `#`) that is not empty
    /// and holds no `@`, and no backslash, ASCII whitespace or control character up to its end.
    static func isPlainlyWritten(_ url: String) -> Bool {
        guard let separator = url.range(of: "://") else {
            return false
        }
        let authority = url[separator.upperBound...].prefix { !"/?#".contains($0) }
        return !authority.isEmpty && !authority.contains("@")
            && !url[..<authority.endIndex].unicodeScalars.contains {
                $0.value <= 0x20 || $0.value == 0x7f || $0 == "\\"
            }
    }

    /// Whether `host` (lowercase, without brackets) holds only what a host name or address may
    /// (`a`–`z`, digits, `.`, `-`, `_`, `:`), and no empty label but a trailing one.
    private static func isWellFormed(_ host: String) -> Bool {
        let name = host.hasSuffix(".") ? String(host.dropLast()) : host
        return !name.isEmpty
            && name.unicodeScalars.allSatisfy {
                ("a"..."z").contains($0) || ("0"..."9").contains($0) || ".-_:".unicodeScalars
                    .contains($0)
            }
            && (name.contains(":") || !name.split(separator: ".", omittingEmptySubsequences: false)
                .contains(where: \.isEmpty))
    }

    private static func host(of url: URL) -> String? {
        guard let host = url.host?.lowercased(), !host.isEmpty else {
            return nil
        }
        return host.hasPrefix("[") && host.hasSuffix("]") ? String(host.dropFirst().dropLast()) : host
    }

    /// Whether `host` is the device itself as a development server is reached: `localhost`,
    /// `::1`, or a dotted IPv4 address in `127.0.0.0/8`, written plainly.
    private static func isLoopback(_ host: String) -> Bool {
        return host == "localhost" || host == "::1" || isIPv4Loopback(host)
    }

    /// Four parts of 1 to 3 ASCII digits, each at most 255, the first 127.
    private static func isIPv4Loopback(_ host: String) -> Bool {
        let parts = host.split(separator: ".", omittingEmptySubsequences: false)
        return parts.count == 4 && parts[0] == "127"
            && parts.allSatisfy { part in
                (1...3).contains(part.count) && part.allSatisfy { ("0"..."9").contains($0) }
                    && Int(part)! <= 255
            }
    }

    /// Whether `host` (lowercase, without brackets) names the device itself or a network it is
    /// on, or is not a host at all: `localhost` or a name under it, a `.local` name, an IP address
    /// in `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10`, `127.0.0.0/8`, `169.254.0.0/16`,
    /// `172.16.0.0/12`, `192.168.0.0/16`, `198.18.0.0/15`, `224.0.0.0/4` or `240.0.0.0/4`
    /// (broadcast included), or in `::/128`, `::1/128`, `fc00::/7`, `fe80::/9` (link-local and
    /// the old site-local), `ff00::/8` or `64:ff9b:1::/48`, or an IPv4 address of those in IPv6
    /// form (mapped, compatible or NAT64).
    ///
    /// A host whose last label is a number is an IPv4 address in any form `inet_aton` reads
    /// (`2130706433` and `0x7f.1` are `127.0.0.1`), and one that is not a valid address that way
    /// (`0x17f000001`, `256.0.0.1`) is refused: a resolver may read it as an address all the
    /// same, keeping the bits that fit. An IPv6 literal that does not read counts as local. Names
    /// that only resolve to such an address are not caught.
    static func isLocalNetwork(_ host: String) -> Bool {
        let name = host.hasSuffix(".") ? String(host.dropLast()) : host
        if name == "localhost" || name.hasSuffix(".localhost") || name.hasSuffix(".local") {
            return true
        }
        if name.contains(":") || name.contains("%") {
            var address = in6_addr()
            guard !name.contains("%"), inet_pton(AF_INET6, name, &address) == 1 else {
                return true
            }
            return isLocalIPv6(withUnsafeBytes(of: &address) { Array($0) })
        }
        guard let last = name.split(separator: ".").last, isNumber(last) else {
            return false
        }
        return ipv4(name).map(isLocalIPv4) ?? true
    }

    /// Whether `label` is written as a number: decimal or octal digits, or `0x` and hexadecimal
    /// digits.
    private static func isNumber(_ label: Substring) -> Bool {
        let lower = label.lowercased()
        if lower.hasPrefix("0x") {
            return lower.dropFirst(2).allSatisfy(\.isHexDigit)
        }
        return !lower.isEmpty && lower.allSatisfy { ("0"..."9").contains($0) }
    }

    /// The bytes of `host` as an IPv4 address in any form `inet_aton` reads: one to four
    /// parts, each decimal, octal (`0` first) or hexadecimal (`0x` first), the last filling the
    /// bytes left; `nil` when it is none.
    static func ipv4(_ host: String) -> [UInt8]? {
        let parts = host.split(separator: ".", omittingEmptySubsequences: false)
        guard (1...4).contains(parts.count) else {
            return nil
        }
        var values: [UInt32] = []
        for part in parts {
            let text = part.lowercased()
            let (digits, radix): (Substring, Int) =
                text.hasPrefix("0x")
                ? (text.dropFirst(2), 16)
                : text.count > 1 && text.hasPrefix("0") ? (text.dropFirst(), 8) : (text[...], 10)
            guard !text.isEmpty, digits.count <= 32,
                digits.isEmpty || digits.allSatisfy({ $0.isHexDigit && $0.isASCII }),
                let value = digits.isEmpty ? 0 : UInt32(digits, radix: radix)
            else {
                return nil
            }
            values.append(value)
        }
        let last = values.removeLast()
        guard values.allSatisfy({ $0 <= 255 }),
            UInt64(last) < UInt64(1) << (8 * (4 - values.count))
        else {
            return nil
        }
        let lastBytes = (0..<(4 - values.count)).reversed().map {
            UInt8(truncatingIfNeeded: last >> (8 * $0))
        }
        return values.map { UInt8($0) } + lastBytes
    }

    private static func isLocalIPv4(_ address: [UInt8]) -> Bool {
        let (first, second) = (address[0], address[1])
        return first == 0 || first == 10 || first == 127 || first >= 224
            || (first == 100 && second & 0xc0 == 64)
            || (first == 169 && second == 254)
            || (first == 172 && second & 0xf0 == 16)
            || (first == 192 && second == 168)
            || (first == 198 && second & 0xfe == 18)
    }

    private static let nat64Prefix: [UInt8] = [0, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0]

    private static func isLocalIPv6(_ address: [UInt8]) -> Bool {
        let prefix = Array(address[0..<12])
        let embedded = Array(address[12...])
        // `::/96` (with `::` and `::1`), `::ffff:0:0/96` and `64:ff9b::/96` hold an IPv4 address.
        if prefix.prefix(10).allSatisfy({ $0 == 0 })
            && (prefix[10...] == [0, 0] || prefix[10...] == [0xff, 0xff])
            || prefix == nat64Prefix
        {
            return isLocalIPv4(embedded)
        }
        let localNat64 = address.starts(with: [0, 0x64, 0xff, 0x9b, 0, 1])
        return localNat64 || address[0] == 0xff || address[0] & 0xfe == 0xfc
            || (address[0] == 0xfe && address[1] & 0x80 == 0x80)
    }
}

/// Refuses, before it is requested, a redirect the policy does not permit, and remembers that it
/// did: the task then ends with the redirect's own response, which is not what was asked for.
private final class FlowRedirectGuard: NSObject, URLSessionTaskDelegate, @unchecked Sendable {
    private let lock = NSLock()
    private let pinned: Bool
    private var refusedRedirect = false

    /// `pinned` for the download of an image its package pins.
    init(pinned: Bool) {
        self.pinned = pinned
    }

    var refused: Bool { lock.withLock { refusedRedirect } }

    func urlSession(
        _ session: URLSession, task: URLSessionTask,
        willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
        completionHandler: @escaping (URLRequest?) -> Void
    ) {
        guard let from = response.url ?? task.currentRequest?.url, let to = request.url,
            FlowUrlPolicy.permitsRedirect(from: from, to: to, pinned: pinned)
        else {
            lock.withLock { refusedRedirect = true }
            completionHandler(nil)
            return
        }
        completionHandler(request)
    }
}

/// Downloads what a flow needs, a package or an image it shows, never more of it than the caller
/// allows: content served by a host that misbehaves must not cost the app its memory. Only from
/// URLs ``FlowUrlPolicy`` permits.
public enum FlowDownload {
    /// Largest flow package the SDK loads.
    public static let maxPackageBytes = 16 * 1024 * 1024

    /// Fetches the bytes at `url`, `maxBytes` of them at most, from the server itself and not
    /// the session's cache when `ignoringLocalCache`; `pinned` for an image its package pins,
    /// which ``FlowUrlPolicy`` trusts the backend for.
    ///
    /// A response that announces more, or keeps delivering past it, is cancelled where it
    /// stands instead of being received in full.
    ///
    /// - Throws: ``FlowDownloadError`` for a URL ``FlowUrlPolicy`` refuses and for a redirect it
    ///   refuses, both before they are requested, for a status other than 2xx and for content
    ///   larger than `maxBytes`; the session's error for a transport failure.
    public static func data(
        from url: URL, using session: URLSession, maxBytes: Int, ignoringLocalCache: Bool = false,
        pinned: Bool = false
    ) async throws -> Data {
        guard FlowUrlPolicy.permits(url, pinned: pinned) else {
            throw FlowDownloadError.refusedUrl
        }
        let transfer = CappedTransfer(maxBytes: maxBytes)
        let redirects = FlowRedirectGuard(pinned: pinned)
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                // As the session would ask for `url` on its own, unless the cache is to be passed.
                let request = URLRequest(
                    url: url,
                    cachePolicy: ignoringLocalCache
                        ? .reloadIgnoringLocalCacheData : session.configuration.requestCachePolicy,
                    timeoutInterval: session.configuration.timeoutIntervalForRequest)
                let task = session.dataTask(with: request) { data, response, error in
                    let exceeded = transfer.finish()
                    if redirects.refused {
                        continuation.resume(throwing: FlowDownloadError.refusedUrl)
                    } else if exceeded || (data?.count ?? 0) > maxBytes {
                        continuation.resume(throwing: FlowDownloadError.tooLarge(maxBytes: maxBytes))
                    } else if let final = response?.url, final != url,
                        !FlowUrlPolicy.permitsRedirect(from: url, to: final, pinned: pinned)
                    {
                        // A session whose own delegate followed a redirect the policy refuses.
                        continuation.resume(throwing: FlowDownloadError.refusedUrl)
                    } else if let error {
                        continuation.resume(throwing: error)
                    } else if let http = response as? HTTPURLResponse,
                        !(200..<300).contains(http.statusCode)
                    {
                        continuation.resume(throwing: FlowDownloadError.status(http.statusCode))
                    } else {
                        continuation.resume(returning: data ?? Data())
                    }
                }
                // The task's own delegate, so a session the app or a test passes is checked too.
                task.delegate = redirects
                transfer.start(task)
            }
        } onCancel: {
            transfer.cancel()
        }
    }
}

/// Watches a data task and cancels it once it is to receive, or has received, more than
/// `maxBytes`.
private final class CappedTransfer: @unchecked Sendable {
    private let maxBytes: Int64
    private let lock = NSLock()
    private var task: URLSessionDataTask?
    private var observations: [NSKeyValueObservation] = []
    private var isCancelled = false
    private var exceeded = false

    init(maxBytes: Int) {
        self.maxBytes = Int64(maxBytes)
    }

    func start(_ task: URLSessionDataTask) {
        // The expected count is known with the response headers, when the server sends a
        // length; the received count grows with the body.
        let observations = [
            task.observe(\.countOfBytesExpectedToReceive) { [weak self] task, _ in
                self?.check(task.countOfBytesExpectedToReceive, of: task)
            },
            task.observe(\.countOfBytesReceived) { [weak self] task, _ in
                self?.check(task.countOfBytesReceived, of: task)
            },
        ]
        let isCancelled = lock.withLock { () -> Bool in
            self.task = task
            self.observations = observations
            return self.isCancelled
        }
        task.resume()
        if isCancelled {
            task.cancel()
        }
    }

    /// The caller no longer waits for the download.
    func cancel() {
        let task = lock.withLock { () -> URLSessionDataTask? in
            isCancelled = true
            return self.task
        }
        task?.cancel()
    }

    /// Stops watching the task; answers whether it was cancelled for its size.
    func finish() -> Bool {
        return lock.withLock {
            observations = []
            task = nil
            return exceeded
        }
    }

    private func check(_ bytes: Int64, of task: URLSessionDataTask) {
        guard bytes > maxBytes else {
            return
        }
        lock.withLock { exceeded = true }
        task.cancel()
    }
}

/// Downloads flow packages, verifies them against the SHA-256 their release names and keeps them
/// on disk by that hash, so a package already seen shows without a request.
///
/// It also remembers the last package each location showed. When a release's package cannot be
/// fetched or fails verification, that one is shown instead: the location keeps a paywall
/// through an outage or a bad upload rather than showing nothing.
///
/// Never a withdrawn package, though. A package an answer lists as withdrawn is no fallback, and
/// once a fresh answer lists it (``answered(serving:withdrawn:at:)``) the location forgets it, its
/// file is deleted unless another location still shows it, and its hash is remembered, the
/// newest ``maxWithdrawn`` of them, so that no other answer, such as one cached for another
/// interface revision, shows it either. A fresh answer serving a remembered hash clears it: a
/// withdrawal can be reversed. Bytes are verified every time they are read, so a corrupted file
/// is never handed to the renderer.
actor FlowPackageStore {
    /// Fetches the bytes at a URL; throws on transport failures and non-success statuses.
    typealias Download = @Sendable (URL) async throws -> Data

    private struct LocationEntry: Codable, Equatable {
        let sha256: String
        let abiVersion: Int
    }

    private static let indexFileName = "locations.json"
    private static let withdrawnFileName = "withdrawn.json"
    /// How many withdrawn hashes are remembered; the backend lists at most 20 per answer.
    static let maxWithdrawn = 100
    private static let packageExtension = "vhfp"

    /// `nil` when no cache directory is available: packages are then fetched on every show.
    private let directory: URL?
    private let baseUrl: URL
    private let download: Download
    private let warn: VoidhashWarningHandler
    private var index: [String: LocationEntry]?
    /// Hex SHA-256 of the packages known withdrawn, newest first.
    private var withdrawnHashes: [String]?

    /// - Parameters:
    ///   - directory: Where packages and the per-location index are written.
    ///   - baseUrl: Resolves package URLs the backend returns relative to the API origin.
    ///   - download: Fetches package bytes.
    ///   - warn: Receives fallbacks and cache write failures.
    init(
        directory: URL?, baseUrl: URL, download: @escaping Download,
        warn: @escaping VoidhashWarningHandler
    ) {
        self.directory = directory
        self.baseUrl = baseUrl
        self.download = download
        self.warn = warn
    }

    /// `Caches/voidhash/<namespace>/flow-packages`, scoped like the rest of the client's storage
    /// so projects sharing a device never read each other's packages.
    static func cachesDirectory(namespace: String) -> URL? {
        return FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("voidhash/\(namespace)/flow-packages", isDirectory: true)
    }

    /// A ``Download`` over `session` that fails on any non-2xx status and on a package larger
    /// than ``FlowDownload/maxPackageBytes``.
    static func download(using session: URLSession) -> Download {
        return { url in
            do {
                return try await FlowDownload.data(
                    from: url, using: session, maxBytes: FlowDownload.maxPackageBytes)
            } catch let error as FlowDownloadError {
                throw FlowPackageLoadError(
                    message: "Downloading \(url.absoluteString) failed: \(error)")
            }
        }
    }

    /// Lowercase hex SHA-256 of `data`.
    static func sha256(_ data: Data) -> String {
        return hex(SHA256.hash(data: data))
    }

    /// Lowercase hex of `digest`.
    static func hex(_ digest: SHA256.Digest) -> String {
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    /// Returns the verified bytes of `package` for `location`.
    ///
    /// Reads the cached copy when there is one, else downloads it. When neither yields bytes that
    /// match the package's hash, falls back to the last package `location` showed if
    /// `acceptsAbiVersion` still reads it and `withdrawn` does not list it.
    ///
    /// - Parameter withdrawn: Hex SHA-256 of the packages the answer naming `package` lists as
    ///   withdrawn.
    /// - Throws: ``FlowPackageLoadError`` when no verified package is available.
    func load(
        location: String,
        package: SdkResolvedPaywall.FlowPackage,
        withdrawn: [String] = [],
        acceptsAbiVersion: @Sendable (Int) -> Bool
    ) async throws -> LoadedFlowPackage {
        let expected = package.sha256.lowercased()
        let knownWithdrawn = Set(loadWithdrawn())
        guard !knownWithdrawn.contains(expected) else {
            throw FlowPackageLoadError(
                message: "the package \(expected) was withdrawn", failure: .withdrawn)
        }
        if let cached = readVerified(sha256: expected) {
            remember(location: location, sha256: expected, abiVersion: package.abiVersion)
            return LoadedFlowPackage(data: cached, fromCache: true)
        }

        let failure: FlowPackageLoadError
        do {
            let data = try await fetch(package)
            if FlowPackageStore.sha256(data) == expected {
                write(data, sha256: expected)
                remember(location: location, sha256: expected, abiVersion: package.abiVersion)
                return LoadedFlowPackage(data: data, fromCache: false)
            }
            failure = FlowPackageLoadError(
                message: "the package downloaded from \(package.url) does not match its SHA-256",
                failure: .integrity)
        } catch {
            failure = FlowPackageLoadError(
                message: "could not download \(package.url): \(error)", failure: .download)
        }

        let withdrawn = Set(withdrawn.map { $0.lowercased() }).union(knownWithdrawn)
        if let previous = loadIndex()[location], previous.sha256 != expected,
            !withdrawn.contains(previous.sha256), acceptsAbiVersion(previous.abiVersion),
            let fallback = readVerified(sha256: previous.sha256)
        {
            warn("Showing the previous paywall for \"\(location)\": \(failure.message)")
            return LoadedFlowPackage(data: fallback, fromCache: true)
        }
        throw failure
    }

    /// Whether an answer listed `sha256` as withdrawn, among the hashes this store remembers: a
    /// package it names is never shown, not even the one an app bundles.
    func isWithdrawn(sha256: String) -> Bool {
        return loadWithdrawn().contains(sha256.lowercased())
    }

    /// Takes in a fresh answer for `location`, which serves the package `served` and lists
    /// `withdrawn`: the withdrawn hashes are remembered and refused from then on, the location
    /// forgets a withdrawn package it showed, whose file is deleted unless another location still
    /// shows it, and a remembered hash the answer serves again is cleared.
    func answered(serving served: String?, withdrawn: [String], at location: String) {
        let served = served?.lowercased()
        let withdrawn = withdrawn.map { $0.lowercased() }.filter { $0 != served }
        let known = loadWithdrawn()
        var remembered = withdrawn
        for hash in known where hash != served && !remembered.contains(hash) {
            remembered.append(hash)
        }
        remembered = Array(remembered.prefix(FlowPackageStore.maxWithdrawn))
        if remembered != known {
            saveWithdrawn(remembered)
        }

        let withdrawnHere = Set(withdrawn)
        var entries = loadIndex()
        guard let entry = entries[location], withdrawnHere.contains(entry.sha256) else {
            return
        }
        entries[location] = nil
        save(entries)
    }

    private func loadWithdrawn() -> [String] {
        if let withdrawnHashes {
            return withdrawnHashes
        }
        var loaded: [String] = []
        if let directory,
            let data = try? Data(
                contentsOf: directory.appendingPathComponent(FlowPackageStore.withdrawnFileName))
        {
            loaded = (try? JSONDecoder().decode([String].self, from: data)) ?? []
        }
        withdrawnHashes = loaded
        return loaded
    }

    private func saveWithdrawn(_ hashes: [String]) {
        withdrawnHashes = hashes
        guard let directory else {
            return
        }
        do {
            try FileManager.default.createDirectory(
                at: directory, withIntermediateDirectories: true)
            try JSONEncoder().encode(hashes).write(
                to: directory.appendingPathComponent(FlowPackageStore.withdrawnFileName),
                options: .atomic)
        } catch {
            warn("Could not record the withdrawn paywall packages: \(error)")
        }
    }

    private func fetch(_ package: SdkResolvedPaywall.FlowPackage) async throws -> Data {
        guard let url = URL(string: package.url, relativeTo: baseUrl)?.absoluteURL else {
            throw FlowPackageLoadError(message: "invalid package url \"\(package.url)\"")
        }
        return try await download(url)
    }

    private func packageFile(sha256: String) -> URL? {
        // Only ever a hex digest: the name must not be able to address another file.
        guard !sha256.isEmpty, sha256.allSatisfy(\.isHexDigit) else {
            return nil
        }
        return directory?.appendingPathComponent(
            "\(sha256).\(FlowPackageStore.packageExtension)")
    }

    private func readVerified(sha256: String) -> Data? {
        guard let file = packageFile(sha256: sha256),
            let data = try? Data(contentsOf: file)
        else {
            return nil
        }
        guard FlowPackageStore.sha256(data) == sha256 else {
            try? FileManager.default.removeItem(at: file)
            return nil
        }
        return data
    }

    private func write(_ data: Data, sha256: String) {
        guard let directory, let file = packageFile(sha256: sha256) else {
            return
        }
        do {
            try FileManager.default.createDirectory(
                at: directory, withIntermediateDirectories: true)
            try data.write(to: file, options: .atomic)
        } catch {
            warn("Could not cache the paywall package \(sha256): \(error.localizedDescription)")
        }
    }

    private func loadIndex() -> [String: LocationEntry] {
        if let index {
            return index
        }
        var loaded: [String: LocationEntry] = [:]
        if let directory,
            let data = try? Data(
                contentsOf: directory.appendingPathComponent(FlowPackageStore.indexFileName))
        {
            loaded = (try? JSONDecoder().decode([String: LocationEntry].self, from: data)) ?? [:]
        }
        index = loaded
        return loaded
    }

    /// Records the package `location` showed and deletes packages no location refers to.
    private func remember(location: String, sha256: String, abiVersion: Int) {
        var entries = loadIndex()
        let entry = LocationEntry(sha256: sha256, abiVersion: abiVersion)
        guard entries[location] != entry else {
            return
        }
        entries[location] = entry
        save(entries)
    }

    /// Writes the index and deletes packages no location refers to.
    private func save(_ entries: [String: LocationEntry]) {
        index = entries
        guard let directory else {
            return
        }
        do {
            try FileManager.default.createDirectory(
                at: directory, withIntermediateDirectories: true)
            try JSONEncoder().encode(entries).write(
                to: directory.appendingPathComponent(FlowPackageStore.indexFileName),
                options: .atomic)
        } catch {
            warn("Could not record the paywall packages locations show: \(error)")
            return
        }
        let referenced = Set(entries.values.map(\.sha256))
        let files =
            (try? FileManager.default.contentsOfDirectory(
                at: directory, includingPropertiesForKeys: nil)) ?? []
        for file in files where file.pathExtension == FlowPackageStore.packageExtension {
            if !referenced.contains(file.deletingPathExtension().lastPathComponent) {
                try? FileManager.default.removeItem(at: file)
            }
        }
    }
}
