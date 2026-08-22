import Foundation
import VoidhashCore

/// Configuration of a ``VoidhashClient``.
public struct VoidhashOptions: Sendable {
    /// API origin. Defaults to `https://api.voidhash.com`.
    public var baseUrl: URL
    /// Analytics ingest origin; falls back to ``baseUrl``.
    public var ingestUrl: URL?
    /// Prints SDK diagnostics and marks requests as coming from a debug build.
    public var debug: Bool
    /// Distinct id to start with, instead of a generated anonymous one.
    public var distinctId: String?
    /// When `false` every client method is inert and no requests are made.
    public var enabled: Bool
    /// Observer mode: the SDK syncs transactions but never finishes them with the store.
    public var readOnly: Bool
    /// Requests development mode: purchases run against a mock store and are recorded under
    /// the development environment — nothing is charged. Honored only in debug builds; a
    /// release build always uses the real App Store.
    public var dev: Bool
    /// Receives SDK diagnostics that are not raised to the caller (a failed background refresh,
    /// an unparseable paywall bridge message, a dropped analytics batch). Defaults to
    /// ``VoidhashWarnings/standard``.
    public var onWarning: VoidhashWarningHandler?

    public init(
        baseUrl: URL = VoidhashApiClient.defaultBaseUrl,
        ingestUrl: URL? = nil,
        debug: Bool = false,
        distinctId: String? = nil,
        enabled: Bool = true,
        readOnly: Bool = false,
        dev: Bool = false,
        onWarning: VoidhashWarningHandler? = nil
    ) {
        self.baseUrl = baseUrl
        self.ingestUrl = ingestUrl
        self.debug = debug
        self.distinctId = distinctId
        self.enabled = enabled
        self.readOnly = readOnly
        self.dev = dev
        self.onWarning = onWarning
    }
}

/// Entry point of the Voidhash iOS SDK.
///
/// ```swift
/// let voidhash = Voidhash.configure(publishableKey: "pk_live_…")
/// let products = try await voidhash.getProducts()
/// ```
public enum Voidhash {
    /// Version of this SDK package, reported as `x-sdk-version`.
    public static let sdkVersion = "0.0.1-alpha.1"

    private nonisolated(unsafe) static var sharedClient: VoidhashClient?
    private static let lock = NSLock()

    /// Configures (or reconfigures) the shared client.
    ///
    /// - Parameters:
    ///   - publishableKey: Project publishable key from the dashboard.
    ///   - options: Optional configuration overrides.
    /// - Returns: The configured client, also available as ``shared``.
    @discardableResult
    public static func configure(
        publishableKey: String, options: VoidhashOptions = VoidhashOptions()
    ) -> VoidhashClient {
        let client = VoidhashClient(publishableKey: publishableKey, options: options)
        lock.withLock { sharedClient = client }
        Task { await client.start() }
        return client
    }

    /// The client created by the most recent ``configure(publishableKey:options:)`` call.
    public static var shared: VoidhashClient? {
        return lock.withLock { sharedClient }
    }
}
