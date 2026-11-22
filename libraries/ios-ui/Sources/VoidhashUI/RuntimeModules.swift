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
    /// nothing after a short wait. It verifies every module by hash and by the signature the
    /// release names, once, as it stores it in `Caches/voidhash/runtime-modules`; a module
    /// refused for its signature never runs, and the release then shows on the linked runtime if
    /// that reads it. This type only fetches what the core asks for. A runtime module is public
    /// code, the same for every project, so one cache serves them all. Nothing here runs before a
    /// flow is presented.
    public enum RuntimeModules {
        /// Whether this build trusts the development root, whose private key is public: only a
        /// `DEBUG` build that is also a development build where it runs, on the simulator or
        /// signed with a provisioning profile that allows debugging (`get-task-allow`). A build
        /// for the App Store, TestFlight or ad hoc distribution has no such profile even when its
        /// configuration defines `DEBUG`, and a missing or unreadable profile trusts nothing; a
        /// release configuration never trusts it. Read once, when module mode is first used
        /// (``trustDevelopmentRootIfAllowed()``), never at launch.
        package static let trustsDevelopmentRoot: Bool = {
            #if DEBUG
                #if targetEnvironment(simulator)
                    return true
                #else
                    return allowsDebugging(
                        provisioningProfile: Bundle.main.url(
                            forResource: "embedded", withExtension: "mobileprovision"
                        ).flatMap { try? Data(contentsOf: $0, options: .mappedIfSafe) })
                #endif
            #else
                return false
            #endif
        }()

        /// Whether an embedded provisioning profile (`embedded.mobileprovision`, a signed message
        /// holding a property list) allows debugging the app: its `Entitlements` grant
        /// `get-task-allow`. `nil`, an oversized or unreadable profile, or one without the
        /// entitlement does not.
        package static func allowsDebugging(provisioningProfile data: Data?) -> Bool {
            guard let data, data.count < 1 << 20,
                let start = data.range(of: Data("<?xml".utf8)),
                let end = data.range(
                    of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex)
            else {
                return false
            }
            guard
                let profile = try? PropertyListSerialization.propertyList(
                    from: data.subdata(in: start.lowerBound..<end.upperBound), format: nil)
                    as? [String: Any],
                let entitlements = profile["Entitlements"] as? [String: Any]
            else {
                return false
            }
            return entitlements["get-task-allow"] as? Bool == true
        }

        private static let developmentTrust: Void = {
            if trustsDevelopmentRoot {
                vhv_runtime_trust_development_root()
            }
        }()

        /// Has the core trust the development root, once, when this build may
        /// (``trustsDevelopmentRoot``). Reads the provisioning profile the first time.
        package static func trustDevelopmentRootIfAllowed() {
            _ = developmentTrust
        }

        /// Whether the app asked for module mode (``FlowView/runtimeMode``), which the core
        /// grants only once it trusts a root.
        package static var isModuleModeRequested: Bool {
            get { requested.withLock { $0 } }
            set { requested.withLock { $0 = newValue } }
        }

        private static let requested = Locked(false)

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
            trustDevelopmentRootIfAllowed()
            while true {
                // Compiling a module the first time takes tens of milliseconds: never on the
                // main thread.
                let status = await Task.detached(priority: .userInitiated) {
                    () -> Result<Bool, FlowViewError> in
                    var version = Array(runtime.version.utf8)
                    var sha256 = Array(runtime.sha256.utf8)
                    var url = Array(runtime.url.utf8)
                    var signature = Array((runtime.signature ?? "").utf8)
                    switch vhv_runtime_prepare(
                        &version, version.count, &sha256, sha256.count, &url, url.count,
                        &signature, signature.count)
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

        /// A value behind a lock, for the process-wide switch read from any thread.
        private final class Locked<Value>: @unchecked Sendable {
            private let lock = NSLock()
            private var value: Value

            init(_ value: Value) {
                self.value = value
            }

            func withLock<Result>(_ body: (inout Value) -> Result) -> Result {
                lock.lock()
                defer { lock.unlock() }
                return body(&value)
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
