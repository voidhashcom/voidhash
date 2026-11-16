import CryptoKit
import Foundation
import VoidhashCore

/// Why a flow package could not be loaded.
public struct FlowPackageLoadError: Error, Sendable, Equatable, CustomStringConvertible {
    public let message: String

    public var description: String {
        return "FLOW_PACKAGE_UNAVAILABLE: \(message)"
    }
}

/// Why a download for a flow was refused.
public enum FlowDownloadError: LocalizedError, Sendable, Equatable, CustomStringConvertible {
    /// The server answered with a status other than 2xx.
    case status(Int)
    /// The content is larger than the download may be.
    case tooLarge(maxBytes: Int)

    public var description: String {
        switch self {
        case .status(let statusCode):
            return "HTTP \(statusCode)"
        case .tooLarge(let maxBytes):
            return "larger than \(maxBytes / (1024 * 1024)) MB"
        }
    }

    public var errorDescription: String? {
        return description
    }
}

/// Downloads what a flow needs, a package or an image it shows, never more of it than the caller
/// allows: content served by a host that misbehaves must not cost the app its memory.
public enum FlowDownload {
    /// Largest flow package the SDK loads.
    public static let maxPackageBytes = 16 * 1024 * 1024

    /// Fetches the bytes at `url`, `maxBytes` of them at most.
    ///
    /// A response that announces more, or keeps delivering past it, is cancelled where it
    /// stands instead of being received in full.
    ///
    /// - Throws: ``FlowDownloadError`` for a status other than 2xx and for content larger than
    ///   `maxBytes`; the session's error for a transport failure.
    public static func data(from url: URL, using session: URLSession, maxBytes: Int) async throws
        -> Data
    {
        let transfer = CappedTransfer(maxBytes: maxBytes)
        return try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                let task = session.dataTask(with: url) { data, response, error in
                    let exceeded = transfer.finish()
                    if exceeded || (data?.count ?? 0) > maxBytes {
                        continuation.resume(throwing: FlowDownloadError.tooLarge(maxBytes: maxBytes))
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
/// through an outage or a bad upload rather than showing nothing. Bytes are verified every time
/// they are read, so a corrupted file is never handed to the renderer.
public actor FlowPackageStore {
    /// Fetches the bytes at a URL; throws on transport failures and non-success statuses.
    public typealias Download = @Sendable (URL) async throws -> Data

    private struct LocationEntry: Codable, Equatable {
        let sha256: String
        let abiVersion: Int
    }

    private static let indexFileName = "locations.json"
    private static let packageExtension = "vhfp"

    /// `nil` when no cache directory is available: packages are then fetched on every show.
    private let directory: URL?
    private let baseUrl: URL
    private let download: Download
    private let warn: VoidhashWarningHandler
    private var index: [String: LocationEntry]?

    /// - Parameters:
    ///   - directory: Where packages and the per-location index are written.
    ///   - baseUrl: Resolves package URLs the backend returns relative to the API origin.
    ///   - download: Fetches package bytes.
    ///   - warn: Receives fallbacks and cache write failures.
    public init(
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
    public static func cachesDirectory(namespace: String) -> URL? {
        return FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("voidhash/\(namespace)/flow-packages", isDirectory: true)
    }

    /// A ``Download`` over `session` that fails on any non-2xx status and on a package larger
    /// than ``FlowDownload/maxPackageBytes``.
    public static func download(using session: URLSession) -> Download {
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
        return SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    }

    /// Returns the verified bytes of `package` for `location`.
    ///
    /// Reads the cached copy when there is one, else downloads it. When neither yields bytes that
    /// match the package's hash, falls back to the last package `location` showed if
    /// `acceptsAbiVersion` still reads it.
    ///
    /// - Throws: ``FlowPackageLoadError`` when no verified package is available.
    public func load(
        location: String,
        package: SdkResolvedPaywall.FlowPackage,
        acceptsAbiVersion: @Sendable (Int) -> Bool
    ) async throws -> Data {
        let expected = package.sha256.lowercased()
        if let cached = readVerified(sha256: expected) {
            remember(location: location, sha256: expected, abiVersion: package.abiVersion)
            return cached
        }

        let failure: String
        do {
            let data = try await fetch(package)
            if FlowPackageStore.sha256(data) == expected {
                write(data, sha256: expected)
                remember(location: location, sha256: expected, abiVersion: package.abiVersion)
                return data
            }
            failure = "the package downloaded from \(package.url) does not match its SHA-256"
        } catch {
            failure = "could not download \(package.url): \(error)"
        }

        if let previous = loadIndex()[location], previous.sha256 != expected,
            acceptsAbiVersion(previous.abiVersion),
            let fallback = readVerified(sha256: previous.sha256)
        {
            warn("Showing the previous paywall for \"\(location)\": \(failure)")
            return fallback
        }
        throw FlowPackageLoadError(message: failure)
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
            warn("Could not record the paywall package for \"\(location)\": \(error)")
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
