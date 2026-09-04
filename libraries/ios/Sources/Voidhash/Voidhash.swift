import Foundation
import VoidhashCore

// Temporary release gate. Transaction observation and submission intentionally stay active while
// SDK-started purchases and hosted paywalls are unavailable.
let commerceFeaturesEnabled = false

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
    /// Observer mode: the SDK syncs transactions but never finishes them with the store. The
    /// current release always enables this mode while commerce is unavailable.
    public var readOnly: Bool
    /// Requests development mode: purchases run against a mock store and are recorded under
    /// the development environment — nothing is charged. Honored only in debug builds; a
    /// release build always uses the real App Store.
    public var dev: Bool
    /// Receives SDK diagnostics that are not raised to the caller (a failed background refresh,
    /// an unparseable paywall bridge message, a dropped analytics batch). Defaults to
    /// ``VoidhashWarnings/standard``.
    public var onWarning: VoidhashWarningHandler?
    /// Receives structured ``VoidhashDiagnostic`` values for situations the SDK handled with a
    /// documented fallback: a paused transport, an evicted queue entry, an opened circuit
    /// breaker, a rejected key, an unreadable cache entry. Handler exceptions never propagate.
    public var onDiagnostic: VoidhashDiagnosticHandler?
    /// Paywall placements to fetch and warm on the first launch, before the app asks for them.
    ///
    /// Placements the device has already resolved are remembered and preloaded automatically;
    /// this option covers the very first launch, where there is no history yet.
    public var preloadPlacements: [String]
    /// Configuration of the built-in `$screen` event.
    public var screenTracking: ScreenTrackingOptions
    /// Captures `$app_installed`, `$app_updated`, `$app_opened`, `$app_backgrounded`,
    /// `$app_became_active` and `$sign_out` on the app's behalf. Hosts that emit these
    /// themselves (the React Native SDK) turn it off.
    public var automaticLifecycleEvents: Bool

    public init(
        baseUrl: URL = VoidhashApiClient.defaultBaseUrl,
        ingestUrl: URL? = nil,
        debug: Bool = false,
        distinctId: String? = nil,
        enabled: Bool = true,
        readOnly: Bool = true,
        dev: Bool = false,
        onWarning: VoidhashWarningHandler? = nil,
        onDiagnostic: VoidhashDiagnosticHandler? = nil,
        preloadPlacements: [String] = [],
        screenTracking: ScreenTrackingOptions = ScreenTrackingOptions(),
        automaticLifecycleEvents: Bool = true
    ) {
        self.baseUrl = baseUrl
        self.ingestUrl = ingestUrl
        self.debug = debug
        self.distinctId = distinctId
        self.enabled = enabled
        self.readOnly = readOnly || !commerceFeaturesEnabled
        self.dev = dev
        self.onWarning = onWarning
        self.onDiagnostic = onDiagnostic
        self.preloadPlacements = preloadPlacements
        self.screenTracking = screenTracking
        self.automaticLifecycleEvents = automaticLifecycleEvents
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
        return configure(
            publishableKey: publishableKey, options: options,
            dependencies: VoidhashClient.Dependencies())
    }

    /// ``configure(publishableKey:options:)`` with injected dependencies, so tests can install
    /// a network-free client as ``shared`` for the UIKit and SwiftUI integrations to find.
    @discardableResult
    static func configure(
        publishableKey: String, options: VoidhashOptions, dependencies: VoidhashClient.Dependencies
    ) -> VoidhashClient {
        let client = VoidhashClient(
            publishableKey: publishableKey, options: options, dependencies: dependencies)
        let previous = lock.withLock { () -> VoidhashClient? in
            defer { sharedClient = client }
            return sharedClient
        }
        #if canImport(UIKit)
            if options.screenTracking.automatic {
                UIKitScreenTracking.install()
            }
        #endif
        Task {
            await previous?.shutdown()
            await client.start()
        }
        return client
    }

    /// The client created by the most recent ``configure(publishableKey:options:)`` call.
    public static var shared: VoidhashClient? {
        return lock.withLock { sharedClient }
    }
}
