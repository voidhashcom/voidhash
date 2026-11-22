import Foundation
@_spi(VoidhashFlows) import Voidhash

/// Loads the images a flow asks for: from the SDK's image store when it holds them, from the
/// network otherwise.
package enum FlowImageLoader {
    /// An image larger than this is skipped rather than held in memory.
    package static let maxImageBytes = FlowImageStore.maxImageBytes

    /// An image URL that is not loaded.
    package struct UnsupportedURL: LocalizedError, Equatable {
        package init() {}

        package var errorDescription: String? {
            return "only https images from hosts on the internet are loaded, apart from a local "
                + "development server"
        }
    }

    /// The image at `urlString`: the copy `store` holds, or else downloaded, `maxBytes` of it
    /// at most, and handed to `store` for the next time. The store keeps only what starts as
    /// an image: a page served in an image's place is returned to the renderer, which reports
    /// it, and asked for again the next time.
    ///
    /// An image its flow's build pinned, `sha256` its hex SHA-256, is returned only as the
    /// bytes the build recorded: a stored copy that does not hash to it is discarded and the
    /// image downloaded again, and downloaded bytes that do not are neither returned nor kept.
    /// Such bytes are asked of the server once more, past the HTTP cache, once per URL while the
    /// process lives.
    /// They are hashed once, off the main thread, before anything decodes them. An image the
    /// build did not pin (`nil`), a URL typed in the designer or worked out on the device,
    /// cannot be verified and is returned as it arrives.
    ///
    /// The store is read first, so a flow already shown, or preloaded, has its images while
    /// the host serving them cannot be reached. A flow names its images itself, so only URLs
    /// `FlowUrlPolicy` permits are loaded, and only redirects it permits followed: `https`,
    /// without credentials, from a host on the internet, apart from a local development server.
    /// A `file:` URL would read the app's own files, and a local address probe the device's
    /// networks.
    ///
    /// - Throws: ``UnsupportedURL`` for any other URL; `FlowDownloadError` for a status other
    ///   than 2xx and for an image larger than `maxBytes`; `FlowImageMismatch` for bytes that
    ///   are not the pinned image's; the session's error for a transport failure.
    package static func load(
        _ urlString: String, sha256: String?, using session: URLSession,
        store: FlowImageStore? = nil, maxBytes: Int = maxImageBytes
    ) async throws -> Data {
        guard let url = FlowImageStore.remoteUrl(urlString, pinned: sha256 != nil) else {
            throw UnsupportedURL()
        }
        if let stored = await store?.image(at: urlString, sha256: sha256) {
            return stored
        }
        func keep(_ image: Data) async throws {
            if let store {
                try await store.store(image, at: urlString, sha256: sha256)
            } else {
                try FlowImageStore.verify(image, sha256: sha256)
            }
        }
        let image = try await FlowDownload.data(
            from: url, using: session, maxBytes: maxBytes, pinned: sha256 != nil)
        do {
            try await keep(image)
            return image
        } catch is FlowImageMismatch where refetched.claim(urlString) {
            // The session's HTTP cache keeps a response as long as it allows, a year for an
            // uploaded image, so bytes that do not match may be the cache's and not the
            // server's. Once per URL while the process lives the cached response is dropped and
            // the server itself asked; bytes that still do not match fail from then on without
            // a download each time.
            session.configuration.urlCache?.removeCachedResponse(for: URLRequest(url: url))
            let fresh = try await FlowDownload.data(
                from: url, using: session, maxBytes: maxBytes, ignoringLocalCache: true,
                pinned: true)
            try await keep(fresh)
            return fresh
        }
    }

    /// The URLs whose pinned image was asked of the server past the cache once already.
    private static let refetched = RefetchedUrls()
}

/// A set of URLs safe to claim from any thread.
private final class RefetchedUrls: @unchecked Sendable {
    private let lock = NSLock()
    private var urls: Set<String> = []

    /// Whether `url` was not claimed before; it is from now on.
    func claim(_ url: String) -> Bool {
        return lock.withLock { urls.insert(url).inserted }
    }
}
