import Foundation

/// What the paywall engine an app links can run.
///
/// The SDK sends it when it resolves a paywall, so the backend serves only flows the engine can
/// show; a flow that needs more is answered as a placement with nothing showing. An app without
/// the engine sends nothing and is served only flows the first engine release could show.
public struct FlowEngineCapabilities: Sendable, Equatable {
    /// Header carrying ``packageAbiVersion``.
    public static let packageAbiHeader = "x-ui-package-abi"
    /// Header carrying ``guestAbiVersion``.
    public static let guestAbiHeader = "x-ui-guest-abi"
    /// Header carrying ``nativeComponents``, comma-separated.
    public static let nativeComponentsHeader = "x-ui-native-components"

    /// Newest flow package format version the engine reads.
    public let packageAbiVersion: Int
    /// Newest code component ABI version the engine runs; it runs every older one.
    public let guestAbiVersion: Int
    /// The native components the engine provides, as `id@version`.
    public let nativeComponents: [String]

    public init(packageAbiVersion: Int, guestAbiVersion: Int, nativeComponents: [String]) {
        self.packageAbiVersion = packageAbiVersion
        self.guestAbiVersion = guestAbiVersion
        self.nativeComponents = nativeComponents
    }

    /// The `resolve-paywall` headers that report the engine.
    public var headers: [String: String] {
        return [
            Self.packageAbiHeader: String(packageAbiVersion),
            Self.guestAbiHeader: String(guestAbiVersion),
            Self.nativeComponentsHeader: nativeComponents.joined(separator: ","),
        ]
    }

    /// Identifies these capabilities in the key of a cached `resolve-paywall` answer.
    ///
    /// The backend answers by what the engine can run, so an answer cached for one engine must
    /// not serve another: after an app update brings a newer engine, a "nothing showing" cached
    /// for the old one would otherwise hide a paywall the new one can show. Native components are
    /// sorted, so their order does not matter.
    public var cacheKey: String {
        let natives = nativeComponents.sorted().joined(separator: ",")
        return "e" + CacheNamespace.hash("\(packageAbiVersion)|\(guestAbiVersion)|\(natives)")
    }
}
