import Foundation
import Voidhash

/// Loads the images a flow asks for: from the SDK's image store when it holds them, from the
/// network otherwise.
package enum FlowImageLoader {
    /// An image larger than this is skipped rather than held in memory.
    package static let maxImageBytes = FlowImageStore.maxImageBytes

    /// An image URL that is not loaded.
    package struct UnsupportedURL: LocalizedError, Equatable {
        package init() {}

        package var errorDescription: String? {
            return "only http and https images are loaded"
        }
    }

    /// The image at `urlString`: the copy `store` holds, or else downloaded, `maxBytes` of it
    /// at most, and handed to `store` for the next time. The store keeps only what starts as
    /// an image: a page served in an image's place is returned to the renderer, which reports
    /// it, and asked for again the next time.
    ///
    /// The store is read first, so a flow already shown, or preloaded, has its images while
    /// the host serving them cannot be reached. A flow names its images itself, so only
    /// `http` and `https` are loaded: a `file:` URL would read the app's own files.
    ///
    /// - Throws: ``UnsupportedURL`` for any other URL; `FlowDownloadError` for a status other
    ///   than 2xx and for an image larger than `maxBytes`; the session's error for a transport
    ///   failure.
    package static func load(
        _ urlString: String, using session: URLSession, store: FlowImageStore? = nil,
        maxBytes: Int = maxImageBytes
    ) async throws -> Data {
        guard let url = FlowImageStore.remoteUrl(urlString) else {
            throw UnsupportedURL()
        }
        if let stored = await store?.image(at: urlString) {
            return stored
        }
        let image = try await FlowDownload.data(from: url, using: session, maxBytes: maxBytes)
        await store?.store(image, at: urlString)
        return image
    }
}
