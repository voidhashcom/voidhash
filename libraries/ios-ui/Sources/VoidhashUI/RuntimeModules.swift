#if os(iOS)
    import Foundation
    import Voidhash
    import VoidhashCore
    import VoidhashUICore

    /// Gets the flow runtime module a release needs, in module mode
    /// (``FlowView/runtimeMode``).
    ///
    /// The views core chooses: a cached module that runs the release, else the one the release
    /// names once downloaded, else the module the SDK bundles when it runs the release, else
    /// nothing after a short wait. It verifies every module by hash and keeps the downloaded ones in
    /// `Caches/voidhash/runtime-modules`; this type only fetches what the core asks for. A
    /// runtime module is public code, the same for every project, so one cache serves them all.
    /// Nothing here runs before a flow is presented.
    public enum RuntimeModules {
        /// How often a waiting presentation asks the core again.
        private static let pollNanoseconds: UInt64 = 50_000_000

        private static let configured: Void = {
            if let directory = FileManager.default.urls(
                for: .cachesDirectory, in: .userDomainMask
            ).first?.appendingPathComponent("voidhash/runtime-modules", isDirectory: true) {
                var path = Array(directory.path.utf8)
                _ = vhv_runtime_set_cache_directory(&path, path.count)
            }
        }()

        /// Waits until a module that runs the release is ready to show it with, fetching what the
        /// core asks for over `session`. The core bounds the wait (3 seconds).
        ///
        /// - Throws: ``FlowViewError`` when no module that runs the release is
        ///   available: show nothing.
        public static func prepare(
            _ runtime: SdkResolvedPaywall.FlowPackage.RuntimeModule, using session: URLSession
        ) async throws {
            _ = configured
            while true {
                // Compiling a module the first time takes tens of milliseconds: never on the
                // main thread.
                let status = await Task.detached(priority: .userInitiated) {
                    () -> Result<Bool, FlowViewError> in
                    var version = Array(runtime.version.utf8)
                    var sha256 = Array(runtime.sha256.utf8)
                    var url = Array(runtime.url.utf8)
                    switch vhv_runtime_prepare(
                        &version, version.count, &sha256, sha256.count, &url, url.count)
                    {
                    case 0: return .success(true)
                    case 1: return .success(false)
                    // The reason is on this thread.
                    default:
                        return .failure(
                            FlowViewError(message: FlowView.lastError()))
                    }
                }.value
                // Downloads the choice started for a later presentation are fetched too.
                fetchDownloads(using: session)
                switch status {
                case .success(true): return
                case .failure(let error): throw error
                case .success(false):
                    try await Task.sleep(nanoseconds: pollNanoseconds)
                }
            }
        }

        /// Starts fetching every module the core asks for and hands it the outcome.
        private static func fetchDownloads(using session: URLSession) {
            while let request = takeDownload() {
                Task.detached(priority: .utility) {
                    var sha256 = Array(request.sha256.utf8)
                    do {
                        guard let url = URL(string: request.url) else {
                            throw FlowViewError(message: "invalid URL \(request.url)")
                        }
                        let bytes = try await FlowDownload.data(
                            from: url, using: session, maxBytes: FlowDownload.maxPackageBytes)
                        bytes.withUnsafeBytes { module in
                            _ = vhv_runtime_download_finished(
                                &sha256, sha256.count,
                                module.bindMemory(to: UInt8.self).baseAddress, module.count)
                        }
                    } catch {
                        var reason = Array("\(error)".utf8)
                        _ = vhv_runtime_download_failed(
                            &sha256, sha256.count, &reason, reason.count)
                    }
                }
            }
        }

        private static func takeDownload() -> (sha256: String, url: String)? {
            var buffer = [UInt8](repeating: 0, count: 512)
            var length = vhv_runtime_take_download(&buffer, buffer.count)
            if length > buffer.count {
                buffer = [UInt8](repeating: 0, count: length)
                length = vhv_runtime_take_download(&buffer, buffer.count)
            }
            guard length > 0 else {
                return nil
            }
            let text = String(decoding: buffer[0..<min(length, buffer.count)], as: UTF8.self)
            guard let space = text.firstIndex(of: " ") else {
                return nil
            }
            return (String(text[..<space]), String(text[text.index(after: space)...]))
        }
    }
#endif
