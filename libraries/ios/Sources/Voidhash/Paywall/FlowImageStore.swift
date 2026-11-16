import CryptoKit
import Foundation
import VoidhashCore

/// Keeps the images flows show on the device, so a flow whose package is cached still shows its
/// backgrounds, product art and icons when the host serving them cannot be reached.
///
/// The renderer reads an image here before it asks the network and stores what it downloads;
/// loading a flow's package fetches the images the package lists ahead of its presentation. An
/// image is kept under a hash of its URL, with a digest of its bytes in front of them: a file
/// that was cut short or damaged does not match and is discarded rather than shown. Only `http`
/// and `https` images are kept, none larger than ``maxImageBytes``, and only bytes that start
/// as one of the formats the renderer decodes: a page a proxy or a failing origin served in an
/// image's place is not. An image the renderer still cannot decode is taken out again with
/// ``remove(at:)``.
///
/// The store holds at most ``maxStoreBytes``: room is made by dropping the images shown longest
/// ago. The order they were shown in is kept in an index of the store's own rather than read
/// off the files' dates. Fetching ahead never makes room at the expense of an image stored or
/// shown since the process started, so flows that list more than the store holds do not push
/// each other's images out on every launch.
///
/// Images are not personal. The store belongs to the project, like the flow packages next to
/// it, and a sign-out leaves it alone. An image stays as stored for as long as it is kept, so a
/// URL should not be given other content.
public actor FlowImageStore {
    /// Fetches the bytes at a URL; throws on transport failures and non-success statuses.
    public typealias Download = @Sendable (URL) async throws -> Data

    /// Largest image a flow shows.
    public static let maxImageBytes = 10 * 1024 * 1024
    /// Most the store keeps on disk.
    public static let maxStoreBytes = 64 * 1024 * 1024

    private static let fileExtension = "img"
    private static let indexFileName = "shown.json"
    private static let digestLength = SHA256.byteCount

    /// `nil` when no directory is available: nothing is kept, and every image is downloaded
    /// when it is shown.
    private let directory: URL?
    private let download: Download
    private let maxBytes: Int
    /// When each image, by file name, was last stored or shown: a count that grows with every
    /// use, so the lowest is the one shown longest ago. Loaded from the index on first use.
    private var shown: [String: Int]?
    /// The images, by file name, stored, shown or found in place by a fetch ahead since the
    /// process started: the ones a fetch ahead never drops.
    private var usedThisRun: Set<String> = []
    /// The packages whose images were fetched ahead since the process started.
    private var prefetchedPackages: Set<String> = []
    /// The batches of images still to fetch ahead, and the one task working through them, so
    /// packages loaded together fetch one image at a time between them.
    private var queuedBatches: [[String]] = []
    private var prefetching: Task<Void, Never>?
    private var isStopped = false

    /// - Parameters:
    ///   - directory: Where images are written.
    ///   - download: Fetches an image for ``prefetch(package:imageUrls:)``.
    ///   - maxBytes: Most the store keeps on disk.
    public init(
        directory: URL?, download: @escaping Download,
        maxBytes: Int = FlowImageStore.maxStoreBytes
    ) {
        self.directory = directory
        self.download = download
        self.maxBytes = maxBytes
    }

    /// `Caches/voidhash/<namespace>/flow-images`, next to the project's flow packages.
    public static func cachesDirectory(namespace: String) -> URL? {
        return FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?
            .appendingPathComponent("voidhash/\(namespace)/flow-images", isDirectory: true)
    }

    /// A ``Download`` over `session` that fails on any non-2xx status and on an image larger
    /// than ``maxImageBytes``.
    public static func download(using session: URLSession) -> Download {
        return { url in
            try await FlowDownload.data(
                from: url, using: session, maxBytes: FlowImageStore.maxImageBytes)
        }
    }

    /// The URL of an image a flow may show: `http` or `https`. A flow names its images itself,
    /// so anything else, a `file:` URL for instance, is refused.
    public static func remoteUrl(_ urlString: String) -> URL? {
        guard let url = URL(string: urlString), let scheme = url.scheme?.lowercased(),
            scheme == "https" || scheme == "http"
        else {
            return nil
        }
        return url
    }

    /// Whether `data` starts as an image of a format the renderer decodes: PNG, JPEG, WebP or
    /// GIF, told by the same leading bytes the renderer goes by.
    public static func isImage(_ data: Data) -> Bool {
        let head = [UInt8](data.prefix(12))
        return head.starts(with: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            || head.starts(with: [0xff, 0xd8, 0xff])
            || head.starts(with: Array("GIF8".utf8))
            || (head.count == 12 && head.starts(with: Array("RIFF".utf8))
                && Array(head[8...]) == Array("WEBP".utf8))
    }

    /// The image stored for `urlString`; `nil` when there is none, or none that is intact.
    /// Reading it counts as showing it.
    public func image(at urlString: String) -> Data? {
        guard let file = file(for: urlString), let stored = try? Data(contentsOf: file) else {
            return nil
        }
        let image = stored.dropFirst(FlowImageStore.digestLength)
        guard stored.count > FlowImageStore.digestLength,
            Data(SHA256.hash(data: image)) == stored.prefix(FlowImageStore.digestLength)
        else {
            try? FileManager.default.removeItem(at: file)
            return nil
        }
        markShown([file])
        return Data(image)
    }

    /// Keeps `image` for `urlString`, dropping the images shown longest ago when the store
    /// would hold more than it may.
    ///
    /// - Returns: Whether it was stored: not an image of another scheme, bytes that are not an
    ///   image, one larger than ``maxImageBytes``, or when it could not be written.
    @discardableResult
    public func store(_ image: Data, at urlString: String) -> Bool {
        guard let directory, let file = file(for: urlString), FlowImageStore.isImage(image),
            image.count <= FlowImageStore.maxImageBytes
        else {
            return false
        }
        do {
            try FileManager.default.createDirectory(
                at: directory, withIntermediateDirectories: true,
                attributes: FlowImageStore.directoryAttributes)
            try (Data(SHA256.hash(data: image)) + image).write(
                to: file, options: FlowImageStore.writingOptions)
        } catch {
            return false
        }
        markShown([file], always: true)
        makeRoom(in: directory)
        return true
    }

    /// Takes the image stored for `urlString` out, for the renderer to call when it cannot
    /// decode what the store handed it: kept, the same bytes would fail every later
    /// presentation, read before the network is asked again.
    public func remove(at urlString: String) {
        guard let file = file(for: urlString) else {
            return
        }
        try? FileManager.default.removeItem(at: file)
        usedThisRun.remove(file.lastPathComponent)
        var order = loadShown()
        if order.removeValue(forKey: file.lastPathComponent) != nil {
            writeShown(order)
        }
    }

    /// Fetches the images of the flow package `sha256` the store does not hold yet, one at a
    /// time, for a flow that is about to be shown or was preloaded. Returns when the batch is
    /// done.
    ///
    /// A package's images are fetched ahead once per process, and a batch writes at most half
    /// of what the store holds. It never drops an image stored or shown since the process
    /// started to make room: it ends instead, and the renderer downloads what is missing when
    /// the flow is shown. Images it finds in place count as shown, so they are not the first
    /// to go.
    ///
    /// Nothing here fails: an image the server refuses, that is too large or is not an image
    /// is skipped, and when the server cannot be reached the rest of the batch is left to the
    /// renderer.
    ///
    /// - Parameter imageUrls: The images the package lists; asked for only when the package's
    ///   images are fetched.
    public func prefetch(package sha256: String, imageUrls: @Sendable () -> [String]) async {
        guard directory != nil, !isStopped, prefetchedPackages.insert(sha256).inserted else {
            return
        }
        let urlStrings = imageUrls()
        guard !urlStrings.isEmpty else {
            return
        }
        queuedBatches.append(urlStrings)
        if prefetching == nil {
            prefetching = Task { await self.fetchQueuedBatches() }
        }
        await prefetching?.value
    }

    /// Ends the fetching ahead, the download in flight included, for a client that was shut
    /// down. Nothing is fetched ahead afterwards.
    public func stopPrefetching() {
        isStopped = true
        queuedBatches.removeAll()
        prefetching?.cancel()
    }

    private func fetchQueuedBatches() async {
        while !queuedBatches.isEmpty, !isStopped {
            await fetchMissing(queuedBatches.removeFirst())
        }
        prefetching = nil
    }

    private func fetchMissing(_ urlStrings: [String]) async {
        var seen: Set<String> = []
        let wanted = urlStrings.compactMap { urlString -> (urlString: String, url: URL, file: URL)? in
            guard seen.insert(urlString).inserted,
                let url = FlowImageStore.remoteUrl(urlString), let file = file(for: urlString)
            else {
                return nil
            }
            return (urlString, url, file)
        }
        // Whatever is in place already belongs to a flow of this run: it must not be what the
        // next image stored, for this flow or another, pushes out.
        markShown(wanted.map(\.file).filter { FileManager.default.fileExists(atPath: $0.path) })

        var writtenBytes = 0
        for image in wanted where !FileManager.default.fileExists(atPath: image.file.path) {
            guard !isStopped, !Task.isCancelled, roomWithoutDroppingThisRun() > 0 else {
                return
            }
            let bytes: Data
            do {
                bytes = try await download(image.url)
            } catch is FlowDownloadError {
                continue
            } catch {
                return
            }
            guard !isStopped, !Task.isCancelled else {
                return
            }
            guard FlowImageStore.isImage(bytes) else {
                continue
            }
            // Storing it would push out an image of this run: the store is full of what the
            // flows shown or preloaded now need.
            guard bytes.count + FlowImageStore.digestLength <= roomWithoutDroppingThisRun() else {
                return
            }
            if store(bytes, at: image.urlString) {
                writtenBytes += bytes.count
            }
            if writtenBytes >= maxBytes / 2 {
                return
            }
        }
    }

    /// How much can still be stored before an image used since the process started would have
    /// to go.
    private func roomWithoutDroppingThisRun() -> Int {
        guard let directory else {
            return 0
        }
        let used = usedThisRun.reduce(0) { total, name in
            let file = directory.appendingPathComponent(name)
            return total + ((try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0)
        }
        return maxBytes - used
    }

    /// The file of the image at `urlString`; `nil` without a directory and for a URL that is
    /// not an image a flow may show.
    private func file(for urlString: String) -> URL? {
        guard let directory, FlowImageStore.remoteUrl(urlString) != nil else {
            return nil
        }
        let name = SHA256.hash(data: Data(urlString.utf8))
            .map { String(format: "%02x", $0) }.joined()
        return directory.appendingPathComponent("\(name).\(FlowImageStore.fileExtension)")
    }

    private func loadShown() -> [String: Int] {
        if let shown {
            return shown
        }
        var loaded: [String: Int] = [:]
        if let directory,
            let data = try? Data(
                contentsOf: directory.appendingPathComponent(FlowImageStore.indexFileName))
        {
            loaded = (try? JSONDecoder().decode([String: Int].self, from: data)) ?? [:]
        }
        shown = loaded
        return loaded
    }

    /// Records `files` as the images shown last, in their order. Written through only when
    /// that changes the order, so showing the same image again costs no write.
    private func markShown(_ files: [URL], always: Bool = false) {
        guard !files.isEmpty else {
            return
        }
        var order = loadShown()
        var latest = order.values.max() ?? 0
        var changed = always
        for file in files {
            let name = file.lastPathComponent
            usedThisRun.insert(name)
            if order[name] != latest || latest == 0 {
                latest += 1
                order[name] = latest
                changed = true
            }
        }
        if changed {
            writeShown(order)
        }
    }

    private func writeShown(_ order: [String: Int]) {
        shown = order
        guard let directory, let data = try? JSONEncoder().encode(order) else {
            return
        }
        // Losing the index costs the order, not an image: an image it does not list counts as
        // the one shown longest ago.
        try? data.write(
            to: directory.appendingPathComponent(FlowImageStore.indexFileName),
            options: FlowImageStore.writingOptions)
    }

    private func makeRoom(in directory: URL) {
        var order = loadShown()
        let files =
            ((try? FileManager.default.contentsOfDirectory(
                at: directory, includingPropertiesForKeys: [.fileSizeKey])) ?? [])
            .filter { $0.pathExtension == FlowImageStore.fileExtension }
            .map { file -> (url: URL, bytes: Int, shown: Int) in
                let bytes = (try? file.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0
                return (file, bytes, order[file.lastPathComponent] ?? 0)
            }
        // What the index lists and the directory no longer holds was discarded as damaged.
        let present = Set(files.map(\.url.lastPathComponent))
        var changed = order.keys.contains { !present.contains($0) }
        order = order.filter { present.contains($0.key) }
        var total = files.reduce(0) { $0 + $1.bytes }
        for file in files.sorted(by: { $0.shown < $1.shown }) where total > maxBytes {
            if (try? FileManager.default.removeItem(at: file.url)) != nil {
                total -= file.bytes
                order[file.url.lastPathComponent] = nil
                usedThisRun.remove(file.url.lastPathComponent)
                changed = true
            }
        }
        if changed {
            writeShown(order)
        }
    }

    #if os(macOS)
        // macOS has no per-file data protection classes.
        private static let writingOptions: Data.WritingOptions = .atomic
        private static var directoryAttributes: [FileAttributeKey: Any]? {
            return nil
        }
    #else
        // Like the SDK's other files: readable from the first unlock on, so a flow shown while
        // the device is locked again still finds its images.
        private static let writingOptions: Data.WritingOptions = [
            .atomic, .completeFileProtectionUntilFirstUserAuthentication,
        ]
        private static var directoryAttributes: [FileAttributeKey: Any]? {
            return [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication]
        }
    #endif
}
