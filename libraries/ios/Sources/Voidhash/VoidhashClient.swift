import CryptoKit
import Foundation
import StoreKit
import VoidhashCore

#if canImport(UIKit)
    import UIKit
#endif

/// The Voidhash SDK client.
///
/// Created through ``Voidhash/configure(publishableKey:options:)``. Every method is `async`;
/// initialization (store connection, schema resolution, reconciliation of transactions observed
/// while the app was away) runs once and is awaited implicitly by the first call that needs it.
///
/// When the client was configured with `enabled: false` every method is inert: no requests are
/// made, no StoreKit observer, timer or lifecycle observer starts, nothing is written to storage,
/// `getProducts()` returns an empty list and `getCurrentPerson()` returns `nil`.
///
/// Persisted state is loaded only once the device has been unlocked since it booted. Until then
/// (an app launched in the background before the first unlock) reads return cold values without
/// waiting, and writes are held in memory and applied once the state has loaded.
public actor VoidhashClient {
    /// Injection seam for tests and for hosts that supply their own store.
    struct Dependencies: Sendable {
        var session: URLSession = NetworkPolicy.defaultSession
        var cacheAdapter: (any CacheAdapter)?
        /// Adapter over the pre-namespace key layout, migrated across on first run. Defaults to
        /// the same `UserDefaults` the SDK has always written to; `nil` skips the migration.
        var legacyCacheAdapter: (any CacheAdapter)? = UserDefaultsCacheAdapter(
            keyPrefix: CacheMigration.legacyKeyPrefix)
        /// Durable backing for the analytics queue; defaults to a file in Application Support.
        var analyticsStore: (any RecordStore)?
        /// Durable backing for the transaction outbox.
        var outboxStore: (any RecordStore)?
        /// Durable backing for the identify and person-trait writes waiting for the backend.
        var personWritesStore: (any RecordStore)?
        /// Durable backing for the receipts the backend accepted.
        var acceptedReceiptsStore: (any RecordStore)?
        var clock: any VoidhashClock = SystemVoidhashClock()
        var connectivityMonitor: any ConnectivityMonitoring = DefaultConnectivityMonitor.current
        /// Longest an interactive read waits on an in-flight refresh before serving stale state.
        var freshnessBudgetMilliseconds: Double = NetworkPolicy.freshnessBudgetMilliseconds
        /// Suspends for the freshness budget. Separate from the analytics clock so tests can keep
        /// backoff deterministic while still exercising a real race.
        var budgetSleep: @Sendable (Double) async -> Void = { milliseconds in
            await NetworkPolicy.sleep(milliseconds: milliseconds)
        }
        /// Longest a call the app awaits waits on Voidhash, see
        /// ``NetworkPolicy/awaitedCallBudgetMilliseconds``.
        var awaitedCallBudgetMilliseconds: Double = NetworkPolicy.awaitedCallBudgetMilliseconds
        /// Random extra added to each circuit-breaker cooldown, see ``CircuitBreaker``.
        var breakerJitter: @Sendable () -> Double = { Double.random(in: 0..<0.25) }
        var engine: (any StoreKitEngineProtocol)?
        /// Where flow packages are cached for a storage namespace; `nil` keeps none on disk.
        var flowPackageDirectory: @Sendable (String) -> URL? = { namespace in
            FlowPackageStore.cachesDirectory(namespace: namespace)
        }
        /// Where the images flows show are kept for a storage namespace; `nil` keeps none.
        var flowImageDirectory: @Sendable (String) -> URL? = { namespace in
            FlowImageStore.cachesDirectory(namespace: namespace)
        }
        var device: SdkDeviceInfo = SdkDeviceInfo.current()
        var analyticsNow: @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 }
        var analyticsSleep: @Sendable (Double) async -> Void = { milliseconds in
            await NetworkPolicy.sleep(milliseconds: milliseconds)
        }
        var openExternalUrl: (@Sendable (String) async -> Void)?
        var startAutoFlush = true
        /// Whether the background refresh triggers run: the boot warm-up and the post-purchase
        /// grant refresh. Tests that assert on exact request sequences turn them off.
        var runBackgroundRefreshes = true
        var lifecycleObserver: any AppLifecycleObserving = VoidhashClient.defaultLifecycleObserver
        var crashDiagnostics: any CrashDiagnosticObserving =
            VoidhashClient.defaultCrashDiagnostics
        var backgroundTaskRunner: any BackgroundTaskRunning =
            VoidhashClient.defaultBackgroundTaskRunner
        /// Whether this process has reported `$app_opened`, whichever client did. Shared by every
        /// client in the process, so a client configured again does not report a second one.
        var appOpenedInProcess: AtomicBool = VoidhashClient.appOpenedInProcess
        /// Whether persisted state can be read yet; tests simulate a launch before first unlock.
        var protectedData: any ProtectedDataAvailability = SystemProtectedDataAvailability()
        /// Shutdown of the client this one replaces. Persisted state, which the two share, is
        /// read only once it has handed everything over.
        var predecessorShutdown: Task<Void, Never>?
        /// Set by ``VoidhashClient/makeEmbedded(publishableKey:options:)``: no identity, no
        /// initialization, and nothing persisted.
        var embedded = false
        /// Set by ``Voidhash/configure(publishableKey:options:)``, which starts the client itself
        /// on a task of its own that a first call can overtake.
        var startsWhenConfigured = false
        /// Whether the client takes the storage of its publishable key and API origin over from
        /// the live client holding it, retiring that one. `nil` decides by whether any of the
        /// storage is the shared default, which two clients must never hold at once.
        var claimsNamespaceStorage: Bool?
        /// What a host SDK adds, see ``VoidhashHostOptions``; `nil` for an app's own client.
        var host: VoidhashHostOptions?
        /// Fetches the Apple Ads attribution token, blocking its thread. `nil` means the client
        /// never reads install attribution: nothing but ``live()`` reaches Apple on its own.
        var adServicesToken: (@Sendable () throws -> String)?
        /// Runs once Apple's answer is decoded, before it is recorded, so a test can withdraw
        /// consent at exactly that point.
        var installAttributionAnswered: (@Sendable () async -> Void)?
        /// Whether the client listens to App Store messages and purchase intents, which only a
        /// real app receives.
        var observesAppStoreEvents = false

        /// The dependencies of a client in a real app.
        static func live() -> Dependencies {
            var dependencies = Dependencies()
            dependencies.adServicesToken = InstallAttribution.systemTokenFetch
            dependencies.observesAppStoreEvents = true
            return dependencies
        }
    }

    /// Which client holds each storage namespace.
    static let storageOwners = StorageOwners()

    /// Whether the process has reported `$app_opened`; see ``Dependencies/appOpenedInProcess``.
    static let appOpenedInProcess = AtomicBool(false)

    private static let personCacheTtlMilliseconds: Double = 1000 * 60 * 60 * 24 * 2
    private static let flagsCacheStaleTimeMilliseconds: Double = 1000 * 60 * 5
    private static let paywallCacheTtlMilliseconds: Double = 1000 * 60 * 60 * 24 * 7
    private static let paywallCacheStaleTimeMilliseconds: Double = 1000 * 60 * 60
    /// Debounce between foreground-triggered refreshes.
    private static let foregroundRefreshDebounceMilliseconds: Double = 60_000
    /// Locations remembered for preload on the next launch.
    static let maxKnownLocations = 20
    /// Cache key of the locations this device has resolved before.
    static let knownLocationsCacheKey = "paywall:placements"

    private static func normalizeKnownLocations(_ locations: [String]) -> [String] {
        var normalized: [String] = []
        for location in locations where !location.isEmpty {
            normalized.removeAll { $0 == location }
            normalized.append(location)
        }
        return Array(normalized.suffix(maxKnownLocations))
    }

    /// Cache key of the `{appBuild, appVersion}` pair seen on the previous launch.
    ///
    /// The `voidhash:` in the key is historical — it was the whole namespace before keys were
    /// scoped per publishable key and origin — and is kept so the one-time migration in
    /// ``CacheMigration`` can carry the entry across without a device re-reporting
    /// `$app_installed`.
    static let lastSeenAppReleaseCacheKey = "voidhash:analytics:last-seen-app-release"

    /// Cache key of the time up to which crash reports were handled, in epoch milliseconds: the
    /// newest report sent, or the moment analytics consent was last granted.
    static let lastReportedCrashCacheKey = "voidhash:analytics:last-reported-crash"

    struct AppReleaseInfo: Codable, Sendable, Equatable {
        let appBuild: String
        let appVersion: String
    }

    private struct CachedPaywallState: Sendable {
        let value: SdkResolvedPaywall?
        let isStale: Bool
        let isExpired: Bool
    }

    /// The backend's answer to a person read: its snapshot, or `nil` when it has no person for
    /// the identity.
    private struct PersonRefresh: Sendable {
        let person: SdkPerson?
    }
    private static let personCacheStaleTimeMilliseconds: Double = 1000 * 60 * 5

    /// Read planes whose refreshes back off independently after a failure.
    private enum RefreshPlane: Hashable {
        case person
        case flags
        case paywall
        case schema
    }

    /// Refresh backoff of one ``RefreshPlane``, on the clock's monotonic reading.
    private struct RefreshBackoff {
        let attempts: Int
        let retryAt: Double
        /// Whether the server asked for the wait through `Retry-After`, which even a forced read
        /// honours.
        let requestedByServer: Bool
    }

    let options: VoidhashOptions
    private let dependencies: Dependencies
    /// Storage namespace of the publishable key and API origin, which a replacing client over
    /// the same queue files shares.
    private nonisolated let namespace: String
    /// Whether the UIKit swizzle reports screens to this client: enabled with automatic tracking.
    nonisolated let tracksScreensAutomatically: Bool
    /// ``ScreenTrackingOptions/isAppScreenClass``, read by the UIKit swizzle on the main thread.
    nonisolated let isAppScreenClass: (@Sendable (AnyClass) -> Bool)?
    private let warn: VoidhashWarningHandler
    /// Whether any flow can be shown: only through a configured native renderer. Resolving,
    /// remembering and warming locations all follow it, so no location costs a request while
    /// nothing can show it.
    private var paywallsEnabled: Bool {
        return options.paywallRenderer != nil || dependencies.host?.resolvesPaywalls == true
    }
    private let readOnlyFlag: AtomicBool
    /// The end user's analytics consent, read synchronously by the header builder and the
    /// analytics queue.
    private let analyticsConsentState: AnalyticsConsentState
    /// Whether `ANALYTICS_CONSENT_DENIED` was reported since consent was last granted.
    private let reportedConsentSkip = AtomicBool(false)
    /// Set when a launch without analytics consent skipped the install and update check, which
    /// then runs once consent is granted.
    private var appReleaseCheckDeferred = false
    /// Development mode: purchases run against a mock store and are recorded under the
    /// development environment. Only ever true in debug builds.
    private let isDevelopmentMode: Bool
    private let cacheManager: CacheManager
    private let cacheAdapter: any CacheAdapter
    private let identityStore: IdentityStore
    private let apiClient: VoidhashApiClient
    private let engine: any StoreKitEngineProtocol
    private let schemaManager: SchemaManager
    private let headerFactory: SdkHeaderFactory
    let sessionManager: AnalyticsSessionManager
    let analytics: AnalyticsClient

    private var orchestratorStorage: PurchaseOrchestrator?
    private var flowCoordinatorStorage: FlowCoordinator?
    private var flowImageStore: FlowImageStore?
    private var initializationTask: Task<RuntimeSchema, any Error>?
    /// What initialization writes to persisted state on its way up: collected analytics dropped
    /// without consent, the startup events and the release they record. Retirement waits for it
    /// rather than for all of ``initializationTask``, which also waits on the main thread.
    private var startupWrites: Task<Void, Never>?
    private var storeConnectionTask: Task<Void, any Error>?
    private var storeConnected = false
    /// Resolves once the client knows whether it can read persisted state now: after the
    /// predecessor handed it over, whether protected data was available.
    private let protectedDataProbe: Task<Bool, Never>
    /// Loads persisted state, started in `init`: waits for protected data, runs the one-time move
    /// of the pre-namespace cache entries and loads the identity, so no call reads identity,
    /// session or queue state before then. Calls check ``loadIdentity()`` rather than awaiting
    /// it, since before the first unlock it waits for as long as the device stays locked.
    private let identityInitializationTask: Task<Void, Never>
    /// Set once ``identityInitializationTask`` has loaded the persisted identity.
    private let stateLoaded: AtomicBool
    /// A write made while protected data was unavailable.
    private struct HeldWrite {
        /// An analytics capture, which the cap on held captures may drop. Identity changes,
        /// traits, consent and receipts are always kept.
        let isCapture: Bool
        let apply: @Sendable (VoidhashClient) async -> Void
    }

    /// Captures held while protected data is unavailable; past this the oldest is dropped, as
    /// for events taken before the client started.
    static let maxHeldCaptures = HostIntake.maxHeldBeforeStart

    /// Writes made while protected data was unavailable, applied in order once state has loaded.
    private var heldWrites: [HeldWrite] = []
    private var heldCaptureCount = 0
    private var droppedHeldCaptures = 0
    /// Applies ``heldWrites`` once state has loaded; `nil` while nothing is held.
    private var heldWritesReplay: Task<Void, Never>?
    /// An event that happened while analytics consent was pending, see
    /// ``VoidhashOptions/analyticsWhilePending``.
    private struct PendingEvent {
        let name: String
        let properties: [String: JSONValue]
        let capturedAt: Double
    }

    /// Events held while analytics consent is pending; past this the oldest is dropped.
    static let maxPendingEvents = 100

    /// Events held, in memory only, until consent is granted, which records them, or denied,
    /// which discards them.
    private var pendingEvents: [PendingEvent] = []
    private var droppedPendingEvents = 0
    /// Records the held events after a grant; captures made meanwhile wait for it, so they land
    /// behind the events that happened before them.
    private var pendingEventsReplay: Task<Void, Never>?
    private let identityChanges = SerialTaskQueue()
    /// The last identify the backend confirmed in this process.
    private var lastIdentifiedId: String?
    /// Set by ``shutdown()``: the client was retired and does no more work of its own.
    private let retirement: AtomicBool
    private var shutdownTask: Task<Void, Never>?
    /// What a disabled or retired client, or one waiting for protected data, reports as its
    /// distinct id and session id. Never persisted.
    private let inertDistinctId =
        IdentityStore.anonymousDistinctIdPrefix + UUID().uuidString.lowercased()
    private var hasStarted: Bool
    private var didWarnNeverStarted = false
    private var currentSchema: RuntimeSchema?
    private var lifecycleTracker = LifecycleTracker()
    private var lifecycleSubscription: (any AppLifecycleSubscription)?
    private var crashSubscription: (any CrashDiagnosticSubscription)?
    /// The send id ``trackPushOpened(userInfo:)`` reported last.
    private var lastPushOpenedSendId: String?
    private let lifecycleQueue = SerialTaskQueue()
    private var screenTracker: ScreenTracker
    private var manualScreenCounter = 0

    private let clock: any VoidhashClock
    private let diagnostics: DiagnosticEmitter
    /// Delivers events to a host SDK, see ``VoidhashHostOptions/events``.
    private let hostEvents: HostEventSink
    /// The identity and the synchronous capture intake, readable without the actor.
    private let intake = HostIntake()
    /// Whether the schema was given by the host and is never fetched.
    private let schemaIsFixed: Bool
    private let breaker: CircuitBreaker
    private let gate: OutboundGate
    private let outbox: TransactionOutbox
    /// Breaker key of receipt delivery: an outage of the reads or of ingest must not hold up
    /// purchases, nor refused receipts the reads.
    private let transactionsBreakerHost: String
    /// Receipts the backend accepted, which scans and host reports do not send again.
    private let acceptedReceipts: AcceptedReceiptLedger
    /// Identify and person-trait writes waiting for the backend.
    private let personWrites: PersonWriteOutbox
    /// Per distinct id, bumped when a person write for it goes out and when its answer is in, and
    /// when the backend accepted a receipt that may have granted it something. A person read that
    /// finds it changed over its own request may predate the change, and leaves the cache to the
    /// write's answer or to the next read; a read started after the change does not join it.
    private var personWriteGenerations: [String: Int] = [:]
    /// Recovery timers, armed only while the app is in the foreground.
    private let scheduler: ForegroundScheduler
    private let personFlight = SingleFlight<PersonRefresh?>()
    private let flagsFlight = SingleFlight<[SdkFeatureFlagResult]>()
    private let paywallFlight = SingleFlight<SdkResolvedPaywall?>()
    private var connectivitySubscription: (any ConnectivitySubscription)?
    /// The person refreshes following an accepted receipt, see ``scheduleGrantRefreshes(afterDelays:)``.
    private var grantRefreshes: Task<Void, Never>?
    /// This launch's read of install attribution, once it started. Withdrawing consent cancels and
    /// clears it, so it runs again once consent is granted. One that found no answer stays, and
    /// the next launch asks again.
    private var installAttributionTask: Task<Void, Never>?
    /// Last foreground refresh, for the once-a-minute debounce.
    private var lastForegroundRefreshAt: Double?
    /// Last connectivity-restored refresh. Its own window: a foreground that found the network
    /// down must not cost the flush that connectivity coming back a moment later triggers.
    private var lastConnectivityRefreshAt: Double?
    /// Planes whose last refresh failed. Until `retryAt` a stale read serves its cache instead of
    /// asking again, so throttling or an outage the breaker does not see (a `429`, a verdict)
    /// costs one request per backoff window rather than one per host read.
    private var refreshBackoff: [RefreshPlane: RefreshBackoff] = [:]
    /// Last connectivity report, so only an offline-to-online edge triggers a refresh.
    private var wasOnline: Bool?
    private var didSurfaceAuthFailure = false
    /// Flag key sets whose read an open circuit breaker turned away, refreshed once it admits a
    /// probe; see ``refreshWhenCircuitReopens(_:)``.
    private var flagKeySetsAwaitingCircuit: Set<[String]?> = []
    /// Whether a person read was turned away by an open circuit breaker.
    private var personAwaitsCircuit = false
    /// Identify requests in flight, see ``trackIdentifySend(_:)``.
    private var identifySends: [UUID: (alias: String?, target: String, task: Task<Void, Never>)] =
        [:]
    private var knownLocations: [String] = []
    /// The interface revision each location was last presented with in this process, which a
    /// background refresh of a location ``VoidhashOptions/flowRevisions`` does not name uses.
    private var presentedFlowRevisions: [String: Int] = [:]
    /// Set while ``purchase(_:options:)`` runs, which takes one purchase at a time.
    private var purchaseInFlight = false
    /// Waiting for the purchase in flight to end, see ``waitForPurchaseInFlight()``.
    private var purchaseEndWaiters: [CheckedContinuation<Void, Never>] = []
    /// The transactions ``purchase(_:options:)`` returned lately, at most 50.
    private var boughtHere: [String] = []
    /// The transactions ``transactionUpdates()`` reported this session, the latest 200.
    private var announcedTransactions: [String] = []
    /// Feeds ``personUpdates()``.
    private nonisolated let personBroadcaster = UpdateBroadcaster<SdkPerson?>(replaysLatest: true)
    /// Feeds ``transactionUpdates()``. Keeps a few for the first stream, so a purchase approved
    /// before the app listens still reaches it.
    private nonisolated let transactionBroadcaster = UpdateBroadcaster<VoidhashTransactionUpdate>(
        keepsWhileUnsubscribed: 10)
    /// The snapshot ``personUpdates()`` saw last; `nil` before the first.
    private var publishedPerson: SdkPerson??
    /// The identity ``personUpdates()`` and ``FeatureFlagOptions/onUpdate`` describe: set by the
    /// first publish after the identity loads and by every identity switch, as it publishes.
    private var publishedIdentity: String?
    /// Identity switches between their change of the identity and their announcement, during
    /// which nothing read for an identity is published; see ``mayPublish(for:)``.
    private var identitySwitchesInFlight = 0
    /// Feeds ``VoidhashAppStore/purchaseIntents()``.
    nonisolated let purchaseIntentBroadcaster = UpdateBroadcaster<VoidhashPurchaseIntent>(
        keepsWhileUnsubscribed: 10)
    /// The loops listening to App Store messages and purchase intents.
    private var appStoreEvents: [Task<Void, Never>] = []
    /// Flows being presented, which App Store messages wait for.
    private var flowsOnScreen = 0
    /// App Store messages waiting for the flows on screen to end, or for a scene in the
    /// foreground to show them on.
    private var heldMessages: [any DeferredAppStoreMessage] = []

    #if canImport(UIKit)
        private let presentationTarget = PresentationTargetBox()
    #endif

    /// Creates a client without starting it.
    ///
    /// Call ``start()`` or ``waitForInitialization()`` before using it: until then no StoreKit
    /// observer, flush loop or lifecycle observation runs.
    /// ``Voidhash/configure(publishableKey:options:)`` creates and starts the shared client and is
    /// what most apps want. Hosts that only need the embedded surface use
    /// ``makeEmbedded(publishableKey:options:)`` instead.
    ///
    /// One client at a time works over the state of a publishable key and API origin. Creating
    /// another one over the same pair, here or through `configure`, retires the client before it
    /// (see ``shutdown()``), whose writes then go to the new one.
    ///
    /// - Parameter publishableKey: Project publishable key from the dashboard. Without one, `nil`
    ///   or blank, the client is inert, as with ``VoidhashOptions/enabled`` off.
    public init(publishableKey: String?, options: VoidhashOptions = VoidhashOptions()) {
        self.init(publishableKey: publishableKey, options: options, dependencies: .live())
    }

    /// Creates a client for a host that embeds it as its backend transport and owns identity,
    /// caching and store observation itself.
    ///
    /// Nothing is persisted and nothing runs on its own: no identity is allocated, the cache and
    /// queues live in memory, and the client is never started, so no StoreKit observer, flush
    /// loop, lifecycle or connectivity observation begins. Use the embedded surface, which takes
    /// the distinct id on every call; ``fetchSchema(distinctId:)`` always asks the backend.
    public static func makeEmbedded(
        publishableKey: String, options: VoidhashOptions = VoidhashOptions()
    ) -> VoidhashClient {
        return makeEmbedded(
            publishableKey: publishableKey, options: options, dependencies: Dependencies())
    }

    /// ``makeEmbedded(publishableKey:options:)`` over injected transport and store doubles.
    static func makeEmbedded(
        publishableKey: String, options: VoidhashOptions, dependencies: Dependencies
    ) -> VoidhashClient {
        var dependencies = dependencies
        dependencies.embedded = true
        dependencies.cacheAdapter = InMemoryCacheAdapter()
        dependencies.legacyCacheAdapter = nil
        dependencies.analyticsStore = InMemoryRecordStore()
        dependencies.outboxStore = InMemoryRecordStore()
        dependencies.personWritesStore = InMemoryRecordStore()
        dependencies.acceptedReceiptsStore = InMemoryRecordStore()
        dependencies.startAutoFlush = false
        dependencies.runBackgroundRefreshes = false
        return VoidhashClient(
            publishableKey: publishableKey, options: options, dependencies: dependencies)
    }

    init(publishableKey: String?, options: VoidhashOptions, dependencies: Dependencies) {
        // A real key is used exactly as given; only its absence changes anything.
        let publishableKey = publishableKey ?? ""
        let hasKey = !publishableKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        let options = { (options: VoidhashOptions) -> VoidhashOptions in
            var options = options
            options.enabled = options.enabled && hasKey
            return options
        }(options)
        self.options = options
        self.dependencies = dependencies
        tracksScreensAutomatically = options.enabled && options.screenTracking.automatic
        isAppScreenClass = options.screenTracking.isAppScreenClass
        hasStarted = dependencies.startsWhenConfigured
        screenTracker = ScreenTracker(options: options.screenTracking)
        let warn = options.onWarning ?? VoidhashWarnings.standard
        self.warn = warn
        readOnlyFlag = AtomicBool(options.readOnly)
        let analyticsConsentState = AnalyticsConsentState(options.analyticsConsent)
        self.analyticsConsentState = analyticsConsentState
        // Development mode is a debug-build-only affordance: the flag alone is never enough,
        // so it can never reach a production release.
        #if DEBUG
            let developmentMode = options.dev
            let isDebugConfiguration = true
        #else
            let developmentMode = false
            let isDebugConfiguration = false
        #endif
        isDevelopmentMode = developmentMode
        // The backend accepts development purchases only from requests marked as a debug build,
        // so the header follows the build configuration and development mode, not only the
        // logging option.
        let isDebugBuild = isDebugConfiguration || options.debug || developmentMode
        let hostEvents = HostEventSink(handler: dependencies.host?.events)
        self.hostEvents = hostEvents
        let onDiagnostic = options.onDiagnostic
        let forwardToHost: VoidhashDiagnosticHandler = { diagnostic in
            onDiagnostic?(diagnostic)
            hostEvents.emit(.diagnostic(diagnostic))
        }
        let diagnostics = DiagnosticEmitter(hostEvents.isActive ? forwardToHost : onDiagnostic)
        self.diagnostics = diagnostics
        schemaIsFixed = dependencies.host?.internalSchema != nil
        currentSchema = dependencies.host?.internalSchema
        clock = dependencies.clock
        let clientBox = WeakClientBox()
        // Whichever request finds the key rejected, the analytics queue, the outbox or a read, the
        // client is the one that schedules the probe.
        gate = OutboundGate(
            clock: dependencies.clock,
            onPause: { [clientBox] in
                guard let client = clientBox.get() else {
                    return
                }
                Task { await client.scheduleAuthProbe() }
            })
        breaker = CircuitBreaker(
            clock: dependencies.clock, diagnostics: diagnostics, jitter: dependencies.breakerJitter)
        scheduler = ForegroundScheduler(clock: dependencies.clock)
        let namespace = CacheNamespace.prefix(
            publishableKey: publishableKey, baseUrl: options.baseUrl)
        self.namespace = namespace
        let adapter =
            dependencies.cacheAdapter
            ?? UserDefaultsCacheAdapter(
                publishableKey: publishableKey, baseUrl: options.baseUrl)
        cacheAdapter = adapter
        cacheManager = CacheManager(
            adapter: adapter, now: dependencies.analyticsNow, diagnostics: diagnostics)
        identityStore = IdentityStore(cacheManager: cacheManager)
        let stateLoaded = AtomicBool(false)
        self.stateLoaded = stateLoaded
        let retirement = AtomicBool(false)
        self.retirement = retirement
        let protectedData = dependencies.protectedData
        // A disabled client reads and writes nothing, and an embedded one keeps its state in
        // memory, so neither waits for protected data.
        let persistsState = options.enabled && !dependencies.embedded
        // Two live clients over one set of files would each hold their own copy of the queues,
        // send the same receipts and events twice, and rewrite the files without what the other
        // just wrote. A client created over files another one holds takes them over, as
        // reconfiguring does: the previous one is retired and hands everything over first.
        let claimsStorage =
            persistsState
            && (dependencies.claimsNamespaceStorage
                ?? (dependencies.cacheAdapter == nil || dependencies.analyticsStore == nil
                    || dependencies.outboxStore == nil || dependencies.personWritesStore == nil
                    || dependencies.acceptedReceiptsStore == nil))
        let replacedOwner =
            claimsStorage ? VoidhashClient.storageOwners.claim(namespace, for: clientBox) : nil
        let configuredPredecessor = dependencies.predecessorShutdown
        let predecessorShutdown =
            replacedOwner.map { replaced in
                Task {
                    await configuredPredecessor?.value
                    await replaced.shutdown()
                }
            } ?? configuredPredecessor
        let protectedDataProbe =
            persistsState
            ? Task {
                await predecessorShutdown?.value
                return await protectedData.isAvailable()
            } : Task { true }
        self.protectedDataProbe = protectedDataProbe
        let legacyCacheAdapter = dependencies.legacyCacheAdapter
        let prepareStorage = dependencies.host?.prepareStorage
        let appVersion = dependencies.device.appVersion
        let embedded = dependencies.embedded
        let readsInstallAttribution =
            options.installAttribution && dependencies.adServicesToken != nil
        let personWrites = PersonWriteOutbox(
            store: dependencies.personWritesStore
                ?? VoidhashClient.defaultRecordStore(
                    namespace: namespace, name: "person-writes", adapter: adapter,
                    diagnostics: diagnostics),
            clock: dependencies.clock,
            diagnostics: diagnostics)
        self.personWrites = personWrites
        identityInitializationTask = Task { [identityStore, cacheManager] in
            guard options.enabled else { return }
            guard !embedded else {
                stateLoaded.value = true
                return
            }
            if !(await protectedDataProbe.value) {
                diagnostics.emit(
                    .cache, code: "PROTECTED_DATA_UNAVAILABLE", operation: "client.initialize",
                    retryable: true,
                    message:
                        "Persisted state is unreadable until the device is unlocked; it loads then, and writes made meanwhile are held in memory"
                )
                await protectedData.waitUntilAvailable()
            }
            // Retired while waiting: the replacing client owns the persisted state.
            guard !retirement.value, !Task.isCancelled else { return }
            await prepareStorage?()
            guard !retirement.value, !Task.isCancelled else { return }
            if let legacyCacheAdapter {
                await CacheMigration.run(
                    target: adapter, legacy: legacyCacheAdapter, appVersion: appVersion,
                    diagnostics: diagnostics)
            }
            // Before anything below stores an identity: the one stored now is an earlier launch's.
            if readsInstallAttribution {
                await InstallAttribution.prepare(
                    cacheManager: cacheManager,
                    hasStoredIdentity: await identityStore.getDistinctIdFromCache() != nil)
            }
            if let pinned = options.distinctId {
                if let reason = IdentityStore.invalidDistinctIdReason(pinned) {
                    // Every request made as it would be refused, receipts included.
                    warn(
                        "Ignoring the distinctId option: a distinct id \(reason). The SDK keeps its own identity"
                    )
                } else {
                    // An anonymous id this device used before is linked onto the pinned one, so
                    // its purchases and history merge into the pinned person rather than being
                    // orphaned. The identify is queued, not sent: the drain delivers it.
                    if let stored = await identityStore.getDistinctIdFromCache(),
                        stored != pinned, IdentityStore.isAnonymous(stored)
                    {
                        await personWrites.enqueue(.identify(alias: stored, target: pinned))
                        await VoidhashClient.carryAnonymousSnapshot(
                            from: stored, to: pinned, in: cacheManager)
                        await VoidhashClient.carryAnonymousFlags(
                            from: stored, to: pinned, in: cacheManager)
                        await VoidhashClient.invalidatePerIdentityCache(
                            previousDistinctId: stored, in: cacheManager)
                    }
                    await identityStore.identify(distinctId: pinned)
                }
            }
            // Applied before anything that collects analytics can run: held captures, startup
            // events and lifecycle observation all wait for the state to load.
            if let stored = await cacheManager.get(
                AnalyticsConsentState.cacheKey, as: String.self)?.value,
                let consent = AnalyticsConsent(rawValue: stored)
            {
                analyticsConsentState.adoptPersisted(
                    consent,
                    implied: await cacheManager.get(
                        AnalyticsConsentState.impliedCacheKey, as: Bool.self)?.value == true)
            }
            _ = await identityStore.getDistinctId()
            await identityStore.loadGroups()
            stateLoaded.value = true
        }
        apiClient = VoidhashApiClient(baseUrl: options.baseUrl, session: dependencies.session)
        engine =
            dependencies.engine
            ?? (developmentMode
                ? DevelopmentStoreEngine()
                : StoreKitEngine(onUnverified: { [diagnostics] operation, message in
                    diagnostics.emit(
                        .transport, code: "STOREKIT_TRANSACTION_UNVERIFIED",
                        operation: operation, message: message)
                }))
        schemaManager = SchemaManager(
            apiClient: GuardedSchemaFetcher { [clientBox] headers in
                guard let client = clientBox.get() else {
                    throw CancellationError()
                }
                return try await client.fetchGuardedSchema(headers: headers)
            },
            cacheManager: cacheManager,
            appVersion: dependencies.device.appVersion,
            diagnostics: diagnostics,
            gate: gate,
            onSchemaUpdated: { [clientBox] schema in
                guard let client = clientBox.get() else {
                    return
                }
                Task { await client.publishSchema(schema) }
            }
        )
        let sdkName = dependencies.host?.sdkName ?? SdkHeaders.sdkName
        let sdkVersion = dependencies.host?.sdkVersion ?? Voidhash.sdkVersion
        headerFactory = SdkHeaderFactory(
            publishableKey: publishableKey,
            sdkName: sdkName,
            sdkVersion: sdkVersion,
            device: dependencies.device,
            isDebugBuild: isDebugBuild,
            identityStore: identityStore,
            readOnly: readOnlyFlag,
            analyticsConsent: analyticsConsentState
        )
        let sessionManager = AnalyticsSessionManager(
            cacheManager: cacheManager, now: dependencies.analyticsNow)
        self.sessionManager = sessionManager
        analytics = AnalyticsClient(
            publishableKey: publishableKey,
            ingestUrl: options.ingestUrl ?? options.baseUrl,
            session: dependencies.session,
            distinctIdProvider: { [identityStore] in await identityStore.getDistinctId() },
            groupsProvider: { [identityStore] in identityStore.groups },
            sessionIdProvider: { await sessionManager.current() },
            analyticsConsent: { analyticsConsentState.value },
            standardProperties: AnalyticsClient.standardProperties(
                device: dependencies.device,
                sdkVersion: sdkVersion,
                sdkName: sdkName),
            now: dependencies.analyticsNow,
            sleep: dependencies.analyticsSleep,
            store: dependencies.analyticsStore
                ?? VoidhashClient.defaultRecordStore(
                    namespace: namespace, name: "analytics-queue", adapter: adapter,
                    diagnostics: diagnostics),
            gate: gate,
            breaker: breaker,
            diagnostics: diagnostics,
            debug: options.debug,
            warn: options.onWarning ?? VoidhashWarnings.standard
        )
        let apiClient = self.apiClient
        let acceptedReceipts = AcceptedReceiptLedger(
            store: dependencies.acceptedReceiptsStore
                ?? VoidhashClient.defaultRecordStore(
                    namespace: namespace, name: "accepted-receipts", adapter: adapter,
                    diagnostics: diagnostics),
            clock: dependencies.clock)
        self.acceptedReceipts = acceptedReceipts
        let transactionsBreakerHost = "transactions:\(VoidhashClient.host(of: options.baseUrl))"
        self.transactionsBreakerHost = transactionsBreakerHost
        outbox = TransactionOutbox(
            store: dependencies.outboxStore
                ?? VoidhashClient.defaultRecordStore(
                    namespace: namespace, name: "transaction-outbox", adapter: adapter,
                    diagnostics: diagnostics),
            sync: { [headerFactory, clientBox] body, distinctId in
                let accepted = try await apiClient.syncTransaction(
                    headers: headerFactory.build(distinctId: distinctId), body: body
                ).accepted
                if accepted {
                    await clientBox.get()?.noteReceiptAccepted(sentUnder: distinctId)
                }
                return accepted
            },
            clock: dependencies.clock,
            gate: gate,
            breaker: breaker,
            breakerHost: transactionsBreakerHost,
            diagnostics: diagnostics,
            currentDistinctId: { [identityStore] in await identityStore.getDistinctId() },
            acceptedReceipts: acceptedReceipts,
            beforeDrain: { [clientBox] distinctIds in
                await clientBox.get()?.awaitIdentifySends(linking: distinctIds)
                await clientBox.get()?.drainDuePersonWrites()
            },
            onDrainFinished: { [clientBox] deliveredIds in
                guard let client = clientBox.get() else {
                    return
                }
                Task {
                    await client.armReceiptRetry()
                    await client.finishDeliveredTransactions(deliveredIds)
                }
            }
        )
        clientBox.set(self)
    }

    /// Kicks off initialization without waiting for it.
    ///
    /// A no-op on a disabled, embedded or retired client. A start that lands after
    /// ``shutdown()`` would otherwise resubscribe to lifecycle and connectivity and restart the
    /// flush loop on a client that was replaced.
    public func start() {
        guard options.enabled, !isShutDown, !dependencies.embedded else {
            return
        }
        _ = ensureInitializationTask()
    }

    /// Awaits initialization, returning the resolved runtime schema.
    ///
    /// Never fails because the backend is unreachable: with no cached schema and no connectivity
    /// it returns ``RuntimeSchema/empty`` and refreshes in the background. Analytics capture,
    /// lifecycle observation and identity are already running by the time it returns.
    ///
    /// Returns the current schema (``RuntimeSchema/empty`` before one resolved) without waiting
    /// on a disabled, embedded or retired client, and before the first unlock after a reboot, when
    /// initialization completes once the device is unlocked.
    @discardableResult
    public func waitForInitialization() async throws -> RuntimeSchema {
        return try await ensureInitialized()
    }

    // MARK: - Products and purchases

    /// Returns every product configured in Studio that the App Store sells, sorted by slug, with
    /// the prices and the offers the current user can have.
    ///
    /// Waits for the StoreKit connection initialization opens. A device that has never fetched
    /// the dashboard products asks the backend for them first, unless it is known to be down or
    /// to refuse the publishable key: then the list is empty straight away.
    ///
    /// Each call asks the App Store again, so a purchase or another identity is reflected at
    /// once: who can have an introductory or promotional offer changes with both. A product the
    /// App Store does not return is left out and reported once per call as the
    /// `PRODUCT_NOT_FOUND` diagnostic, with its slug. So is one the App Store sells as a type
    /// that contradicts Studio's, as `PRODUCT_TYPE_MISMATCH` with both types: a Studio
    /// subscription needs an auto-renewable subscription, a Studio consumable a consumable, and a
    /// Studio one-time product a non-consumable or a non-renewing subscription.
    public func getProducts() async throws -> [VoidhashProduct] {
        guard options.enabled, !isShutDown, await loadIdentity() else {
            return []
        }
        let schema = try await resolvedSchemaForProducts()
        return try await loadProducts(
            Array(schema.products.values), schema: schema, reportsUnsold: false)
    }

    /// The products with `slugs`, in the order given: `nil` for a slug Studio has no product for,
    /// or one the App Store does not sell (reported as for ``getProducts()``).
    public func getProducts(slugs: [String]) async throws -> [VoidhashProduct?] {
        guard options.enabled, !isShutDown, await loadIdentity() else {
            return slugs.map { _ in nil }
        }
        let schema = try await resolvedSchemaForProducts()
        let definitions = Set(slugs).compactMap { schema.products[$0] }
        for slug in Set(slugs) where schema.products[slug] == nil {
            diagnostics.emit(
                .store, code: "PRODUCT_NOT_FOUND", operation: "products.load",
                message: "No product with the slug \"\(slug)\" is configured in Studio")
        }
        let bySlug = Dictionary(
            uniqueKeysWithValues: try await loadProducts(
                definitions, schema: schema, reportsUnsold: true
            ).map {
                ($0.slug, $0)
            })
        return slugs.map { bySlug[$0] }
    }

    /// The schema products are loaded from, fetched first on a device that has none.
    private func resolvedSchemaForProducts() async throws -> RuntimeSchema {
        var schema = try await ensureInitialized()
        if schema.isEmpty, !schemaIsFixed, isRefreshDue(.schema), await canReachNetwork(),
            let refreshed = await schemaManager.refresh(headers: await headerFactory.build())
        {
            schema = refreshed
        }
        return schema
    }

    /// The products of `definitions` the store sells, sorted by slug, reporting the ones it did
    /// not return as `PRODUCT_NOT_FOUND`, and the ones it sells as another type than Studio's as
    /// `PRODUCT_TYPE_MISMATCH`.
    ///
    /// - Parameter reportsUnsold: Also reports the products Studio does not sell in this store,
    ///   such as Google Play only ones, which the app asked for by slug.
    private func loadProducts(
        _ definitions: [RuntimeProductDefinition], schema: RuntimeSchema, reportsUnsold: Bool
    ) async throws -> [VoidhashProduct] {
        // The development store synthesizes products from the schema's computed development
        // metadata: no store round-trip, works on any simulator.
        if isDevelopmentMode {
            return definitions.compactMap { definition -> VoidhashProduct? in
                guard let configuration = definition.configuration.providers.development else {
                    if reportsUnsold {
                        reportProductNotFound(
                            definition, reason: "it has no development configuration")
                    }
                    return nil
                }
                return VoidhashProduct(definition: definition, development: configuration)
            }
            .sorted { $0.slug < $1.slug }
        }

        let sold = definitions.filter { $0.configuration.providers.appleAppStore != nil }
        for definition in definitions
        where reportsUnsold && definition.configuration.providers.appleAppStore == nil {
            reportProductNotFound(definition, reason: "it has no App Store product in Studio")
        }
        let skus = Set(sold.compactMap { $0.configuration.providers.appleAppStore?.productId })
        guard !skus.isEmpty else {
            return []
        }

        try await ensureStoreConnected()
        let storeProducts = try await engine.getItems(
            skus: skus.sorted(),
            appAccountToken: AccountToken.derive(distinctId: await identityStore.getDistinctId()))
        let storeProductsById = Dictionary(
            storeProducts.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        return sold.compactMap { definition -> VoidhashProduct? in
            guard let storeProductId = definition.configuration.providers.appleAppStore?.productId,
                let storeProduct = storeProductsById[storeProductId]
            else {
                reportProductNotFound(
                    definition,
                    reason:
                        "the App Store did not return it: check the product id, that it is cleared for sale, and the Paid Apps agreement"
                )
                return nil
            }
            guard
                let product = VoidhashProduct(definition: definition, storeProduct: storeProduct)
            else {
                diagnostics.emit(
                    .store, code: "PRODUCT_TYPE_MISMATCH", operation: "products.load",
                    message:
                        "Product \"\(definition.slug)\" is left out: it is a \(definition.type) product in Studio, but the App Store sells \(storeProductId) as \(storeProduct.appStore.productType.rawValue)"
                )
                return nil
            }
            return product
        }
        .sorted { $0.slug < $1.slug }
    }

    private func reportProductNotFound(_ definition: RuntimeProductDefinition, reason: String) {
        diagnostics.emit(
            .store, code: "PRODUCT_NOT_FOUND", operation: "products.load",
            message: "Product \"\(definition.slug)\" is left out: \(reason)")
    }

    /// Buys `product`, syncs the transaction with Voidhash and finishes it with the store.
    ///
    /// By default (``VoidhashOfferSelection/automatic``) a subscription is bought with its
    /// introductory offer when the user can have it. A promotional offer is signed by Voidhash for
    /// the person and applied by the App Store; a win-back offer needs iOS 18. An offer that
    /// cannot be applied throws `OFFER_UNAVAILABLE`: the product is never bought at its regular
    /// price instead.
    ///
    /// Unavailable in observer mode, as set when the purchase starts: an observer never owns a
    /// transaction, so it must never start one it would then be unable to finish. Only one
    /// purchase runs at a time: another one throws `PURCHASE_IN_PROGRESS`.
    ///
    /// Once the store has handed the transaction over, the call waits on Voidhash for at most
    /// one request timeout, the person refresh after an accepted receipt included. When Voidhash
    /// is slower than that or unreachable, the call returns `synced: false`, the receipt stays
    /// queued and the transaction unfinished until Voidhash accepts it, and the person is
    /// refreshed then.
    ///
    /// - Returns: ``VoidhashPurchaseResult/purchased(transaction:synced:)`` once the store charged
    ///   the user; ``VoidhashPurchaseResult/pending`` for a purchase waiting for approval, which
    ///   completes through ``transactionUpdates()``; ``VoidhashPurchaseResult/cancelled`` when the
    ///   user closed the sheet. A disabled client, a retired one without a successor and one
    ///   before the first unlock buy nothing and answer ``VoidhashPurchaseResult/disabled``.
    /// - Throws: `INVALID_ARGUMENT` for a quantity other than 1 of a product that is not a
    ///   consumable, `READ_ONLY_PURCHASE_NOT_ALLOWED`, `PURCHASE_IN_PROGRESS`,
    ///   `OFFER_UNAVAILABLE` and the store's failures as ``VoidhashStoreError``.
    public func purchase(
        _ product: VoidhashProduct, options: VoidhashPurchaseOptions = VoidhashPurchaseOptions()
    ) async throws -> VoidhashPurchaseResult {
        try await purchase(product, options: options, paywallContext: nil)
    }

    /// ``purchase(_:options:)`` started from a flow, whose receipt names the paywall.
    func purchase(
        _ product: VoidhashProduct, options: VoidhashPurchaseOptions,
        paywallContext: SdkPurchasePaywallContext?
    ) async throws -> VoidhashPurchaseResult {
        guard self.options.enabled else {
            return .disabled
        }
        guard !readOnlyFlag.value else {
            throw VoidhashStoreError.readOnlyPurchaseNotAllowed
        }
        // Claimed before the first suspension, so two calls never both get through.
        guard !purchaseInFlight else {
            throw VoidhashStoreError.purchaseInProgress
        }
        purchaseInFlight = true
        defer {
            purchaseInFlight = false
            let waiters = purchaseEndWaiters
            purchaseEndWaiters = []
            for waiter in waiters {
                waiter.resume()
            }
        }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return try await successor.purchase(
                product, options: options, paywallContext: paywallContext)
        case .retired, .held:
            return .disabled
        }
        let schema = try await ensureInitialized()
        let bought = BoughtTransaction()
        let outcome: PurchaseOrchestrator.PurchaseOutcome
        do {
            outcome = try await orchestrator().purchase(
                product: product, schema: schema, options: options,
                paywallContext: paywallContext, deliveryDeadline: requestTimeoutDeadline(1),
                bought: { bought.id = $0 })
        } catch {
            await handOverPurchaseIfRetired(bought.id)
            throw error
        }
        await handOverPurchaseIfRetired(bought.id)
        switch outcome {
        case .purchased(let storeTransaction, let synced):
            rememberBoughtHere(storeTransaction.transactionId)
            return .purchased(
                transaction: VoidhashTransaction(storeTransaction, schema: schema), synced: synced)
        case .pending:
            return .pending
        case .cancelled:
            return .cancelled
        }
    }

    /// The transactions ``purchase(_:options:)`` returned lately, which ``transactionUpdates()``
    /// does not report again should the store observer hand them over too.
    private func rememberBoughtHere(_ transactionId: String) {
        boughtHere.append(transactionId)
        if boughtHere.count > 50 {
            boughtHere.removeFirst()
        }
    }

    /// How many calls wait in ``waitForPurchaseInFlight()``.
    var purchaseInFlightWaiters: Int { purchaseEndWaiters.count }

    /// Returns once no ``purchase(_:options:)`` runs, or the client shut down.
    private func waitForPurchaseInFlight() async {
        guard purchaseInFlight, !isShutDown else {
            return
        }
        await withCheckedContinuation { purchaseEndWaiters.append($0) }
    }

    /// Reports `update` through ``transactionUpdates()``, unless it reported the transaction
    /// already this session: the store hands an unfinished transaction over twice at launch, and
    /// an offer code redeemed both to the sheet and to the observer.
    private func announceTransaction(_ update: VoidhashTransactionUpdate) {
        guard !announcedTransactions.contains(update.transaction.id) else {
            return
        }
        announcedTransactions.append(update.transaction.id)
        if announcedTransactions.count > 200 {
            announcedTransactions.removeFirst()
        }
        transactionBroadcaster.yield(update)
    }

    /// The id of the transaction a purchase's store sheet handed over, once it did.
    private final class BoughtTransaction: @unchecked Sendable {
        private let lock = NSLock()
        private var storage: String?

        var id: String? {
            get { lock.withLock { storage } }
            set { lock.withLock { storage = newValue } }
        }
    }

    /// Lets the client that replaced this one take over a purchase this one started before it
    /// was retired: a retired client sends nothing, and the store hands a purchase back to the
    /// call that made it, not to the replacement's observer. The replacement picks it up from
    /// the store's unfinished transactions, sends its receipt and finishes it, once.
    ///
    /// The purchase was started in owner mode (a purchase in observer mode is refused), so the
    /// replacement finishes it whatever its own mode is now.
    /// Only the transaction the purchase produced is handed over: other unfinished ones, of the
    /// same product included, this SDK may not have started, and stay with the observer.
    private func handOverPurchaseIfRetired(_ transactionId: String?) async {
        guard let transactionId, isShutDown, let successor = successor() else {
            return
        }
        await successor.takeOverPurchase(transactionId, readOnly: false)
    }

    /// Sends and finishes the unfinished store transaction `transactionId` a replaced client
    /// bought, in the mode the purchase started in.
    private func takeOverPurchase(_ transactionId: String, readOnly: Bool) async {
        guard options.enabled, !isShutDown, (try? await ensureStoreConnected()) != nil else {
            return
        }
        guard let schema = try? await ensureInitialized(),
            let storeTransaction = await engine.retainUnfinishedTransaction(transactionId)
        else {
            return
        }
        let transaction = ReceiptTransaction(storeTransaction: storeTransaction)
        if (try? await orchestrator().processTransaction(
            transaction, schema: schema, readOnlyOverride: readOnly)) == true
        {
            scheduleGrantRefresh()
        }
    }

    /// Restores purchases for the current identity, refreshing App Store history and revalidating
    /// transactions with Voidhash. Call only after a user action; StoreKit may request sign-in.
    /// Throws ``ReconcileTransactionsError`` if any eligible transaction cannot be accepted.
    ///
    /// Returns the person once Voidhash accepted the receipts and the person was refreshed:
    /// check its entitlements for access, which say whether anything was restored. When the
    /// refresh gets no answer, the snapshot cached for the person is returned instead, and the
    /// restore still succeeds; `nil` when there is none.
    ///
    /// It resubmits receipts already accepted for another user, so the project's paid access
    /// sharing setting can share or move their access to the current one. Being the user's request,
    /// it sends every receipt now: a receipt waiting out a retry, or parked after Voidhash refused
    /// it, goes at once, and a circuit breaker that stopped requests after an outage lets a probe
    /// through. It sends the latest transaction of each subscription or purchase, not its whole
    /// history. Identify calls and traits still queued go first, so an anonymous purchase is
    /// restored to the account the anonymous id was merged into rather than transferred.
    ///
    /// Once the store has handed its history over, the restore waits on Voidhash for at most two
    /// request timeouts, and fails at the first receipt that cannot reach it rather than sending
    /// the others into the same outage. The receipts not accepted by then fail the restore; the
    /// one being sent stays queued and is delivered in the background.
    ///
    /// A retired client forwards the call to the client that replaced it. Before the first unlock
    /// after a reboot, when no user can ask for a restore, and on a disabled client, it returns
    /// `nil` without restoring.
    @discardableResult
    public func restorePurchases() async throws -> SdkPerson? {
        guard options.enabled else { return nil }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return try await successor.restorePurchases()
        case .retired, .held:
            return nil
        }
        let schema = try await ensureInitialized()
        let distinctId = await identityStore.getDistinctId()
        try await ensureStoreConnected()
        await breaker.halfOpenAll()
        // An identify still queued for this user goes before the receipts however long it has
        // been backing off: sent first, the restore finds one person where the backend would
        // otherwise see two and apply paid access sharing between them.
        await personWrites.endBackoff()
        try await orchestrator().restorePurchases(
            schema: schema, distinctId: distinctId,
            deliveryDeadline: requestTimeoutDeadline(2))
        // The restore refreshed the person already: this is the cache, or the snapshot served
        // when the refresh got no answer.
        return await cachedPerson(distinctId: distinctId)?.value ?? nil
    }

    /// Reports a verified StoreKit result. Only its transaction ID is sent.
    /// Unverified results throw; the host remains responsible for finishing. `isRestore` as for
    /// a reported ``VoidhashTransaction``.
    public func reportTransaction(
        _ result: VerificationResult<StoreKit.Transaction>, isRestore: Bool = false
    ) async throws {
        guard options.enabled else { return }
        try await reportTransaction(try result.payloadValue, isRestore: isRestore)
    }

    /// Reports a StoreKit transaction. The host owns local verification and finishing.
    ///
    /// Only the transaction ID is sent for server verification. The device keeps its product,
    /// original transaction, purchase date and revocation, so a receipt Voidhash accepted is not
    /// sent again while a refund of it is, and neither is an older renewal of a subscription
    /// whose latest one Voidhash accepted. An upgrade or crossgrade is another product and is
    /// sent. A transaction from a local StoreKit configuration in Xcode is not
    /// sent at all: the App Store cannot verify it.
    public func reportTransaction(_ transaction: StoreKit.Transaction, isRestore: Bool = false)
        async throws
    {
        guard options.enabled else { return }
        try await reportReceipt(
            ReceiptTransaction(
                storeTransaction: StoreKitTransactionInfo(
                    transaction: transaction, jwsRepresentation: "")),
            isRestore: isRestore)
    }

    /// Reports a store transaction ID, using the current SDK identity automatically.
    /// Capture is durable before return unless storage fails (reported as the
    /// `TRANSACTION_CAPTURE_NOT_DURABLE` diagnostic); delivery failures stay queued in the
    /// background.
    public func reportTransaction(transactionId: String, isRestore: Bool = false) async throws {
        guard options.enabled else { return }
        try await reportReceipt(
            ReceiptTransaction(
                transactionId: transactionId, productId: "", purchaseDate: 0, quantity: 1),
            isRestore: isRestore)
    }

    /// Reporting a transaction also tells the SDK that finishing it is yours: the SDK never
    /// finishes a transaction you reported, in or out of observer mode, on this launch or a
    /// later one. It remembers the 500 transactions reported most recently.
    ///
    /// Reports a transaction the SDK handed over, such as one of
    /// ``VoidhashAppStore/currentEntitlements()``. Only its transaction ID is sent; the product
    /// ID, original transaction ID, purchase date and revocation date stay on the device to
    /// recognise a receipt Voidhash already accepted. The host retains store finalization.
    ///
    /// Pass `isRestore` for a transaction the host's own restore flow returned after the user
    /// asked to restore purchases. It is sent as an explicit restore for the current identity,
    /// like ``restorePurchases()``, even when Voidhash accepted it before, and keeps that intent
    /// across retries and relaunches: the project's paid access sharing setting then decides
    /// whether a purchase another user has is shared, moved or kept. Any other report leaves such
    /// a purchase with its owner.
    public func reportTransaction(_ input: VoidhashTransaction, isRestore: Bool = false)
        async throws
    {
        guard options.enabled else { return }
        guard input.store == .appStore else {
            throw VoidhashStoreError(
                code: "INVALID_TRANSACTION", message: "Only App Store transactions can be reported")
        }
        try await reportReceipt(
            ReceiptTransaction(
                transactionId: input.id, productId: input.storeProductId,
                purchaseDate: input.purchasedAt.timeIntervalSince1970 * 1000, quantity: 1,
                originalTransactionId: input.originalId,
                revocationDate: input.appStore?.revocationDate.map {
                    $0.timeIntervalSince1970 * 1000
                }, environment: input.environment),
            isRestore: isRestore)
    }

    /// Captures a host-reported transaction durably, then delivers it in the background. A
    /// pending one is ignored.
    func reportReceipt(_ input: ReceiptTransaction, isRestore: Bool = false) async throws {
        guard input.purchaseState == .purchased else { return }
        guard !input.transactionId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw VoidhashStoreError(
                code: "INVALID_TRANSACTION", message: "A store transaction ID is required")
        }
        let transaction = ReceiptTransaction(
            transactionId: input.transactionId, productId: input.productId,
            purchaseDate: input.purchaseDate, quantity: 1,
            originalTransactionId: input.originalTransactionId,
            revocationDate: input.revocationDate, environment: input.environment)
        guard await !orchestrator().skipsLocalTesting(transaction) else {
            return
        }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return try await successor.reportReceipt(transaction, isRestore: isRestore)
        case .retired:
            await stageOnRetiredClient(transaction, isRestore: isRestore)
            return
        case .held:
            reportCaptureNotDurable(
                transaction.transactionId,
                reason: "storage is unreadable until the device is unlocked; it is held in memory")
            holdUntilStateLoads { client in
                try? await client.reportReceipt(transaction, isRestore: isRestore)
            }
            return
        }
        warnIfNeverStarted("reportTransaction")

        let distinctId = await identityStore.getDistinctId()
        let schema = currentSchema ?? RuntimeSchema.empty
        let processingKey = PurchaseOrchestrator.processingKey(transaction)
        let processedCacheKey = PurchaseOrchestrator.processedCacheKey(processingKey)
        let restoreDistinctId = isRestore ? distinctId : nil
        // A receipt Voidhash accepted is not sent again, unless it now arrives revoked or the host
        // restored it.
        if let cached = await cacheManager.get(
            processedCacheKey, as: PurchaseOrchestrator.TransactionProcessingState.self)
        {
            if cached.isExpired {
                await cacheManager.delete(processedCacheKey)
            } else if cached.value.backendAccepted, transaction.revocationDate == nil, !isRestore {
                return
            }
        }
        if !isRestore, await acceptedReceipts.covers(transaction.receiptReference) {
            return
        }
        // The report is the host's claim on the transaction: recorded durably before anything
        // can deliver the receipt, so no later scan, observation or delivery finishes it, on
        // this launch or another. It also goes on the queued receipt and into the marker below,
        // which a drain already running reads the moment the receipt is queued.
        await acceptedReceipts.claimForHost(transaction.transactionId)
        await cacheManager.set(
            processedCacheKey,
            value: PurchaseOrchestrator.TransactionProcessingState(
                backendAccepted: false,
                storeFinalized: false,
                externallyManaged: true
            ),
            ttl: PurchaseOrchestrator.processedTransactionTtlMilliseconds
        )
        let durable = await outbox.stage(
            PurchaseOrchestrator.syncPayload(transaction, products: schema.products),
            distinctId: distinctId, restoreDistinctId: restoreDistinctId,
            receipt: transaction.receiptReference, hostClaimed: true
        )
        if !durable {
            reportCaptureNotDurable(
                transaction.transactionId,
                reason: "it could not be written to storage; it is kept in memory and retried")
        }
        await orchestrator().retainHostOwnership(transaction)

        Task { [weak self] in
            await self?.deliverReportedTransaction(
                transaction, schema: schema, restoreDistinctId: restoreDistinctId)
        }
    }

    /// Reports pending purchases and current store entitlements to Voidhash.
    /// Recovery fallback when a host callback exposes no transaction values. Prefer
    /// `reportTransaction` for purchases, especially already finished consumables. In observer mode the host
    /// retains transaction ownership. Delivery failures stay queued and emit diagnostics;
    /// returning successfully does not imply server acceptance.
    ///
    /// Every receipt the scan finds is written to disk before the first is sent. The call then
    /// waits on their delivery for at most one request timeout, after which delivery carries on
    /// in the background. When it completes in time, the person is refreshed before the call
    /// returns, so a person read right after it carries what the backend just accepted.
    ///
    /// A retired client forwards the call to the client that replaced it. Before the first unlock
    /// after a reboot it returns without scanning; initialization scans once the device unlocks.
    public func syncPurchases() async throws {
        guard options.enabled else {
            return
        }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return try await successor.syncPurchases()
        case .retired, .held:
            return
        }
        let schema = try await ensureInitialized()
        try await ensureStoreConnected()
        try await orchestrator().syncPurchases(
            schema: schema, deliveryDeadline: requestTimeoutDeadline(1))
    }

    // MARK: - Identity

    /// Returns the person snapshot for the current distinct id.
    ///
    /// Cache-first: a cached snapshot is returned immediately, and a stale one triggers a
    /// background refresh this call waits on for at most the freshness budget. A snapshot is
    /// served at any age while the backend is unreachable, so entitlements survive an outage.
    ///
    /// - Parameter forceFetch: Bypasses the cached snapshot when the network is usable, waiting
    ///   for the backend's answer up to the request timeout. It asks even while an earlier
    ///   refresh's failure holds reads back, unless the server asked for the wait through
    ///   `Retry-After`. Without an answer, the cached snapshot is returned, which
    ///   ``getCurrentPersonState(forceFetch:)`` reports as stale.
    public func getCurrentPerson(forceFetch: Bool = false) async throws -> SdkPerson? {
        return try await getCurrentPersonState(forceFetch: forceFetch).value
    }

    /// ``getCurrentPerson(forceFetch:)`` with the freshness of the value it returned.
    ///
    /// Apps gating high-value content should branch on `isExpired`: the value is still the last
    /// state the backend confirmed, but it has outlived its trust window.
    ///
    /// Before the first unlock after a reboot the cached snapshot cannot be read yet, so the
    /// answer is `nil`, stale and expired, without waiting.
    public func getCurrentPersonState(forceFetch: Bool = false) async throws -> Stale<SdkPerson?> {
        guard options.enabled, !isShutDown else {
            return Stale(value: nil, reason: .noCache)
        }
        guard await loadIdentity() else {
            return Stale(value: nil, isStale: true, isExpired: true, reason: .noCache)
        }

        let distinctId = await identityStore.getDistinctId()
        let cached = await cachedPerson(distinctId: distinctId)

        if !forceFetch, let cached, !cached.isStale {
            return Stale(
                value: cached.value, isStale: false, isExpired: cached.isExpired, reason: .fresh)
        }

        guard await canReachNetwork(), isRefreshDue(.person, forced: forceFetch) else {
            try surfaceAuthFailureIfUnserved(hasCache: cached != nil)
            await refreshWhenCircuitReopens(.person)
            return Stale(
                value: cached?.value, isStale: true, isExpired: cached?.isExpired ?? true,
                reason: cached == nil ? .noCache : .refreshFailed)
        }

        let refresh = Task { try await self.refreshPerson() }
        // With a value in hand an unforced read never waits on the network longer than the
        // budget. A forced read asked for the backend's answer, and a cold one has nothing to
        // serve, so for both the request timeout is the budget. A value the refresh did not
        // confirm is stale, even when a forced read bypassed a fresh one, and so is one the
        // backend's answer does not settle yet.
        let waitsForAnswer = forceFetch || cached == nil
        let answer = await value(of: refresh, withinBudget: !waitsForAnswer)
        if case .success(let fresh?)? = answer {
            return Stale(value: fresh.person, reason: .fresh)
        }
        // `nil`: the budget ran out with the refresh still running. A refresh that settled
        // nothing (an identify still queued) or failed leaves the cached value unconfirmed.
        let reason: StaleReason = answer == nil ? .refreshInFlight : .refreshFailed
        if let cached {
            return Stale(
                value: cached.value, isStale: true, isExpired: cached.isExpired, reason: reason)
        }
        return Stale(value: nil, isStale: true, isExpired: true, reason: .noCache)
    }

    /// Drops the cached person snapshot of the current identity, so the next read asks the
    /// backend. A read already in flight does not put its answer back. ``personUpdates()`` gets
    /// `nil` until the next read answers.
    public func resetPersonCache() async {
        guard options.enabled, !isShutDown, await loadIdentity() else {
            return
        }
        let distinctId = await identityStore.getDistinctId()
        personWriteGenerations[distinctId, default: 0] += 1
        await cacheManager.delete(VoidhashClient.personCacheKey(distinctId))
        await cacheManager.delete(VoidhashClient.missingPersonCacheKey(distinctId))
        refreshBackoff[.person] = nil
        announcePerson(
            Stale(value: nil, isStale: true, isExpired: true, reason: .noCache),
            distinctId: distinctId)
        // What is cached for the identity now: nothing, until the next read answers.
        publishPerson(nil, of: distinctId)
    }

    /// The cached answer for `distinctId`: its snapshot, or the backend's confirmation that it
    /// has no person, with the freshness of the entry it came from.
    private func cachedPerson(distinctId: String) async -> Stale<SdkPerson?>? {
        if let hit = await cacheManager.get(
            VoidhashClient.personCacheKey(distinctId), as: SdkPerson.self)
        {
            return Stale(value: hit.value, isStale: hit.isStale, isExpired: hit.isExpired)
        }
        if let missing = await cacheManager.get(
            VoidhashClient.missingPersonCacheKey(distinctId), as: Bool.self)
        {
            return Stale(value: nil, isStale: missing.isStale, isExpired: missing.isExpired)
        }
        return nil
    }

    /// Fetches and caches the person for the current identity, single-flighted.
    @discardableResult
    private func refreshPerson() async throws -> PersonRefresh? {
        guard await loadIdentity() else {
            throw VoidhashClient.identityUnavailable
        }
        let distinctId = await identityStore.getDistinctId()
        let generation = personWriteGenerations[distinctId, default: 0]
        return try await personFlight.run(key: "\(generation):\(distinctId)") { [weak self] in
            guard let self else {
                return nil
            }
            return try await self.fetchAndCachePerson(distinctId: distinctId)
        }
    }

    /// Fetches the person for `distinctId` and caches the answer.
    ///
    /// - Returns: `nil` when the answer settles nothing because an identify linking an alias
    ///   onto `distinctId` is still queued, so the answer predates the merge: the backend has no
    ///   person for the id yet, or it has one while the cache holds the snapshot carried over
    ///   from that alias, which still names it. Whatever is cached keeps being served then, until
    ///   the identify's own answer replaces it.
    private func fetchAndCachePerson(
        distinctId: String, authenticationProbe: Bool = false
    ) async throws -> PersonRefresh? {
        let generation = personWriteGenerations[distinctId, default: 0]
        let headers = headerFactory.build(distinctId: distinctId)
        let person: SdkPerson?
        do {
            person = try await guarded("person.fetch", authenticationProbe: authenticationProbe) {
                [apiClient] in
                try await apiClient.getPerson(headers: headers)
            }
            refreshBackoff[.person] = nil
        } catch {
            backOffRefresh(.person, after: error)
            throw error
        }
        let pendingAliases = await personWrites.pendingWrites()
            .filter { $0.kind == .identify && $0.target == distinctId }
            .compactMap(\.alias)
        if !pendingAliases.isEmpty {
            guard person != nil else {
                return nil
            }
            // A person the backend already had, created on the web or another device, lacks
            // what the alias bought until the merge lands: it must not replace the snapshot that
            // carries it.
            if let cached = await cacheManager.get(
                VoidhashClient.personCacheKey(distinctId), as: SdkPerson.self),
                pendingAliases.contains(cached.value.distinctId)
            {
                return nil
            }
        }
        // A person write that went out while this request was in flight answers with the newer
        // state, which this response may predate: its caller gets it, the cache does not.
        guard personWriteGenerations[distinctId, default: 0] == generation else {
            return PersonRefresh(person: person)
        }
        // An answer for an identity signed out or switched away from meanwhile must not come
        // back into the cache that change cleared, where nothing would delete it again.
        guard await identityStore.getDistinctId() == distinctId else {
            return PersonRefresh(person: person)
        }
        if let person {
            await cachePerson(person, distinctId: distinctId)
        } else {
            // The backend says this identity has no person. Keeping the old snapshot would keep
            // serving grants for someone who no longer exists, and remembering the answer spares
            // an anonymous user a request on every read until it goes stale.
            await cacheManager.delete(VoidhashClient.personCacheKey(distinctId))
            await cacheManager.set(
                VoidhashClient.missingPersonCacheKey(distinctId),
                value: true,
                ttl: VoidhashClient.personCacheTtlMilliseconds,
                staleTime: VoidhashClient.personCacheStaleTimeMilliseconds
            )
            announcePerson(Stale(value: nil, reason: .fresh), distinctId: distinctId)
            publishPerson(nil, of: distinctId)
        }
        return PersonRefresh(person: person)
    }

    /// Switches the current identity to `externalUserId` and returns the merged person.
    ///
    /// The switch is applied locally first, so it takes effect whether or not the backend is
    /// reachable. `nil` means the backend has not confirmed the merge yet, not that it failed;
    /// use ``identifyState(externalUserId:email:name:)`` when you need to tell the two apart.
    @discardableResult
    public func identify(externalUserId: String, email: String? = nil, name: String? = nil)
        async throws -> SdkPerson?
    {
        return try await identifyState(externalUserId: externalUserId, email: email, name: name)
            .person
    }

    /// ``identify(externalUserId:email:name:)`` reporting whether the backend confirmed the merge.
    ///
    /// The identity switches locally and the identify is written to a durable queue before the
    /// request goes out, so neither an outage, a cancelled caller nor a killed process loses the
    /// merge: the SDK delivers it as soon as the backend is reachable, before any queued store
    /// receipt, across relaunches. The result is `deferred` until then, carrying the anonymous
    /// person's snapshot (served as stale) when nothing was cached for `externalUserId` yet, so a
    /// customer who bought before signing in keeps their access; the visitor's flag evaluations
    /// are carried over the same way. The call waits on Voidhash for at most 2 seconds: a slower
    /// answer is applied in the background, and the call returns `deferred`. A verdict arriving
    /// after that keeps the identity, without the merge, and is reported as
    /// `PERSON_WRITE_REJECTED`. It never throws for
    /// transport, an unreadable answer or a rejected publishable key, and it lifts a pause after
    /// a rejected key, as ``reset()`` does.
    ///
    /// A `409` from the backend means the anonymous id is already linked to another identified
    /// user. Nothing is thrown then: the identity stays `externalUserId`, without that anonymous
    /// id's history and purchases, which stay with the other user; the result is `confirmed` and
    /// a `PERSON_WRITE_REJECTED` diagnostic is emitted.
    ///
    /// The request runs outside the queue that orders identity changes, so a ``reset()`` or
    /// another identify right after this one never waits on the network.
    ///
    /// - Throws: ``VoidhashStoreError`` with `INVALID_ARGUMENT` when `externalUserId` is one the
    ///   API refuses: empty or whitespace only, longer than 255 characters (code points),
    ///   containing NUL, or starting with an anonymous prefix, `vh_anon_` or `vh:anon:`. The
    ///   identity is left unchanged. A ``VoidhashApiError`` for any other verdict the API will
    ///   repeat (a `400`) that arrives within the 2 seconds the call waits, after which the
    ///   previous identity is restored; one arriving later keeps the identity, drops the queued
    ///   identify and is reported as `PERSON_WRITE_REJECTED` instead. `CancellationError` when the
    ///   caller is cancelled: a cancel before the switch changes nothing, one after it leaves the
    ///   identify queued.
    @discardableResult
    public func identifyState(
        externalUserId: String, email: String? = nil, name: String? = nil
    ) async throws -> PersonWriteResult {
        guard options.enabled else {
            return PersonWriteResult(status: .deferred, person: nil)
        }
        if let reason = IdentityStore.invalidDistinctIdReason(externalUserId) {
            throw VoidhashStoreError.invalidDistinctId(reason: reason)
        }
        guard !IdentityStore.isAnonymous(externalUserId) else {
            throw VoidhashStoreError.invalidDistinctId(
                reason:
                    "must not start with \(IdentityStore.anonymousDistinctIdPrefix) or \(IdentityStore.legacyAnonymousDistinctIdPrefix), which mark the SDK's anonymous ids"
            )
        }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return try await successor.identifyState(
                externalUserId: externalUserId, email: email, name: name)
        case .retired:
            return PersonWriteResult(status: .deferred, person: nil)
        case .held:
            holdUntilStateLoads { client in
                _ = try? await client.identifyState(
                    externalUserId: externalUserId, email: email, name: name)
            }
            return PersonWriteResult(status: .deferred, person: nil)
        }
        liftAuthPause()
        let switched = identityChanges.submit {
            try await self.switchIdentity(externalUserId: externalUserId, email: email, name: name)
        }
        let identitySwitch = try await withTaskCancellationHandler {
            try await switched.value
        } onCancel: {
            switched.cancel()
        }
        switch identitySwitch {
        case .settled(let result):
            return result
        case .switched(let request):
            // The identify is on disk already: past the budget the caller learns it is deferred,
            // and its answer is applied in the background when it arrives.
            let sending = Task { try await self.sendIdentify(request) }
            trackIdentifySend(
                sending, alias: request.queued.alias, target: request.queued.target)
            guard
                let outcome = await outcomeWithinCallBudget(
                    of: sending, wait: request.callerWait)
            else {
                return PersonWriteResult(
                    status: .deferred,
                    person: await cacheManager.get(
                        Self.personCacheKey(request.queued.target), as: SdkPerson.self)?.value)
            }
            return try outcome.get()
        }
    }

    /// Remembers an identify request in flight until it settles, so a receipt drain waits for the
    /// merge it carries even after the caller of `identify` stopped waiting for it.
    private func trackIdentifySend(
        _ sending: Task<PersonWriteResult, any Error>, alias: String?, target: String
    ) {
        let id = UUID()
        identifySends[id] = (
            alias: alias,
            target: target,
            task: Task { [weak self] in
                _ = await sending.result
                await self?.forgetIdentifySend(id)
            }
        )
    }

    private func forgetIdentifySend(_ id: UUID) {
        identifySends[id] = nil
    }

    /// Waits for the identify requests in flight that link an anonymous id onto a user, when a
    /// receipt is sent under either of the two. One captured under the anonymous id must reach
    /// the backend after the merge, or it is recorded for the anonymous person alone. One sent
    /// under the user, a restore right after signing in for instance, must as well: before the
    /// merge the backend holds two people, and would share or move the purchase between them.
    /// Sends for other people are not waited for.
    private func awaitIdentifySends(linking distinctIds: Set<String>) async {
        for send in identifySends.values {
            if send.alias.map(distinctIds.contains) == true || distinctIds.contains(send.target) {
                await send.task.value
            }
        }
    }

    /// The outcome of `task` when it finishes within the awaited-call budget; `nil` past it,
    /// when `task` carries on in the background. Cancelling the caller cancels `task`.
    ///
    /// - Parameter wait: Decides between `task` and the deadline: the deadline only ends the
    ///   wait when `task` has not claimed its outcome for the caller yet; once it has, the
    ///   caller waits for it however late it lands.
    private func outcomeWithinCallBudget<Value: Sendable>(
        of task: Task<Value, any Error>, wait: CallerWait
    ) async -> Result<Value, any Error>? {
        let budget = dependencies.awaitedCallBudgetMilliseconds
        let sleep = dependencies.budgetSleep
        let deadline = Task {
            await sleep(budget)
            if !Task.isCancelled {
                _ = wait.stop()
            }
        }
        defer { deadline.cancel() }
        let outcome = await withTaskCancellationHandler {
            await firstOutcome(of: task, before: deadline)
        } onCancel: {
            task.cancel()
        }
        if outcome == nil, !wait.isStopped {
            return await VoidhashClient.outcome(of: task)
        }
        return outcome
    }

    /// The local half of an identify, applied in order with the other identity changes.
    private enum IdentitySwitch: Sendable {
        /// Nothing is left to send: the identity already was the target, or the identify joins
        /// one already queued for it.
        case settled(PersonWriteResult)
        /// The identity switched to the target; the request is the caller's to send.
        case switched(IdentifyRequest)
    }

    /// An identify applied locally whose request its caller sends.
    private struct IdentifyRequest: Sendable {
        /// The queued write, claimed so no drain sends it meanwhile.
        let queued: PersonWrite
        let previousDistinctId: String
        /// Whether the anonymous person's snapshot was carried over to the target.
        let carriedSnapshot: Bool
        /// Whether the anonymous visitor's flag evaluations were carried over to the target.
        let carriedFlags: Bool
        /// Decides whether the caller sees the answer or was told the identify is deferred; a
        /// verdict the caller no longer waits for keeps the identity the app was told it has.
        let callerWait = CallerWait()
    }

    private func switchIdentity(
        externalUserId: String, email: String?, name: String?
    ) async throws -> IdentitySwitch {
        await identityInitializationTask.value
        // A cancel that lands before the switch leaves everything as it was.
        try Task.checkCancellation()

        if options.grantConsentOnIdentify, analyticsConsentState.grantImplied() {
            // Before the switch: what was held while consent was pending is recorded under the
            // anonymous id, which the identify then links to the person.
            reportedConsentSkip.value = false
            hostEvents.emit(.consent(.granted))
            await settleAnalyticsConsent(.granted, previous: .pending)
        }

        let previousDistinctId = await identityStore.getDistinctId()
        let pending = await personWrites.pendingIdentify(target: externalUserId)
        let profile = IdentifiedProfile(
            distinctId: externalUserId, digest: Self.profileDigest(email: email, name: name))
        if previousDistinctId == externalUserId,
            await cacheManager.get(Self.identifiedProfileCacheKey, as: IdentifiedProfile.self)?
                .value == profile
        {
            // The same person with the same profile as the last identify, no email and no name
            // twice included: nothing to say again, whatever this launch has cached.
            // One still queued carries exactly this, and the drain delivers it.
            if pending != nil {
                kickPersonWriteDrain()
            }
            let person = await cacheManager.get(
                Self.personCacheKey(externalUserId), as: SdkPerson.self)?
                .value
            return .settled(
                PersonWriteResult(
                    status: pending == nil && person != nil ? .confirmed : .deferred,
                    person: person))
        }
        if previousDistinctId == externalUserId && email == nil && name == nil && pending == nil {
            let person = await cacheManager.get(
                Self.personCacheKey(externalUserId), as: SdkPerson.self)?
                .value
            if person != nil || lastIdentifiedId == externalUserId {
                return .settled(
                    PersonWriteResult(
                        status: person == nil ? .deferred : .confirmed, person: person))
            }
        }
        // An anonymous id is linked onto the user it becomes. Otherwise an identify still queued
        // for this user keeps its alias: a fresh one would stand in for it, and the anonymous
        // purchases behind the queued one would never be merged.
        let aliasDistinctId =
            IdentityStore.isAnonymous(previousDistinctId)
            ? previousDistinctId
            : pending?.alias
                ?? IdentityStore.anonymousDistinctIdPrefix + UUID().uuidString.lowercased()
        if let pending, pending.alias == aliasDistinctId, email == nil, name == nil {
            if previousDistinctId != externalUserId {
                await changeIdentity(from: previousDistinctId) {
                    await identityStore.identify(distinctId: externalUserId)
                }
                await Self.invalidatePerIdentityCache(
                    previousDistinctId: previousDistinctId, in: cacheManager)
            }
            kickPersonWriteDrain()
            return .settled(
                PersonWriteResult(
                    status: .deferred,
                    person: await cacheManager.get(
                        Self.personCacheKey(externalUserId), as: SdkPerson.self)?.value))
        }

        // Local first: the app asked to be this user, and that must hold regardless of the
        // network. The write is on disk before the switch and the request, which is what makes a
        // cancelled caller or a killed process safe: the drain delivers it.
        let queued = await personWrites.enqueue(
            .identify(alias: aliasDistinctId, target: externalUserId, email: email, name: name),
            claim: true)
        await cacheManager.set(Self.identifiedProfileCacheKey, value: profile)
        await changeIdentity(from: previousDistinctId) {
            await identityStore.identify(distinctId: externalUserId)
        }
        let carriesAnonymousState = aliasDistinctId == previousDistinctId
        let carriedSnapshot =
            carriesAnonymousState
            ? await Self.carryAnonymousSnapshot(
                from: previousDistinctId, to: externalUserId, in: cacheManager) : false
        let carriedFlags =
            carriesAnonymousState
            ? await Self.carryAnonymousFlags(
                from: previousDistinctId, to: externalUserId, in: cacheManager) : false
        return .switched(
            IdentifyRequest(
                queued: queued, previousDistinctId: previousDistinctId,
                carriedSnapshot: carriedSnapshot, carriedFlags: carriedFlags))
    }

    /// The profile of the last identify queued, kept so a repeat of it sends nothing.
    private struct IdentifiedProfile: Codable, Sendable, Equatable {
        let distinctId: String
        /// ``profileDigest(email:name:)`` of what the identify carried.
        let digest: String
    }

    /// Cache key of the ``IdentifiedProfile``. Cleared when the identity leaves that person.
    static let identifiedProfileCacheKey = "identify:profile"

    private static func profileDigest(email: String?, name: String?) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let canonical = (try? encoder.encode(["email": email, "name": name])) ?? Data()
        return SHA256.hash(data: canonical).map { String(format: "%02x", $0) }.joined()
    }

    /// Sends an identify switched to already, outside the identity-change queue, so a sign-out
    /// or another identify meanwhile does not wait on the network. Its answer is then applied in
    /// order with those changes.
    private func sendIdentify(_ request: IdentifyRequest) async throws -> PersonWriteResult {
        let write = request.queued
        personWriteGenerations[write.target, default: 0] += 1
        defer { personWriteGenerations[write.target, default: 0] += 1 }
        let outcome: Result<SdkPerson, any Error>
        do {
            outcome = .success(
                try await guarded("person.identify", drainsPersonWrites: false) {
                    [apiClient, headerFactory] in
                    try await apiClient.identify(
                        headers: headerFactory.build(distinctId: write.alias ?? ""),
                        body: SdkIdentifyBody(
                            distinctId: write.target, email: write.email, name: write.name)
                    )
                })
        } catch {
            outcome = .failure(error)
        }
        let result = try await identityChanges.submit {
            try await self.settleIdentify(request, outcome: outcome)
        }.value
        if case .failure = outcome, Task.isCancelled {
            throw CancellationError()
        }
        return result
    }

    /// Applies the backend's answer to an identify, unless a sign-out or another identify has
    /// moved the identity on since: the identity that change set is kept, and only the queued
    /// write and the caches of the identity left behind are settled.
    private func settleIdentify(
        _ request: IdentifyRequest, outcome: Result<SdkPerson, any Error>
    ) async throws -> PersonWriteResult {
        let target = request.queued.target
        let previousDistinctId = request.previousDistinctId
        let currentDistinctId = await identityStore.getDistinctId()
        switch outcome {
        case .success(let person):
            await personWrites.remove(request.queued)
            // Anything evaluated for the previous id would otherwise leak into the identified
            // session: flags in particular are per person.
            if currentDistinctId != previousDistinctId {
                await Self.invalidatePerIdentityCache(
                    previousDistinctId: previousDistinctId, in: cacheManager)
            }
            if currentDistinctId == target {
                lastIdentifiedId = target
                await cachePerson(person, distinctId: target)
                // The visitor's carried evaluations keep answering, stale, until the user's own
                // evaluation replaces them; dropping them now would turn every sign-in back to
                // the defaults, for good when that evaluation fails.
                Task { [weak self] in
                    _ = try? await self?.refreshFlags(keys: nil)
                }
            }
            // Traits queued behind the identify can go now.
            kickPersonWriteDrain()
            return PersonWriteResult(status: .confirmed, person: person)
        case .failure(let error as VoidhashApiError)
        where error.tag == VoidhashApiError.personAlreadyIdentifiedTag:
            // The alias belongs to another user for good. Putting it back would serve that
            // user's person here and send every later identify from it into the same refusal,
            // so the identity stays the target, without the alias's history.
            await personWrites.remove(request.queued)
            if request.carriedSnapshot {
                await cacheManager.delete(Self.personCacheKey(target))
            }
            if request.carriedFlags {
                await cacheManager.deleteByPrefix("flags:\(target):")
            }
            if currentDistinctId != previousDistinctId {
                await Self.invalidatePerIdentityCache(
                    previousDistinctId: previousDistinctId, in: cacheManager)
            }
            diagnostics.emit(
                .eviction, code: "PERSON_WRITE_REJECTED", operation: "person.identify",
                httpStatus: error.statusCode,
                message:
                    "Identified \(target) without merging the previous anonymous id, which already belongs to another identified user"
            )
            kickPersonWriteDrain()
            return PersonWriteResult(
                status: .confirmed,
                person: await cacheManager.get(Self.personCacheKey(target), as: SdkPerson.self)?
                    .value)
        case .failure(let error as VoidhashApiError)
        where (error.isVerdict || error.isLocal) && !request.callerWait.claimForCaller():
            // The app was told the identify is deferred and has moved on as this user: switching
            // the identity back under it now would be a surprise sign-out. The identity stays,
            // without the merge, as a queued identify the API refuses does.
            await personWrites.remove(request.queued)
            await forgetIdentifiedProfile(of: request.queued)
            if request.carriedSnapshot {
                await cacheManager.delete(Self.personCacheKey(target))
            }
            if request.carriedFlags {
                await cacheManager.deleteByPrefix("flags:\(target):")
            }
            if currentDistinctId != previousDistinctId {
                await Self.invalidatePerIdentityCache(
                    previousDistinctId: previousDistinctId, in: cacheManager)
            }
            diagnostics.emit(
                .eviction, code: "PERSON_WRITE_REJECTED", operation: "person.identify",
                httpStatus: error.statusCode,
                message:
                    "Identified \(target) without merging the previous anonymous id, which the API refused: \(error.message)"
            )
            throw error
        case .failure(let error as VoidhashApiError) where error.isVerdict || error.isLocal:
            // The API will never accept this alias: keeping the switch would strand the device on
            // an identity nothing else knows, serving grants that were never merged into it.
            await personWrites.remove(request.queued)
            await forgetIdentifiedProfile(of: request.queued)
            if currentDistinctId == target {
                if previousDistinctId != target {
                    await changeIdentity(from: target) {
                        await identityStore.identify(distinctId: previousDistinctId)
                    }
                }
                if request.carriedSnapshot {
                    await cacheManager.delete(Self.personCacheKey(target))
                }
                if request.carriedFlags {
                    await cacheManager.deleteByPrefix("flags:\(target):")
                }
            } else if currentDistinctId != previousDistinctId {
                await Self.invalidatePerIdentityCache(
                    previousDistinctId: previousDistinctId, in: cacheManager)
            }
            throw error
        case .failure(let error):
            // Transport, an unreadable answer, a rejected key or a cancelled caller: the switch
            // holds and the queued identify is delivered by the drain.
            await personWrites.release(request.queued, after: error)
            if currentDistinctId != previousDistinctId {
                await Self.invalidatePerIdentityCache(
                    previousDistinctId: previousDistinctId, in: cacheManager)
            }
            await armPersonWriteRetry()
            return PersonWriteResult(
                status: .deferred,
                person: await cacheManager.get(Self.personCacheKey(target), as: SdkPerson.self)?
                    .value)
        }
    }

    /// Forgets the profile of an identify the API refused, so the app's next identify with it is
    /// sent, not taken for a repeat. A later identify's profile is kept.
    private func forgetIdentifiedProfile(of write: PersonWrite) async {
        let refused = IdentifiedProfile(
            distinctId: write.target,
            digest: Self.profileDigest(email: write.email, name: write.name))
        if await cacheManager.get(Self.identifiedProfileCacheKey, as: IdentifiedProfile.self)?
            .value == refused
        {
            await cacheManager.delete(Self.identifiedProfileCacheKey)
        }
    }

    /// Sets person traits, reporting whether the backend confirmed them.
    ///
    /// Traits are what the app says about the person, not what the SDK observes, so they are
    /// sent whatever the analytics consent. `$ad_data_sharing` is the exception, see
    /// ``setAdDataSharing(_:)``: agreeing needs consent, and is left out of the write without
    /// it; `false` is always queued, and a write holding nothing else reports `deferred`.
    ///
    /// A string named `email` or `name` sets the person's email or name, as
    /// ``identify(externalUserId:email:name:)`` does, instead of a trait of that name.
    ///
    /// Trait values are flat: strings, numbers, booleans or `null`; non-finite numbers are sent as
    /// `null`. When the backend cannot confirm them now (an outage, a rejected publishable key, a
    /// cancelled caller), or an identify or earlier traits for the current person are still
    /// queued, the traits are queued durably behind them and the cached person is returned,
    /// flagged `deferred`. The traits are written to that queue before the request goes out, and
    /// the call waits on Voidhash for at most 2 seconds; past that it returns `deferred` while
    /// the request carries on, and the queue delivers the traits if it fails in transit. A
    /// refusal arriving after the call returned drops them and is reported as
    /// `PERSON_WRITE_REJECTED`. Never throws for transport.
    ///
    /// Empty `attributes` send and queue nothing: the cached person is returned, `confirmed`
    /// unless a write for the current person is still queued.
    ///
    /// - Throws: ``VoidhashStoreError`` with `INVALID_ARGUMENT` when a value is an object or an
    ///   array, before anything is sent or queued. A ``VoidhashApiError`` verdict the API will
    ///   repeat for the payload.
    @discardableResult
    public func setPersonAttributesState(_ attributes: [String: JSONValue]) async throws
        -> PersonWriteResult
    {
        guard options.enabled else {
            return PersonWriteResult(status: .deferred, person: nil)
        }
        let nestedKeys = attributes.compactMap { key, value -> String? in
            switch value {
            case .array, .object:
                return key
            case .null, .bool, .number, .string:
                return nil
            }
        }
        guard nestedKeys.isEmpty else {
            throw VoidhashStoreError.invalidPersonTraits(keys: nestedKeys.sorted())
        }
        let requested = attributes
        let attributes = await settlingAdDataSharing(in: requested)
        if attributes.isEmpty, requested[PersonWrite.adDataSharingTrait] == .bool(false) {
            guard await loadIdentity() else {
                return PersonWriteResult(status: .deferred, person: nil)
            }
            return PersonWriteResult(
                status: .deferred,
                person: await cacheManager.get(
                    Self.personCacheKey(await identityStore.getDistinctId()), as: SdkPerson.self)?
                    .value)
        }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return try await successor.setPersonAttributesState(attributes)
        case .retired:
            return PersonWriteResult(status: .deferred, person: nil)
        case .held:
            holdUntilStateLoads { client in
                _ = try? await client.setPersonAttributesState(attributes)
            }
            return PersonWriteResult(status: .deferred, person: nil)
        }

        let distinctId = await identityStore.getDistinctId()
        // Nothing to write, and the backend refuses a traits request carrying nothing for an id
        // it has not seen yet.
        guard !attributes.isEmpty else {
            // Something was asked for and consent left none of it: an agreement to ad data sharing.
            guard requested.isEmpty else {
                return PersonWriteResult(
                    status: .skipped,
                    person: await cacheManager.get(
                        Self.personCacheKey(distinctId), as: SdkPerson.self)?.value)
            }
            return PersonWriteResult(
                status: await personWrites.hasPendingWrite(for: distinctId) ? .deferred : .confirmed,
                person: await cacheManager.get(
                    Self.personCacheKey(distinctId), as: SdkPerson.self)?.value)
        }
        var revocationInFlight = false
        if attributes[PersonWrite.adDataSharingTrait] == .bool(true) {
            revocationInFlight = await personWrites.cancelAdDataSharingRevocation(
                for: distinctId)
        }
        let traits = replacingNonFiniteNumbers(in: attributes, operation: "person.traits")
        // On disk before the request goes out, so `deferred` always means queued. Traits for a
        // person with a write still queued or in flight queue behind it: sent now, they could
        // reach the backend before the identify that links the person, or be overwritten by the
        // older traits arriving after them. An agreement whose revocation a drain may be sending
        // right now is left to the drain as well, so it lands after the revocation.
        let write = PersonWrite.traits(traits, for: distinctId)
        let claimed: PersonWrite?
        if revocationInFlight {
            await personWrites.enqueue(write)
            claimed = nil
        } else {
            claimed = await personWrites.enqueueClaimingIfFirst(write)
        }
        guard let claimed else {
            kickPersonWriteDrain()
            return PersonWriteResult(
                status: .deferred,
                person: await cacheManager.get(
                    Self.personCacheKey(distinctId), as: SdkPerson.self)?.value)
        }

        // Past the budget the caller learns the traits are deferred; the request carries on, and
        // the drain delivers them if it fails.
        let callerWait = CallerWait()
        guard
            let outcome = await outcomeWithinCallBudget(
                of: Task {
                    try await self.sendTraits(claimed, callerWait: callerWait)
                },
                wait: callerWait)
        else {
            return PersonWriteResult(
                status: .deferred,
                person: await cacheManager.get(
                    Self.personCacheKey(distinctId), as: SdkPerson.self)?.value)
        }
        return try outcome.get()
    }

    /// Sends `claimed`, traits queued and claimed for this send, and settles the queued write:
    /// removed once applied or refused with a verdict, handed back to the drain otherwise. Traits
    /// merged into it meanwhile stay queued and go next, in order.
    ///
    /// - Parameter callerWait: Whether the caller still waits for the answer; a refusal it no
    ///   longer waits for is reported as `PERSON_WRITE_REJECTED`, since nobody sees the throw.
    private func sendTraits(
        _ claimed: PersonWrite, callerWait: CallerWait
    ) async throws -> PersonWriteResult {
        let distinctId = claimed.target
        personWriteGenerations[distinctId, default: 0] += 1
        defer { personWriteGenerations[distinctId, default: 0] += 1 }
        do {
            let person = try await guarded("person.traits", drainsPersonWrites: false) {
                [apiClient, headerFactory] in
                try await apiClient.setPersonTraits(
                    headers: headerFactory.build(distinctId: distinctId),
                    body: SdkPersonTraitsBody(attributes: claimed.traits)
                )
            }
            await personWrites.remove(claimed)
            kickPersonWriteDrain()
            // A sign-out or an identify since the traits went out owns the identity now, and
            // cleared what was cached for this one.
            if await identityStore.getDistinctId() == distinctId {
                await cachePerson(person, distinctId: distinctId)
            }
            return PersonWriteResult(status: .confirmed, person: person)
        } catch let error as VoidhashApiError
            where (error.isVerdict || error.isLocal)
            && error.tag != VoidhashApiError.personNotFoundTag
        {
            // Decided before anything is awaited, so the deadline cannot tell the caller
            // "deferred" for traits this refusal drops.
            let callerSees = callerWait.claimForCaller()
            await personWrites.remove(claimed)
            kickPersonWriteDrain()
            if !callerSees {
                diagnostics.emit(
                    .eviction, code: "PERSON_WRITE_REJECTED", operation: "person.traits",
                    httpStatus: error.statusCode,
                    message: "Dropped traits for \(distinctId) the API refused: \(error.message)")
            }
            throw error
        } catch {
            // Transport, an unreadable answer, a rejected key, a person the backend has not seen
            // yet or a cancelled caller: the traits stay queued, never lost.
            await personWrites.release(claimed, after: error)
            await armPersonWriteRetry()
            if Task.isCancelled {
                throw CancellationError()
            }
            return PersonWriteResult(
                status: .deferred,
                person: await cacheManager.get(
                    Self.personCacheKey(distinctId), as: SdkPerson.self)?.value)
        }
    }

    /// Takes `$ad_data_sharing` out of a trait write where it does not travel with the other
    /// traits, and returns the rest: a revocation is queued on its own, whatever the consent, and
    /// an agreement needs analytics consent, without which it is left out.
    private func settlingAdDataSharing(
        in attributes: [String: JSONValue]
    ) async -> [String: JSONValue] {
        switch attributes[PersonWrite.adDataSharingTrait] {
        case .bool(false):
            await queueAdDataSharingRevocation()
        case .some where analyticsConsentState.value != .granted:
            break
        default:
            return attributes
        }
        return attributes.filter { $0.key != PersonWrite.adDataSharingTrait }
    }

    /// Queues taking the current person's agreement to sharing with ad platforms back, on disk
    /// before it returns, whatever the analytics consent: on a client that was replaced for the
    /// next one over the same storage, and while storage is unreadable until it loads.
    private func queueAdDataSharingRevocation() async {
        switch await writeRoute() {
        case .direct:
            _ = try? await identityChanges.submit {
                let distinctId = await self.identityStore.getDistinctId()
                await self.personWrites.enqueueAdDataSharingRevocation(for: distinctId)
            }.value
            kickPersonWriteDrain()
        case .forward(let successor):
            await successor.queueAdDataSharingRevocation()
        case .retired:
            guard stateLoaded.value else {
                return
            }
            await personWrites.enqueueAdDataSharingRevocation(
                for: await identityStore.getDistinctId())
        case .held:
            holdUntilStateLoads { client in await client.queueAdDataSharingRevocation() }
        }
    }

    /// Records whether the end user agreed to you sharing their purchases with ad platforms, as
    /// the person trait `$ad_data_sharing`. Voidhash sends a person's purchases to a Conversions
    /// API you turned on only when it is `true`.
    ///
    /// `true` is sent like any other person attribute, but only with analytics consent: without it
    /// the agreement is left out, and the call reports what an empty write does.
    /// When it is written, it also drops a revocation still queued for the person.
    ///
    /// `false` is a revocation, which analytics consent neither blocks nor discards: it is on disk
    /// when this returns, reported as `deferred`, and sent and retried in the background until
    /// Voidhash has written it, or for 48 hours while Voidhash has no such person. It records no
    /// analytics. Withdrawing analytics consent does not take the agreement back by itself, so when
    /// someone rejects everything, call this next to ``setAnalyticsConsent(_:)``.
    ///
    /// ``setPersonAttributesState(_:)`` treats `$ad_data_sharing` the same way.
    @discardableResult
    public func setAdDataSharing(_ granted: Bool) async throws -> PersonWriteResult {
        return try await setPersonAttributesState([PersonWrite.adDataSharingTrait: .bool(granted)])
    }

    /// Sets person traits and returns the person the SDK now holds.
    ///
    /// Offline the traits are queued rather than lost and the cached person comes back unchanged;
    /// ``setPersonAttributesState(_:)`` reports which of the two happened and lists what it
    /// throws.
    @discardableResult
    public func setPersonAttributes(_ attributes: [String: JSONValue]) async throws -> SdkPerson? {
        return try await setPersonAttributesState(attributes).person
    }

    /// Starts over as a fresh visitor: signs the identified person out, exactly as ``signOut()``
    /// does, and when nobody is signed in replaces the anonymous identity with a new one. Made
    /// for shared devices, a guest's "start over" and tests; an app whose own session ended
    /// calls ``signOut()``.
    ///
    /// Signing out captures `$sign_out` under the identity and session being left, with its
    /// groups, then persists a fresh anonymous distinct id, clears the groups and everything
    /// cached for the identity, and starts a new analytics session. State that is not tied to a
    /// person — the schema, remembered locations, the install marker — stays cached, so a
    /// sign-out offline does not turn the next launch into a cold start or re-report
    /// `$app_installed`. So does the analytics consent the end user decided: it belongs to the
    /// device's user, not to the identity. A consent implied by an identify
    /// (``VoidhashOptions/grantConsentOnIdentify``) returns to `pending`: the events recorded
    /// while signed in, `$sign_out` included, are sent first, waiting on Voidhash for at most 2
    /// seconds as ``flush()`` does, since the return to `pending` drops what is still queued.
    /// Without consent no `$sign_out` is captured and no new session is started.
    ///
    /// For an anonymous identity nothing is signed out: no `$sign_out` is captured and nothing
    /// is sent; the new identity and the new session are all there is.
    ///
    /// Lifts a pause after a rejected publishable key, so the next request tries the key again.
    public func reset() async {
        guard options.enabled else {
            return
        }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return await successor.reset()
        case .retired:
            return
        case .held:
            holdUntilStateLoads { client in await client.reset() }
            return
        }
        liftAuthPause()
        _ = try? await identityChanges.submit { await self.performReset() }.value
    }

    /// Lifts the pause a rejected publishable key put on outbound traffic, as configuring the SDK
    /// again does, and as the other Voidhash SDKs do on a sign-in or sign-out. What the pause
    /// held goes now; a key still rejected pauses traffic again and is reported again.
    private func liftAuthPause() {
        guard gate.isPaused else {
            return
        }
        gate.resume()
        didSurfaceAuthFailure = false
        Task { [weak self] in
            _ = await self?.drainPendingWork(freshEvidence: false)
        }
    }

    /// Signs the identified person out; see ``reset()``, which does exactly the same for someone
    /// signed in.
    ///
    /// Does nothing while the identity is anonymous, so it is safe to call wherever the app's
    /// own session ends, however often: no `$sign_out`, no new anonymous id, the groups stay and
    /// no request is made. Use ``reset()`` to start over as a fresh visitor then.
    public func signOut() async {
        guard options.enabled else {
            return
        }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return await successor.signOut()
        case .retired:
            return
        case .held:
            holdUntilStateLoads { client in await client.signOut() }
            return
        }
        _ = try? await identityChanges.submit {
            guard !IdentityStore.isAnonymous(await self.identityStore.getDistinctId()) else {
                return
            }
            await self.liftAuthPause()
            await self.performReset()
        }.value
    }

    /// Leaves the current identity for a fresh anonymous one and a new analytics session. Someone
    /// signed in is signed out first: `$sign_out` is captured, and what an implied consent
    /// collected is sent before that consent ends. An anonymous visitor leaves nothing behind.
    private func performReset() async {
        await identityInitializationTask.value
        let signsOut = !IdentityStore.isAnonymous(await identityStore.getDistinctId())
        if signsOut, options.automaticLifecycleEvents {
            // Never held while consent is pending: recorded after a later grant it would name the
            // visitor who came after the person signing out.
            await settlePendingEvents()
            await analytics.capture(AutomaticEvents.signOut)
        }
        // A grant implied by signing in ends with the sign-in.
        if analyticsConsentState.isImplied {
            // What was recorded while signed in is sent before the return to pending drops it.
            // Only the analytics queue: a full flush also waits for an identify in flight, whose
            // answer is applied behind this reset.
            if signsOut {
                _ = await waitBriefly(for: Task { await self.analytics.flush() })
            }
            if analyticsConsentState.withdrawImplied() {
                hostEvents.emit(.consent(.pending))
                await settleAnalyticsConsent(.pending, previous: .granted)
            }
        }
        let previousDistinctId = await identityStore.getDistinctIdFromCache()
        await cacheManager.delete(Self.identifiedProfileCacheKey)
        await changeIdentity(from: previousDistinctId ?? "") {
            await identityStore.forgetDistinctId()
        }
        if let previousDistinctId {
            await Self.invalidatePerIdentityCache(
                previousDistinctId: previousDistinctId, in: cacheManager)
        }
        if analyticsConsentState.value == .granted {
            await sessionManager.rotate()
        } else {
            await sessionManager.discard()
        }
    }

    /// Returns the current distinct id, allocating an anonymous one when needed.
    ///
    /// A disabled or retired client, and one waiting for the first unlock after a reboot, returns
    /// an anonymous id of its own that is never persisted and never sent.
    public func getDistinctId() async -> String {
        guard options.enabled, !isShutDown, await loadIdentity() else {
            return inertDistinctId
        }
        return await identityStore.getDistinctId()
    }

    /// Returns the analytics session id the next captured event will carry.
    ///
    /// Sessions end after 30 minutes without a capture and on ``reset()``; reading the id does
    /// not extend the session. A disabled or retired client, one waiting for the first unlock
    /// after a reboot, and one without analytics consent have no session and return an empty
    /// string.
    public func sessionId() async -> String {
        guard options.enabled, !isShutDown, analyticsConsentState.value == .granted,
            await loadIdentity()
        else {
            return ""
        }
        return await sessionManager.peek()
    }

    // MARK: - Groups

    /// Puts the end user in a group, such as the company or workspace they use your app as part
    /// of. Every later event carries it in `$groups`, until ``resetGroups()``, ``reset()`` or
    /// ``signOut()``; it is stored on the device with the distinct id, one group per type.
    ///
    /// `properties` set the group's own properties, such as its `name` and `plan`: strings,
    /// numbers or booleans, other values are left out with a warning. They are sent as a
    /// `$groupidentify` event when given, or when the end user's group of that type changed, so
    /// the group is known before any other event names it. A group and its properties are what
    /// the app says about the end user, so they are sent whatever the analytics consent: without
    /// it the event goes out at once in a request of its own, carrying nothing but the group and
    /// the distinct id, and is neither stored nor retried. The call then waits on Voidhash for at
    /// most 2 seconds.
    ///
    /// A group type is a lower-case letter followed by up to 63 lower-case letters, digits or
    /// underscores, such as `company`, and a key has 1 to 256 characters. A call with any other is
    /// ignored with a warning.
    public func group(type: String, key: String, properties: [String: JSONValue]? = nil) async {
        guard options.enabled else {
            return
        }
        if let reason = IdentityStore.invalidGroupReason(type: type, key: key) {
            warn("Ignoring group(type: \"\(type)\"): \(reason)")
            return
        }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return await successor.group(type: type, key: key, properties: properties)
        case .retired:
            return
        case .held:
            holdUntilStateLoads { client in
                await client.group(type: type, key: key, properties: properties)
            }
            return
        }
        let groupSet = properties.map { groupProperties($0, type: type) }
        let calledAt = dependencies.analyticsNow()
        // In order with identity changes: a group set before a sign-out belongs to the user
        // signing out, and one set after it to the next.
        let description = GroupDescription(type: type, key: key, set: groupSet, digest: nil)
        let unsent = try? await identityChanges.submit { () -> UnsentGroupDescriptions? in
            let changed = await self.identityStore.setGroup(type: type, key: key)
            guard changed || groupSet != nil,
                !(await self.queueGroupIdentify(description, capturedAt: calledAt))
            else {
                return nil
            }
            return UnsentGroupDescriptions(
                groups: [description], distinctId: await self.identityStore.getDistinctId())
        }.value
        if let unsent {
            await sendGroupDescriptions(unsent, capturedAt: calledAt)
        }
    }

    /// Replaces every group the end user belongs to, by group type, in one call. Made to be called
    /// wherever the app learns its groups, as often as it likes: a call that changes nothing
    /// sends and stores nothing.
    ///
    /// A type missing from `groups` is left, without an event; an empty dictionary behaves like
    /// ``resetGroups()``. A `$groupidentify` event is sent for a type only when its id changed,
    /// or its properties differ from the ones this method last sent for that id. As with
    /// ``group(type:key:properties:)`` it is sent whatever the analytics consent; one whose
    /// request without consent failed is sent again by the next call.
    ///
    /// Types, ids and properties follow the rules of ``group(type:key:properties:)``: an entry
    /// with an invalid type or id is ignored with a warning, as if it were missing.
    public func setGroups(_ groups: [String: VoidhashGroup]) async {
        guard options.enabled else {
            return
        }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return await successor.setGroups(groups)
        case .retired:
            return
        case .held:
            holdUntilStateLoads { client in await client.setGroups(groups) }
            return
        }
        var accepted: [String: VoidhashGroup] = [:]
        for (type, group) in groups {
            if let reason = IdentityStore.invalidGroupReason(type: type, key: group.id) {
                warn("Ignoring the group of type \"\(type)\" in setGroups: \(reason)")
                continue
            }
            accepted[type] = VoidhashGroup(
                id: group.id, properties: groupProperties(group.properties, type: type))
        }
        let calledAt = dependencies.analyticsNow()
        let replaced = accepted
        let unsent = try? await identityChanges.submit { () -> UnsentGroupDescriptions? in
            await self.identityStore.replaceGroups(replaced.mapValues(\.id))
            let sent = await self.identityStore.sentGroupDigests()
            var queued: [String: String] = [:]
            var unsent: [GroupDescription] = []
            for (type, group) in replaced.sorted(by: { $0.key < $1.key })
            where sent[type] != group.digest {
                let description = GroupDescription(
                    type: type, key: group.id,
                    set: group.properties.isEmpty ? nil : group.properties, digest: group.digest)
                if await self.queueGroupIdentify(description, capturedAt: calledAt) {
                    queued[type] = group.digest
                } else {
                    unsent.append(description)
                }
            }
            await self.identityStore.recordGroupDigests(queued)
            guard !unsent.isEmpty else {
                return nil
            }
            return UnsentGroupDescriptions(
                groups: unsent, distinctId: await self.identityStore.getDistinctId())
        }.value
        if let unsent {
            await sendGroupDescriptions(unsent, capturedAt: calledAt)
        }
    }

    /// Takes the end user out of every group; later events carry no `$groups`.
    public func resetGroups() async {
        guard options.enabled else {
            return
        }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return await successor.resetGroups()
        case .retired:
            return
        case .held:
            holdUntilStateLoads { client in await client.resetGroups() }
            return
        }
        _ = try? await identityChanges.submit { await self.identityStore.resetGroups() }.value
    }

    /// The groups the end user belongs to, by group type, as ``group(type:key:properties:)`` and
    /// ``setGroups(_:)`` set them. Empty when they belong to none, and on a disabled or retired client or one waiting
    /// for the first unlock after a reboot.
    public var groups: [String: String] {
        get async {
            guard options.enabled, !isShutDown, await loadIdentity() else {
                return [:]
            }
            return identityStore.groups
        }
    }

    /// The flat values of a group's `properties`, which a group can keep; the rest is left out
    /// with a warning.
    private func groupProperties(_ properties: [String: JSONValue], type: String)
        -> [String: JSONValue]
    {
        let kept = properties.filter { _, value in
            switch value {
            case .string, .number, .bool:
                return true
            case .null, .array, .object:
                return false
            }
        }
        if kept.count < properties.count {
            let left = properties.keys.filter { kept[$0] == nil }.sorted()
            warn(
                "Leaving out the group properties \(left.joined(separator: ", ")) of group type \"\(type)\": a group property is a string, a number or a boolean"
            )
        }
        return kept
    }

    /// A `$groupidentify` to send: a group and the properties to set on it.
    private struct GroupDescription: Sendable {
        let type: String
        let key: String
        let set: [String: JSONValue]?
        /// What ``setGroups(_:)`` records once the description is sent; `nil` from
        /// ``group(type:key:properties:)``, which records none.
        let digest: String?

        var properties: [String: JSONValue] {
            var properties: [String: JSONValue] = [
                "$group_type": .string(type), "$group_key": .string(key),
            ]
            if let set {
                properties["$group_set"] = .object(set)
            }
            return properties
        }
    }

    /// Group descriptions the analytics queue did not take, for lack of consent, and the identity
    /// they were made under.
    private struct UnsentGroupDescriptions: Sendable {
        let groups: [GroupDescription]
        let distinctId: String
    }

    /// Queues a group description as an analytics event, with consent.
    ///
    /// - Returns: `false` without consent, when the queue takes nothing and the description is
    ///   sent on its own, see ``sendGroupDescriptions(_:capturedAt:)``.
    private func queueGroupIdentify(_ group: GroupDescription, capturedAt: Double) async -> Bool {
        guard analyticsConsentState.value == .granted else {
            return false
        }
        warnIfNeverStarted("group")
        await record(
            AnalyticsClient.groupIdentifyEvent, properties: group.properties,
            capturedAt: capturedAt)
        return true
    }

    /// Sends group descriptions made without analytics consent, each in a request of its own,
    /// outside the analytics queue and the events held for a consent decision: nothing is stored
    /// and a failed request is not retried. The digest of one Voidhash accepted is recorded, so
    /// ``setGroups(_:)`` sends a failed one again.
    ///
    /// Runs outside the queue that orders identity changes, which never waits on the network,
    /// and the caller waits for it for at most the awaited-call budget.
    private func sendGroupDescriptions(
        _ unsent: UnsentGroupDescriptions, capturedAt: Double
    ) async {
        let sending = Task<Void, any Error> { [analytics, identityStore, identityChanges] in
            var recorded: [String: String] = [:]
            for group in unsent.groups {
                let sent = await analytics.sendGroupIdentify(
                    properties: group.properties, distinctId: unsent.distinctId,
                    capturedAt: capturedAt)
                if sent, let digest = group.digest {
                    recorded[group.type] = digest
                }
            }
            let digests = recorded
            guard !digests.isEmpty else {
                return
            }
            _ = try? await identityChanges.submit {
                await identityStore.recordGroupDigests(digests)
            }.value
        }
        let budget = dependencies.awaitedCallBudgetMilliseconds
        let sleep = dependencies.budgetSleep
        let deadline = Task { await sleep(budget) }
        defer { deadline.cancel() }
        _ = await firstOutcome(of: sending, before: deadline)
    }

    /// Toggles observer mode. Purchases already in flight still finish with the store.
    ///
    /// `nonisolated` so embedding hosts (the React Native engine) can flip the mode
    /// synchronously; the flag is an atomic the header factory and orchestrator already share.
    public nonisolated func setReadOnly(_ readOnly: Bool) {
        readOnlyFlag.value = readOnly
    }

    /// Whether the SDK currently runs in observer mode.
    public nonisolated var isReadOnly: Bool {
        return readOnlyFlag.value
    }

    /// Records the end user's analytics consent, and persists it so later launches start from it
    /// instead of ``VoidhashOptions/analyticsConsent``. ``reset()`` keeps it.
    ///
    /// Takes effect as soon as it is called. While consent is `denied` or `pending` no custom,
    /// screen, lifecycle or paywall event is collected, queued or sent, and every request carries
    /// `x-analytics-consent`. Withdrawing consent also drops what was
    /// collected and not sent yet, a batch in flight included, and ends the analytics session.
    /// Granting it collects from then on; nothing skipped meanwhile is replayed, except the
    /// events held under ``VoidhashOptions/analyticsWhilePending``, which a grant records first
    /// and a denial discards.
    ///
    /// The decision is the end user's own: it replaces a grant implied by an identify
    /// (``VoidhashOptions/grantConsentOnIdentify``), and a sign-out keeps it.
    ///
    /// Consent covers what the SDK observes, not what the app says about the person: purchases,
    /// restores, entitlements, ``identify(externalUserId:email:name:)``, person traits, groups and
    /// their properties, feature flags, paywalls and taking the agreement to ad data sharing back
    /// through ``setAdDataSharing(_:)`` work the same whatever the consent.
    public nonisolated func setAnalyticsConsent(_ consent: AnalyticsConsent) async {
        // Flipped before the client is reached: captures and requests already queued on the
        // actor see the new value.
        let previous = analyticsConsentState.value
        analyticsConsentState.set(consent)
        if consent == .granted {
            reportedConsentSkip.value = false
        }
        if previous != consent {
            hostEvents.emit(.consent(consent))
        }
        await applyAnalyticsConsent(consent, previous: previous)
    }

    /// The end user's analytics consent in effect: the last ``setAnalyticsConsent(_:)``, the
    /// decision persisted by an earlier launch, or ``VoidhashOptions/analyticsConsent``.
    public nonisolated var analyticsConsent: AnalyticsConsent {
        return analyticsConsentState.value
    }

    private func applyAnalyticsConsent(
        _ consent: AnalyticsConsent, previous: AnalyticsConsent
    ) async {
        guard options.enabled else {
            return
        }
        switch await writeRoute() {
        case .direct:
            await settleAnalyticsConsent(consent, previous: previous)
        case .forward(let successor):
            await successor.setAnalyticsConsent(consent)
        case .retired:
            return
        case .held:
            holdUntilStateLoads { client in
                await client.settleAnalyticsConsent(consent, previous: previous)
            }
        }
    }

    /// Brings persisted state in line with a consent decision: records the consent in effect for
    /// later launches, then either drops what analytics collected or, once granted, runs the
    /// install and update check a launch without consent skipped.
    ///
    /// A withdrawal always drops what was collected, even when consent was granted again before
    /// this ran: what was collected before it must never be sent. A grant moves the crash marker
    /// to now, since a crash from the time without consent stays unreported, as anything else
    /// skipped meanwhile does.
    private func settleAnalyticsConsent(
        _ decision: AnalyticsConsent, previous: AnalyticsConsent
    ) async {
        await cacheManager.set(
            AnalyticsConsentState.cacheKey, value: analyticsConsentState.value.rawValue)
        if analyticsConsentState.isImplied {
            await cacheManager.set(AnalyticsConsentState.impliedCacheKey, value: true)
        } else {
            await cacheManager.delete(AnalyticsConsentState.impliedCacheKey)
        }
        guard decision == .granted else {
            installAttributionTask?.cancel()
            installAttributionTask = nil
            if decision == .denied {
                discardPendingEvents()
            }
            await discardCollectedAnalytics()
            return
        }
        // Before anything else the grant records.
        await settlePendingEvents()
        if previous != .granted, options.automaticLifecycleEvents {
            await cacheManager.set(
                VoidhashClient.lastReportedCrashCacheKey, value: dependencies.analyticsNow())
        }
        startInstallAttribution()
    }

    /// Starts this launch's read of install attribution, off every launch path, once the client
    /// has started and with analytics consent.
    private func startInstallAttribution() {
        guard options.installAttribution, let fetchToken = dependencies.adServicesToken,
            hasStarted, stateLoaded.value, !isShutDown, !dependencies.embedded,
            analyticsConsentState.value == .granted, installAttributionTask == nil
        else {
            return
        }
        let attribution = InstallAttribution(
            cacheManager: cacheManager, fetchToken: fetchToken, session: dependencies.session,
            clock: clock, diagnostics: diagnostics, now: dependencies.analyticsNow)
        installAttributionTask = Task { [weak self] in
            await self?.attributeInstall(attribution)
        }
    }

    /// Reads install attribution and queues the touch it carries for the current identity, an
    /// anonymous one included, whose person a later identify merges. The install is settled only
    /// once that touch is on disk: a process killed before then, or a withdrawal of consent,
    /// leaves it for the next attempt.
    private func attributeInstall(_ attribution: InstallAttribution) async {
        guard !Task.isCancelled, await attribution.beginAttempt(),
            let outcome = try? await attribution.read()
        else {
            return
        }
        await dependencies.installAttributionAnswered?()
        switch outcome {
        case .tryLater:
            return
        case .noTouch:
            break
        case .touch(let touch):
            guard !Task.isCancelled else {
                return
            }
            await analytics.capture(
                InstallAttribution.touchEvent,
                properties: InstallAttribution.touchEventProperties(touch),
                capturedAt: dependencies.analyticsNow())
            guard await analytics.persist() else {
                attribution.reportDeferred("The touch could not be written to storage")
                return
            }
        }
        // A withdrawal meanwhile cancelled this, and dropped the touch from the queue.
        guard !Task.isCancelled, analyticsConsentState.value == .granted else {
            return
        }
        await attribution.markDone()
    }

    /// Drops the queued events, a batch in flight, the analytics session and a queued agreement
    /// to ad data sharing, which needs consent and does not come back with a later grant. Other
    /// person writes stay queued: identity and traits are what the app says about the person,
    /// which consent does not cover.
    private func discardCollectedAnalytics() async {
        await analytics.discardQueuedEvents()
        await personWrites.discardAdDataSharingAgreements()
        await sessionManager.discard()
    }

    /// Whether analytics consent is pending and the events that happen meanwhile are held for it.
    private var holdsPendingEvents: Bool {
        return options.analyticsWhilePending == .buffer && analyticsConsentState.value == .pending
    }

    /// Whether an event that happens now is kept: recorded with consent, or held for it.
    private var collectsAnalytics: Bool {
        return analyticsConsentState.value == .granted || holdsPendingEvents
    }

    /// Records an event that happened at `capturedAt`, or holds it in memory while consent is
    /// pending and ``VoidhashOptions/analyticsWhilePending`` asks for that. Dropped otherwise
    /// without consent.
    private func record(
        _ eventName: String, properties: [String: JSONValue] = [:], capturedAt: Double
    ) async {
        guard holdsPendingEvents else {
            await settlePendingEvents()
            await analytics.capture(eventName, properties: properties, capturedAt: capturedAt)
            return
        }
        pendingEvents.append(
            PendingEvent(name: eventName, properties: properties, capturedAt: capturedAt))
        if pendingEvents.count > VoidhashClient.maxPendingEvents {
            pendingEvents.removeFirst()
            droppedPendingEvents += 1
        }
    }

    /// Settles what waited for a consent decision with the consent in effect now. A grant runs the
    /// install and update check a launch without consent skipped, then records the events held
    /// while consent was pending, in order, each at its own time, under the identity, groups and
    /// session of this moment; a denial discards them. Returns once those being recorded are in
    /// the queue.
    private func settlePendingEvents() async {
        switch analyticsConsentState.value {
        case .pending:
            break
        case .denied:
            discardPendingEvents()
        case .granted:
            if !pendingEvents.isEmpty || appReleaseCheckDeferred {
                reportDroppedPendingEvents()
                let events = pendingEvents
                pendingEvents = []
                // The install or update a launch without consent left to the grant comes first,
                // at the time of the earliest event it precedes.
                let checksAppRelease = appReleaseCheckDeferred
                appReleaseCheckDeferred = false
                let earlier = pendingEventsReplay
                pendingEventsReplay = Task { [analytics] in
                    await earlier?.value
                    if checksAppRelease {
                        await self.captureAppReleaseEvents(
                            appOpened: false, capturedAt: events.map(\.capturedAt).min())
                    }
                    for event in events {
                        await analytics.capture(
                            event.name, properties: event.properties, capturedAt: event.capturedAt)
                    }
                }
            }
        }
        if let replay = pendingEventsReplay {
            await replay.value
            if pendingEventsReplay == replay {
                pendingEventsReplay = nil
            }
        }
    }

    private func discardPendingEvents() {
        reportDroppedPendingEvents()
        pendingEvents = []
    }

    private func reportDroppedPendingEvents() {
        guard droppedPendingEvents > 0 else {
            return
        }
        diagnostics.emit(
            .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "capture",
            message:
                "Dropped the \(droppedPendingEvents) oldest event(s) captured while analytics consent was pending; it keeps \(VoidhashClient.maxPendingEvents)"
        )
        droppedPendingEvents = 0
    }

    /// Reports the first analytics call skipped since consent was last granted.
    private func reportAnalyticsConsentSkip(operation: String) {
        guard !reportedConsentSkip.exchange(true) else {
            return
        }
        diagnostics.emit(
            .consent, code: "ANALYTICS_CONSENT_DENIED", operation: operation,
            message:
                "Analytics consent is \(analyticsConsentState.value.rawValue): analytics events are not collected"
        )
    }

    // MARK: - Feature flags and analytics

    /// Evaluates feature flags for the current identity.
    ///
    /// Cache-first with a 5 minute stale window; cached results are served indefinitely while the
    /// backend is unreachable, so a flag never flips back to its default during an outage. With
    /// nothing cached the read waits at most ``FeatureFlagOptions/maxWaitMilliseconds``; the
    /// evaluation then carries on in the background and is announced through
    /// ``FeatureFlagOptions/onUpdate``. A requested key without an evaluated value is answered
    /// with its ``FeatureFlagOptions/defaults`` entry, when it has one.
    ///
    /// - Parameter keys: Flag keys to evaluate; `nil` evaluates every flag.
    public func getFeatureFlags(_ keys: [String]? = nil) async throws -> [SdkFeatureFlagResult] {
        return try await getFeatureFlagsState(keys).value
    }

    /// ``getFeatureFlags(_:)`` with the freshness of the values it returned.
    ///
    /// Before the first unlock after a reboot the cached flags cannot be read yet, so the answer is
    /// an empty list, stale and expired, without waiting.
    public func getFeatureFlagsState(_ keys: [String]? = nil) async throws -> Stale<
        [SdkFeatureFlagResult]
    > {
        return try await readFeatureFlags(keys).map { flags in
            VoidhashClient.withDefaults(flags, keys: keys, defaults: options.featureFlags.defaults)
        }
    }

    /// `flags` with a result for every key in `keys` that has none but a default.
    private static func withDefaults(
        _ flags: [SdkFeatureFlagResult], keys: [String]?, defaults: [String: Bool]
    ) -> [SdkFeatureFlagResult] {
        guard let keys, !defaults.isEmpty else {
            return flags
        }
        var answered = Set(flags.map(\.key))
        var completed = flags
        for key in keys where !answered.contains(key) {
            guard let enabled = defaults[key] else {
                continue
            }
            answered.insert(key)
            completed.append(SdkFeatureFlagResult(enabled: enabled, key: key))
        }
        return completed
    }

    private func readFeatureFlags(_ keys: [String]?) async throws -> Stale<[SdkFeatureFlagResult]>
    {
        guard options.enabled, !isShutDown else {
            return Stale(value: [])
        }
        guard await loadIdentity() else {
            return Stale(value: [], isStale: true, isExpired: true)
        }

        let distinctId = await identityStore.getDistinctId()
        let cacheKey = VoidhashClient.flagsCacheKey(distinctId: distinctId, keys: keys)
        let exact = await cacheManager.get(cacheKey, as: [SdkFeatureFlagResult].self)
        var cached = exact.map {
            Stale(value: $0.value, isStale: $0.isStale, isExpired: $0.isExpired)
        }
        // The full evaluation answers a subset too unless the subset is newer: the carried copy
        // of a visitor's subset must not outlive the user's own evaluation.
        if let keys, !keys.isEmpty,
            let all = await cacheManager.get(
                VoidhashClient.flagsCacheKey(distinctId: distinctId, keys: nil),
                as: [SdkFeatureFlagResult].self),
            exact.map({ all.createdAt >= $0.createdAt }) ?? true
        {
            cached = Stale(
                value: all.value.filter { keys.contains($0.key) },
                isStale: all.isStale, isExpired: all.isExpired)
        }

        if let cached, !cached.isStale {
            return Stale(value: cached.value, isStale: false, isExpired: cached.isExpired)
        }

        guard await canReachNetwork(), isRefreshDue(.flags) else {
            let answeredByDefaults =
                keys?.contains { options.featureFlags.defaults[$0] != nil } ?? false
            try surfaceAuthFailureIfUnserved(hasCache: cached != nil || answeredByDefaults)
            await refreshWhenCircuitReopens(.flags(keys))
            return Stale(
                value: cached?.value ?? [], isStale: true, isExpired: cached?.isExpired ?? true)
        }

        let refresh = Task { try await self.refreshFlags(keys: keys) }
        if cached != nil, case .success(let fresh)? = await value(of: refresh, withinBudget: true) {
            return Stale(value: fresh)
        }
        if let cached {
            return Stale(value: cached.value, isStale: true, isExpired: cached.isExpired)
        }
        // Nothing to serve: wait for the evaluation, but no longer than the app allows. It keeps
        // running, lands in the cache and is announced through `onUpdate`.
        // A wait past the request timeout could only end with it; a negative one waits none.
        let requestTimeout = dependencies.session.configuration.timeoutIntervalForRequest * 1000
        let configuredWait = options.featureFlags.maxWaitMilliseconds
        let maxWait =
            configuredWait.isFinite ? min(max(configuredWait, 0), requestTimeout) : requestTimeout
        let sleep = dependencies.budgetSleep
        let deadline = Task { await sleep(maxWait) }
        defer { deadline.cancel() }
        if case .success(let fresh)? = await firstOutcome(of: refresh, before: deadline) {
            return Stale(value: fresh)
        }
        return Stale(value: [], isStale: true, isExpired: true)
    }

    @discardableResult
    private func refreshFlags(keys: [String]?) async throws -> [SdkFeatureFlagResult] {
        guard await loadIdentity() else {
            throw VoidhashClient.identityUnavailable
        }
        let distinctId = await identityStore.getDistinctId()
        let cacheKey = VoidhashClient.flagsCacheKey(distinctId: distinctId, keys: keys)
        return try await flagsFlight.run(key: cacheKey) { [weak self] in
            guard let self else {
                return []
            }
            return try await self.fetchAndCacheFlags(
                distinctId: distinctId, keys: keys, cacheKey: cacheKey)
        }
    }

    private func fetchAndCacheFlags(
        distinctId: String, keys: [String]?, cacheKey: String
    ) async throws -> [SdkFeatureFlagResult] {
        let headers = headerFactory.build(distinctId: distinctId)
        let response: SdkFeatureFlagsResponse
        do {
            response = try await guarded("flags.evaluate") { [apiClient] in
                try await apiClient.evaluateFlags(headers: headers, flagKeys: keys)
            }
            refreshBackoff[.flags] = nil
        } catch {
            backOffRefresh(.flags, after: error)
            throw error
        }
        // An evaluation for an identity signed out meanwhile must neither come back into the
        // cache that sign-out cleared nor be announced for the user who is signed in now.
        guard await identityStore.getDistinctId() == distinctId else {
            return response.flags
        }
        await cacheManager.set(
            cacheKey,
            value: response.flags,
            staleTime: VoidhashClient.flagsCacheStaleTimeMilliseconds
        )
        // The identity may have switched while the cache was written.
        guard mayPublish(for: distinctId) else {
            return response.flags
        }
        options.featureFlags.onUpdate?(keys, response.flags)
        if let identity = intake.currentIdentity, identity.distinctId == distinctId {
            hostEvents.emit(
                .flags(
                    VoidhashFlagsAnswer(
                        distinctId: distinctId, generation: identity.generation, keys: keys,
                        state: Stale(value: response.flags, reason: .fresh))))
        }
        return response.flags
    }

    /// Queues an analytics event. Dropped while analytics consent is not granted, unless consent
    /// is pending and ``VoidhashOptions/analyticsWhilePending`` holds events for it. The name is
    /// trimmed; a blank one is ignored and reported as `ANALYTICS_EVENT_INVALID`.
    public func capture(_ eventName: String, properties: [String: JSONValue] = [:]) async {
        guard options.enabled else {
            return
        }
        guard collectsAnalytics else {
            reportAnalyticsConsentSkip(operation: "capture")
            return
        }
        warnIfNeverStarted("capture")
        await capture(eventName, properties: properties, capturedAt: dependencies.analyticsNow())
    }

    /// Queues an event that happened at `capturedAt`: here, on the client that replaced this one,
    /// or once persisted state has loaded.
    private func capture(
        _ eventName: String, properties: [String: JSONValue], capturedAt: Double
    ) async {
        switch await writeRoute() {
        case .direct:
            await record(eventName, properties: properties, capturedAt: capturedAt)
        case .forward(let successor):
            await successor.capture(eventName, properties: properties, capturedAt: capturedAt)
        case .retired:
            return
        case .held:
            holdUntilStateLoads(isCapture: true) { client in
                await client.capture(eventName, properties: properties, capturedAt: capturedAt)
            }
        }
    }

    /// Reports that the end user opened a notification, as `$push_opened` naming its send. Call it
    /// from your own notification handling, with the opened notification's `userInfo`:
    ///
    /// ```swift
    /// func userNotificationCenter(
    ///     _ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse
    /// ) async {
    ///     voidhash.trackPushOpened(userInfo: response.notification.request.content.userInfo)
    /// }
    /// ```
    ///
    /// The SDK does not take over the app's notification delegate, so it never sees a notification
    /// on its own. A notification not sent through Voidhash is ignored, and so is one reported again
    /// right after its first report. Dropped while analytics consent is not granted.
    public nonisolated func trackPushOpened(userInfo: [AnyHashable: Any]) {
        guard let sendId = userInfo[PushOpened.sendIdDataKey] as? String,
            !sendId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            return
        }
        let openedAt = dependencies.analyticsNow()
        // In call order, behind the lifecycle transitions reported before it: a task per report
        // could let another notification's report in between two reports of the same one, and
        // the duplicate check would then count it twice.
        lifecycleQueue.enqueue { await self.capturePushOpened(sendId: sendId, openedAt: openedAt) }
    }

    private func capturePushOpened(sendId: String, openedAt: Double) async {
        guard options.enabled, sendId != lastPushOpenedSendId else {
            return
        }
        lastPushOpenedSendId = sendId
        guard collectsAnalytics else {
            reportAnalyticsConsentSkip(operation: "trackPushOpened")
            return
        }
        warnIfNeverStarted("trackPushOpened")
        await capture(
            AutomaticEvents.pushOpened,
            properties: [PushOpened.sendIdProperty: .string(sendId)], capturedAt: openedAt)
    }

    /// Sends everything queued: identify and person-trait writes, then store receipts waiting for
    /// the backend, then analytics events.
    ///
    /// A flush is a request to resume traffic now: it gives a circuit breaker that stopped
    /// requests after an outage its probe, probes a pause after a rejected publishable key when
    /// the last probe was at least a minute ago, and sends queued work without waiting out the
    /// retry backoff. A server's `Retry-After` is still honoured, and a receipt Voidhash refused
    /// for good waits for the next launch, six hours or ``restorePurchases()``.
    ///
    /// Never throws: an unreachable backend leaves everything on disk. The returned status
    /// describes the analytics queue; ``pendingTransactionCount()`` reports the receipts. Only
    /// one analytics flush runs at a time; concurrent callers join the running one.
    ///
    /// Waits on Voidhash for at most 2 seconds. When the backend is slower than that, the call
    /// returns with what is still queued reported as `pending`, and the delivery carries on in
    /// the background. One flush sends at most ``AnalyticsClient/maxBatchesPerFlush`` analytics
    /// batches; the periodic flush sends the rest.
    @discardableResult
    public func flush() async -> FlushStatus {
        guard options.enabled else {
            return FlushStatus(flushed: 0, pending: 0)
        }
        switch await writeRoute() {
        case .direct:
            return await waitBriefly(
                for: Task {
                    await self.breaker.halfOpenAll()
                    await self.probeAuthPauseIfDue()
                    return await self.drainPendingWork(freshEvidence: true)
                })
        case .forward(let successor):
            return await successor.flush()
        case .retired:
            return FlushStatus(flushed: 0, pending: 0)
        case .held:
            return FlushStatus(
                flushed: 0, pending: 0,
                lastError: "Persisted state is unreadable until the device is unlocked")
        }
    }

    /// Captures a `$screen` event for a screen the SDK cannot see on its own (custom
    /// navigation, onboarding steps, pager pages).
    ///
    /// Every call is a new screen instance, so calling it twice with the same name emits twice.
    /// The name is trimmed; a blank one is ignored and reported as `ANALYTICS_EVENT_INVALID`.
    /// `properties` are merged under the reserved `$screen_*` properties. Dropped while
    /// analytics consent is not granted.
    public func screen(_ name: String, properties: [String: JSONValue] = [:]) async {
        guard options.enabled else {
            return
        }
        let name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else {
            diagnostics.emit(
                .eviction, code: "ANALYTICS_EVENT_INVALID", operation: "analytics.screen",
                message: "Ignored a screen with a blank name")
            warn("Ignored a screen with a blank name")
            return
        }
        guard collectsAnalytics else {
            reportAnalyticsConsentSkip(operation: "screen")
            return
        }
        if isShutDown {
            await successor()?.screen(name, properties: properties)
            return
        }
        manualScreenCounter += 1
        let view = ScreenView(
            identity: "manual:\(name):\(manualScreenCounter)", name: name, source: .manual)
        await trackScreen(view, properties: properties)
    }

    /// Retires the client. ``Voidhash/configure(publishableKey:options:)`` calls this on the
    /// client it replaces.
    ///
    /// Ends the StoreKit connection and stops lifecycle and connectivity observation and every
    /// background loop, then waits for the identity load, the startup events and queue work in
    /// flight and writes the analytics queue, the queued person writes and the receipt outbox
    /// through, so a client configured over the same storage starts from everything this one
    /// held. Calling it again waits for the first call.
    ///
    /// A retired client does no work of its own. Writes (`capture`, `screen`, `identify`,
    /// `setPersonAttributes`, `reset`, `flush`, `reportTransaction`, `syncStoreTransaction`,
    /// `restorePurchases`, `syncPurchases`) go to ``Voidhash/shared`` when it is enabled and uses
    /// the same publishable key and API origin. Otherwise a reported transaction is still
    /// captured durably for the next client over this storage, and other writes do nothing. Reads
    /// return the same inert values as a disabled client.
    public func shutdown() async {
        if let shutdownTask {
            return await shutdownTask.value
        }
        retirement.value = true
        guard options.enabled else {
            return
        }
        let task = Task { await self.retire() }
        shutdownTask = task
        await task.value
    }

    private func retire() async {
        personBroadcaster.finish()
        transactionBroadcaster.finish()
        purchaseIntentBroadcaster.finish()
        for task in appStoreEvents {
            task.cancel()
        }
        appStoreEvents = []
        // A retired client is no way to keep a flow: the one on screen is closed and one still
        // loading is not shown. Not waited for: handing the storage over must not depend on
        // how long a flow takes to leave the screen. Its images are no longer fetched ahead.
        Task { [flowCoordinatorStorage, flowImageStore] in
            await flowImageStore?.stopPrefetching()
            await flowCoordinatorStorage?.shutDown()
        }
        initializationTask?.cancel()
        // Ends a wait for protected data: the replacing client loads the persisted state.
        identityInitializationTask.cancel()
        scheduler.stop()
        grantRefreshes?.cancel()
        installAttributionTask?.cancel()
        lifecycleSubscription?.cancel()
        lifecycleSubscription = nil
        crashSubscription?.cancel()
        crashSubscription = nil
        connectivitySubscription?.cancel()
        connectivitySubscription = nil
        if let storeConnectionTask {
            _ = try? await storeConnectionTask.value
        }
        if storeConnected {
            storeConnected = false
            _ = try? await engine.endConnection()
        }
        // The identity being loaded and the startup events being captured end before the
        // storage changes hands: a replacement that read it in between would make a second
        // anonymous id on a fresh install, and report the install twice. Neither waits on the
        // network, and the cancel above ended a wait for protected data.
        await identityInitializationTask.value
        await startupWrites?.value
        // Every loop, timer and queue the client owns stops here, before the replacement reads
        // the storage they share.
        await installAttributionTask?.value
        await analytics.retire()
        await personWrites.retire()
        await outbox.retire()
        await acceptedReceipts.retire()
        // Events still held for a consent decision go to the client that replaced this one, which
        // holds, records or drops them by its own consent. Not waited for: that client reads its
        // storage only once this retirement has finished.
        if !pendingEvents.isEmpty, let successor = successor() {
            let events = pendingEvents
            pendingEvents = []
            Task {
                for event in events {
                    await successor.capture(
                        event.name, properties: event.properties, capturedAt: event.capturedAt)
                }
            }
        }
    }

    // MARK: - Screen tracking

    /// Feeds a view through the screen tracker and captures `$screen` when it is a new screen.
    func trackScreen(_ view: ScreenView, properties: [String: JSONValue] = [:]) async {
        let now = dependencies.analyticsNow()
        guard options.enabled, !isShutDown, collectsAnalytics,
            let screenProperties = screenTracker.transition(view, now: now)
        else {
            return
        }
        await capture(
            AutomaticEvents.screen,
            properties: properties.merging(screenProperties) { _, reserved in reserved },
            capturedAt: now)
    }

    /// Entry point of the UIKit swizzle; applies the automatic-capture filter first.
    func trackAutomaticScreen(_ descriptor: ScreenControllerDescriptor) async {
        guard options.screenTracking.automatic,
            let view = ScreenControllerDescriptor.screenView(
                for: descriptor, suppressHostingControllers: screenTracker.hasSwiftUIScreen)
        else {
            return
        }
        await trackScreen(view)
    }

    // MARK: - Store actions

    /// Shows the App Store's subscription management, opened on the subscription group of
    /// `product` from iOS 17.
    ///
    /// The person is refreshed after the sheet closes, and twice shortly after, so a change the
    /// user made there shows once the App Store has told Voidhash.
    public func showManageSubscriptions(product: VoidhashProduct? = nil) async throws {
        guard options.enabled, !isShutDown else {
            return
        }
        try await engine.showManageSubscriptions(
            subscriptionGroupId: product?.subscription?.groupId)
        scheduleGrantRefresh()
    }

    /// Shows the App Store's sheet for redeeming an offer code.
    ///
    /// From iOS 27 the sheet hands the transaction of the code redeemed back, which is sent to
    /// Voidhash and finished like a purchase, and returned. Before that the transaction arrives
    /// through the store observer and ``transactionUpdates()``, and this returns `nil`, as it does
    /// when the user closes the sheet. Needs iOS 16.
    @discardableResult
    public func presentCodeRedemption() async throws -> VoidhashTransaction? {
        guard options.enabled, !isShutDown else {
            return nil
        }
        try await ensureStoreConnected()
        guard let storeTransaction = try await engine.presentCodeRedemption() else {
            return nil
        }
        // The schema names the product redeemed; a device without one fetches it first.
        let schema = try await resolvedSchemaForProducts()
        let synced =
            (try? await orchestrator().processTransaction(
                ReceiptTransaction(storeTransaction: storeTransaction), schema: schema)) == true
        if synced {
            scheduleGrantRefresh()
        }
        let transaction = VoidhashTransaction(storeTransaction, schema: schema)
        announceTransaction(VoidhashTransactionUpdate(transaction: transaction, synced: synced))
        return transaction
    }

    /// The App Store storefront the user buys in: its country as ISO 3166-1 alpha-2, and from
    /// iOS 17 its currency. `nil` when the App Store cannot say, and on a disabled client.
    public func getStorefront() async -> VoidhashStorefront? {
        guard options.enabled, !isShutDown else {
            return nil
        }
        return await engine.storefront()
    }

    /// Whether the user may make payments: Screen Time can turn them off. `false` on a disabled
    /// client.
    public func canMakePayments() -> Bool {
        guard options.enabled, !isShutDown else {
            return false
        }
        return engine.canMakePayments()
    }

    // MARK: - Updates

    /// The person snapshot every time it changes: after a read, a purchase, a restore, an
    /// identity switch. Starts with the snapshot last known: once the client has started, the one
    /// cached on the device for the identity, offline too, or `nil` when nothing is cached. A
    /// read for an identity the app switched away from is never published after the switch.
    ///
    /// Each call makes a stream of its own, which ends when the task iterating it is cancelled.
    /// Check access with the snapshot's entitlements.
    public nonisolated func personUpdates() -> AsyncStream<SdkPerson?> {
        guard options.enabled else {
            return AsyncStream { continuation in
                continuation.yield(nil)
                continuation.finish()
            }
        }
        return personBroadcaster.stream()
    }

    /// Purchases completing outside ``purchase(_:options:)``: Ask to Buy approvals, renewals the
    /// device sees, offer codes redeemed, App Store promotions bought.
    ///
    /// A transaction arrives once the SDK has handled it: its receipt accepted by Voidhash
    /// (``VoidhashTransactionUpdate/synced``), or queued for it. Each transaction arrives once a
    /// session; one the receipt of which Voidhash has not accepted yet stays unfinished, and the
    /// next launch reports it again. Refunds, revocations and subscriptions the user upgraded
    /// from are not purchases and do not arrive; they reach the person snapshot. Up to 10 that
    /// arrive while no stream is open are kept for the next stream made.
    ///
    /// It is a signal for the interface, not a delivery guarantee: access comes from the
    /// person's entitlements, see ``personUpdates()``. Each call makes a stream of its own, which
    /// ends when the task iterating it is cancelled.
    public nonisolated func transactionUpdates() -> AsyncStream<VoidhashTransactionUpdate> {
        guard options.enabled else {
            return AsyncStream { $0.finish() }
        }
        return transactionBroadcaster.stream()
    }

    // MARK: - App Store

    /// The App Store's own features: refunds, subscription status, entitlements, the app
    /// transaction, App Store messages and purchases started on the App Store.
    public nonisolated var appStore: VoidhashAppStore {
        return VoidhashAppStore(client: self)
    }

    func beginRefundRequest(transactionId: String) async throws -> VoidhashRefundRequestStatus {
        guard options.enabled, !isShutDown else {
            throw VoidhashStoreError.storeKitNotInitialized
        }
        return try await engine.beginRefundRequest(transactionId: transactionId)
    }

    func subscriptionStatus(groupId: String) async throws -> [VoidhashAppStoreSubscriptionStatus] {
        guard options.enabled, !isShutDown, await loadIdentity() else {
            return []
        }
        let schema = currentSchema ?? RuntimeSchema.empty
        let statuses = try await engine.subscriptionStatuses(
            groupId: groupId,
            appAccountToken: AccountToken.derive(distinctId: await identityStore.getDistinctId()))
        return statuses.map { status in
            VoidhashAppStoreSubscriptionStatus(
                state: status.state, transaction: VoidhashTransaction(status.transaction, schema: schema),
                renewalInfo: status.renewalInfo)
        }
    }

    func currentEntitlements() async throws -> [VoidhashTransaction] {
        guard options.enabled, !isShutDown else {
            return []
        }
        let schema = currentSchema ?? RuntimeSchema.empty
        return try await engine.currentEntitlements().map {
            VoidhashTransaction($0, schema: schema)
        }
    }

    func appTransaction() async throws -> VoidhashAppTransaction {
        guard options.enabled, !isShutDown else {
            throw VoidhashStoreError.storeKitNotInitialized
        }
        return try await engine.appTransaction()
    }

    /// Starts listening to App Store messages and purchase intents, as the options say, once
    /// the store is connected. Never in development mode, where nothing is sold through the App
    /// Store, nor in observer mode for purchase intents, which another integration buys.
    private func observeAppStoreEvents() {
        guard dependencies.observesAppStoreEvents, !isDevelopmentMode, appStoreEvents.isEmpty,
            !isShutDown
        else {
            return
        }
        #if os(iOS) || os(visionOS)
            if #available(iOS 16.0, *), options.appStoreMessages == .deferWhileFlowPresented {
                appStoreEvents.append(
                    Task { [weak self] in
                        for await message in Message.messages {
                            guard let self else { return }
                            await self.receive(VoidhashAppStoreMessage(message))
                        }
                    })
            }
        #endif
        #if os(iOS)
            if #available(iOS 16.4, *), !readOnlyFlag.value {
                appStoreEvents.append(
                    Task { [weak self] in
                        for await intent in PurchaseIntent.intents {
                            guard let self else { return }
                            await self.receive(intent)
                        }
                    })
            }
        #endif
    }

    /// Shows an App Store message now, or once the flows on screen have ended.
    func receive(_ message: any DeferredAppStoreMessage) async {
        heldMessages.append(message)
        await showHeldMessages()
    }

    /// Shows the held App Store messages, unless a flow is on screen. One that finds no scene in
    /// the foreground to show it on stays held, and is shown when the app next becomes active.
    ///
    /// Only for this process: StoreKit hands a message over once, so one the app is killed
    /// holding is not shown.
    private func showHeldMessages() async {
        while flowsOnScreen == 0, !isShutDown, !heldMessages.isEmpty {
            let message = heldMessages.removeFirst()
            do {
                try await MainActor.run { try message.display() }
            } catch let error as VoidhashStoreError where error == .windowSceneNotFound {
                heldMessages.insert(message, at: 0)
                return
            } catch {
                warn("Could not show the App Store message (\(message.reasonName)): \(error)")
            }
        }
    }

    /// Shows the App Store messages held while flows were on screen, once none is.
    private func flowLeftScreen() async {
        flowsOnScreen -= 1
        await showHeldMessages()
    }

    #if os(iOS)
        /// Hands a purchase the user started on the App Store to ``handle(_:)`` once the client
        /// has initialized. An intent for a product Studio does not sell, or with an offer the
        /// user cannot have, is reported and dropped: it is never bought at another price than the
        /// one the App Store showed.
        @available(iOS 16.4, *)
        private func receive(_ intent: PurchaseIntent) async {
            guard !isShutDown, (try? await ensureInitialized()) != nil else {
                return
            }
            let products: [VoidhashProduct]
            do {
                products = try await getProducts()
            } catch {
                warn("Dropped the App Store purchase of \(intent.product.id): \(error)")
                return
            }
            guard let product = products.first(where: { $0.storeProductId == intent.product.id })
            else {
                diagnostics.emit(
                    .store, code: "PRODUCT_NOT_FOUND", operation: "purchaseIntent",
                    message:
                        "Dropped the App Store purchase of \(intent.product.id): no product in Studio sells it")
                return
            }
            var offer: VoidhashOffer?
            if #available(iOS 18.0, *), let intentOffer = intent.offer {
                // The App Store names the offer by its own identifier, and an introductory one
                // by none.
                guard let match = product.offer(appStoreOfferId: intentOffer.id) else {
                    diagnostics.emit(
                        .store, code: "OFFER_UNAVAILABLE", operation: "purchaseIntent",
                        message:
                            "Dropped the App Store purchase of \(product.slug): the user cannot have its offer \(intentOffer.id ?? "introductory")")
                    return
                }
                offer = match
            }
            await handle(VoidhashPurchaseIntent(product: product, offer: offer))
        }
    #endif

    /// Hands a purchase the user started on the App Store to
    /// ``VoidhashAppStore/purchaseIntents()``, or buys it as ``VoidhashOptions/purchaseIntents``
    /// says. One that arrives while another purchase runs is bought once that one has ended.
    func handle(_ purchaseIntent: VoidhashPurchaseIntent) async {
        switch options.purchaseIntents {
        case .manual:
            purchaseIntentBroadcaster.yield(purchaseIntent)
        case .purchaseWhenReady:
            let product = purchaseIntent.product
            while !isShutDown {
                await waitForPurchaseInFlight()
                do {
                    if case .purchased(let transaction, let synced) = try await purchase(
                        product, options: purchaseIntent.purchaseOptions)
                    {
                        announceTransaction(
                            VoidhashTransactionUpdate(transaction: transaction, synced: synced))
                    }
                    return
                } catch let error as VoidhashStoreError where error == .purchaseInProgress {
                    // Another purchase claimed the store first; this one waits for it.
                    continue
                } catch {
                    warn("The App Store purchase of \(product.slug) failed: \(error)")
                    return
                }
            }
        }
    }

    // MARK: - Flows

    /// Presents the flow or paywall assigned to `location` and returns how it ended.
    ///
    /// Returns once the flow has ended and left the screen. Every ending has the same shape:
    /// ``FlowResult/outcome`` is ``FlowResult/purchased``, ``FlowResult/restored``,
    /// ``FlowResult/dismissed`` or the outcome the flow finished with, and
    /// ``FlowResult/output`` holds the flow's outputs whichever it was.
    ///
    /// A location cached on this device presents without waiting on the backend. Presenting a
    /// flow while another is on screen closes that one first. Cancelling the calling task closes
    /// the flow, or keeps one that is still loading from being shown; the call then returns
    /// ``FlowResult/dismissed``.
    ///
    /// A flow that is not ready to show within 15 seconds of the call
    /// (``NetworkPolicy/flowPresentationDeadlineSeconds``), because the location resolves or
    /// its package downloads too slowly, is not shown at all: the call throws
    /// ``FlowError/unavailable``, and the package is still downloaded for the next presentation.
    ///
    /// ``shutdown()`` ends the presentation too: a flow on screen is closed and the call returns
    /// ``FlowResult/dismissed``; one still loading is not shown, and the call throws
    /// ``FlowError/disabled``, as every presentation on a shut-down client does.
    ///
    /// - Parameters:
    ///   - location: The slug of the location in the app where the flow is shown.
    ///   - revision: The revision of the location's interface the app was built against. When
    ///     `nil`, the one ``VoidhashOptions/flowRevisions`` names for the location, else 0.
    ///   - input: The values the app passes to the flow, by name. An input that is not passed
    ///     keeps its default.
    ///   - actions: Handlers of the app actions the flow may call, by name. A handler receives
    ///     the call's arguments and returns the reply; when it throws, or when the flow calls
    ///     an action that has no handler, the call fails in the flow, which carries on. A
    ///     handler still running when the flow ends is cancelled.
    /// - Throws: ``FlowError`` when the flow could not be presented, or could no longer be
    ///   drawn while it was shown.
    public func presentFlow(
        location: String, revision: Int? = nil, input: [String: FlowValue] = [:],
        actions: [String: FlowActionHandler] = [:]
    ) async throws -> FlowResult {
        guard options.enabled, !isShutDown else {
            throw FlowError.disabled
        }
        guard paywallsEnabled else {
            warn(FlowError.rendererMissing.description)
            throw FlowError.rendererMissing
        }
        let revision = revision ?? flowRevision(of: location)
        presentedFlowRevisions[location] = revision
        // Resolving the location waits for initialization, inside the coordinator, where
        // `dismissFlow()` and cancellation end the wait.
        // App Store messages wait while a flow is on screen.
        flowsOnScreen += 1
        do {
            let result = try await flowCoordinator().present(
                location: location, revision: revision, input: input, actions: actions)
            await flowLeftScreen()
            return result
        } catch {
            await flowLeftScreen()
            throw error
        }
    }

    #if canImport(UIKit)
        /// Presents the flow assigned to `location` from `viewController`, or from the top view
        /// controller of the key window when it is `nil`, and returns how it ended.
        ///
        /// - Throws: ``FlowError`` when the flow could not be presented.
        public func presentFlow(
            location: String, revision: Int? = nil, input: [String: FlowValue] = [:],
            actions: [String: FlowActionHandler] = [:], from viewController: UIViewController?
        ) async throws -> FlowResult {
            // Released only while it is still this call's: a presentation that replaces this
            // one names its own target before this call returns.
            let claim = presentationTarget.claim(viewController)
            defer { presentationTarget.release(claim) }
            return try await presentFlow(
                location: location, revision: revision, input: input, actions: actions)
        }
    #endif

    /// Changes inputs of the flow on screen, by name; the inputs it does not name keep their
    /// values. Does nothing when no flow is shown.
    public func updateFlowInput(_ values: [String: FlowValue]) async {
        guard options.enabled, paywallsEnabled, !isShutDown else {
            return
        }
        await flowCoordinatorStorage?.updateInput(values)
    }

    /// Closes the presented flow, and keeps a flow that is still loading from being shown; its
    /// ``presentFlow(location:revision:input:actions:)`` returns ``FlowResult/dismissed``.
    /// Returns once the flow has left the screen. It closes a flow of a client that was shut
    /// down as well.
    public func dismissFlow() async {
        guard options.enabled, paywallsEnabled else {
            return
        }
        // A shut-down client has a flow to close only if it ever presented one.
        await (isShutDown ? flowCoordinatorStorage : flowCoordinator())?.dismiss()
    }

    /// The revision of the interface at `location` the app is built against, as far as the
    /// client knows: the one the options name, else the one the location was last presented
    /// with in this process, else 0.
    private func flowRevision(of location: String) -> Int {
        return options.flowRevisions[location] ?? presentedFlowRevisions[location] ?? 0
    }

    /// Resolves the paywall assigned to `location` without presenting it.
    ///
    /// Cache-first with a 7 day lifetime and a 1 hour stale window, so a location the device has
    /// seen before resolves offline and, after a boot preload, with no request at all.
    ///
    /// Embedded hosts (for example the React Native SDK) use this together with their own
    /// presenter; the returned envelope carries everything a renderer needs.
    ///
    /// - Parameter revision: The revision of the location's interface the app was built
    ///   against. When `nil`, the one ``VoidhashOptions/flowRevisions`` names for the location,
    ///   else the one it was last presented with, else 0.
    public func getPaywall(location: String, revision: Int? = nil) async throws
        -> SdkResolvedPaywall?
    {
        return try await getPaywallState(location: location, revision: revision).value
    }

    /// ``getPaywall(location:revision:)`` with the freshness of the configuration it returned.
    public func getPaywallState(location: String, revision: Int? = nil) async throws
        -> Stale<SdkResolvedPaywall?>
    {
        guard options.enabled, paywallsEnabled, !isShutDown else {
            return Stale(value: nil)
        }
        guard await loadIdentity() else {
            return Stale(value: nil, isStale: true, isExpired: true)
        }
        _ = try await ensureInitialized()
        let revision = revision ?? flowRevision(of: location)
        let distinctId = await identityStore.getDistinctId()
        let engine = options.paywallRenderer?.engineCapabilities

        let unassigned = await cacheManager.get(
            VoidhashClient.unassignedPaywallCacheKey(
                distinctId: distinctId, location: location, engine: engine, revision: revision),
            as: Bool.self)
        let assigned =
            unassigned == nil
            ? await cacheManager.get(
                VoidhashClient.paywallCacheKey(
                    distinctId: distinctId, location: location, engine: engine,
                    revision: revision),
                as: SdkResolvedPaywall.self)
            : nil
        let cached: CachedPaywallState?
        if let unassigned {
            cached = CachedPaywallState(
                value: nil, isStale: unassigned.isStale, isExpired: unassigned.isExpired)
        } else if let assigned {
            cached = CachedPaywallState(
                value: assigned.value, isStale: assigned.isStale, isExpired: assigned.isExpired)
        } else {
            cached = nil
        }
        if cached?.value != nil {
            await rememberLocation(location)
        }

        if let cached, !cached.isStale {
            return Stale(value: cached.value, isStale: false, isExpired: cached.isExpired)
        }

        guard await canReachNetwork(), isRefreshDue(.paywall) else {
            try surfaceAuthFailureIfUnserved(hasCache: cached != nil)
            return Stale(
                value: cached?.value, isStale: true, isExpired: cached?.isExpired ?? true)
        }

        let refresh = Task {
            try await self.refreshPaywall(
                location: location, revision: revision, distinctId: distinctId)
        }
        if cached != nil, case .success(let fresh)? = await value(of: refresh, withinBudget: true) {
            return Stale(value: fresh)
        }
        if let cached {
            return Stale(value: cached.value, isStale: true, isExpired: cached.isExpired)
        }
        if case .success(let fresh)? = await value(of: refresh, withinBudget: false) {
            return Stale(value: fresh)
        }
        return Stale(value: nil, isStale: true, isExpired: true)
    }

    /// Resolves a location for presentation, distinguishing "nothing is assigned here" from
    /// "this device has never seen this location and cannot reach the backend".
    ///
    /// - Throws: ``FlowActionError`` in the second case, which the coordinator turns into
    ///   ``FlowError/unavailable``.
    private func resolvePaywallForPresentation(location: String, revision: Int) async throws
        -> SdkResolvedPaywall?
    {
        let state = try await getPaywallState(location: location, revision: revision)
        if state.value == nil, state.isExpired, state.isStale {
            throw FlowActionError(
                code: "FLOW_UNAVAILABLE",
                message:
                    "No cached configuration for \"\(location)\" and the backend is unreachable"
            )
        }
        return state.value
    }

    // Every paywall helper below checks `paywallsEnabled` itself, so no background caller can
    // resolve a location, remember it or warm a paywall that cannot be shown.
    @discardableResult
    private func refreshPaywall(
        location: String,
        revision: Int,
        distinctId: String
    ) async throws -> SdkResolvedPaywall? {
        guard paywallsEnabled else {
            return nil
        }
        let cacheKey = VoidhashClient.paywallCacheKey(
            distinctId: distinctId, location: location,
            engine: options.paywallRenderer?.engineCapabilities, revision: revision)
        return try await paywallFlight.run(key: cacheKey) { [weak self] in
            guard let self else {
                return nil
            }
            return try await self.fetchAndCachePaywall(
                location: location, revision: revision, distinctId: distinctId)
        }
    }

    private func fetchAndCachePaywall(
        location: String,
        revision: Int,
        distinctId: String
    ) async throws -> SdkResolvedPaywall? {
        guard paywallsEnabled else {
            return nil
        }
        let headers = headerFactory.build(distinctId: distinctId)
        let engine = options.paywallRenderer?.engineCapabilities
        let resolved: SdkResolvedPaywall?
        do {
            resolved = try await guarded("paywall.resolve") { [apiClient] in
                try await apiClient.resolvePaywall(
                    headers: headers, locationSlug: location, engine: engine,
                    interfaceRevision: revision)
            }
            refreshBackoff[.paywall] = nil
        } catch {
            backOffRefresh(.paywall, after: error)
            throw error
        }
        // An answer for an identity signed out or switched away from meanwhile must not come
        // back into the cache that change cleared.
        guard await identityStore.getDistinctId() == distinctId else {
            return resolved
        }
        // Stored under the engine and the interface revision the request reported, the ones the
        // answer was decided for.
        let assignedKey = VoidhashClient.paywallCacheKey(
            distinctId: distinctId, location: location, engine: engine, revision: revision)
        let unassignedKey = VoidhashClient.unassignedPaywallCacheKey(
            distinctId: distinctId, location: location, engine: engine, revision: revision)
        if let resolved {
            await cacheManager.set(
                assignedKey,
                value: resolved,
                ttl: VoidhashClient.paywallCacheTtlMilliseconds,
                staleTime: VoidhashClient.paywallCacheStaleTimeMilliseconds
            )
            await cacheManager.delete(unassignedKey)
        } else {
            await cacheManager.set(
                unassignedKey,
                value: true,
                ttl: VoidhashClient.paywallCacheTtlMilliseconds,
                staleTime: VoidhashClient.paywallCacheStaleTimeMilliseconds
            )
            await cacheManager.delete(assignedKey)
        }
        await rememberLocation(location)
        return resolved
    }

    /// Downloads the flow package a cached location points at.
    ///
    /// Best effort: a cached configuration whose assets never loaded would still render, just
    /// slower, so a failure here is reported without failing initialization.
    private func prefetchPaywallAssets(location: String, resolved: SdkResolvedPaywall?) async {
        guard paywallsEnabled, let release = resolved?.showing.paywallRelease else {
            return
        }
        do {
            try await flowCoordinator().preload(location: location, release: release)
        } catch {
            // The configuration is still cached and will render; only the warm start is lost.
            diagnostics.emit(
                .transport, code: "PAYWALL_ASSET_PREFETCH_FAILED", operation: "paywall.prefetch",
                retryable: true,
                message:
                    "Could not warm the paywall for \(location): \(error.localizedDescription)"
            )
        }
    }

    /// Records that this device resolved `location`, so the next launch preloads it.
    private func rememberLocation(_ location: String) async {
        guard paywallsEnabled, knownLocations.last != location else {
            return
        }
        knownLocations.removeAll { $0 == location }
        knownLocations.append(location)
        if knownLocations.count > VoidhashClient.maxKnownLocations {
            knownLocations.removeFirst(knownLocations.count - VoidhashClient.maxKnownLocations)
        }
        await cacheManager.set(VoidhashClient.knownLocationsCacheKey, value: knownLocations)
    }

    /// Adopts an externally supplied schema without a server round-trip.
    ///
    /// Escape hatch for preview and testing hosts; the next background refresh replaces it.
    public func injectInternalSchema(_ schema: RuntimeSchema) {
        publishSchema(schema)
    }

    // MARK: - Embedded-engine surface

    // Stateless data-plane operations for hosts embedding the client as their backend
    // transport, see `makeEmbedded`. Each takes the distinct id explicitly instead of reading
    // the persisted identity, so the host stays the single source of truth. On a disabled or
    // retired client each returns its inert value; the two that have none throw
    // `CONFIGURATION_MISSING`.

    private func headers(for distinctId: String) async -> [String: String] {
        return headerFactory.build(distinctId: distinctId)
    }

    /// Fetches the runtime schema. Deliberately does not run initialization: the embedded
    /// surface is data-plane only and must never start the store's transaction observer,
    /// which the host already owns.
    ///
    /// An embedded client always asks the backend, since its host caches the schema; so does a
    /// client that cannot read its own storage yet.
    public func fetchSchema(distinctId: String) async throws -> RuntimeSchema {
        guard options.enabled, !isShutDown else {
            return RuntimeSchema.empty
        }
        guard !dependencies.embedded, await loadIdentity() else {
            return try await apiClient.getSchema(headers: headers(for: distinctId))
        }
        return try await schemaManager.resolveSchema(headers: headers(for: distinctId))
    }

    /// Fetches the person snapshot; `nil` when the backend has none yet.
    public func fetchPerson(distinctId: String) async throws -> SdkPerson? {
        guard options.enabled, !isShutDown else {
            return nil
        }
        return try await apiClient.getPerson(headers: headers(for: distinctId))
    }

    /// Aliases `distinctId` onto `externalUserId` and returns the merged person.
    public func identifyPerson(
        distinctId: String,
        externalUserId: String,
        email: String?,
        name: String?
    ) async throws -> SdkPerson {
        guard options.enabled, !isShutDown else {
            throw VoidhashClient.inactiveClient
        }
        return try await apiClient.identify(
            headers: headers(for: distinctId),
            body: SdkIdentifyBody(distinctId: externalUserId, email: email, name: name)
        )
    }

    /// Writes person traits and returns the updated person. Non-finite numbers are sent as
    /// `null`.
    public func setPersonTraits(
        distinctId: String,
        traits: [String: JSONValue]
    ) async throws -> SdkPerson {
        guard options.enabled, !isShutDown else {
            throw VoidhashClient.inactiveClient
        }
        return try await apiClient.setPersonTraits(
            headers: headers(for: distinctId),
            body: SdkPersonTraitsBody(
                attributes: replacingNonFiniteNumbers(in: traits, operation: "person.traits"))
        )
    }

    /// Evaluates feature flags; `keys == nil` evaluates every flag.
    public func evaluateFeatureFlags(
        distinctId: String,
        keys: [String]?
    ) async throws -> [SdkFeatureFlagResult] {
        guard options.enabled, !isShutDown else {
            return []
        }
        let response = try await apiClient.evaluateFlags(
            headers: headers(for: distinctId), flagKeys: keys)
        return response.flags
    }

    /// Resolves the paywall assigned to `location`; `nil` when nothing is showing.
    public func resolvePaywallConfig(
        distinctId: String,
        locationSlug: String
    ) async throws -> SdkResolvedPaywall? {
        guard options.enabled, paywallsEnabled, !isShutDown else {
            return nil
        }
        return try await apiClient.resolvePaywall(
            headers: headers(for: distinctId), locationSlug: locationSlug,
            engine: options.paywallRenderer?.engineCapabilities)
    }

    /// Records a store transaction in the durable outbox and tries to sync it.
    ///
    /// The receipt is written to disk before any network call, so an outage or a process death
    /// between the store handing the transaction over and the backend recording it cannot lose
    /// the purchase. `false` means "not acknowledged yet", never "lost": the outbox retries on
    /// its own timer while the app is in the foreground, and on ``flush()``,
    /// ``syncPendingWork()``, a foreground, connectivity coming back and the next launch. A body
    /// whose intent is ``SdkSyncTransactionIntent/restore`` is delivered as an explicit restore.
    /// A disabled client returns `false` without recording anything.
    ///
    /// A receipt that could not be written is kept in memory, still sent, and reported as the
    /// `TRANSACTION_CAPTURE_NOT_DURABLE` diagnostic; the write is retried before the next drain.
    ///
    /// Once the receipt is captured the call waits on Voidhash for at most one request timeout,
    /// as ``purchase(_:options:)`` does: person writes queued ahead of the receipt, a drain
    /// already in flight and the send itself all count towards it. Past it the call returns
    /// `false` and delivery carries on in the background.
    @discardableResult
    public func syncStoreTransaction(
        _ body: SdkSyncTransactionBody,
        distinctId: String
    ) async throws -> Bool {
        guard options.enabled else {
            return false
        }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return try await successor.syncStoreTransaction(body, distinctId: distinctId)
        case .retired:
            if !(await outbox.stage(body, distinctId: distinctId)) {
                reportCaptureNotDurable(
                    body.transactionId, operation: "syncStoreTransaction",
                    reason: "it could not be written to storage")
            }
            return false
        case .held:
            reportCaptureNotDurable(
                body.transactionId, operation: "syncStoreTransaction",
                reason: "storage is unreadable until the device is unlocked; it is held in memory")
            holdUntilStateLoads { client in
                _ = try? await client.syncStoreTransaction(body, distinctId: distinctId)
            }
            return false
        }
        if !(await outbox.stage(body, distinctId: distinctId)) {
            reportCaptureNotDurable(
                body.transactionId, operation: "syncStoreTransaction",
                reason: "it could not be written to storage; it is kept in memory and retried")
        }
        let delivery = Task<OutboxDrainResult, any Error> { [outbox] in await outbox.drain() }
        let deadline = Task { [wait = requestTimeoutDeadline(1)] in await wait() }
        defer { deadline.cancel() }
        // A cancelled caller stops waiting at once, as one past the deadline does.
        let outcome = await withTaskCancellationHandler {
            await firstOutcome(of: delivery, before: deadline)
        } onCancel: {
            deadline.cancel()
        }
        guard case .success(let result)? = outcome else {
            return false
        }
        // Strictly this transaction: a drain that happened to deliver an older receipt says
        // nothing about the one the caller just handed over.
        let accepted = result.didAcknowledge(body.transactionId)
        if accepted {
            scheduleGrantRefresh()
        }
        return accepted
    }

    /// Receipts still waiting for a backend acknowledgement; `0` on a disabled or retired
    /// client, and while its storage is unreadable before the first unlock.
    public func pendingTransactionCount() async -> Int {
        guard options.enabled, !isShutDown, await loadIdentity() else {
            return 0
        }
        return await outbox.pendingCount()
    }

    /// Drains the queued person writes, the transaction outbox and then the analytics queue,
    /// without waiting out the retry backoff, for hosts that want to force a sync.
    ///
    /// Sends nothing on a disabled or retired client, or while its storage is unreadable. Waits
    /// on Voidhash for at most 2 seconds, as ``flush()`` does; delivery carries on in the
    /// background.
    @discardableResult
    public func syncPendingWork() async -> FlushStatus {
        guard options.enabled, !isShutDown, await loadIdentity() else {
            return FlushStatus(flushed: 0, pending: 0)
        }
        return await waitBriefly(for: Task { await self.drainPendingWork(freshEvidence: true) })
    }

    /// Waits on `delivery` for at most the awaited-call budget. Past it the delivery carries on
    /// in the background, and the status reports what the analytics queue still holds.
    private func waitBriefly(for delivery: Task<FlushStatus, any Error>) async -> FlushStatus {
        let budget = dependencies.awaitedCallBudgetMilliseconds
        let sleep = dependencies.budgetSleep
        let deadline = Task { await sleep(budget) }
        defer { deadline.cancel() }
        if case .success(let status)? = await firstOutcome(of: delivery, before: deadline) {
            return status
        }
        return FlushStatus(
            flushed: 0, pending: await analytics.queueLength(),
            lastError:
                "Voidhash did not answer within 2 seconds; delivery continues in the background")
    }

    /// Delivers what the durable queues hold: person writes first, so a receipt captured under an
    /// anonymous id lands after the identify that merges that id, then receipts, since the user's
    /// access waits on them, then analytics.
    ///
    /// - Parameter freshEvidence: The caller has news that the backend may be reachable again (a
    ///   flush, a foreground, connectivity coming back, a probe that got through), so work only
    ///   waiting out the retry backoff goes now.
    /// - Returns: The analytics queue's status.
    @discardableResult
    private func drainPendingWork(freshEvidence: Bool) async -> FlushStatus {
        if freshEvidence {
            await personWrites.endBackoff()
            await outbox.endBackoff()
            await analytics.endBackoff()
        }
        await drainPersonWrites()
        await outbox.drain()
        return await analytics.flush()
    }

    /// Delivers the queued identify and person-trait writes through the gate and the breaker,
    /// then arms the retry timer for what is left.
    private func drainPersonWrites() async {
        guard !isShutDown else {
            return
        }
        let result = await personWrites.drain(
            identify: { [weak self] write in
                guard let self else {
                    throw CancellationError()
                }
                try await self.deliverQueuedIdentify(write)
            },
            setTraits: { [weak self] write in
                guard let self else {
                    throw CancellationError()
                }
                try await self.deliverQueuedTraits(write)
            })
        // A merge that will never happen must not keep answering reads with the snapshot carried
        // over for it.
        for target in result.rejectedIdentifyTargets {
            await cacheManager.delete(Self.personCacheKey(target))
            await cacheManager.deleteByPrefix("flags:\(target):")
        }
        await armPersonWriteRetry()
    }

    private func deliverQueuedIdentify(_ write: PersonWrite) async throws {
        guard let alias = write.alias else {
            throw VoidhashApiError.requestEncodingFailed("A queued identify carries no alias")
        }
        personWriteGenerations[write.target, default: 0] += 1
        defer { personWriteGenerations[write.target, default: 0] += 1 }
        let person = try await guarded("person.identify", drainsPersonWrites: false) {
            [apiClient, headerFactory] in
            try await apiClient.identify(
                headers: headerFactory.build(distinctId: alias),
                body: SdkIdentifyBody(
                    distinctId: write.target, email: write.email, name: write.name)
            )
        }
        // A sign-out or another identify since the write was queued owns the identity now.
        guard await identityStore.getDistinctId() == write.target else {
            return
        }
        lastIdentifiedId = write.target
        await cachePerson(person, distinctId: write.target)
        Task { [weak self] in
            _ = try? await self?.refreshFlags(keys: nil)
        }
    }

    private func deliverQueuedTraits(_ write: PersonWrite) async throws {
        // A withdrawal takes a queued agreement to ad data sharing out of the queue; one it could
        // not reach, claimed for a send or on a store not yet readable, is not sent without
        // consent either. Returning settles a write that holds nothing else.
        var traits = write.traits
        if analyticsConsentState.value != .granted,
            let sharing = traits[PersonWrite.adDataSharingTrait], sharing != .bool(false)
        {
            traits[PersonWrite.adDataSharingTrait] = nil
            guard !traits.isEmpty else {
                return
            }
        }
        personWriteGenerations[write.target, default: 0] += 1
        defer { personWriteGenerations[write.target, default: 0] += 1 }
        let person = try await guarded("person.traits", drainsPersonWrites: false) {
            [apiClient, headerFactory, traits] in
            try await apiClient.setPersonTraits(
                headers: headerFactory.build(distinctId: write.target),
                body: SdkPersonTraitsBody(attributes: traits))
        }
        guard await identityStore.getDistinctId() == write.target else {
            return
        }
        await cachePerson(person, distinctId: write.target)
    }

    /// Drains the person writes off the caller's task when one of them could go now.
    private func kickPersonWriteDrain() {
        guard stateLoaded.value, !isShutDown else {
            return
        }
        Task { [weak self] in
            await self?.drainDuePersonWrites()
        }
    }

    /// Drains the person writes when one of them could go now. Every receipt drain runs it
    /// first, so a receipt lands after the identify merging the identity it was captured under.
    private func drainDuePersonWrites() async {
        guard stateLoaded.value, !isShutDown, await personWrites.hasDueWrites() else {
            return
        }
        await drainPersonWrites()
    }

    /// Arms the timer that drains the person writes once the next of them may go, while the app
    /// is in the foreground: when the backoff after a failed delivery ends, or when the circuit
    /// breaker that refused one lets a probe through.
    ///
    /// Nothing is armed when nothing is queued, or while a rejected key pauses traffic: the probe
    /// that lifts the pause drains them.
    private func armPersonWriteRetry() async {
        guard dependencies.runBackgroundRefreshes, !isShutDown, !gate.isPaused,
            let nextAttemptAt = await personWrites.nextAttemptAt()
        else {
            return
        }
        let breakerReopensAt = await breaker.nextAttemptAt(
            host: VoidhashClient.host(of: options.baseUrl))
        let delay = max(
            nextAttemptAt - clock.now(),
            (breakerReopensAt ?? 0) - clock.monotonicNow(),
            NetworkPolicy.minRetryAfterMilliseconds)
        scheduler.schedule(
            .personWrites,
            at: clock.monotonicNow() + min(delay, NetworkPolicy.maxPostponementMilliseconds)
        ) { [weak self] in
            await self?.drainPersonWrites()
        }
    }

    /// Arms the timer that drains the receipt outbox once its next receipt may go, while the app
    /// is in the foreground: when the backoff after a failed delivery ends, or when the circuit
    /// breaker that refused one lets a probe through.
    ///
    /// Called after every drain. Nothing is armed when no receipt could go (none is queued, or only
    /// parked ones), or while a rejected key pauses traffic: the probe that lifts the pause drains
    /// the outbox.
    private func armReceiptRetry() async {
        guard dependencies.runBackgroundRefreshes, !isShutDown, !gate.isPaused,
            let nextAttemptAt = await outbox.nextAttemptAt()
        else {
            return
        }
        let breakerReopensAt = await breaker.nextAttemptAt(host: transactionsBreakerHost)
        let delay = max(
            nextAttemptAt - clock.now(),
            (breakerReopensAt ?? 0) - clock.monotonicNow(),
            NetworkPolicy.minRetryAfterMilliseconds)
        scheduler.schedule(
            .receipts,
            at: clock.monotonicNow() + min(delay, NetworkPolicy.maxPostponementMilliseconds)
        ) { [weak self] in
            await self?.retryReceipts()
        }
    }

    /// Finishes the store transactions whose receipts a drain delivered after the call that
    /// handed them over had returned, such as a purchase that ended deferred during an outage.
    /// Observer mode and a host's claim leave a transaction unfinished, as for a scan.
    private func finishDeliveredTransactions(_ transactionIds: Set<String>) async {
        guard !transactionIds.isEmpty, !isShutDown, storeConnected else {
            return
        }
        await orchestrator().finishDelivered(
            transactionIds, schema: currentSchema ?? RuntimeSchema.empty)
    }

    /// The receipt timer's drain; finishing it arms the next timer when receipts are still waiting.
    private func retryReceipts() async {
        guard !isShutDown else {
            return
        }
        await outbox.drain()
    }

    /// Refreshes the person and waits for it, for the calls a host awaits before it reads
    /// entitlements (a restore, a sync, a purchase), then schedules the follow-up refreshes.
    ///
    /// Runs whether or not background refreshes do, and never fails the call: the request timeout
    /// and the circuit breaker bound it, and without an answer the snapshot the accepted receipt
    /// marked stale is served as such.
    private func refreshPersonAfterPurchase() async {
        // A refresh the purchase left running past its deadline must not act for a client that
        // was retired meanwhile.
        guard !isShutDown else {
            return
        }
        _ = try? await refreshPerson()
        scheduleGrantRefreshes(afterDelays: [2000, 3000])
    }

    /// Refreshes the person off the caller's task after the backend accepted a receipt the store
    /// observer or the host reported, followed by the same follow-ups.
    private func scheduleGrantRefresh() {
        scheduleGrantRefreshes(afterDelays: [0, 2000, 3000])
    }

    // A grant can land a moment after the backend accepted the receipt that bought it, so the
    // person read straight after the ack may still predate it. Refreshes spaced by these delays,
    // at 2 s and 5 s after the first like the other SDKs, absorb that without a poll loop, off the
    // caller's task so nothing the host awaits waits on them. A new series replaces the one
    // running, so an ack reported by both the drain and the purchase flow costs one series.
    private func scheduleGrantRefreshes(afterDelays delays: [Double]) {
        guard dependencies.runBackgroundRefreshes, !isShutDown else {
            return
        }
        grantRefreshes?.cancel()
        grantRefreshes = Task { [weak self, clock] in
            for delay in delays {
                if delay > 0 {
                    await clock.sleep(milliseconds: delay)
                }
                guard !Task.isCancelled, let self, !self.isShutDown else {
                    return
                }
                _ = try? await self.refreshPerson()
            }
        }
    }

    /// Makes what is cached for the person `distinctId` read as stale, and keeps a person read
    /// already in flight from caching its answer, after the backend accepted a receipt sent under
    /// it or under the identity merged into it: the grant it bought postdates both.
    ///
    /// Whichever drain delivered the receipt (a purchase, a flush, a retry timer, a foreground),
    /// the person is then refreshed in the background, and a read no longer waits out the backoff
    /// of reads that failed before: the answer just in shows the backend is reachable.
    private func noteReceiptAccepted(sentUnder distinctId: String) async {
        let current = await identityStore.getDistinctIdFromCache()
        for id in Set([distinctId, current].compactMap { $0 }) {
            personWriteGenerations[id, default: 0] += 1
            let personKey = Self.personCacheKey(id)
            if let hit = await cacheManager.get(personKey, as: SdkPerson.self), !hit.isStale {
                await cacheManager.setStale(personKey, value: hit.value, expiresAt: hit.expiresAt)
            }
            let missingKey = Self.missingPersonCacheKey(id)
            if let hit = await cacheManager.get(missingKey, as: Bool.self), !hit.isStale {
                await cacheManager.setStale(missingKey, value: hit.value, expiresAt: hit.expiresAt)
            }
        }
        if refreshBackoff[.person]?.requestedByServer == false {
            refreshBackoff[.person] = nil
        }
        scheduleGrantRefresh()
    }

    /// Fetches the schema for ``SchemaManager`` under the same admission as the other reads:
    /// nothing is sent while a rejected key pauses traffic, a rejection pauses it, and the fetch
    /// takes a permit from, and counts towards, the circuit breaker of the host's reads. Its
    /// outcome drives the schema's read backoff; the manager reports the failures.
    private func fetchGuardedSchema(headers: [String: String]) async throws -> RuntimeSchema {
        do {
            let schema = try await guarded("schema.refresh", reportsTransportFailure: false) {
                [apiClient] in
                try await apiClient.getSchema(headers: headers)
            }
            refreshBackoff[.schema] = nil
            return schema
        } catch {
            backOffRefresh(.schema, after: error)
            throw error
        }
    }

    /// Asks the backend to sign a promotional offer under the same admission as the other
    /// requests: nothing is sent while a rejected key pauses traffic or the circuit breaker of
    /// the host is open, and the outcome counts towards that breaker.
    private func signGuardedOffer(
        headers: [String: String], body: SdkPromotionalOfferSignatureBody
    ) async throws -> SdkPromotionalOfferSignature {
        return try await guarded("purchase.offer") { [apiClient] in
            try await apiClient.signPromotionalOffer(headers: headers, body: body)
        }
    }

    /// Records a development purchase through the development gateway.
    ///
    /// - Returns: Whether the backend explicitly accepted the simulated transaction.
    public func recordDevelopmentPurchase(
        _ body: SdkDevelopmentPurchaseBody,
        distinctId: String
    ) async throws -> Bool {
        guard options.enabled, !isShutDown else {
            return false
        }
        return try await apiClient.developmentPurchase(
            headers: headers(for: distinctId), body: body)
    }

    // MARK: - Internals

    /// Adopts a schema resolved outside ``runInitialization`` — the stale-while-revalidate
    /// refresh — so a warm-cache session stops running on the stale schema.
    private func publishSchema(_ schema: RuntimeSchema) {
        // A schema the host gave stays: a cached or fetched one never replaces it.
        if schemaIsFixed, currentSchema != nil, schema != currentSchema {
            return
        }
        currentSchema = schema
        (engine as? DevelopmentStoreEngine)?.updateCatalog(schema)
        if hostEvents.isActive, let json = VoidhashClient.schemaJson(schema) {
            hostEvents.emit(.schema(json))
        }
    }

    static func schemaJson(_ schema: RuntimeSchema) -> String? {
        guard let data = try? JSONEncoder().encode(schema) else {
            return nil
        }
        return String(decoding: data, as: UTF8.self)
    }

    /// Awaits the running initialization, dropping it when it fails so the next call retries.
    ///
    /// Returns the current schema without waiting on a client that does not initialize: disabled,
    /// embedded or retired. Before the first unlock it starts initialization, which completes once
    /// the device is unlocked, and returns without waiting for it.
    private func ensureInitialized() async throws -> RuntimeSchema {
        guard options.enabled, !isShutDown, !dependencies.embedded else {
            return currentSchema ?? RuntimeSchema.empty
        }
        let task = ensureInitializationTask()
        guard await loadIdentity() else {
            return currentSchema ?? RuntimeSchema.empty
        }
        do {
            _ = try await task.value
        } catch {
            forgetFailedInitializationTask(task)
            throw error
        }
        // A background refresh that landed after initialization already published a newer schema;
        // returning the memoized one would pin the session to the cold-start placeholder.
        return currentSchema ?? RuntimeSchema.empty
    }

    private func ensureInitializationTask() -> Task<RuntimeSchema, any Error> {
        hasStarted = true
        if let initializationTask {
            return initializationTask
        }
        let task = Task { try await self.runInitialization() }
        initializationTask = task
        return task
    }

    // Only clears the failure that was actually awaited: a caller that lost the race must not
    // discard the fresh initialization another caller already started.
    private func forgetFailedInitializationTask(_ task: Task<RuntimeSchema, any Error>) {
        if initializationTask == task {
            initializationTask = nil
        }
    }

    private func runInitialization() async throws -> RuntimeSchema {
        // Before the first unlock this waits for the device to be unlocked, however long that is.
        await identityInitializationTask.value
        // A shutdown that landed while this was suspended means the client was replaced; it
        // must not come back to life on its own (see `start()`), nor fail a caller for it.
        guard options.enabled, stateLoaded.value, !isShutDown else {
            return currentSchema ?? RuntimeSchema.empty
        }
        await publishLoadedPerson()

        // Analytics, lifecycle observation and connectivity come up first and unconditionally.
        // Everything below them can fail on a cold-cache offline launch, and none of it is a
        // reason for the app to lose a session's worth of events. Each subscription is guarded:
        // a `shutdown()` that landed while this was suspended means the client was replaced,
        // and a replaced client must not come back to life on its own.
        let launchState = await dependencies.lifecycleObserver.currentState()
        // Retired while asking the application: the replacing client owns the persisted state.
        guard !isShutDown else {
            return currentSchema ?? RuntimeSchema.empty
        }
        let startupWrites = Task {
            // What an earlier process collected before consent went away, or before the app
            // started passing a denying option, is never sent.
            if self.analyticsConsentState.value != .granted {
                await self.discardCollectedAnalytics()
            }
            if self.options.automaticLifecycleEvents {
                await self.captureStartupEvents(launchState: launchState)
            }
        }
        self.startupWrites = startupWrites
        await startupWrites.value
        // Observed whether or not lifecycle events are captured: the app's state also decides when
        // the SDK recovers (the foreground refresh), persists and flushes (backgrounding) and runs
        // its timers. Observation starts the flush loop and the timers when the app is in the
        // foreground.
        if !isShutDown {
            await observeLifecycle(launchState: launchState)
        }
        if !isShutDown {
            observeConnectivity()
        }
        startInstallAttribution()

        let schema: RuntimeSchema
        if let currentSchema {
            schema = currentSchema
        } else {
            schema = await schemaManager.resolveSchemaTolerant(
                headers: await headerFactory.build())
        }
        if currentSchema == nil {
            currentSchema = schema
        }

        knownLocations = VoidhashClient.normalizeKnownLocations(
            await cacheManager.get(
                VoidhashClient.knownLocationsCacheKey, as: [String].self)?.value ?? [])

        if dependencies.runBackgroundRefreshes {
            Task { [weak self] in
                await self?.runBootRefresh()
            }
        }

        Task { [weak self] in
            await self?.connectAndReconcileStore()
        }

        // A launch in the background observes them from its first activation instead.
        if launchState != LifecycleTracker.background {
            observeCrashDiagnostics()
        }

        return currentSchema ?? schema
    }

    /// Subscribes to the crash reports the operating system delivers, once the client has started
    /// and the app is in the foreground. A launch in the background, for a push or a fetch, neither
    /// reaches MetricKit nor opens an analytics session for a report.
    private func observeCrashDiagnostics() {
        guard options.automaticLifecycleEvents, crashSubscription == nil, !isShutDown else {
            return
        }
        crashSubscription = dependencies.crashDiagnostics.subscribe {
            [weak self, lifecycleQueue] crashes in
            guard let self else {
                return
            }
            lifecycleQueue.enqueue { await self.reportCrashes(crashes) }
        }
    }

    /// Captures `$app_crashed` for the reports newer than the marker, then moves it to the newest.
    ///
    /// Only the marker as it was before this delivery counts: the crashes of one report share its
    /// time window, and each is reported. The event time is the report's window, not the delivery,
    /// which can be much later, and its version the one the report names.
    private func reportCrashes(_ crashes: [CrashDiagnostic]) async {
        guard !isShutDown, analyticsConsentState.value == .granted else {
            return
        }
        let reportedUpTo =
            await cacheManager.get(VoidhashClient.lastReportedCrashCacheKey, as: Double.self)?.value
            ?? 0
        let unreported = crashes.filter { $0.occurredAt > reportedUpTo }
        guard let newest = unreported.map(\.occurredAt).max() else {
            return
        }
        let now = dependencies.analyticsNow()
        for crash in unreported {
            await analytics.capture(
                AutomaticEvents.appCrashed, properties: ["crash_kind": .string("crash")],
                capturedAt: min(crash.occurredAt, now), appVersion: crash.appVersion)
        }
        // As with the app release: the marker must never reach storage ahead of the events.
        await analytics.persist()
        guard analyticsConsentState.value == .granted else {
            return
        }
        await cacheManager.set(VoidhashClient.lastReportedCrashCacheKey, value: newest)
    }

    private func connectAndReconcileStore() async {
        guard options.enabled, !isShutDown else { return }
        do {
            try await ensureStoreConnected()
        } catch {
            warn("Failed to connect to the store: \(error)")
            diagnostics.emit(
                .transport, code: "STORE_CONNECTION_FAILED", operation: "client.initialize",
                retryable: true, message: String(describing: error))
            return
        }
        observeAppStoreEvents()
        await reconcileStore()
        // Once a launch, after the scan read what it needed: the markers left behind by earlier
        // sessions mean nothing once they expire.
        await cacheManager.deleteExpiredEntries(
            withPrefix: PurchaseOrchestrator.processedCacheKey(""))
        await cacheManager.deleteExpiredEntries(
            withPrefix: PurchaseOrchestrator.restoredIdentityCacheKeyPrefix)
    }

    private func ensureStoreConnected() async throws {
        guard options.enabled, !isShutDown else {
            throw VoidhashStoreError.storeKitNotInitialized
        }
        if storeConnected { return }
        if let storeConnectionTask {
            return try await storeConnectionTask.value
        }
        let listener: StoreKitTransactionListener = { [weak self] storeTransaction in
            guard let self else { return }
            Task { await self.handleObservedTransaction(storeTransaction) }
        }
        let task = Task {
            _ = try await engine.initConnection(onTransaction: listener)
            // A shutdown that landed while the connection opened found nothing to end.
            guard !isShutDown else {
                _ = try? await engine.endConnection()
                throw VoidhashStoreError.storeKitNotInitialized
            }
            storeConnected = true
        }
        storeConnectionTask = task
        defer { storeConnectionTask = nil }
        try await task.value
    }

    private func reconcileStore() async {
        guard options.enabled, !isShutDown else { return }
        do {
            try await ensureStoreConnected()
            try await orchestrator().reconcileObservedTransactions(
                schema: currentSchema ?? RuntimeSchema.empty)
        } catch {
            warn("Failed to reconcile observed transactions: \(error)")
            diagnostics.emit(
                .transport, code: "STORE_RECONCILIATION_FAILED", operation: "syncPurchases",
                retryable: true, message: String(describing: error))
        }
    }

    /// Warms everything the app is likely to ask for, in the order it is likely to ask.
    ///
    /// Runs after local state is loaded and never blocks a caller: `waitForInitialization` has
    /// already returned by the time this makes its first request.
    private func runBootRefresh() async {
        guard options.enabled, !isShutDown else {
            return
        }
        let canRefresh = await canReachNetwork()
        if canRefresh {
            await drainPendingWork(freshEvidence: false)
            _ = try? await refreshPerson()
            _ = try? await refreshFlags(keys: nil)
            // The launch's own schema resolve asked already; right behind a failure it would only
            // fail again.
            await schemaManager.awaitBackgroundRefresh()
            if isRefreshDue(.schema) {
                await refreshSchemaIfNeeded()
            }
        }

        // While no flow can be shown there is nothing to resolve or warm: no request per
        // location, no package download on the launch path.
        guard paywallsEnabled else {
            return
        }
        var locations = options.preloadLocations
        for location in knownLocations where !locations.contains(location) {
            locations.append(location)
        }
        let distinctId = await identityStore.getDistinctId()
        for location in locations {
            let revision = flowRevision(of: location)
            let refreshed =
                canRefresh
                ? try? await refreshPaywall(
                    location: location, revision: revision, distinctId: distinctId) : nil
            let resolved: SdkResolvedPaywall?
            if let refreshed {
                resolved = refreshed
            } else {
                resolved = await cacheManager.get(
                    VoidhashClient.paywallCacheKey(
                        distinctId: distinctId, location: location,
                        engine: options.paywallRenderer?.engineCapabilities, revision: revision),
                    as: SdkResolvedPaywall.self
                )?.value
            }
            await prefetchPaywallAssets(location: location, resolved: resolved)
        }
    }

    // Mirrors `captureAutomaticStartupEvents` in the React Native SDK. The adapter cannot
    // fail, so a present-but-undecodable entry is the degraded case: it costs the
    // install/update event, never the `$app_opened` that marks the session.
    //
    // `$app_opened` belongs to the process's first foreground. A process launched in the
    // background, for a push, a background fetch or a location update, opens nothing until the
    // user brings the app up; `handleLifecycleState` reports it then.
    //
    // Without analytics consent the install marker is left alone, so the check runs once consent
    // is granted; the process's open is still spent, so a grant later in the session reports none.
    private func captureStartupEvents(launchState: String?) async {
        let appOpened =
            launchState != LifecycleTracker.background
            && !dependencies.appOpenedInProcess.exchange(true)
        guard analyticsConsentState.value == .granted else {
            appReleaseCheckDeferred = true
            if appOpened {
                await record(AutomaticEvents.appOpened, capturedAt: dependencies.analyticsNow())
            }
            return
        }
        await captureAppReleaseEvents(appOpened: appOpened)
    }

    /// Captures `$app_installed` or `$app_updated` when the release differs from the one the
    /// marker records, and `$app_opened` when asked, then moves the marker to this release.
    ///
    /// - Parameter capturedAt: When the events happened, for a check a launch without consent
    ///   left to the grant; `nil` for now.
    private func captureAppReleaseEvents(appOpened: Bool, capturedAt: Double? = nil) async {
        let current = AppReleaseInfo(
            appBuild: dependencies.device.appBuild ?? "",
            appVersion: dependencies.device.appVersion ?? ""
        )
        let key = VoidhashClient.lastSeenAppReleaseCacheKey
        // Read the raw entry first: a corrupt one is dropped by the decode below, and an install
        // event must not be attributed to a device that simply had an unreadable envelope.
        let hasEntry = await cacheAdapter.get(key) != nil
        let previous = await cacheManager.get(key, as: AppReleaseInfo.self)?.value

        var eventNames: [String] = []
        if let previous {
            if previous != current {
                eventNames.append(AutomaticEvents.appUpdated)
            }
        } else if !hasEntry {
            eventNames.append(AutomaticEvents.appInstalled)
        }
        if appOpened {
            eventNames.append(AutomaticEvents.appOpened)
        }

        let capturedAt = capturedAt ?? dependencies.analyticsNow()
        for eventName in eventNames {
            await analytics.capture(eventName, properties: [:], capturedAt: capturedAt)
        }
        // The marker must never reach storage ahead of the event it records: a crash in between
        // would lose the install or update for good, since the next launch trusts the marker.
        await analytics.persist()
        // Consent withdrawn meanwhile dropped the events; the check waits for the next grant.
        guard analyticsConsentState.value == .granted else {
            appReleaseCheckDeferred = true
            return
        }
        await cacheManager.set(VoidhashClient.lastSeenAppReleaseCacheKey, value: current)
    }

    /// Subscribes to application state transitions after applying the state the app is in now.
    ///
    /// Both go through the lifecycle queue, the launch state first, so a transition that arrives
    /// meanwhile is applied after it.
    private func observeLifecycle(launchState: String?) async {
        guard lifecycleSubscription == nil, !isShutDown else {
            return
        }
        let launch = lifecycleQueue.submit { await self.applyLaunchState(launchState) }
        lifecycleSubscription = dependencies.lifecycleObserver.subscribe { [weak self, lifecycleQueue] state in
            guard let self else {
                return
            }
            lifecycleQueue.enqueue { await self.handleLifecycleState(state) }
        }
        _ = try? await launch.value
    }

    /// Starts the foreground work unless the app was launched in the background, where the
    /// user's first activation is then a real `$app_became_active`.
    private func applyLaunchState(_ state: String?) async {
        guard state != LifecycleTracker.background else {
            lifecycleTracker = LifecycleTracker(previousState: LifecycleTracker.background)
            return
        }
        await startForegroundWork()
    }

    private func handleLifecycleState(_ state: String) async {
        // Transitions queued before the subscription was cancelled belong to a replaced client.
        guard !isShutDown else {
            return
        }
        // The lifecycle event is captured before any network work: a foreground refresh that
        // waits on a dead backend must not delay — or, on a kill, lose — `$app_became_active`.
        let transitionEvent = lifecycleTracker.transition(to: state)
        if options.automaticLifecycleEvents {
            // The first activation of a process launched in the background is its `$app_opened`,
            // reported in place of `$app_became_active`.
            let now = dependencies.analyticsNow()
            if state == LifecycleTracker.active, !dependencies.appOpenedInProcess.exchange(true) {
                await record(AutomaticEvents.appOpened, capturedAt: now)
            } else if let transitionEvent {
                await record(transitionEvent, capturedAt: now)
            }
        }
        if state == LifecycleTracker.background {
            scheduler.suspend()
            // The persist-behind window is the only place events live in memory alone; close it
            // before the process can be suspended or killed.
            await analytics.persist()
            // Everything queued is worth sending while the platform still grants execution time:
            // identify calls and traits, receipts, then analytics. It runs off the lifecycle
            // queue so a quick return to the foreground is not held up.
            Task { [runner = dependencies.backgroundTaskRunner] in
                await runner.run("com.voidhash.analytics.flush") {
                    _ = await self.drainPendingWork(freshEvidence: false)
                }
            }
            // Nothing wakes a backgrounded process on the SDK's behalf; the loop and the timers
            // come back with the app.
            await analytics.stopAutoFlush()
        }
        if state == LifecycleTracker.active {
            await startForegroundWork()
            observeCrashDiagnostics()
            await showHeldMessages()
            Task { [weak self] in
                await self?.handleForeground()
            }
        }
    }

    /// Starts what runs only while the app is in the foreground: the recovery timers, re-armed
    /// for work still pending, and the periodic analytics flush.
    private func startForegroundWork() async {
        guard !isShutDown else {
            return
        }
        scheduler.resume()
        scheduleAuthProbe()
        await armReadsAfterCircuit()
        await armPersonWriteRetry()
        await armReceiptRetry()
        if dependencies.startAutoFlush {
            await analytics.startAutoFlush()
        }
    }

    /// Sends and finishes a transaction the store reported on its own, then tells
    /// ``transactionUpdates()``, unless ``purchase(_:options:)`` returned it already or it is no
    /// purchase: a refund or revocation, or a subscription the user upgraded from, which the
    /// store reports again with the change.
    private func handleObservedTransaction(_ storeTransaction: StoreKitTransactionInfo) async {
        // The replacing client observes the same transaction through its own connection.
        guard !isShutDown, let schema = currentSchema else {
            return
        }
        var synced = false
        do {
            synced = try await orchestrator().processObservedTransaction(
                ReceiptTransaction(storeTransaction: storeTransaction), schema: schema)
        } catch {
            warn(
                "Failed to process the observed transaction \(storeTransaction.transactionId): \(error)"
            )
        }
        guard !boughtHere.contains(storeTransaction.transactionId),
            storeTransaction.appStore.revocationDate == nil, !storeTransaction.appStore.isUpgraded
        else {
            return
        }
        announceTransaction(
            VoidhashTransactionUpdate(
                transaction: VoidhashTransaction(storeTransaction, schema: schema), synced: synced))
    }

    /// Delivers a receipt already persisted by `reportTransaction` without letting a transport or
    /// backend failure escape the host's purchase callback.
    private func deliverReportedTransaction(
        _ transaction: ReceiptTransaction,
        schema: RuntimeSchema,
        restoreDistinctId: String?
    ) async {
        guard !isShutDown else { return }
        do {
            try await orchestrator().reportTransaction(
                transaction, schema: schema, restoreDistinctId: restoreDistinctId)
        } catch is CancellationError {
            return
        } catch {
            warn("Failed to deliver reported transaction \(transaction.transactionId): \(error)")
            diagnostics.emit(
                .transport,
                code: "TRANSACTION_SYNC_DEFERRED",
                operation: "reportTransaction",
                retryable: true,
                message: "Receipt remains queued: \(error)"
            )
        }
    }

    // MARK: - Lifetime and persisted state

    /// How a write reaches persisted state.
    private enum WriteRoute {
        /// The persisted identity has loaded: the write applies to this client.
        case direct
        /// This client was retired: the write belongs to the client that replaced it.
        case forward(VoidhashClient)
        /// This client was retired and nothing replaced it over the same storage.
        case retired
        /// Protected data is unavailable: the write waits in memory for the persisted identity.
        case held
    }

    /// Raised by an internal refresh on a client that cannot use its persisted identity. Nothing
    /// was sent.
    private static let identityUnavailable = VoidhashApiError(
        code: "IDENTITY_UNAVAILABLE",
        message: "The persisted identity is not available to this client", isLocal: true)

    /// Raised by the embedded calls that have no inert value, on a disabled or retired client.
    private static let inactiveClient = VoidhashStoreError(
        code: "CONFIGURATION_MISSING", message: "The client is disabled or was replaced")

    private nonisolated var isShutDown: Bool {
        return retirement.value
    }

    /// Waits for the persisted identity to load and returns whether this client may use it.
    ///
    /// `false` on a retired client, and while protected data is unavailable before the first
    /// unlock: no call waits that out, since it can last as long as the device stays locked.
    private func loadIdentity() async -> Bool {
        if !stateLoaded.value {
            guard await protectedDataProbe.value else {
                return false
            }
            await identityInitializationTask.value
        }
        return stateLoaded.value && !isShutDown
    }

    private func writeRoute() async -> WriteRoute {
        if await loadIdentity() {
            return .direct
        }
        guard isShutDown else {
            return .held
        }
        return successor().map(WriteRoute.forward) ?? .retired
    }

    /// The client that replaced this one over the same storage: the one that took it over, or
    /// ``Voidhash/shared``, when it is live, enabled and configured with the same publishable key
    /// and API origin.
    private func successor() -> VoidhashClient? {
        return [VoidhashClient.storageOwners.owner(of: namespace), Voidhash.shared]
            .compactMap { $0 }
            .first { client in
                client !== self && !client.isShutDown && client.options.enabled
                    && client.namespace == namespace
            }
    }

    /// Queues `write` to run, in order with the other held writes, once persisted state has
    /// loaded; on a client retired meanwhile it is routed as any write to a retired client.
    ///
    /// - Parameter isCapture: The write is an analytics capture. The device can stay locked for
    ///   as long as the process lives, so at most ``maxHeldCaptures`` of them are held.
    private func holdUntilStateLoads(
        isCapture: Bool = false, _ write: @escaping @Sendable (VoidhashClient) async -> Void
    ) {
        heldWrites.append(HeldWrite(isCapture: isCapture, apply: write))
        if isCapture {
            heldCaptureCount += 1
            if heldCaptureCount > VoidhashClient.maxHeldCaptures,
                let oldest = heldWrites.firstIndex(where: \.isCapture)
            {
                heldWrites.remove(at: oldest)
                heldCaptureCount -= 1
                droppedHeldCaptures += 1
            }
        }
        guard heldWritesReplay == nil else {
            return
        }
        heldWritesReplay = Task { [weak self, identityInitializationTask] in
            await identityInitializationTask.value
            await self?.applyHeldWrites()
        }
    }

    private func applyHeldWrites() async {
        if droppedHeldCaptures > 0 {
            diagnostics.emit(
                .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "capture",
                message:
                    "Dropped the \(droppedHeldCaptures) oldest event(s) captured before the device was unlocked; it keeps \(VoidhashClient.maxHeldCaptures)"
            )
            droppedHeldCaptures = 0
        }
        while !heldWrites.isEmpty {
            let write = heldWrites.removeFirst()
            if write.isCapture {
                heldCaptureCount -= 1
            }
            await write.apply(self)
        }
        heldWritesReplay = nil
    }

    /// Captures a reported transaction durably on a retired client that nothing replaced over
    /// the same storage, for the next client configured over it to deliver.
    private func stageOnRetiredClient(_ transaction: ReceiptTransaction, isRestore: Bool) async {
        guard stateLoaded.value else {
            reportCaptureNotDurable(
                transaction.transactionId,
                reason: "the client was replaced before its storage became readable")
            return
        }
        let distinctId = await identityStore.getDistinctId()
        // The claim travels with the queued receipt: this client's ledger was handed over, and
        // the client that delivers the receipt records the claim in its own.
        let durable = await outbox.stage(
            PurchaseOrchestrator.syncPayload(
                transaction, products: (currentSchema ?? RuntimeSchema.empty).products),
            distinctId: distinctId, restoreDistinctId: isRestore ? distinctId : nil,
            receipt: transaction.receiptReference, hostClaimed: true)
        if !durable {
            reportCaptureNotDurable(
                transaction.transactionId, reason: "it could not be written to storage")
        }
    }

    private func reportCaptureNotDurable(
        _ transactionId: String, operation: String = "reportTransaction", reason: String
    ) {
        diagnostics.emit(
            .cache, code: "TRANSACTION_CAPTURE_NOT_DURABLE", operation: operation,
            retryable: true, message: "Receipt \(transactionId) is not on disk yet: \(reason)")
    }

    /// Warns once when a public write runs on a client nobody started, whose StoreKit observer,
    /// flush loop and lifecycle observation therefore never run.
    private func warnIfNeverStarted(_ operation: String) {
        guard !hasStarted, !didWarnNeverStarted, !dependencies.embedded else {
            return
        }
        didWarnNeverStarted = true
        warn(
            "\(operation) ran on a client that was never started. Call start() or waitForInitialization(), which Voidhash.configure does for you, or no StoreKit observer, flush loop or lifecycle observation runs."
        )
    }

    private func orchestrator() -> PurchaseOrchestrator {
        if let orchestratorStorage {
            return orchestratorStorage
        }

        let orchestrator = PurchaseOrchestrator(
            engine: engine,
            api: OutboxTransactionSync(outbox: outbox),
            developmentApi: apiClient,
            offerSigner: GuardedOfferSigner { [weak self] headers, body in
                guard let self else {
                    throw CancellationError()
                }
                return try await self.signGuardedOffer(headers: headers, body: body)
            },
            isDevelopmentMode: isDevelopmentMode,
            cacheManager: cacheManager,
            headersProvider: { [headerFactory] in await headerFactory.build() },
            distinctIdProvider: { [identityStore] in await identityStore.getDistinctId() },
            isReadOnly: { [readOnlyFlag] in readOnlyFlag.value },
            refreshPerson: { [weak self] in
                await self?.refreshPersonAfterPurchase()
            },
            schedulePersonRefresh: { [weak self] in
                await self?.scheduleGrantRefresh()
            },
            acceptedReceipts: acceptedReceipts,
            diagnostics: diagnostics
        )
        orchestratorStorage = orchestrator
        return orchestrator
    }

    private func flowCoordinator() -> FlowCoordinator {
        if let flowCoordinatorStorage {
            return flowCoordinatorStorage
        }

        let downloadSession = VoidhashClient.downloadSession(like: dependencies.session)
        // Per project, like the packages, and not per person: images are not personal, so a
        // sign-out leaves them where they are.
        let images = FlowImageStore(
            directory: dependencies.embedded ? nil : dependencies.flowImageDirectory(namespace),
            download: FlowImageStore.download(using: downloadSession))
        flowImageStore = images
        let connectivity = dependencies.connectivityMonitor
        let presenter = makeFlowPresenter(imageStore: images)
        let store = FlowPackageStore(
            directory: dependencies.embedded ? nil : dependencies.flowPackageDirectory(namespace),
            baseUrl: options.baseUrl,
            download: FlowPackageStore.download(using: downloadSession),
            warn: warn)
        let warn = self.warn
        let host = FlowHost(
            capabilities: options.flowCapabilities,
            getProducts: { [weak self] in
                return try await self?.getProducts() ?? []
            },
            // A client that is gone or was shut down buys and restores nothing, which a flow
            // must hear as a failure: answered with nothing, it would report a purchase or a
            // restore that never happened.
            purchase: { [weak self] product, offerId, paywallContext in
                try await VoidhashClient.live(self).purchase(
                    product, options: VoidhashPurchaseOptions(offer: offerId.map { .id($0) } ?? .automatic),
                    paywallContext: paywallContext)
            },
            restorePurchases: { [weak self] in
                _ = try await VoidhashClient.live(self).restorePurchases()
            },
            capture: { [weak self] name, properties in
                await self?.capture(name, properties: properties)
            },
            screen: { [weak self] name, properties in
                await self?.screen(name, properties: properties)
            },
            setAttribute: { [weak self] name, value in
                _ = try await self?.setPersonAttributesState([name: value])
            },
            requestPermission: { permission in
                await FlowPermissions.request(permission, warn: warn)
            },
            openUrl: dependencies.openExternalUrl ?? VoidhashClient.defaultOpenExternalUrl,
            state: FlowStateStore(
                load: { [weak self] key in
                    await self?.loadFlowState(key: key)
                },
                save: { [weak self] key, variables in
                    await self?.saveFlowState(key: key, variables: variables)
                },
                clear: { [weak self] key in
                    await self?.clearFlowState(key: key)
                }
            ),
            locale: dependencies.device.locales.first,
            warn: warn
        )
        let coordinator = FlowCoordinator(
            presenter: presenter,
            loadPackage: { location, package in
                let bytes = try await store.load(location: location, package: package) {
                    abiVersion in
                    presenter?.supportsFlowPackage(abiVersion: abiVersion) ?? false
                }
                // The images the package lists are fetched behind its presentation or preload,
                // which neither waits for them nor fails with them: a flow shown later, with
                // their host unreachable, still has them. Not on cellular or in Low Data Mode,
                // where nobody asked for them yet: a flow on screen still downloads its own.
                if !connectivity.isExpensiveOrConstrained {
                    Task {
                        await images.prefetch(package: package.sha256) {
                            FlowPackageMetadata.imageUrls(in: bytes)
                        }
                    }
                }
                return bytes
            },
            resolvePaywall: { [weak self] location, revision in
                return try await self?.resolvePaywallForPresentation(
                    location: location, revision: revision)
            },
            host: host,
            presentationDeadline: { [sleep = dependencies.budgetSleep] in
                await sleep(NetworkPolicy.flowPresentationDeadlineSeconds * 1000)
            }
        )
        flowCoordinatorStorage = coordinator
        return coordinator
    }

    /// `client` while it can act for a flow.
    ///
    /// - Throws: A `CONFIGURATION_MISSING` ``VoidhashStoreError`` for a client that is gone or
    ///   was shut down.
    private static func live(_ client: VoidhashClient?) throws -> VoidhashClient {
        guard let client, !client.isShutDown else {
            throw inactiveClient
        }
        return client
    }

    private func makeFlowPresenter(imageStore: FlowImageStore) -> (any FlowPaywallPresenting)? {
        guard let renderer = options.paywallRenderer else {
            return nil
        }
        #if canImport(UIKit)
            let target = presentationTarget
            return renderer.makePresenter(
                context: PaywallRendererContext(
                    warn: warn,
                    presentingViewController: {
                        target.viewController
                            ?? PaywallRendererContext.keyWindowTopViewController()
                    },
                    imageStore: imageStore))
        #else
            return renderer.makePresenter(
                context: PaywallRendererContext(warn: warn, imageStore: imageStore))
        #endif
    }

    // MARK: - Flow state

    /// A flow's saved variables belong to the person who produced them.
    private static let flowStateTtlMilliseconds: Double = 1000 * 60 * 60 * 24 * 90

    private func flowStateCacheKey(_ key: String) async -> String {
        return "flow-state:\(await identityStore.getDistinctId()):\(key)"
    }

    private func loadFlowState(key: String) async -> [String: JSONValue]? {
        guard !dependencies.embedded, await loadIdentity() else {
            return nil
        }
        return await cacheManager.get(await flowStateCacheKey(key), as: [String: JSONValue].self)?
            .value
    }

    private func saveFlowState(key: String, variables: [String: JSONValue]) async {
        guard !dependencies.embedded, await loadIdentity() else {
            return
        }
        await cacheManager.set(
            await flowStateCacheKey(key), value: variables,
            ttl: VoidhashClient.flowStateTtlMilliseconds)
    }

    private func clearFlowState(key: String) async {
        guard !dependencies.embedded, await loadIdentity() else {
            return
        }
        await cacheManager.delete(await flowStateCacheKey(key))
    }

    private func cachePerson(_ person: SdkPerson, distinctId: String) async {
        await cacheManager.set(
            VoidhashClient.personCacheKey(distinctId),
            value: person,
            ttl: VoidhashClient.personCacheTtlMilliseconds,
            staleTime: VoidhashClient.personCacheStaleTimeMilliseconds
        )
        await cacheManager.delete(VoidhashClient.missingPersonCacheKey(distinctId))
        announcePerson(Stale(value: person, reason: .fresh), distinctId: distinctId)
        publishPerson(person, of: distinctId)
    }

    /// Tells ``personUpdates()`` `person`, read for `distinctId`, when it changed and
    /// ``mayPublish(for:)`` allows it.
    private func publishPerson(_ person: SdkPerson?, of distinctId: String) {
        guard mayPublish(for: distinctId) else {
            return
        }
        publishedIdentity = distinctId
        guard publishedPerson != .some(person) else {
            return
        }
        publishedPerson = .some(person)
        personBroadcaster.yield(person)
    }

    /// Whether what was read for `distinctId` may reach the app's update callbacks now: no
    /// identity switch is under way, and `distinctId` is the identity they describe. A read for
    /// an identity switched away from finishes after the switch, and is never published then.
    ///
    /// Checked on the actor right before publishing, with no suspension in between, while every
    /// switch counts itself in ``identitySwitchesInFlight`` before it changes the identity.
    private func mayPublish(for distinctId: String) -> Bool {
        return identitySwitchesInFlight == 0 && (publishedIdentity ?? distinctId) == distinctId
    }

    /// Tells ``personUpdates()`` the cached person of the identity that loaded, unless something
    /// was published for it already, so a launch without a network still starts the stream:
    /// with `nil` when nothing is cached.
    private func publishLoadedPerson() async {
        guard publishedIdentity == nil else {
            return
        }
        let distinctId = await identityStore.getDistinctId()
        let cached = await cachedPerson(distinctId: distinctId)
        // A read or a switch that published meanwhile is newer.
        guard publishedIdentity == nil else {
            return
        }
        publishPerson(cached?.value ?? nil, of: distinctId)
    }

    /// Changes the identity with `change`, then records the identity it switched to under the
    /// next generation and tells the host and ``personUpdates()``, before anything is read or
    /// sent for it. Nothing read for an identity is published until then, see
    /// ``mayPublish(for:)``. The host hears nothing before `hostStart()` announced the identity it
    /// loaded, which then carries the latest one.
    ///
    /// Identity changes run one at a time, on ``identityChanges``.
    private func changeIdentity(from previousDistinctId: String, _ change: () async -> Void)
        async
    {
        identitySwitchesInFlight += 1
        await change()
        let current = await identityStore.getDistinctId()
        if let known = intake.currentIdentity, current != known.distinctId {
            let identityChange = VoidhashIdentityChange(
                distinctId: current, previousDistinctId: previousDistinctId,
                generation: IdentityGenerations.next())
            intake.setIdentity(identityChange)
            hostEvents.emit(.identity(identityChange))
        }
        // `personUpdates()` hears of the switch too: the person is now whoever is cached for
        // the new identity, or nobody yet.
        let person = await cachedPerson(distinctId: current)?.value ?? nil
        identitySwitchesInFlight -= 1
        publishedIdentity = current
        if current != previousDistinctId {
            publishPerson(person, of: current)
        }
    }

    /// Tells the host about the person of `distinctId`, when it is the current identity.
    private func announcePerson(_ state: Stale<SdkPerson?>, distinctId: String) {
        guard let identity = intake.currentIdentity, identity.distinctId == distinctId else {
            return
        }
        hostEvents.emit(
            .person(
                VoidhashPersonAnswer(
                    distinctId: distinctId, generation: identity.generation, state: state)))
    }

    /// Replaces non-finite numbers in host-supplied `attributes` with `null`, reporting them once,
    /// so neither the request body nor a queued `$set` can fail to encode.
    private func replacingNonFiniteNumbers(
        in attributes: [String: JSONValue], operation: String
    ) -> [String: JSONValue] {
        let sanitized = JSONValue.replacingNonFiniteNumbers(in: attributes)
        if !sanitized.nonFiniteKeyPaths.isEmpty {
            diagnostics.emit(
                .eviction, code: "NON_FINITE_NUMBER_REPLACED", operation: operation,
                message:
                    "Replaced non-finite numbers with null: \(sanitized.nonFiniteKeyPaths.joined(separator: ", "))"
            )
        }
        return sanitized.properties
    }

    static func personCacheKey(_ distinctId: String) -> String {
        return "person:\(distinctId)"
    }

    /// Records the backend's answer that `distinctId` has no person.
    static func missingPersonCacheKey(_ distinctId: String) -> String {
        return "person-none:\(distinctId)"
    }

    /// Flags are cached per identity and per requested key set, so a narrow `getFeatureFlags(["a"])`
    /// never answers a later `getFeatureFlags()` from a partial result.
    /// ``flagsCacheKey(distinctId:keys:)``, for an importer carrying another SDK's evaluations.
    @_spi(VoidhashHost)
    public static func hostFlagsCacheKey(distinctId: String, keys: [String]?) -> String {
        return flagsCacheKey(distinctId: distinctId, keys: keys)
    }

    static func flagsCacheKey(distinctId: String, keys: [String]?) -> String {
        guard let keys, !keys.isEmpty else {
            return "flags:\(distinctId):all"
        }
        let serialized = keys.sorted().map { "\($0.utf8.count):\($0)" }.joined()
        return "flags:\(distinctId):\(CacheNamespace.hash(serialized))"
    }

    /// Paywall answers are cached per identity, per engine, per interface revision and per
    /// location: the backend answers by what the engine can run (see
    /// ``FlowEngineCapabilities/cacheKey``) and by the revision of the location's interface the
    /// app was built against, so an app update that brings a newer engine or a newer revision
    /// starts from a fresh answer instead of one cached for the old one. Revision 0 leaves the
    /// key as it was before revisions existed, which keeps the answers cached until then.
    static func paywallCacheKey(
        distinctId: String, location: String, engine: FlowEngineCapabilities?, revision: Int = 0
    ) -> String {
        return "paywall:\(distinctId):\(paywallCacheVariant(engine: engine, revision: revision)):\(location)"
    }

    static func unassignedPaywallCacheKey(
        distinctId: String, location: String, engine: FlowEngineCapabilities?, revision: Int = 0
    ) -> String {
        return
            "paywall-unassigned:\(distinctId):\(paywallCacheVariant(engine: engine, revision: revision)):\(location)"
    }

    private static func paywallCacheVariant(engine: FlowEngineCapabilities?, revision: Int)
        -> String
    {
        let engineKey = engine?.cacheKey ?? "none"
        return revision == 0 ? engineKey : "\(engineKey)-r\(revision)"
    }

    // MARK: - Freshness, transport gating and refresh triggers

    /// Whether an outbound request is worth attempting: enabled, not paused by a rejected key,
    /// and not behind an open circuit breaker.
    ///
    /// Side-effect free — it consumes no breaker probe, so a read can use it to decide whether to
    /// serve cache without wedging a half-open host.
    private func canReachNetwork() async -> Bool {
        guard options.enabled, gate.allowsOutbound() else {
            return false
        }
        return await breaker.shouldAttempt(host: VoidhashClient.host(of: options.baseUrl))
    }

    /// Runs `work` under a circuit-breaker permit, releasing it on every exit.
    ///
    /// A half-open breaker hands out exactly one permit, so a path that returned without giving
    /// it back — a cancelled task, a deallocated client — would hold the host shut for the life
    /// of the process.
    ///
    /// - Parameter drainsPersonWrites: Whether a success drains the queued person writes, for
    ///   which it is fresh evidence that the backend is reachable. Person writes pass `false`
    ///   and settle the queue themselves.
    /// - Parameter reportsTransportFailure: Whether a failure that is not a rejected key is
    ///   reported as a diagnostic here; `false` for a caller that reports it itself.
    private func guarded<Value: Sendable>(
        _ operation: String,
        authenticationProbe: Bool = false,
        drainsPersonWrites: Bool = true,
        reportsTransportFailure: Bool = true,
        _ work: @Sendable () async throws -> Value
    ) async throws -> Value {
        let host = VoidhashClient.host(of: options.baseUrl)
        guard options.enabled, gate.allowsOutbound(probe: authenticationProbe) else {
            throw VoidhashApiError(
                code: VoidhashApiError.outboundPausedCode,
                message: "Outbound requests are paused: the publishable key was rejected")
        }
        guard let permit = await breaker.acquire(host: host) else {
            throw VoidhashApiError(
                code: VoidhashApiError.circuitOpenCode,
                message: "Requests to \(host) are paused while it recovers")
        }

        do {
            let value = try await work()
            await breaker.release(permit, retryableFailure: nil)
            if gate.isPaused {
                // A request that got through while the gate was paused (one that left before the
                // rejection landed, or the probe) proves the key works.
                gate.endProbe(succeeded: true)
                // The probe reports its own recovery; any other request resumes everything the
                // pause held, as a probe would.
                if !authenticationProbe {
                    didSurfaceAuthFailure = false
                    diagnostics.emit(
                        .auth, code: "AUTHENTICATION_RECOVERED", operation: operation,
                        message:
                            "The publishable key is accepted again; outbound requests resumed")
                    Task { [weak self] in
                        _ = await self?.drainPendingWork(freshEvidence: true)
                    }
                }
            }
            if drainsPersonWrites {
                kickPersonWriteDrain()
            }
            // A read the circuit turned away, one that lost the half-open probe to this request
            // included, goes now rather than when its timer fires.
            if !flagKeySetsAwaitingCircuit.isEmpty || personAwaitsCircuit {
                Task { [weak self] in
                    await self?.refreshReadsAfterCircuit()
                }
            }
            return value
        } catch is CancellationError {
            await breaker.abandon(permit)
            throw CancellationError()
        } catch {
            await recordNetworkFailure(
                error, operation: operation, permit: permit,
                reportsTransportFailure: reportsTransportFailure)
            throw error
        }
    }

    private func recordNetworkFailure(
        _ error: any Error, operation: String, permit: CircuitBreakerPermit,
        reportsTransportFailure: Bool = true
    ) async {
        let apiError = error as? VoidhashApiError

        if apiError?.isAuthFailure == true {
            // A rejected key is a configuration problem, not an outage: pausing keeps the SDK
            // from burning a user's session on requests that can only fail, and the breaker is
            // deliberately left closed so a key rotation takes effect immediately. Reported once
            // per pause, not for every request or failed probe that finds it paused already.
            if gate.pause() {
                diagnostics.emit(
                    .auth, code: "AUTHENTICATION_FAILED", operation: operation,
                    httpStatus: apiError?.statusCode,
                    message: "The publishable key was rejected; outbound requests are paused")
            }
            gate.endProbe(succeeded: false)
            await breaker.release(permit, retryableFailure: false)
            return
        }
        if apiError?.isLocal == true {
            // Nothing was sent, so the host's health is unknown; the caller gets the error.
            await breaker.abandon(permit)
            return
        }

        await breaker.release(
            permit, retryableFailure: apiError?.countsTowardsCircuitBreaker ?? true)
        guard reportsTransportFailure else {
            return
        }
        diagnostics.emit(
            .transport, code: apiError?.code ?? "NETWORK_ERROR", operation: operation,
            retryable: apiError?.isRetryable ?? true, httpStatus: apiError?.statusCode,
            message: String(describing: error))
    }

    /// Surfaces a rejected publishable key exactly once, and only to a read that had nothing to
    /// serve. A read backed by cache stays a success: the app keeps working.
    private func surfaceAuthFailureIfUnserved(hasCache: Bool) throws {
        guard gate.isPaused, !hasCache, !didSurfaceAuthFailure else {
            return
        }
        didSurfaceAuthFailure = true
        // Stands for the backend's tagged rejection that paused the gate, so it classifies as one.
        throw VoidhashApiError(
            code: "AUTHENTICATION_FAILED",
            message:
                "The publishable key was rejected. Requests are paused; queued data is retained.",
            statusCode: 401,
            tag: VoidhashApiError.authenticationTag
        )
    }

    /// Awaits `task` for at most the freshness budget, leaving it running when the budget wins.
    ///
    /// The refresh keeps going and lands in the cache for the next read, which is what makes a
    /// stale-but-present value feel instant without serving it forever.
    // The outcome is wrapped in a `Result` rather than an optional: `try?` collapses nested
    // optionals, which would make a successful `nil` person indistinguishable from a failed
    // fetch and silently turn an outage into "this user does not exist".
    private func value<Value: Sendable>(
        of task: Task<Value, any Error>,
        withinBudget: Bool
    ) async -> Result<Value, any Error>? {
        guard withinBudget else {
            return await VoidhashClient.outcome(of: task)
        }
        let budget = dependencies.freshnessBudgetMilliseconds
        let sleepForBudget = dependencies.budgetSleep
        let deadline = Task { await sleepForBudget(budget) }
        defer { deadline.cancel() }
        return await firstOutcome(of: task, before: deadline)
    }

    /// Suspends for `multiple` request timeouts of the client's session, which bounds how long a
    /// purchase call the host awaits waits on receipt delivery.
    private func requestTimeoutDeadline(_ multiple: Double) -> @Sendable () async -> Void {
        let milliseconds =
            dependencies.session.configuration.timeoutIntervalForRequest * 1000 * multiple
        let sleep = dependencies.budgetSleep
        return { await sleep(milliseconds) }
    }

    /// Drops every entry keyed by `previousDistinctId`: its person, flags, paywall resolutions
    /// and saved flow state. Paywalls are assigned per person, so the old identity's entries can never
    /// answer a read again and would otherwise sit in the store for good.
    private static func invalidatePerIdentityCache(
        previousDistinctId: String, in cacheManager: CacheManager
    ) async {
        await cacheManager.delete(VoidhashClient.personCacheKey(previousDistinctId))
        await cacheManager.delete(VoidhashClient.missingPersonCacheKey(previousDistinctId))
        await cacheManager.deleteByPrefix("flags:\(previousDistinctId):")
        await cacheManager.deleteByPrefix("paywall:\(previousDistinctId):")
        await cacheManager.deleteByPrefix("paywall-unassigned:\(previousDistinctId):")
        await cacheManager.deleteByPrefix("flow-state:\(previousDistinctId):")
    }

    /// Copies the anonymous person's snapshot to `externalUserId`, already stale so its first
    /// read revalidates, when nothing is cached for that id yet.
    ///
    /// The backend merges the anonymous person into the identified one, so until it has the
    /// alias the anonymous snapshot is the best answer for the new identity: without it a
    /// customer who bought anonymously and signs in while Voidhash is unreachable loses access.
    ///
    /// - Returns: Whether a snapshot was carried over.
    @discardableResult
    private static func carryAnonymousSnapshot(
        from anonymousDistinctId: String, to externalUserId: String, in cacheManager: CacheManager
    ) async -> Bool {
        guard
            await cacheManager.get(
                VoidhashClient.personCacheKey(externalUserId), as: SdkPerson.self) == nil,
            let snapshot = await cacheManager.get(
                VoidhashClient.personCacheKey(anonymousDistinctId), as: SdkPerson.self)
        else {
            return false
        }
        await cacheManager.setStale(
            VoidhashClient.personCacheKey(externalUserId), value: snapshot.value,
            expiresAt: snapshot.expiresAt)
        await cacheManager.delete(VoidhashClient.missingPersonCacheKey(externalUserId))
        return true
    }

    /// Copies the anonymous visitor's flag evaluations to `externalUserId`, already stale, for
    /// each key set nothing is cached for under that id yet.
    ///
    /// Flags are evaluated per person, so the visitor's answer for a user who just signed in is
    /// the best one until the user's own evaluation arrives: without it a sign-in while Voidhash
    /// is unreachable turns every flag back to its default. A stale entry is revalidated by the
    /// next read; sign-out and a switch to another user drop the entries with the rest of the
    /// identity's cache.
    ///
    /// - Returns: Whether any evaluation was carried over.
    @discardableResult
    private static func carryAnonymousFlags(
        from anonymousDistinctId: String, to externalUserId: String, in cacheManager: CacheManager
    ) async -> Bool {
        let prefix = "flags:\(anonymousDistinctId):"
        var carried = false
        for key in await cacheManager.getCacheKeys() where key.hasPrefix(prefix) {
            let targetKey = "flags:\(externalUserId):" + key.dropFirst(prefix.count)
            guard
                await cacheManager.get(targetKey, as: [SdkFeatureFlagResult].self) == nil,
                let evaluation = await cacheManager.get(key, as: [SdkFeatureFlagResult].self)
            else {
                continue
            }
            // The evaluation's own age, so the user's reads still tell the newer of a carried
            // full evaluation and a carried subset apart.
            await cacheManager.setStale(
                targetKey, value: evaluation.value, expiresAt: evaluation.expiresAt,
                createdAt: evaluation.createdAt)
            carried = true
        }
        return carried
    }

    private func observeConnectivity() {
        guard connectivitySubscription == nil else {
            return
        }
        connectivitySubscription = dependencies.connectivityMonitor.observe {
            [weak self, lifecycleQueue] isOnline in
            guard let self else {
                return
            }
            lifecycleQueue.enqueue { await self.handleConnectivityChange(isOnline: isOnline) }
        }
    }

    /// Reacts to the offline-to-online edge only: the path monitor reports every satisfied path
    /// update, and the initial report at subscription time is the current state, not a recovery.
    ///
    /// The recovery runs off the lifecycle queue: a backend that is slow to answer must not hold
    /// up the lifecycle transitions queued behind it.
    private func handleConnectivityChange(isOnline: Bool) async {
        guard !isShutDown else {
            return
        }
        // Failures without a usable path are the device's, not the backend's.
        await breaker.setDeviceOnline(isOnline)
        let previous = wasOnline
        wasOnline = isOnline
        guard isOnline, previous == false else {
            return
        }
        Task { [weak self] in
            await self?.handleConnectivityRestored()
        }
    }

    /// Flushes the queues and refreshes stale state the moment a usable path comes back, at most
    /// once a minute together with the foreground refresh so a flapping link cannot re-probe.
    ///
    /// Queued work goes before the store scan, which sends what it finds itself: a receipt the
    /// scan just failed to deliver is not sent a second time in the same recovery.
    private func handleConnectivityRestored() async {
        guard dependencies.runBackgroundRefreshes, !isShutDown,
            claimRecoveryRefresh(lastRefreshAt: &lastConnectivityRefreshAt)
        else {
            return
        }
        await breaker.halfOpenAll()
        await probeAuthPauseIfDue()
        let canRefresh = await canReachNetwork()
        if canRefresh {
            await drainPendingWork(freshEvidence: true)
            await refreshSchemaIfNeeded()
        }
        await reconcileStore()
        guard canRefresh else {
            return
        }
        _ = try? await refreshPerson()
        _ = try? await refreshFlags(keys: nil)
    }

    /// Refreshes the schema when the device has none, or the cached one is stale or was fetched
    /// for another app version, and adopts it at once so the scan that follows classifies with it.
    ///
    /// A launch that could not fetch the schema, or an app update whose first refresh failed,
    /// recovers here instead of running the whole session on what it had.
    private func refreshSchemaIfNeeded() async {
        guard !schemaIsFixed else {
            return
        }
        if let schema = await schemaManager.refreshIfNeeded(headers: await headerFactory.build()) {
            publishSchema(schema)
        }
    }

    /// A read an open circuit breaker turned away.
    private enum CircuitBlockedRead {
        case flags([String]?)
        case person
    }

    /// Remembers `read` for a refresh once the API circuit breaker admits a probe again, so an
    /// app that read nothing during the outage gets its flags announced through
    /// ``FeatureFlagOptions/onUpdate`` and finds the person refreshed, without waiting for a
    /// foreground or reconnect. Nothing is remembered when no breaker is holding the host shut.
    private func refreshWhenCircuitReopens(_ read: CircuitBlockedRead) async {
        guard dependencies.runBackgroundRefreshes, !isShutDown, !gate.isPaused,
            await breaker.nextAttemptAt(host: VoidhashClient.host(of: options.baseUrl)) != nil
        else {
            return
        }
        switch read {
        case .flags(let keys):
            flagKeySetsAwaitingCircuit.insert(keys)
        case .person:
            personAwaitsCircuit = true
        }
        await armReadsAfterCircuit()
    }

    /// Arms the timer that refreshes the reads an open circuit turned away, for when the breaker
    /// admits a request again. Nothing is armed while none waits, or no breaker holds the host.
    private func armReadsAfterCircuit() async {
        guard !flagKeySetsAwaitingCircuit.isEmpty || personAwaitsCircuit,
            dependencies.runBackgroundRefreshes, !isShutDown, !gate.isPaused,
            let reopensAt = await breaker.nextAttemptAt(
                host: VoidhashClient.host(of: options.baseUrl))
        else {
            return
        }
        scheduler.schedule(.readsAfterCircuit, at: reopensAt) { [weak self] in
            await self?.refreshReadsAfterCircuit()
        }
    }

    /// Refreshes every read the circuit turned away. One the breaker refused again, or whose
    /// probe failed, waits for the breaker's next opening: an outage can outlast many cooldowns.
    private func refreshReadsAfterCircuit() async {
        guard !isShutDown else {
            return
        }
        let keySets = flagKeySetsAwaitingCircuit
        let refreshesPerson = personAwaitsCircuit
        flagKeySetsAwaitingCircuit = []
        personAwaitsCircuit = false
        if refreshesPerson {
            do {
                _ = try await refreshPerson()
            } catch let error where VoidhashClient.isTurnedAwayByCircuit(error) {
                personAwaitsCircuit = true
            } catch {}
        }
        for keys in keySets {
            do {
                _ = try await refreshFlags(keys: keys)
            } catch let error where VoidhashClient.isTurnedAwayByCircuit(error) {
                flagKeySetsAwaitingCircuit.insert(keys)
            } catch {}
        }
        await armReadsAfterCircuit()
    }

    /// Whether a request failed because the circuit refused it, or failed in a way that keeps the
    /// circuit shut: worth trying again once the breaker opens again.
    private static func isTurnedAwayByCircuit(_ error: any Error) -> Bool {
        guard let apiError = error as? VoidhashApiError else {
            return false
        }
        return apiError.code == VoidhashApiError.circuitOpenCode
            || apiError.countsTowardsCircuitBreaker
    }

    /// Tries one request to find out whether a rejected key has since been fixed.
    ///
    /// The auth pause is not a latch: a key that was rotated, a clock skew that resolved or a
    /// backend that briefly rejected the key would otherwise keep the SDK silent until the app is
    /// killed. One probe a minute costs nothing and recovers on its own. A probe the backend
    /// rejects again, or one that got no answer of the backend's (a transport failure, a `5xx`,
    /// an untagged `4xx`, a `2xx` whose body is not a JSON object, such as a proxy's or a
    /// maintenance page), schedules the next one.
    ///
    /// - Returns: Whether a probe ran and reopened the gate.
    @discardableResult
    private func probeAuthPauseIfDue() async -> Bool {
        guard gate.beginProbe() else {
            return false
        }
        let distinctId = await identityStore.getDistinctId()
        do {
            _ = try await fetchAndCachePerson(
                distinctId: distinctId, authenticationProbe: true)
        } catch let error as VoidhashApiError
            where error.isVerdict || error.statusCode.map((200..<300).contains) == true
        {
            // The backend answered the request itself, with a verdict or with a person this SDK
            // could not decode, which carries its `2xx` status only when the body was a JSON
            // object: it accepted the key, which is all the probe asks.
        } catch {
            gate.endProbe(succeeded: false)
            scheduleAuthProbe()
            return false
        }
        gate.endProbe(succeeded: true)
        didSurfaceAuthFailure = false
        diagnostics.emit(
            .auth, code: "AUTHENTICATION_RECOVERED", operation: "client.probe",
            message: "The publishable key is accepted again; outbound requests resumed")
        return true
    }

    /// Arms the timer that probes the paused gate once the next probe is allowed, so a session
    /// that stays in the foreground recovers without waiting for a foreground or connectivity
    /// event. Nothing is armed while the gate is open, a probe is in flight, the app is in the
    /// background or the client was retired.
    private func scheduleAuthProbe() {
        guard dependencies.runBackgroundRefreshes, !isShutDown, let dueAt = gate.nextProbeAt
        else {
            return
        }
        scheduler.schedule(.authProbe, at: dueAt) { [weak self] in
            await self?.probeAuthPauseOnTimer()
        }
    }

    /// The timer's probe: on success it sends what the pause held back and refreshes the person,
    /// whose entitlements may have changed meanwhile.
    private func probeAuthPauseOnTimer() async {
        guard !isShutDown else {
            return
        }
        guard await probeAuthPauseIfDue() else {
            // Not due yet, or another trigger's probe is in flight; its outcome re-arms.
            scheduleAuthProbe()
            return
        }
        await drainPendingWork(freshEvidence: true)
        _ = try? await refreshPerson()
    }

    /// Foreground handler: half-opens the breaker, flushes and refreshes, at most once a minute.
    ///
    /// Queued work goes before the store scan, as in ``handleConnectivityRestored()``. Only
    /// locations whose cached configuration is stale are re-resolved: a fresh one would be a
    /// request per remembered location on every foreground for nothing.
    private func handleForeground() async {
        guard dependencies.runBackgroundRefreshes, !isShutDown,
            claimRecoveryRefresh(lastRefreshAt: &lastForegroundRefreshAt)
        else {
            return
        }
        await breaker.halfOpenAll()
        await probeAuthPauseIfDue()
        let canRefresh = await canReachNetwork()
        if canRefresh {
            await drainPendingWork(freshEvidence: true)
            await refreshSchemaIfNeeded()
        }
        await reconcileStore()
        guard canRefresh else {
            return
        }
        _ = try? await refreshPerson()
        _ = try? await refreshFlags(keys: nil)
        guard paywallsEnabled else {
            return
        }
        let distinctId = await identityStore.getDistinctId()
        for location in knownLocations {
            let revision = flowRevision(of: location)
            guard await isPaywallStale(location, revision: revision, distinctId: distinctId)
            else {
                continue
            }
            _ = try? await refreshPaywall(
                location: location, revision: revision, distinctId: distinctId)
        }
    }

    private func isPaywallStale(_ location: String, revision: Int, distinctId: String) async
        -> Bool
    {
        let engine = options.paywallRenderer?.engineCapabilities
        if let assigned = await cacheManager.get(
            VoidhashClient.paywallCacheKey(
                distinctId: distinctId, location: location, engine: engine, revision: revision),
            as: SdkResolvedPaywall.self)
        {
            return assigned.isStale
        }
        if let unassigned = await cacheManager.get(
            VoidhashClient.unassignedPaywallCacheKey(
                distinctId: distinctId, location: location, engine: engine, revision: revision),
            as: Bool.self)
        {
            return unassigned.isStale
        }
        return true
    }

    /// Whether a recovery refresh may run now for the trigger owning `lastRefreshAt`; claims
    /// the window.
    private func claimRecoveryRefresh(lastRefreshAt: inout Double?) -> Bool {
        let timestamp = clock.monotonicNow()
        if let previous = lastRefreshAt,
            timestamp - previous < VoidhashClient.foregroundRefreshDebounceMilliseconds
        {
            return false
        }
        lastRefreshAt = timestamp
        return true
    }

    /// Whether a read may start a refresh for `plane`, rather than serving its cache until the
    /// backoff after the plane's last failed refresh has passed.
    ///
    /// - Parameter forced: The read asked for the backend's answer, so only a wait the server
    ///   asked for through `Retry-After` holds it back.
    private func isRefreshDue(_ plane: RefreshPlane, forced: Bool = false) -> Bool {
        guard let backoff = refreshBackoff[plane] else {
            return true
        }
        if forced && !backoff.requestedByServer {
            return true
        }
        return clock.monotonicNow() >= backoff.retryAt
    }

    /// Pushes the next read-triggered refresh of `plane` out after a failed one: by the server's
    /// `Retry-After` when it sent one, otherwise by the jittered config backoff. A failure that
    /// sent nothing (a paused gate, an open breaker, a cancelled caller) or a rejected key, which
    /// the gate handles, does not count.
    private func backOffRefresh(_ plane: RefreshPlane, after error: (any Error)?) {
        if error is CancellationError {
            return
        }
        let apiError = error as? VoidhashApiError
        if let apiError, apiError.isAuthFailure || apiError.isLocal || apiError.isRefusedLocally {
            return
        }
        let attempts = (refreshBackoff[plane]?.attempts ?? 0) + 1
        let delay =
            apiError?.retryAfterMilliseconds
            ?? NetworkPolicy.backoffMilliseconds(
                attempt: attempts, cap: NetworkPolicy.configBackoffCapMilliseconds)
        refreshBackoff[plane] = RefreshBackoff(
            attempts: attempts, retryAt: clock.monotonicNow() + delay,
            requestedByServer: apiError?.retryAfterMilliseconds != nil)
    }

    fileprivate static func outcome<Value: Sendable>(of task: Task<Value, any Error>) async
        -> Result<Value, any Error>
    {
        do {
            return .success(try await task.value)
        } catch {
            return .failure(error)
        }
    }

    /// A session like `session` whose whole-request timeout fits a flow package download, which
    /// can need longer than an API call on a slow network: the shared
    /// ``NetworkPolicy/downloadSession`` for the SDK's own session, one derived from an injected
    /// session otherwise.
    private static func downloadSession(like session: URLSession) -> URLSession {
        if session === NetworkPolicy.defaultSession {
            return NetworkPolicy.downloadSession
        }
        let configuration = session.configuration
        configuration.timeoutIntervalForResource = max(
            configuration.timeoutIntervalForResource,
            NetworkPolicy.downloadResourceTimeoutSeconds)
        return URLSession(configuration: configuration)
    }

    private static func host(of url: URL) -> String {
        return url.host ?? url.absoluteString
    }

    /// A file-backed record store, falling back to the cache adapter where no writable
    /// Application Support directory exists.
    private static func defaultRecordStore(
        namespace: String, name: String, adapter: any CacheAdapter, diagnostics: DiagnosticEmitter
    ) -> any RecordStore {
        if let store = FileRecordStore.applicationSupport(
            namespace: CacheNamespace.hash(namespace), name: name, diagnostics: diagnostics)
        {
            return store
        }
        return CacheAdapterRecordStore(adapter: adapter, key: "queue:\(name)")
    }

    private static var defaultBackgroundTaskRunner: any BackgroundTaskRunning {
        #if canImport(UIKit)
            return UIApplicationBackgroundTaskRunner()
        #else
            return NoopBackgroundTaskRunner()
        #endif
    }

    private static var defaultLifecycleObserver: any AppLifecycleObserving {
        #if canImport(UIKit)
            return NotificationCenterLifecycleObserver()
        #else
            return NoopAppLifecycleObserver()
        #endif
    }

    private static var defaultCrashDiagnostics: any CrashDiagnosticObserving {
        #if os(iOS) && canImport(MetricKit)
            return MetricKitCrashDiagnosticObserver()
        #else
            return NoopCrashDiagnosticObserver()
        #endif
    }

    private static let defaultOpenExternalUrl: @Sendable (String) async -> Void = { urlString in
        #if canImport(UIKit)
            guard let url = URL(string: urlString) else {
                return
            }
            await MainActor.run {
                ExtensionSafeApplication.shared?.open(url)
            }
        #endif
    }

    // MARK: - Host SDK surface

    /// Creates a client a host SDK drives, see ``VoidhashHostOptions``. Like
    /// ``init(publishableKey:options:)`` it retires the client holding the same storage.
    @_spi(VoidhashHost)
    public init(publishableKey: String?, options: VoidhashOptions, host: VoidhashHostOptions) {
        var dependencies = Dependencies.live()
        dependencies.host = host
        self.init(publishableKey: publishableKey, options: options, dependencies: dependencies)
    }

    /// Starts the client from local state and announces it to the host: waits for the device's
    /// first unlock and for initialization (which never waits on the network), then delivers,
    /// in this order, the loaded identity, the consent in effect, the schema when there is one
    /// and the cached person when there is one, followed by what happened meanwhile. Events the
    /// synchronous intake took before are handed to the queue under the loaded identity.
    @_spi(VoidhashHost)
    public func hostStart() async {
        guard options.enabled, !isShutDown, !dependencies.embedded else {
            return
        }
        start()
        await identityInitializationTask.value
        _ = try? await ensureInitialized()
        guard !isShutDown, stateLoaded.value else {
            return
        }
        await sessionManager.load()
        let distinctId = await identityStore.getDistinctId()
        let identity = VoidhashIdentityChange(
            distinctId: distinctId, previousDistinctId: "",
            generation: IdentityGenerations.next())
        intake.setIdentity(identity)
        var announcements: [VoidhashClientEvent] = [
            .identity(identity), .consent(analyticsConsentState.value),
        ]
        if let currentSchema, !currentSchema.isEmpty,
            let json = VoidhashClient.schemaJson(currentSchema)
        {
            announcements.append(.schema(json))
        }
        if let cached = await cachedPerson(distinctId: distinctId) {
            announcements.append(
                .person(
                    VoidhashPersonAnswer(
                        distinctId: distinctId, generation: identity.generation, state: cached)))
        }
        let droppedEvents = hostEvents.announce(announcements)
        if droppedEvents > 0 {
            diagnostics.emit(
                .eviction, code: "HOST_EVENT_DROPPED", operation: "client.start",
                message:
                    "Dropped the \(droppedEvents) oldest client event(s) held before the client started; it keeps \(HostEventSink.maxHeldBeforeAnnouncement)"
            )
        }
        let opened = intake.open(distinctId: distinctId)
        if opened.dropped > 0 {
            diagnostics.emit(
                .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "capture",
                message:
                    "Dropped the \(opened.dropped) oldest event(s) captured before the client started; it keeps \(HostIntake.maxHeldBeforeStart)"
            )
        }
        if opened.drains {
            Task { await self.drainIntake() }
        }
    }

    /// Queues person traits for the current identity without waiting on the network: they are
    /// queued behind any write for the same person when this returns, and the queue delivers
    /// them. They are on disk then too unless the queue's file could not be written, in which
    /// case they are kept in memory and written with the next write. Queued whatever the
    /// analytics consent, except an agreement to ad data sharing, which is left out without it,
    /// as in ``setPersonAttributesState(_:)``. The identity is read in order with identity changes, so traits queued before a
    /// switch belong to the identity switched away from, and those after it to the new one.
    ///
    /// - Throws: ``VoidhashStoreError`` with `INVALID_ARGUMENT` for a nested value.
    @_spi(VoidhashHost)
    public func queuePersonAttributes(_ attributes: [String: JSONValue]) async throws {
        guard options.enabled else {
            return
        }
        let nestedKeys = attributes.compactMap { key, value -> String? in
            switch value {
            case .array, .object:
                return key
            case .null, .bool, .number, .string:
                return nil
            }
        }
        guard nestedKeys.isEmpty else {
            throw VoidhashStoreError.invalidPersonTraits(keys: nestedKeys.sorted())
        }
        let attributes = await settlingAdDataSharing(in: attributes)
        guard !attributes.isEmpty else {
            return
        }
        switch await writeRoute() {
        case .direct:
            break
        case .forward(let successor):
            return try await successor.queuePersonAttributes(attributes)
        case .retired:
            return
        case .held:
            holdUntilStateLoads { client in try? await client.queuePersonAttributes(attributes) }
            return
        }
        let traits = replacingNonFiniteNumbers(in: attributes, operation: "person.traits")
        let agrees = attributes[PersonWrite.adDataSharingTrait] == .bool(true)
        _ = try? await identityChanges.submit {
            let distinctId = await self.identityStore.getDistinctId()
            if agrees {
                await self.personWrites.cancelAdDataSharingRevocation(for: distinctId)
            }
            await self.personWrites.enqueue(PersonWrite.traits(traits, for: distinctId))
        }.value
        kickPersonWriteDrain()
    }

    /// The identity the client adopted last, under its generation; `nil` before ``hostStart()``.
    @_spi(VoidhashHost)
    public nonisolated var currentIdentity: VoidhashIdentityChange? {
        return intake.currentIdentity
    }

    /// The groups the end user belongs to, read synchronously; empty before ``hostStart()``.
    @_spi(VoidhashHost)
    public nonisolated var currentGroups: [String: String] {
        guard options.enabled, !isShutDown, intake.isStarted else {
            return [:]
        }
        return identityStore.groups
    }

    /// Whether this client was retired, by ``shutdown()`` or by a newer client over the same
    /// storage. A retired client does no work of its own.
    @_spi(VoidhashHost)
    public nonisolated var isRetired: Bool {
        return retirement.value
    }

    /// Queues an event synchronously, stamped with the identity, groups, session and time of the
    /// call, in call order. Before ``hostStart()`` it is kept in memory, at most
    /// ``HostIntake/maxHeldBeforeStart`` of them, and attributed to the identity start loads.
    /// The standardized `$`-properties are added as ``capture(_:properties:)`` adds them.
    ///
    /// - Parameter capturedAt: When the event happened, for one the host held back; `nil` for now.
    @_spi(VoidhashHost)
    public nonisolated func captureNow(
        _ eventName: String, properties: [String: JSONValue], capturedAt: Double? = nil
    ) {
        guard options.enabled, !isShutDown else {
            return
        }
        let capturedAt = capturedAt ?? dependencies.analyticsNow()
        var capture = StampedCapture(
            name: eventName, properties: properties, capturedAt: capturedAt, distinctId: nil,
            sessionId: nil)
        if intake.isStarted {
            capture.distinctId = intake.currentIdentity?.distinctId
            capture.groups = identityStore.groups
            if analyticsConsentState.value == .granted {
                capture.sessionId = sessionManager.stampNow(at: capturedAt)
            }
        }
        if intake.take(capture) {
            Task { await self.drainIntake() }
        }
    }

    private func drainIntake() async {
        while let capture = intake.next() {
            // Held while consent is pending like any other event, and then recorded under the
            // identity, groups and session of the grant, not the ones it was stamped with.
            if holdsPendingEvents {
                await record(
                    capture.name, properties: capture.properties, capturedAt: capture.capturedAt)
                continue
            }
            await settlePendingEvents()
            await analytics.capture(
                capture.name, properties: capture.properties, capturedAt: capture.capturedAt,
                distinctId: capture.distinctId, sessionId: capture.sessionId,
                groups: capture.groups)
        }
    }

    /// The active analytics session id, read synchronously; empty when there is none, before
    /// ``hostStart()`` and without analytics consent.
    @_spi(VoidhashHost)
    public nonisolated func currentSessionId() -> String {
        guard options.enabled, !isShutDown, intake.isStarted,
            analyticsConsentState.value == .granted
        else {
            return ""
        }
        return sessionManager.activeIdNow(at: dependencies.analyticsNow()) ?? ""
    }

    /// ``getCurrentPersonState(forceFetch:)`` with the identity the answer was read under.
    @_spi(VoidhashHost)
    public func hostPersonState(forceFetch: Bool) async throws -> VoidhashPersonAnswer {
        let identity = intake.currentIdentity
        let state = try await getCurrentPersonState(forceFetch: forceFetch)
        return VoidhashPersonAnswer(
            distinctId: identity?.distinctId ?? "", generation: identity?.generation ?? 0,
            state: state)
    }

    /// ``getFeatureFlagsState(_:)`` with the identity the answer was read under.
    @_spi(VoidhashHost)
    public func hostFeatureFlags(_ keys: [String]?) async throws -> VoidhashFlagsAnswer {
        let identity = intake.currentIdentity
        let state = try await getFeatureFlagsState(keys)
        return VoidhashFlagsAnswer(
            distinctId: identity?.distinctId ?? "", generation: identity?.generation ?? 0,
            keys: keys, state: state)
    }

    /// Flushes for at most ``NetworkPolicy/awaitedCallBudgetMilliseconds``, then retires the
    /// client as ``shutdown()`` does, persisting what was not delivered for the next client.
    @_spi(VoidhashHost)
    public func shutdownAfterFlush() async -> FlushStatus {
        let status = isShutDown ? FlushStatus(flushed: 0, pending: 0) : await flush()
        await shutdown()
        return status
    }
}

/// Whether a person write reached the backend.
public enum PersonWriteStatus: String, Sendable, Equatable {
    /// The backend confirmed the write.
    case confirmed
    /// The write is queued and will be applied when the queue drains.
    case deferred
    /// Not sent and not queued: the only trait was an agreement to ad data sharing, which
    /// waits for analytics consent. Every other trait is sent whatever the consent.
    case skipped
}

/// Outcome of ``VoidhashClient/identifyState(externalUserId:email:name:)`` and
/// ``VoidhashClient/setPersonAttributesState(_:)``.
public struct PersonWriteResult: Sendable, Equatable {
    /// Whether the backend confirmed the write.
    public let status: PersonWriteStatus
    /// The person the SDK now holds; `nil` when nothing is cached and nothing was confirmed.
    public let person: SdkPerson?

    public init(status: PersonWriteStatus, person: SdkPerson?) {
        self.status = status
        self.person = person
    }
}

/// The outcome of `task` when it finishes before `deadline` does, `nil` when `deadline` finishes
/// first. `task` keeps running either way.
// Not a task group: a group awaits its children before returning, and `task` is meant to carry on
// past the deadline.
func firstOutcome<Value: Sendable>(
    of task: Task<Value, any Error>, before deadline: Task<Void, Never>
) async -> Result<Value, any Error>? {
    let race = FirstAcrossTheLine<Result<Value, any Error>?>()
    return await withCheckedContinuation { continuation in
        Task {
            race.resume(continuation, with: await VoidhashClient.outcome(of: task))
        }
        Task {
            await deadline.value
            race.resume(continuation, with: nil)
        }
    }
}

/// Resumes a continuation exactly once, whichever racer gets there first.
final class FirstAcrossTheLine<Value: Sendable>: @unchecked Sendable {
    private let lock = NSLock()
    private var isResumed = false

    func resume(_ continuation: CheckedContinuation<Value, Never>, with value: Value) {
        let shouldResume = lock.withLock { () -> Bool in
            guard !isResumed else {
                return false
            }
            isResumed = true
            return true
        }
        if shouldResume {
            continuation.resume(returning: value)
        }
    }
}

/// The schema source ``VoidhashClient`` hands its ``SchemaManager``: every fetch runs under the
/// client's outbound gate and circuit breaker.
private struct GuardedSchemaFetcher: SchemaFetching {
    let fetch: @Sendable ([String: String]) async throws -> RuntimeSchema

    func fetchSchema(headers: [String: String]) async throws -> RuntimeSchema {
        return try await fetch(headers)
    }
}

/// The promotional offer signer ``VoidhashClient`` hands its ``PurchaseOrchestrator``: every
/// request runs under the client's outbound gate and circuit breaker.
private struct GuardedOfferSigner: PromotionalOfferSigning {
    let sign:
        @Sendable ([String: String], SdkPromotionalOfferSignatureBody) async throws
            -> SdkPromotionalOfferSignature

    func signPromotionalOffer(headers: [String: String], body: SdkPromotionalOfferSignatureBody)
        async throws -> SdkPromotionalOfferSignature
    {
        return try await sign(headers, body)
    }
}

/// Routes every orchestrator sync through the durable outbox.
///
/// The receipt is on disk before the request goes out, so an outage between the store handing a
/// transaction over and the backend recording it costs a retry, never the purchase. The outbox
/// sends the intent of the record the receipt is queued in.
struct OutboxTransactionSync: TransactionSyncing {
    let outbox: TransactionOutbox

    func restoreTransaction(headers: [String: String], body: SdkSyncTransactionBody) async throws
        -> SdkSyncTransactionResponse
    {
        return try await restoreTransaction(
            headers: headers, body: body,
            receipt: ReceiptReference(transactionId: body.transactionId))
    }

    func syncTransaction(headers: [String: String], body: SdkSyncTransactionBody) async throws
        -> SdkSyncTransactionResponse
    {
        return try await syncTransaction(
            headers: headers, body: body,
            receipt: ReceiptReference(transactionId: body.transactionId))
    }

    /// - Throws: ``VoidhashApiError`` when the receipt's send failed in transit, so a restore can
    ///   stop sending receipts into the outage. The receipt stays queued.
    func restoreTransaction(
        headers: [String: String], body: SdkSyncTransactionBody, receipt: ReceiptReference
    ) async throws -> SdkSyncTransactionResponse {
        let result = await outbox.restore(
            body, distinctId: OutboxTransactionSync.distinctId(in: headers), receipt: receipt)
        if result.transientFailureIds.contains(body.transactionId) {
            throw VoidhashApiError(
                code: "TRANSACTION_SYNC_DEFERRED",
                message: "Receipt \(body.transactionId) did not reach Voidhash; it stays queued")
        }
        return SdkSyncTransactionResponse(accepted: result.didAcknowledge(body.transactionId))
    }

    func captureTransaction(
        headers: [String: String], body: SdkSyncTransactionBody, receipt: ReceiptReference
    ) async {
        await outbox.stage(
            body, distinctId: OutboxTransactionSync.distinctId(in: headers), receipt: receipt)
    }

    func syncTransaction(
        headers: [String: String], body: SdkSyncTransactionBody, receipt: ReceiptReference
    ) async throws -> SdkSyncTransactionResponse {
        let result = await outbox.enqueue(
            body, distinctId: OutboxTransactionSync.distinctId(in: headers), receipt: receipt)
        return SdkSyncTransactionResponse(accepted: result.didAcknowledge(body.transactionId))
    }

    private static func distinctId(in headers: [String: String]) -> String {
        return headers.first { $0.key.caseInsensitiveCompare("x-distinct-id") == .orderedSame }?
            .value ?? ""
    }
}

#if canImport(UIKit)
    /// Holds the view controller a `presentFlow(location:revision:input:actions:from:)` call
    /// named, if any.
    final class PresentationTargetBox: @unchecked Sendable {
        private let lock = NSLock()
        private weak var storage: UIViewController?
        private var claims = 0

        var viewController: UIViewController? {
            return lock.withLock { storage }
        }

        /// Names the view controller the next flow is presented from.
        ///
        /// - Returns: The claim to ``release(_:)`` it with.
        func claim(_ viewController: UIViewController?) -> Int {
            return lock.withLock {
                claims += 1
                storage = viewController
                return claims
            }
        }

        /// Forgets the view controller `claim` named, unless a later presentation has named its
        /// own since: a flow that replaces another is presented after the call that presented
        /// the first has returned.
        func release(_ claim: Int) {
            lock.withLock {
                if claims == claim {
                    storage = nil
                }
            }
        }
    }

#endif

extension VoidhashClient {
    /// Awaits the schema manager's background refresh. Test affordance.
    func awaitSchemaRefreshForTesting() async {
        await schemaManager.awaitBackgroundRefresh()
    }

    /// Races two resumptions of one continuation. Test affordance for the freshness budget.
    static func raceForTesting(
        first: @escaping @Sendable () async -> Int,
        second: @escaping @Sendable () async -> Int
    ) async -> Int {
        let race = FirstAcrossTheLine<Int>()
        return await withCheckedContinuation { continuation in
            Task { race.resume(continuation, with: await first()) }
            Task { race.resume(continuation, with: await second()) }
        }
    }
}
