import Foundation

/// What the paywall engine an app links can run.
///
/// The SDK sends it when it resolves a paywall, so the backend serves only flows the engine can
/// show; a flow that needs more is answered as a location with nothing showing. An app without
/// the engine sends nothing and is served only flows the first engine release could show.
public struct FlowEngineCapabilities: Sendable, Equatable {
    /// Header carrying ``packageAbiVersion``.
    public static let packageAbiHeader = "x-ui-package-abi"
    /// Header carrying ``guestAbiVersion``.
    public static let guestAbiHeader = "x-ui-guest-abi"
    /// Header carrying ``nativeComponents``, comma-separated.
    public static let nativeComponentsHeader = "x-ui-native-components"
    /// Header carrying ``runtimeBridgeVersion``.
    public static let runtimeBridgeHeader = "x-ui-runtime-bridge"

    /// Newest flow package format version the engine reads.
    public let packageAbiVersion: Int
    /// Newest code component ABI version the engine runs; it runs every older one.
    public let guestAbiVersion: Int
    /// The native components the engine provides, as `id@version`.
    public let nativeComponents: [String]
    /// Newest runtime bridge the engine hosts when it runs the flow runtime as a downloaded
    /// module, else `nil`. Such an engine reads no package format itself, so the backend serves
    /// it any release a runtime module is offered for.
    public let runtimeBridgeVersion: Int?

    public init(
        packageAbiVersion: Int, guestAbiVersion: Int, nativeComponents: [String],
        runtimeBridgeVersion: Int? = nil
    ) {
        self.packageAbiVersion = packageAbiVersion
        self.guestAbiVersion = guestAbiVersion
        self.nativeComponents = nativeComponents
        self.runtimeBridgeVersion = runtimeBridgeVersion
    }

    /// The `resolve-paywall` headers that report the engine.
    public var headers: [String: String] {
        var headers = [
            Self.packageAbiHeader: String(packageAbiVersion),
            Self.guestAbiHeader: String(guestAbiVersion),
            Self.nativeComponentsHeader: nativeComponents.joined(separator: ","),
        ]
        if let runtimeBridgeVersion {
            headers[Self.runtimeBridgeHeader] = String(runtimeBridgeVersion)
        }
        return headers
    }

    /// Identifies these capabilities in the key of a cached `resolve-paywall` answer.
    ///
    /// The backend answers by what the engine can run, so an answer cached for one engine must
    /// not serve another: after an app update brings a newer engine, a "nothing showing" cached
    /// for the old one would otherwise hide a paywall the new one can show. Native components are
    /// sorted, so their order does not matter.
    public var cacheKey: String {
        let natives = nativeComponents.sorted().joined(separator: ",")
        // An engine running modules is served by other rules, so its answers are its own; the
        // key of an engine running the linked runtime is unchanged.
        let runtime = runtimeBridgeVersion.map { "|r\($0)" } ?? ""
        return "e"
            + CacheNamespace.hash("\(packageAbiVersion)|\(guestAbiVersion)|\(natives)\(runtime)")
    }
}
