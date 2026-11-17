import Foundation
import VoidhashCore

/// Configuration of a ``VoidhashClient``.
public struct VoidhashOptions: Sendable {
    /// API origin. Defaults to `https://api.voidhash.com`.
    public var baseUrl: URL
    /// Analytics ingest origin; falls back to ``baseUrl``.
    public var ingestUrl: URL?
    /// Prints SDK diagnostics. Requests are marked as coming from a debug build
    /// (`x-is-debug-build`) when this is on, when the SDK itself is compiled in a debug
    /// configuration, and in development mode (``dev``).
    public var debug: Bool
    /// Distinct id to start with, instead of a generated anonymous one. Adopted without a
    /// request; an anonymous id this device used before is linked onto it in the background, as
    /// ``VoidhashClient/identify(externalUserId:email:name:)`` would. A blank id is ignored.
    public var distinctId: String?
    /// When `false`, or when the client is given no publishable key, the SDK is inert: no
    /// requests, no StoreKit observer, no timers or lifecycle observation, no screen-tracking
    /// swizzle and nothing written to storage. Every client method returns its inert value.
    public var enabled: Bool
    /// Observer mode: the SDK syncs transactions but never finishes them with the store, and
    /// purchases are refused, so another billing integration can own them. Off by default.
    public var readOnly: Bool
    /// Requests development mode: purchases run against a mock store and are recorded under
    /// the development environment — nothing is charged. Honored only in debug builds; a
    /// release build always uses the real App Store.
    public var dev: Bool
    /// Receives SDK diagnostics that are not raised to the caller (a failed background refresh,
    /// an unreadable flow message, a dropped analytics batch). Defaults to
    /// ``VoidhashWarnings/standard``.
    public var onWarning: VoidhashWarningHandler?
    /// Receives structured ``VoidhashDiagnostic`` values for situations the SDK handled with a
    /// documented fallback: a paused transport, an evicted queue entry, an opened circuit
    /// breaker, a rejected key, an unreadable cache entry. Handler exceptions never propagate.
    public var onDiagnostic: VoidhashDiagnosticHandler?
    /// Locations to fetch and warm on the first launch, before the app asks for them.
    ///
    /// Inert while no flow can be shown: without a ``paywallRenderer`` the SDK resolves,
    /// remembers and warms no location. Otherwise locations the device has already resolved are
    /// remembered and preloaded automatically; this option covers the very first launch, where
    /// there is no history yet.
    public var preloadLocations: [String]
    /// The revision of each location's interface the app was built against, by location slug.
    ///
    /// Preloading and background refreshes ask for the flow of a location at this revision,
    /// and a presentation that names no revision uses it. A location that is not listed counts
    /// as revision 0, or, once presented, as the revision it was last presented with.
    public var flowRevisions: [String: Int]
    /// Native renderer for paywalls and flows, `VoidhashUIPaywallRenderer()` from the
    /// `VoidhashUI` package. Without one,
    /// ``VoidhashClient/presentFlow(location:revision:input:actions:)`` throws
    /// ``FlowError/rendererMissing``.
    public var paywallRenderer: (any PaywallRenderer)?
    /// What flows may do beyond purchases, restores and analytics. Defaults to opening links.
    ///
    /// Grant ``FlowCapability/notifications`` or ``FlowCapability/tracking`` only when the app
    /// wants a flow to ask for that permission (tracking also needs
    /// `NSUserTrackingUsageDescription` in the app's Info.plist), and
    /// ``FlowCapability/attributes`` to let flows set person attributes.
    public var flowCapabilities: Set<FlowCapability>
    /// Configuration of the built-in `$screen` event.
    public var screenTracking: ScreenTrackingOptions
    /// Captures `$app_installed`, `$app_updated`, `$app_opened`, `$app_backgrounded`,
    /// `$app_became_active`, `$app_crashed` and `$sign_out` on the app's behalf. An app that
    /// reports these itself turns it off.
    ///
    /// Only the events depend on it: the SDK observes the app's lifecycle either way, to recover
    /// when the app returns to the foreground and to write its queues through and flush them when
    /// it leaves.
    public var automaticLifecycleEvents: Bool
    /// The end user's analytics consent at launch. Defaults to `granted`.
    ///
    /// While it is `denied` or `pending` the SDK collects no analytics: custom, screen, lifecycle
    /// and paywall events are dropped, none is queued or sent, and requests carry
    /// `x-analytics-consent`. Purchases, restores, entitlements, identify, person traits, groups,
    /// feature flags and paywalls are unaffected. A decision passed to
    /// ``VoidhashClient/setAnalyticsConsent(_:)`` is persisted and takes precedence over this
    /// option on later launches.
    public var analyticsConsent: AnalyticsConsent
    /// What happens to events that occur while analytics consent is `pending`. Defaults to
    /// `drop`.
    ///
    /// With `buffer` the events a grant would record (custom, screen, lifecycle and paywall
    /// events) are held in memory with the time they happened, at most 100 of them, the oldest
    /// dropped first; nothing is stored or sent. When consent becomes `granted` they are recorded
    /// in order, each at its own time, under the identity, groups and session in effect then.
    /// When it becomes `denied` they are discarded. Person traits and group descriptions are
    /// never held, since consent does not cover them, and `denied` holds nothing.
    public var analyticsWhilePending: PendingAnalytics
    /// Treats ``VoidhashClient/identify(externalUserId:email:name:)`` as the end user's analytics
    /// consent, for apps whose terms of sign-in cover it. Off by default.
    ///
    /// When on, an identify while consent is `pending` grants it first; `denied` is never
    /// overridden and a consent already `granted` is left alone. Such a grant lasts while the
    /// person is signed in: ``VoidhashClient/signOut()`` and ``VoidhashClient/reset()`` first send
    /// what was recorded, then return consent to `pending`. It is persisted as implied, and
    /// any ``VoidhashClient/setAnalyticsConsent(_:)`` call replaces it with an explicit decision
    /// that sign-out keeps.
    public var grantConsentOnIdentify: Bool
    /// How feature flag reads behave before, and while, Voidhash can answer them.
    public var featureFlags: FeatureFlagOptions
    /// Reads which Apple Ads campaign brought this install and records it on the person as a touch.
    /// Runs once per install, in the background and only with analytics consent. An install that
    /// predates this option is not read. Defaults to `true`.
    public var installAttribution: Bool
    /// What happens to the messages the App Store asks the app to show, such as a price increase
    /// to agree to or a billing issue. Defaults to holding them while a flow is on screen.
    public var appStoreMessages: VoidhashAppStoreMessagesHandling
    /// What happens when the user starts a purchase outside the app, such as an in-app purchase
    /// promoted on the App Store. Defaults to buying it once the client has initialized.
    public var purchaseIntents: VoidhashPurchaseIntentHandling

    public init(
        baseUrl: URL = VoidhashApiClient.defaultBaseUrl,
        ingestUrl: URL? = nil,
        debug: Bool = false,
        distinctId: String? = nil,
        enabled: Bool = true,
        readOnly: Bool = false,
        dev: Bool = false,
        onWarning: VoidhashWarningHandler? = nil,
        onDiagnostic: VoidhashDiagnosticHandler? = nil,
        preloadLocations: [String] = [],
        flowRevisions: [String: Int] = [:],
        screenTracking: ScreenTrackingOptions = ScreenTrackingOptions(),
        automaticLifecycleEvents: Bool = true,
        analyticsConsent: AnalyticsConsent = .granted,
        paywallRenderer: (any PaywallRenderer)? = nil,
        flowCapabilities: Set<FlowCapability> = [.links],
        featureFlags: FeatureFlagOptions = FeatureFlagOptions(),
        installAttribution: Bool = true,
        analyticsWhilePending: PendingAnalytics = .drop,
        grantConsentOnIdentify: Bool = false,
        appStoreMessages: VoidhashAppStoreMessagesHandling = .deferWhileFlowPresented,
        purchaseIntents: VoidhashPurchaseIntentHandling = .purchaseWhenReady
    ) {
        self.baseUrl = baseUrl
        self.ingestUrl = ingestUrl
        self.debug = debug
        self.distinctId = distinctId
        self.enabled = enabled
        self.readOnly = readOnly
        self.dev = dev
        self.onWarning = onWarning
        self.onDiagnostic = onDiagnostic
        self.preloadLocations = preloadLocations
        self.flowRevisions = flowRevisions
        self.screenTracking = screenTracking
        self.automaticLifecycleEvents = automaticLifecycleEvents
        self.analyticsConsent = analyticsConsent
        self.paywallRenderer = paywallRenderer
        self.flowCapabilities = flowCapabilities
        self.featureFlags = featureFlags
        self.installAttribution = installAttribution
        self.analyticsWhilePending = analyticsWhilePending
        self.grantConsentOnIdentify = grantConsentOnIdentify
        self.appStoreMessages = appStoreMessages
        self.purchaseIntents = purchaseIntents
    }
}

/// Feature flag configuration of a ``VoidhashClient``.
public struct FeatureFlagOptions: Sendable {
    /// Longest a flag read with nothing cached waits for Voidhash, in milliseconds. Defaults to
    /// 2000. Without an answer by then the read returns its defaults, marked stale and expired;
    /// the evaluation carries on in the background, is cached, and is announced through
    /// ``onUpdate``. Clamped to between 0 and the request timeout (10 s); a value that is not
    /// finite waits for the request timeout.
    public var maxWaitMilliseconds: Double
    /// The value of each flag that has no evaluated value yet, by key: before the first
    /// evaluation arrives, or when Voidhash does not know the flag. Applied to the keys a
    /// ``VoidhashClient/getFeatureFlags(_:)`` call asks for.
    public var defaults: [String: Bool]
    /// Called with every evaluation the SDK caches for the current identity, including one that
    /// arrives after a read stopped waiting for it, so the app can read its flags again: the key
    /// set that was evaluated (`nil` for every flag, as in
    /// ``VoidhashClient/getFeatureFlags(_:)``) and its results. An evaluation that arrives after
    /// the identity changed is dropped, not announced. Called from an arbitrary task inside the
    /// SDK: it must be thread safe and return quickly, handing anything slow, such as UI work,
    /// to a task of its own.
    public var onUpdate: (@Sendable (_ keys: [String]?, _ flags: [SdkFeatureFlagResult]) -> Void)?

    public init(
        maxWaitMilliseconds: Double = 2000,
        defaults: [String: Bool] = [:],
        onUpdate: (@Sendable (_ keys: [String]?, _ flags: [SdkFeatureFlagResult]) -> Void)? = nil
    ) {
        self.maxWaitMilliseconds = maxWaitMilliseconds
        self.defaults = defaults
        self.onUpdate = onUpdate
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
    /// Reconfiguring retires the previous client (see ``VoidhashClient/shutdown()``). The new
    /// client reads the queues and identity it shares with the previous one only once that
    /// client has handed them over, so nothing either of them queued is lost.
    ///
    /// - Parameters:
    ///   - publishableKey: Project publishable key from the dashboard. Without one, `nil` or
    ///     blank, the client is inert, as with ``VoidhashOptions/enabled`` off: an app can
    ///     configure the SDK the same way in a build that has no key.
    ///   - options: Optional configuration overrides.
    /// - Returns: The configured client, also available as ``shared``.
    @discardableResult
    public static func configure(
        publishableKey: String?, options: VoidhashOptions = VoidhashOptions()
    ) -> VoidhashClient {
        return configure(
            publishableKey: publishableKey, options: options,
            dependencies: VoidhashClient.Dependencies.live())
    }

    /// ``configure(publishableKey:options:)`` with injected dependencies, so tests can install
    /// a network-free client as ``shared`` for the UIKit and SwiftUI integrations to find.
    @discardableResult
    static func configure(
        publishableKey: String?, options: VoidhashOptions, dependencies: VoidhashClient.Dependencies
    ) -> VoidhashClient {
        let client = lock.withLock { () -> VoidhashClient in
            var dependencies = dependencies
            dependencies.startsWhenConfigured = true
            if let previous = sharedClient {
                // Started under the lock: a write the previous client forwards once it sees its
                // shutdown reads `shared` through this lock, so it always finds the new client.
                dependencies.predecessorShutdown = Task { await previous.shutdown() }
            }
            let client = VoidhashClient(
                publishableKey: publishableKey, options: options, dependencies: dependencies)
            sharedClient = client
            return client
        }
        #if canImport(UIKit)
            if client.tracksScreensAutomatically {
                UIKitScreenTracking.install()
            }
        #endif
        Task { await client.start() }
        return client
    }

    /// The client created by the most recent ``configure(publishableKey:options:)`` call.
    public static var shared: VoidhashClient? {
        return lock.withLock { sharedClient }
    }

    /// Whether `distinctId` is one the SDK made for an anonymous end user: `vh_anon_<uuid>`, or
    /// the `vh:anon:` form a device may still hold from an earlier SDK build. Use it instead of
    /// checking a prefix.
    public static func isAnonymousDistinctId(_ distinctId: String) -> Bool {
        return IdentityStore.isAnonymous(distinctId)
    }
}
