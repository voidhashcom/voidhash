import Foundation
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
/// made, `getProducts()` returns an empty list and `getCurrentPerson()` returns `nil`.
public actor VoidhashClient {
    /// Injection seam for tests and for hosts that supply their own store or presenter.
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
        var clock: any VoidhashClock = SystemVoidhashClock()
        var connectivityMonitor: any ConnectivityMonitoring = DefaultConnectivityMonitor.current
        /// Longest an interactive read waits on an in-flight refresh before serving stale state.
        var freshnessBudgetMilliseconds: Double = NetworkPolicy.freshnessBudgetMilliseconds
        /// Suspends for the freshness budget. Separate from the analytics clock so tests can keep
        /// backoff deterministic while still exercising a real race.
        var budgetSleep: @Sendable (Double) async -> Void = { milliseconds in
            try? await Task.sleep(nanoseconds: UInt64(milliseconds * 1_000_000))
        }
        var engine: (any StoreKitEngineProtocol)?
        var presenter: (any PaywallPresenting)?
        var device: SdkDeviceInfo = SdkDeviceInfo.current()
        var analyticsNow: @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 }
        var analyticsSleep: @Sendable (Double) async -> Void = { milliseconds in
            try? await Task.sleep(nanoseconds: UInt64(milliseconds * 1_000_000))
        }
        var openExternalUrl: (@Sendable (String) async -> Void)?
        var startAutoFlush = true
        /// Whether the background refresh triggers run: the boot warm-up and the post-purchase
        /// grant refresh. Tests that assert on exact request sequences turn them off.
        var runBackgroundRefreshes = true
        var lifecycleObserver: any AppLifecycleObserving = VoidhashClient.defaultLifecycleObserver
        var backgroundTaskRunner: any BackgroundTaskRunning =
            VoidhashClient.defaultBackgroundTaskRunner
        /// The commerce release gate; tests flip it to exercise owner-mode behaviour.
        var isCommerceEnabled = commerceFeaturesEnabled
    }

    private static let personCacheTtlMilliseconds: Double = 1000 * 60 * 60 * 24 * 2
    private static let flagsCacheStaleTimeMilliseconds: Double = 1000 * 60 * 5
    private static let paywallCacheTtlMilliseconds: Double = 1000 * 60 * 60 * 24 * 7
    private static let paywallCacheStaleTimeMilliseconds: Double = 1000 * 60 * 60
    /// Debounce between foreground-triggered refreshes.
    private static let foregroundRefreshDebounceMilliseconds: Double = 60_000
    /// Placements remembered for preload on the next launch.
    static let maxKnownPlacements = 20
    /// Cache key of the placements this device has resolved before.
    static let knownPlacementsCacheKey = "paywall:placements"

    private static func normalizeKnownPlacements(_ placements: [String]) -> [String] {
        var normalized: [String] = []
        for placement in placements where !placement.isEmpty {
            normalized.removeAll { $0 == placement }
            normalized.append(placement)
        }
        return Array(normalized.suffix(maxKnownPlacements))
    }

    /// Cache key of the `{appBuild, appVersion}` pair seen on the previous launch.
    ///
    /// The `voidhash:` in the key is historical — it was the whole namespace before keys were
    /// scoped per publishable key and origin — and is kept so the one-time migration in
    /// ``CacheMigration`` can carry the entry across without a device re-reporting
    /// `$app_installed`.
    static let lastSeenAppReleaseCacheKey = "voidhash:analytics:last-seen-app-release"

    struct AppReleaseInfo: Codable, Sendable, Equatable {
        let appBuild: String
        let appVersion: String
    }

    private struct CachedPaywallState: Sendable {
        let value: SdkResolvedPaywall?
        let isStale: Bool
        let isExpired: Bool
    }
    private static let personCacheStaleTimeMilliseconds: Double = 1000 * 60 * 5

    private let options: VoidhashOptions
    private let dependencies: Dependencies
    private let warn: VoidhashWarningHandler
    private let commerceEnabled: Bool
    private let readOnlyFlag: AtomicBool
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
    private var paywallCoordinatorStorage: PaywallCoordinator?
    private var initializationTask: Task<RuntimeSchema, any Error>?
    /// One-time move of the pre-namespace cache entries, started in `init` so no public call can
    /// read identity, session or queue state before it has run. Every such read awaits it.
    private let migrationTask: Task<Void, Never>
    /// Set by ``shutdown()``; an initialization still running past it must not subscribe to
    /// lifecycle or connectivity, or start the flush loop, on a client that has been replaced.
    private var isShutDown = false
    private var currentSchema: RuntimeSchema?
    private var lifecycleTracker = LifecycleTracker()
    private var lifecycleSubscription: (any AppLifecycleSubscription)?
    private let lifecycleQueue = SerialTaskQueue()
    private var screenTracker: ScreenTracker
    private var manualScreenCounter = 0

    private let clock: any VoidhashClock
    private let diagnostics: DiagnosticEmitter
    private let breaker: CircuitBreaker
    private let gate: OutboundGate
    private let outbox: TransactionOutbox
    private let personFlight = SingleFlight<SdkPerson?>()
    private let flagsFlight = SingleFlight<[SdkFeatureFlagResult]>()
    private let paywallFlight = SingleFlight<SdkResolvedPaywall?>()
    private var connectivitySubscription: (any ConnectivitySubscription)?
    /// Last foreground refresh, for the once-a-minute debounce.
    private var lastForegroundRefreshAt: Double = 0
    /// Last connectivity-restored refresh. Its own window: a foreground that found the network
    /// down must not cost the flush that connectivity coming back a moment later triggers.
    private var lastConnectivityRefreshAt: Double = 0
    /// Last connectivity report, so only an offline-to-online edge triggers a refresh.
    private var wasOnline: Bool?
    private var didSurfaceAuthFailure = false
    private var knownPlacements: [String] = []
    private var injectedPresenter: (any PaywallPresenting)?

    #if canImport(UIKit)
        private let presentationTarget = PresentationTargetBox()
    #endif

    public init(publishableKey: String, options: VoidhashOptions = VoidhashOptions()) {
        self.init(publishableKey: publishableKey, options: options, dependencies: Dependencies())
    }

    init(publishableKey: String, options: VoidhashOptions, dependencies: Dependencies) {
        self.options = options
        self.dependencies = dependencies
        screenTracker = ScreenTracker(options: options.screenTracking)
        warn = options.onWarning ?? VoidhashWarnings.standard
        commerceEnabled = dependencies.isCommerceEnabled
        readOnlyFlag = AtomicBool(options.readOnly || !commerceEnabled)
        // Development mode is a debug-build-only affordance: the flag alone is never enough,
        // so it can never reach a production release.
        #if DEBUG
            let developmentMode = options.dev
        #else
            let developmentMode = false
        #endif
        isDevelopmentMode = developmentMode
        let diagnostics = DiagnosticEmitter(options.onDiagnostic)
        self.diagnostics = diagnostics
        clock = dependencies.clock
        gate = OutboundGate()
        breaker = CircuitBreaker(clock: dependencies.clock, diagnostics: diagnostics)
        let namespace = CacheNamespace.prefix(
            publishableKey: publishableKey, baseUrl: options.baseUrl)
        let adapter =
            dependencies.cacheAdapter
            ?? UserDefaultsCacheAdapter(
                publishableKey: publishableKey, baseUrl: options.baseUrl)
        cacheAdapter = adapter
        if let legacy = dependencies.legacyCacheAdapter {
            let appVersion = dependencies.device.appVersion
            migrationTask = Task {
                await CacheMigration.run(
                    target: adapter, legacy: legacy, appVersion: appVersion,
                    diagnostics: diagnostics)
            }
        } else {
            migrationTask = Task {}
        }
        cacheManager = CacheManager(
            adapter: adapter, now: dependencies.analyticsNow, diagnostics: diagnostics)
        identityStore = IdentityStore(cacheManager: cacheManager)
        apiClient = VoidhashApiClient(baseUrl: options.baseUrl, session: dependencies.session)
        engine =
            dependencies.engine ?? (developmentMode ? DevelopmentStoreEngine() : StoreKitEngine())
        let clientBox = WeakClientBox()
        schemaManager = SchemaManager(
            apiClient: apiClient,
            cacheManager: cacheManager,
            appVersion: dependencies.device.appVersion,
            diagnostics: diagnostics,
            onSchemaUpdated: { [clientBox] schema in
                guard let client = clientBox.get() else {
                    return
                }
                Task { await client.publishSchema(schema) }
            }
        )
        headerFactory = SdkHeaderFactory(
            publishableKey: publishableKey,
            sdkVersion: Voidhash.sdkVersion,
            device: dependencies.device,
            isDebugBuild: options.debug,
            identityStore: identityStore,
            readOnly: readOnlyFlag,
            environmentProvider: { developmentMode ? "development" : "production" }
        )
        let sessionManager = AnalyticsSessionManager(
            cacheManager: cacheManager, now: dependencies.analyticsNow)
        self.sessionManager = sessionManager
        analytics = AnalyticsClient(
            publishableKey: publishableKey,
            ingestUrl: options.ingestUrl ?? options.baseUrl,
            session: dependencies.session,
            distinctIdProvider: { [identityStore] in await identityStore.getDistinctId() },
            sessionIdProvider: { await sessionManager.current() },
            standardProperties: AnalyticsClient.standardProperties(
                device: dependencies.device,
                sdkVersion: Voidhash.sdkVersion,
                environment: developmentMode ? "development" : "production"),
            now: dependencies.analyticsNow,
            sleep: dependencies.analyticsSleep,
            store: dependencies.analyticsStore
                ?? VoidhashClient.defaultRecordStore(
                    namespace: namespace, name: "analytics-queue", adapter: adapter),
            gate: gate,
            breaker: breaker,
            diagnostics: diagnostics,
            debug: options.debug,
            warn: options.onWarning ?? VoidhashWarnings.standard
        )
        let apiClient = self.apiClient
        outbox = TransactionOutbox(
            store: dependencies.outboxStore
                ?? VoidhashClient.defaultRecordStore(
                    namespace: namespace, name: "transaction-outbox", adapter: adapter),
            sync: { [headerFactory] body, distinctId in
                return try await apiClient.syncTransaction(
                    headers: headerFactory.build(distinctId: distinctId), body: body
                ).accepted
            },
            clock: dependencies.clock,
            gate: gate,
            breaker: breaker,
            breakerHost: VoidhashClient.host(of: options.baseUrl),
            diagnostics: diagnostics
        )
        clientBox.set(self)
    }

    /// Kicks off initialization without waiting for it.
    ///
    /// A no-op once ``shutdown()`` has run: reconfiguration shuts the replaced client down
    /// before starting its replacement, and the two run on separate tasks, so the start of a
    /// superseded client can land after its shutdown. Without the guard it would resubscribe
    /// to lifecycle and connectivity and restart the flush loop on a dead client.
    public func start() {
        guard options.enabled, !isShutDown else {
            return
        }
        _ = ensureInitializationTask()
    }

    /// Awaits initialization, returning the resolved runtime schema.
    ///
    /// Never fails because the backend is unreachable: with no cached schema and no connectivity
    /// it returns ``RuntimeSchema/empty`` and refreshes in the background. Analytics capture,
    /// lifecycle observation and identity are already running by the time it returns.
    @discardableResult
    public func waitForInitialization() async throws -> RuntimeSchema {
        return try await ensureInitialized()
    }

    // MARK: - Products and purchases

    /// Returns every dashboard product that resolved in the App Store.
    public func getProducts() async throws -> [VoidhashProduct] {
        guard options.enabled else {
            return []
        }

        let schema = try await ensureInitialized()

        // The mock store synthesizes products from the schema's computed development
        // metadata — no store round-trip, works on any simulator.
        if isDevelopmentMode {
            return schema.products.values.compactMap { definition -> VoidhashProduct? in
                guard let configuration = definition.configuration.providers.development else {
                    return nil
                }
                return VoidhashProduct(definition: definition, development: configuration)
            }
            .sorted { $0.slug < $1.slug }
        }

        let definitions = schema.products.values.filter {
            $0.configuration.providers.appleAppStore != nil
        }
        let skus = definitions.compactMap { $0.configuration.providers.appleAppStore?.productId }
        guard !skus.isEmpty else {
            return []
        }

        let storeProducts = try await engine.getItems(skus: skus)
        return storeProducts.compactMap { storeProduct in
            guard
                let definition = definitions.first(where: {
                    $0.configuration.providers.appleAppStore?.productId == storeProduct.id
                })
            else {
                return nil
            }
            return VoidhashProduct(definition: definition, storeProduct: storeProduct)
        }
        .sorted { $0.slug < $1.slug }
    }

    /// Buys `product`, syncs the transaction and finishes it with the store.
    ///
    /// Unavailable in observer mode: an observer never owns a transaction, so it must never
    /// start one it would then be unable to finish. The check reads the live flag, so it also
    /// covers the commerce release gate.
    public func purchase(product: VoidhashProduct) async throws {
        guard options.enabled else {
            return
        }
        guard !readOnlyFlag.value else {
            throw VoidhashStoreError.readOnlyPurchaseNotAllowed
        }
        let schema = try await ensureInitialized()
        try await orchestrator().purchase(product: product, schema: schema)
    }

    /// Syncs every transaction the store still reports for this customer.
    public func restorePurchases() async throws {
        guard options.enabled else {
            return
        }
        let schema = try await ensureInitialized()
        try await orchestrator().restorePurchases(schema: schema)
    }

    // MARK: - Identity

    /// Returns the person snapshot for the current distinct id.
    ///
    /// Cache-first: a cached snapshot is returned immediately, and a stale one triggers a
    /// background refresh this call waits on for at most the freshness budget. A snapshot is
    /// served at any age while the backend is unreachable, so entitlements survive an outage.
    ///
    /// - Parameter forceFetch: Bypasses the cached snapshot when the network is usable.
    public func getCurrentPerson(forceFetch: Bool = false) async throws -> SdkPerson? {
        return try await getCurrentPersonState(forceFetch: forceFetch).value
    }

    /// ``getCurrentPerson(forceFetch:)`` with the freshness of the value it returned.
    ///
    /// Apps gating high-value content should branch on `isExpired`: the value is still the last
    /// state the backend confirmed, but it has outlived its trust window.
    public func getCurrentPersonState(forceFetch: Bool = false) async throws -> Stale<SdkPerson?> {
        guard options.enabled else {
            return Stale(value: nil)
        }
        await migrationTask.value

        let distinctId = await identityStore.getDistinctId()
        let cacheKey = VoidhashClient.personCacheKey(distinctId)
        let cached = await cacheManager.get(cacheKey, as: SdkPerson.self)

        if !forceFetch, let cached, !cached.isStale {
            return Stale(value: cached.value, isStale: false, isExpired: cached.isExpired)
        }

        guard await canReachNetwork() else {
            try surfaceAuthFailureIfUnserved(hasCache: cached != nil)
            return Stale(
                value: cached?.value, isStale: true, isExpired: cached?.isExpired ?? true)
        }

        let refresh = Task { try await self.refreshPerson() }
        // With a value in hand the read never waits on the network longer than the budget.
        if cached != nil, case .success(let fresh)? = await value(of: refresh, withinBudget: true) {
            return Stale(value: fresh)
        }
        if let cached {
            return Stale(value: cached.value, isStale: cached.isStale, isExpired: cached.isExpired)
        }
        // Cold cache: there is nothing to serve, so the full request timeout is the budget.
        if case .success(let fresh)? = await value(of: refresh, withinBudget: false) {
            return Stale(value: fresh)
        }
        return Stale(value: nil, isStale: true, isExpired: true)
    }

    /// Fetches and caches the person for the current identity, single-flighted.
    @discardableResult
    private func refreshPerson() async throws -> SdkPerson? {
        await migrationTask.value
        let distinctId = await identityStore.getDistinctId()
        return try await personFlight.run(key: distinctId) { [weak self] in
            guard let self else {
                return nil
            }
            return try await self.fetchAndCachePerson(distinctId: distinctId)
        }
    }

    private func fetchAndCachePerson(
        distinctId: String, authenticationProbe: Bool = false
    ) async throws -> SdkPerson? {
        let headers = headerFactory.build(distinctId: distinctId)
        let person = try await guarded("person.fetch", authenticationProbe: authenticationProbe) {
            [apiClient] in
            try await apiClient.getPerson(headers: headers)
        }
        if let person {
            await cachePerson(person, distinctId: distinctId)
        } else {
            // The backend says this identity has no person. Keeping the old snapshot would keep
            // serving grants for someone who no longer exists.
            await cacheManager.delete(VoidhashClient.personCacheKey(distinctId))
        }
        return person
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
    /// Offline the identity still switches locally, the per-identity caches are invalidated and
    /// an `$identify` event is queued, so the merge lands as soon as the queue drains. The result
    /// is `deferred` in that case; it never throws for transport.
    @discardableResult
    public func identifyState(
        externalUserId: String, email: String? = nil, name: String? = nil
    ) async throws -> PersonWriteResult {
        guard options.enabled else {
            return PersonWriteResult(status: .deferred, person: nil)
        }
        await migrationTask.value

        let currentDistinctId = await identityStore.getDistinctId()
        // Local first: the app asked to be this user, and that must hold regardless of the
        // network. Anything evaluated for the previous id would otherwise leak into the
        // identified session — flags in particular are per person.
        await identityStore.identify(distinctId: externalUserId)

        do {
            let person = try await guarded("person.identify") { [apiClient, headerFactory] in
                try await apiClient.identify(
                    headers: headerFactory.build(distinctId: currentDistinctId),
                    body: SdkIdentifyBody(distinctId: externalUserId, email: email, name: name)
                )
            }
            await invalidatePerIdentityCache(previousDistinctId: currentDistinctId)
            await cachePerson(person, distinctId: externalUserId)
            Task { [weak self] in
                _ = try? await self?.refreshFlags(keys: nil)
            }
            return PersonWriteResult(status: .confirmed, person: person)
        } catch is CancellationError {
            // Cancellation is not a verdict on the write: the caller went away, and reporting
            // "deferred" would queue a duplicate `$identify` for a merge that may have landed.
            throw CancellationError()
        } catch let error as VoidhashApiError where !error.isRetryable {
            await identityStore.identify(distinctId: currentDistinctId)
            throw error
        } catch {
            await invalidatePerIdentityCache(previousDistinctId: currentDistinctId)
            // The alias rides the analytics queue, which is durable and already retried; the
            // backend applies it when the batch lands.
            var properties: [String: JSONValue] = [
                "$anon_distinct_id": .string(currentDistinctId),
                "$distinct_id": .string(externalUserId),
                "$process_person_profile": .bool(true),
            ]
            if let email {
                properties["$email"] = .string(email)
            }
            if let name {
                properties["$name"] = .string(name)
            }
            await analytics.capture(AutomaticEvents.identify, properties: properties)
            return PersonWriteResult(status: .deferred, person: nil)
        }
    }

    /// Sets person traits, reporting whether the backend confirmed them.
    ///
    /// Offline the traits are queued as a `$set` event rather than lost, and the cached person is
    /// returned unchanged. Never throws for transport.
    @discardableResult
    public func setPersonAttributesState(_ attributes: [String: JSONValue]) async throws
        -> PersonWriteResult
    {
        guard options.enabled else {
            return PersonWriteResult(status: .deferred, person: nil)
        }
        await migrationTask.value

        let distinctId = await identityStore.getDistinctId()
        do {
            let person = try await guarded("person.traits") { [apiClient, headerFactory] in
                try await apiClient.setPersonTraits(
                    headers: headerFactory.build(distinctId: distinctId),
                    body: SdkPersonTraitsBody(traits: attributes)
                )
            }
            await cachePerson(person, distinctId: distinctId)
            return PersonWriteResult(status: .confirmed, person: person)
        } catch is CancellationError {
            throw CancellationError()
        } catch let error as VoidhashApiError where !error.isRetryable {
            throw error
        } catch {
            // The ingest backend reads traits from `$set`, not from the top-level properties.
            await analytics.capture(
                AutomaticEvents.set,
                properties: [
                    "$set": .object(attributes),
                    "$process_person_profile": .bool(true),
                ])
            let cached = await cacheManager.get(
                VoidhashClient.personCacheKey(distinctId), as: SdkPerson.self)
            return PersonWriteResult(status: .deferred, person: cached?.value)
        }
    }

    /// Sets person traits and returns the person the SDK now holds.
    ///
    /// Offline the traits are queued rather than lost and the cached person comes back unchanged;
    /// ``setPersonAttributesState(_:)`` reports which of the two happened.
    @discardableResult
    public func setPersonAttributes(_ attributes: [String: JSONValue]) async throws -> SdkPerson? {
        return try await setPersonAttributesState(attributes).person
    }

    /// Clears the persisted identity and everything cached for it, and starts a new analytics
    /// session.
    ///
    /// Captures `$sign_out` under the identity and session being cleared, then the next
    /// ``getDistinctId()`` allocates a fresh anonymous distinct id. State that is not tied to a
    /// person — the schema, remembered placements, the install marker — stays cached, so a
    /// sign-out offline does not turn the next launch into a cold start or re-report
    /// `$app_installed`.
    public func reset() async {
        guard options.enabled else {
            return
        }
        await migrationTask.value
        if options.automaticLifecycleEvents {
            await analytics.capture(AutomaticEvents.signOut)
        }
        let previousDistinctId = await identityStore.getDistinctIdFromCache()
        await identityStore.forgetDistinctId()
        if let previousDistinctId {
            await invalidatePerIdentityCache(previousDistinctId: previousDistinctId)
        }
        await sessionManager.rotate()
    }

    /// Returns the current distinct id, allocating an anonymous one when needed.
    public func getDistinctId() async -> String {
        await migrationTask.value
        return await identityStore.getDistinctId()
    }

    /// Returns the analytics session id the next captured event will carry.
    ///
    /// Sessions end after 30 minutes without a capture and on ``reset()``; reading the id does
    /// not extend the session.
    public func sessionId() async -> String {
        await migrationTask.value
        return await sessionManager.peek()
    }

    /// Toggles observer mode. Purchases already in flight still finish with the store. While
    /// commerce is unavailable, passing `false` keeps observer mode enabled.
    ///
    /// `nonisolated` so embedding hosts (the React Native engine) can flip the mode
    /// synchronously; the flag is an atomic the header factory and orchestrator already share.
    public nonisolated func setReadOnly(_ readOnly: Bool) {
        readOnlyFlag.value = readOnly || !commerceEnabled
    }

    /// Whether the SDK currently runs in observer mode.
    public nonisolated var isReadOnly: Bool {
        return readOnlyFlag.value
    }

    // MARK: - Feature flags and analytics

    /// Evaluates feature flags for the current identity.
    ///
    /// Cache-first with a 5 minute stale window; cached results are served indefinitely while the
    /// backend is unreachable, so a flag never flips back to its default during an outage.
    ///
    /// - Parameter keys: Flag keys to evaluate; `nil` evaluates every flag.
    public func getFeatureFlags(_ keys: [String]? = nil) async throws -> [SdkFeatureFlagResult] {
        return try await getFeatureFlagsState(keys).value
    }

    /// ``getFeatureFlags(_:)`` with the freshness of the values it returned.
    public func getFeatureFlagsState(_ keys: [String]? = nil) async throws -> Stale<
        [SdkFeatureFlagResult]
    > {
        guard options.enabled else {
            return Stale(value: [])
        }
        await migrationTask.value

        let distinctId = await identityStore.getDistinctId()
        let cacheKey = VoidhashClient.flagsCacheKey(distinctId: distinctId, keys: keys)
        let cached = await cacheManager.get(cacheKey, as: [SdkFeatureFlagResult].self)

        if let cached, !cached.isStale {
            return Stale(value: cached.value, isStale: false, isExpired: cached.isExpired)
        }

        guard await canReachNetwork() else {
            try surfaceAuthFailureIfUnserved(hasCache: cached != nil)
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
        if case .success(let fresh)? = await value(of: refresh, withinBudget: false) {
            return Stale(value: fresh)
        }
        return Stale(value: [], isStale: true, isExpired: true)
    }

    @discardableResult
    private func refreshFlags(keys: [String]?) async throws -> [SdkFeatureFlagResult] {
        await migrationTask.value
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
        let response = try await guarded("flags.evaluate") { [apiClient] in
            try await apiClient.evaluateFlags(headers: headers, flagKeys: keys)
        }
        await cacheManager.set(
            cacheKey,
            value: response.flags,
            staleTime: VoidhashClient.flagsCacheStaleTimeMilliseconds
        )
        return response.flags
    }

    /// Queues an analytics event.
    public func capture(_ eventName: String, properties: [String: JSONValue] = [:]) async {
        guard options.enabled else {
            return
        }
        await migrationTask.value
        await analytics.capture(eventName, properties: properties)
    }

    /// Sends every queued analytics event.
    ///
    /// Never throws: an unreachable backend leaves the events on disk and reports them as
    /// `pending`. Only one flush runs at a time; concurrent callers join the running one.
    @discardableResult
    public func flush() async -> FlushStatus {
        guard options.enabled else {
            return FlushStatus(flushed: 0, pending: 0)
        }
        await migrationTask.value
        return await analytics.flush()
    }

    /// Captures a `$screen` event for a screen the SDK cannot see on its own (custom
    /// navigation, onboarding steps, pager pages).
    ///
    /// Every call is a new screen instance, so calling it twice with the same name emits twice.
    /// `properties` are merged under the reserved `$screen_*` properties.
    public func screen(_ name: String, properties: [String: JSONValue] = [:]) async {
        guard options.enabled else {
            return
        }
        manualScreenCounter += 1
        let view = ScreenView(
            identity: "manual:\(name):\(manualScreenCounter)", name: name, source: .manual)
        await trackScreen(view, properties: properties)
    }

    /// Stops the lifecycle observation and the background analytics flush. The client stays
    /// usable; ``Voidhash/configure(publishableKey:options:)`` calls this on the client it
    /// replaces.
    public func shutdown() async {
        isShutDown = true
        initializationTask?.cancel()
        lifecycleSubscription?.cancel()
        lifecycleSubscription = nil
        connectivitySubscription?.cancel()
        connectivitySubscription = nil
        await analytics.persist()
        await analytics.stopAutoFlush()
    }

    // MARK: - Screen tracking

    /// Feeds a view through the screen tracker and captures `$screen` when it is a new screen.
    func trackScreen(_ view: ScreenView, properties: [String: JSONValue] = [:]) async {
        guard options.enabled,
            let screenProperties = screenTracker.transition(view, now: dependencies.analyticsNow())
        else {
            return
        }
        await migrationTask.value
        await analytics.capture(
            AutomaticEvents.screen,
            properties: properties.merging(screenProperties) { _, reserved in reserved })
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

    // MARK: - Store sheets

    /// Presents the offer code redemption sheet. Inert while commerce is unavailable.
    public func presentCodeRedemptionSheet() throws {
        guard options.enabled, commerceEnabled else {
            return
        }
        try engine.presentCodeRedemptionSheet()
    }

    /// Presents the subscription management sheet. Inert while commerce is unavailable.
    public func showManageSubscriptions() async throws {
        guard options.enabled, commerceEnabled else {
            return
        }
        try await engine.showManageSubscriptions()
    }

    // MARK: - Paywalls

    /// Resolves and presents the paywall assigned to `location`.
    ///
    /// - Parameter delegate: Held weakly — keep a strong reference to it for as long as the
    ///   paywall is presented, or its callbacks silently stop firing.
    @discardableResult
    public func presentPaywall(
        location: String, delegate: (any VoidhashPaywallDelegate)? = nil
    ) async throws -> PaywallPresentationResult {
        guard options.enabled, commerceEnabled else {
            return .notAssigned
        }
        _ = try await ensureInitialized()
        return try await paywallCoordinator().present(location: location, delegate: delegate)
    }

    #if canImport(UIKit)
        /// Resolves and presents the paywall assigned to `location` from a specific
        /// view controller.
        @discardableResult
        public func presentPaywall(
            location: String,
            from viewController: UIViewController?,
            delegate: (any VoidhashPaywallDelegate)? = nil
        ) async throws -> PaywallPresentationResult {
            presentationTarget.viewController = viewController
            return try await presentPaywall(location: location, delegate: delegate)
        }
    #endif

    /// Dismisses the presented paywall.
    public func dismissPaywall() async throws {
        guard options.enabled, commerceEnabled else {
            return
        }
        try await paywallCoordinator().dismiss()
    }

    /// Resolves the paywall assigned to `location` without presenting it.
    ///
    /// Cache-first with a 7 day lifetime and a 1 hour stale window, so a placement the device has
    /// seen before resolves offline and, after a boot preload, with no request at all.
    ///
    /// Embedded hosts (for example the React Native SDK) use this together with their own
    /// presenter; the returned envelope carries everything a renderer needs.
    public func getPaywall(location: String) async throws -> SdkResolvedPaywall? {
        return try await getPaywallState(location: location).value
    }

    /// ``getPaywall(location:)`` with the freshness of the configuration it returned.
    public func getPaywallState(location: String) async throws -> Stale<SdkResolvedPaywall?> {
        guard options.enabled, commerceEnabled else {
            return Stale(value: nil)
        }
        _ = try await ensureInitialized()
        await migrationTask.value
        let distinctId = await identityStore.getDistinctId()

        let unassigned = await cacheManager.get(
            VoidhashClient.unassignedPaywallCacheKey(distinctId: distinctId, location: location),
            as: Bool.self)
        let assigned =
            unassigned == nil
            ? await cacheManager.get(
                VoidhashClient.paywallCacheKey(distinctId: distinctId, location: location),
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
            await rememberPlacement(location)
        }

        if let cached, !cached.isStale {
            return Stale(value: cached.value, isStale: false, isExpired: cached.isExpired)
        }

        guard await canReachNetwork() else {
            try surfaceAuthFailureIfUnserved(hasCache: cached != nil)
            return Stale(
                value: cached?.value, isStale: true, isExpired: cached?.isExpired ?? true)
        }

        let refresh = Task {
            try await self.refreshPaywall(location: location, distinctId: distinctId)
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

    /// Resolves a placement for presentation, distinguishing "nothing is assigned here" from
    /// "this device has never seen this placement and cannot reach the backend".
    ///
    /// - Throws: ``PaywallActionError`` with `PAYWALL_UNAVAILABLE` in the second case, which the
    ///   coordinator turns into ``PaywallPresentationResult/unavailable``.
    private func resolvePaywallForPresentation(location: String) async throws -> SdkResolvedPaywall?
    {
        let state = try await getPaywallState(location: location)
        if state.value == nil, state.isExpired, state.isStale {
            throw PaywallActionError(
                code: "PAYWALL_UNAVAILABLE",
                message:
                    "No cached configuration for \"\(location)\" and the backend is unreachable"
            )
        }
        return state.value
    }

    @discardableResult
    private func refreshPaywall(
        location: String,
        distinctId: String
    ) async throws -> SdkResolvedPaywall? {
        let cacheKey = VoidhashClient.paywallCacheKey(
            distinctId: distinctId, location: location)
        return try await paywallFlight.run(key: cacheKey) { [weak self] in
            guard let self else {
                return nil
            }
            return try await self.fetchAndCachePaywall(
                location: location, distinctId: distinctId)
        }
    }

    private func fetchAndCachePaywall(
        location: String,
        distinctId: String
    ) async throws -> SdkResolvedPaywall? {
        let headers = headerFactory.build(distinctId: distinctId)
        let resolved = try await guarded("paywall.resolve") { [apiClient] in
            try await apiClient.resolvePaywall(headers: headers, locationSlug: location)
        }
        if let resolved {
            await cacheManager.set(
                VoidhashClient.paywallCacheKey(distinctId: distinctId, location: location),
                value: resolved,
                ttl: VoidhashClient.paywallCacheTtlMilliseconds,
                staleTime: VoidhashClient.paywallCacheStaleTimeMilliseconds
            )
            await cacheManager.delete(
                VoidhashClient.unassignedPaywallCacheKey(
                    distinctId: distinctId, location: location))
        } else {
            await cacheManager.set(
                VoidhashClient.unassignedPaywallCacheKey(
                    distinctId: distinctId, location: location),
                value: true,
                ttl: VoidhashClient.paywallCacheTtlMilliseconds,
                staleTime: VoidhashClient.paywallCacheStaleTimeMilliseconds
            )
            await cacheManager.delete(
                VoidhashClient.paywallCacheKey(distinctId: distinctId, location: location))
        }
        await rememberPlacement(location)
        return resolved
    }

    /// Warms the presenter with the bundle a cached paywall points at.
    ///
    /// Best effort: a cached configuration whose assets never loaded would still render, just
    /// slower, so a failure here is reported without failing initialization.
    private func prefetchPaywallAssets(location: String, resolved: SdkResolvedPaywall?) async {
        guard let htmlUrl = resolved?.showing.paywallRelease?.htmlUrl else {
            return
        }
        do {
            _ = try await paywallCoordinator().preload(
                locationSlug: location, htmlUrl: htmlUrl)
        } catch {
            // The configuration is still cached and will render; only the warm start is lost.
            diagnostics.emit(
                .transport, code: "PAYWALL_ASSET_PREFETCH_FAILED", operation: "paywall.prefetch",
                retryable: true, message: "Could not warm \(htmlUrl): \(error.localizedDescription)"
            )
        }
    }

    /// Records that this device resolved `location`, so the next launch preloads it.
    private func rememberPlacement(_ location: String) async {
        guard knownPlacements.last != location else {
            return
        }
        knownPlacements.removeAll { $0 == location }
        knownPlacements.append(location)
        if knownPlacements.count > VoidhashClient.maxKnownPlacements {
            knownPlacements.removeFirst(knownPlacements.count - VoidhashClient.maxKnownPlacements)
        }
        await cacheManager.set(VoidhashClient.knownPlacementsCacheKey, value: knownPlacements)
    }

    /// Adopts an externally supplied schema without a server round-trip.
    ///
    /// Escape hatch for preview and testing hosts; the next background refresh replaces it.
    public func injectInternalSchema(_ schema: RuntimeSchema) {
        publishSchema(schema)
    }

    // MARK: - Embedded-engine surface

    // Stateless data-plane operations for hosts embedding the client as their backend
    // transport (the React Native SDK). Each takes the distinct id explicitly instead of
    // reading the persisted identity, so the host stays the single source of truth.

    private func headers(for distinctId: String) async -> [String: String] {
        return headerFactory.build(distinctId: distinctId)
    }

    /// Fetches the runtime schema. Deliberately does not run initialization: the embedded
    /// surface is data-plane only and must never start the store's transaction observer,
    /// which the host already owns.
    public func fetchSchema(distinctId: String) async throws -> RuntimeSchema {
        return try await schemaManager.resolveSchema(headers: headers(for: distinctId))
    }

    /// Fetches the person snapshot; `nil` when the backend has none yet.
    public func fetchPerson(distinctId: String) async throws -> SdkPerson? {
        return try await apiClient.getPerson(headers: headers(for: distinctId))
    }

    /// Aliases `distinctId` onto `externalUserId` and returns the merged person.
    public func identifyPerson(
        distinctId: String,
        externalUserId: String,
        email: String?,
        name: String?
    ) async throws -> SdkPerson {
        return try await apiClient.identify(
            headers: headers(for: distinctId),
            body: SdkIdentifyBody(distinctId: externalUserId, email: email, name: name)
        )
    }

    /// Writes person traits and returns the updated person.
    public func setPersonTraits(
        distinctId: String,
        traits: [String: JSONValue]
    ) async throws -> SdkPerson {
        return try await apiClient.setPersonTraits(
            headers: headers(for: distinctId),
            body: SdkPersonTraitsBody(traits: traits)
        )
    }

    /// Evaluates feature flags; `keys == nil` evaluates every flag.
    public func evaluateFeatureFlags(
        distinctId: String,
        keys: [String]?
    ) async throws -> [SdkFeatureFlagResult] {
        let response = try await apiClient.evaluateFlags(
            headers: headers(for: distinctId), flagKeys: keys)
        return response.flags
    }

    /// Resolves the paywall assigned to `location`; `nil` when nothing is showing.
    public func resolvePaywallConfig(
        distinctId: String,
        locationSlug: String
    ) async throws -> SdkResolvedPaywall? {
        guard commerceEnabled else {
            return nil
        }
        return try await apiClient.resolvePaywall(
            headers: headers(for: distinctId), locationSlug: locationSlug)
    }

    /// Records a store transaction in the durable outbox and tries to sync it.
    ///
    /// The receipt is written to disk before any network call, so an outage or a process death
    /// between the store handing the transaction over and the backend recording it cannot lose
    /// the purchase. `false` means "not acknowledged yet", never "lost": the outbox retries on
    /// the next flush, foreground or connectivity restore.
    @discardableResult
    public func syncStoreTransaction(
        _ body: SdkSyncTransactionBody,
        distinctId: String
    ) async throws -> Bool {
        await migrationTask.value
        let result = await outbox.enqueue(body, distinctId: distinctId)
        // Strictly this transaction: a drain that happened to deliver an older receipt says
        // nothing about the one the caller just handed over.
        let accepted = result.didAcknowledge(body.transactionId)
        if accepted {
            scheduleGrantRefresh()
        }
        return accepted
    }

    /// Receipts still waiting for a backend acknowledgement.
    public func pendingTransactionCount() async -> Int {
        await migrationTask.value
        return await outbox.pendingCount()
    }

    /// Drains the transaction outbox and the analytics queue.
    ///
    /// Called on foreground, on connectivity restore and by hosts that want to force a sync.
    @discardableResult
    public func syncPendingWork() async -> FlushStatus {
        await migrationTask.value
        await outbox.drain()
        return await analytics.flush()
    }

    // The backend records a receipt asynchronously, so the person read straight after an ack can
    // still predate the grant. Two spaced retries absorb that without a poll loop, off the
    // caller's task so a purchase never waits on them.
    private func scheduleGrantRefresh() {
        guard dependencies.runBackgroundRefreshes else {
            return
        }
        Task { [weak self, clock] in
            _ = try? await self?.refreshPerson()
            for delay in [2000.0, 5000.0] {
                await clock.sleep(milliseconds: delay)
                _ = try? await self?.refreshPerson()
            }
        }
    }

    /// Records a development purchase through the development gateway.
    ///
    /// - Returns: Whether the backend explicitly accepted the simulated transaction.
    public func recordDevelopmentPurchase(
        _ body: SdkDevelopmentPurchaseBody,
        distinctId: String
    ) async throws -> Bool {
        return try await apiClient.developmentPurchase(
            headers: headers(for: distinctId), body: body)
    }

    // MARK: - Internals

    /// Adopts a schema resolved outside ``runInitialization`` — the stale-while-revalidate
    /// refresh — so a warm-cache session stops running on the stale schema.
    private func publishSchema(_ schema: RuntimeSchema) {
        currentSchema = schema
        (engine as? DevelopmentStoreEngine)?.updateCatalog(schema)
    }

    /// Awaits the running initialization, dropping it when it fails so the next call retries.
    private func ensureInitialized() async throws -> RuntimeSchema {
        let task = ensureInitializationTask()
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
        await migrationTask.value
        // A shutdown that landed while this was suspended means the client was replaced; it
        // must not come back to life on its own (see `start()`).
        guard !isShutDown else {
            throw CancellationError()
        }

        if let distinctId = options.distinctId {
            await identityStore.identify(distinctId: distinctId)
        }

        // Analytics, lifecycle observation and connectivity come up first and unconditionally.
        // Everything below them can fail on a cold-cache offline launch, and none of it is a
        // reason for the app to lose a session's worth of events. Each subscription is guarded:
        // a `shutdown()` that landed while this was suspended means the client was replaced,
        // and a replaced client must not come back to life on its own.
        if options.automaticLifecycleEvents {
            await captureStartupEvents()
            if !isShutDown {
                observeLifecycle()
            }
        }
        if dependencies.startAutoFlush, !isShutDown {
            await analytics.startAutoFlush()
        }
        if !isShutDown {
            observeConnectivity()
        }

        // A failed store connection is not fatal either: the observer is what reconciles
        // purchases made outside this session, so it is retried on the next foreground refresh.
        do {
            _ = try await engine.initConnection(onTransaction: { [weak self] storeTransaction in
                guard let self else { return }
                Task { await self.handleObservedTransaction(storeTransaction) }
            })
        } catch {
            warn("Failed to connect to the store: \(error)")
            diagnostics.emit(
                .transport, code: "STORE_CONNECTION_FAILED", operation: "client.initialize",
                retryable: true, message: String(describing: error))
        }

        let schema: RuntimeSchema
        if let currentSchema {
            schema = currentSchema
        } else {
            schema = await schemaManager.resolveSchemaTolerant(
                headers: await headerFactory.build())
        }
        currentSchema = schema

        knownPlacements = VoidhashClient.normalizeKnownPlacements(
            await cacheManager.get(
                VoidhashClient.knownPlacementsCacheKey, as: [String].self)?.value ?? [])

        if dependencies.runBackgroundRefreshes {
            Task { [weak self] in
                await self?.runBootRefresh()
            }
        }

        Task { [orchestrator = orchestrator(), warn] in
            do {
                try await orchestrator.reconcileObservedTransactions(schema: schema)
            } catch {
                warn("Failed to reconcile observed transactions: \(error)")
            }
        }

        return schema
    }

    /// Warms everything the app is likely to ask for, in the order it is likely to ask.
    ///
    /// Runs after local state is loaded and never blocks a caller: `waitForInitialization` has
    /// already returned by the time this makes its first request.
    private func runBootRefresh() async {
        let canRefresh = await canReachNetwork()
        if canRefresh {
            await outbox.drain()
            _ = try? await refreshPerson()
            _ = try? await refreshFlags(keys: nil)
        }

        var placements = options.preloadPlacements
        for placement in knownPlacements where !placements.contains(placement) {
            placements.append(placement)
        }
        let distinctId = await identityStore.getDistinctId()
        for placement in placements {
            let refreshed =
                canRefresh
                ? try? await refreshPaywall(location: placement, distinctId: distinctId) : nil
            let resolved: SdkResolvedPaywall?
            if let refreshed {
                resolved = refreshed
            } else {
                resolved = await cacheManager.get(
                    VoidhashClient.paywallCacheKey(
                        distinctId: distinctId, location: placement),
                    as: SdkResolvedPaywall.self
                )?.value
            }
            await prefetchPaywallAssets(location: placement, resolved: resolved)
        }
    }

    // Mirrors `captureAutomaticStartupEvents` in the React Native SDK. The adapter cannot
    // fail, so a present-but-undecodable entry is the degraded case: it costs the
    // install/update event, never the `$app_opened` that marks the session.
    private func captureStartupEvents() async {
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
        eventNames.append(AutomaticEvents.appOpened)

        for eventName in eventNames {
            await analytics.capture(eventName)
        }
        await cacheManager.set(VoidhashClient.lastSeenAppReleaseCacheKey, value: current)
    }

    private func observeLifecycle() {
        guard lifecycleSubscription == nil else {
            return
        }
        lifecycleSubscription = dependencies.lifecycleObserver.subscribe {
            [weak self, lifecycleQueue] state in
            guard let self else {
                return
            }
            lifecycleQueue.enqueue { await self.handleLifecycleState(state) }
        }
    }

    private func handleLifecycleState(_ state: String) async {
        // The lifecycle event is captured before any network work: a foreground refresh that
        // waits on a dead backend must not delay — or, on a kill, lose — `$app_became_active`.
        if let eventName = lifecycleTracker.transition(to: state) {
            await analytics.capture(eventName)
        }
        if state == LifecycleTracker.background {
            // The persist-behind window is the only place events live in memory alone; close it
            // before the process can be suspended or killed.
            await analytics.persist()
            // A flush is worth attempting while the platform still grants execution time. It
            // runs off the lifecycle queue so a quick return to the foreground is not held up.
            Task { [analytics, runner = dependencies.backgroundTaskRunner] in
                await runner.run("com.voidhash.analytics.flush") {
                    _ = await analytics.flush()
                }
            }
        }
        if state == LifecycleTracker.active {
            Task { [weak self] in
                await self?.handleForeground()
            }
        }
    }

    private func handleObservedTransaction(_ storeTransaction: StoreKitTransactionInfo) async {
        guard let schema = currentSchema else {
            return
        }
        do {
            try await orchestrator().processObservedTransaction(
                VoidhashTransaction(storeTransaction: storeTransaction), schema: schema)
        } catch {
            warn(
                "Failed to process the observed transaction \(storeTransaction.transactionId): \(error)"
            )
        }
    }

    private func orchestrator() -> PurchaseOrchestrator {
        if let orchestratorStorage {
            return orchestratorStorage
        }

        let orchestrator = PurchaseOrchestrator(
            engine: engine,
            api: OutboxTransactionSync(outbox: outbox),
            developmentApi: apiClient,
            isDevelopmentMode: isDevelopmentMode,
            cacheManager: cacheManager,
            headersProvider: { [headerFactory] in await headerFactory.build() },
            distinctIdProvider: { [identityStore] in await identityStore.getDistinctId() },
            isReadOnly: { [readOnlyFlag] in readOnlyFlag.value },
            refreshPerson: { [weak self] in
                await self?.scheduleGrantRefresh()
            }
        )
        orchestratorStorage = orchestrator
        return orchestrator
    }

    private func paywallCoordinator() -> PaywallCoordinator {
        if let paywallCoordinatorStorage {
            return paywallCoordinatorStorage
        }

        let coordinator = PaywallCoordinator(
            presenter: resolvePresenter(),
            resolvePaywall: { [weak self] locationSlug in
                return try await self?.resolvePaywallForPresentation(location: locationSlug)
            },
            getProducts: { [weak self] in
                return try await self?.getProducts() ?? []
            },
            purchaseProduct: { [weak self] product in
                try await self?.purchase(product: product)
            },
            restorePurchases: { [weak self] in
                try await self?.restorePurchases()
            },
            captureEvent: { [analytics] name, properties in
                Task { await analytics.capture(name, properties: properties) }
            },
            openExternalUrl: dependencies.openExternalUrl ?? VoidhashClient.defaultOpenExternalUrl,
            locale: dependencies.device.locales.first,
            warn: warn
        )
        paywallCoordinatorStorage = coordinator
        return coordinator
    }

    private func resolvePresenter() -> any PaywallPresenting {
        if let injectedPresenter {
            return injectedPresenter
        }
        if let presenter = dependencies.presenter {
            return presenter
        }

        #if canImport(UIKit)
            let target = presentationTarget
            return PaywallPresenterCore(
                contextProvider: { ExplicitPaywallPresentationContextProvider(target: target) },
                onLoadFailed: { [warn] failure in warn(failure.description) }
            )
        #else
            return UnavailablePaywallPresenter()
        #endif
    }

    private func cachePerson(_ person: SdkPerson, distinctId: String) async {
        await cacheManager.set(
            VoidhashClient.personCacheKey(distinctId),
            value: person,
            ttl: VoidhashClient.personCacheTtlMilliseconds,
            staleTime: VoidhashClient.personCacheStaleTimeMilliseconds
        )
    }

    static func personCacheKey(_ distinctId: String) -> String {
        return "person:\(distinctId)"
    }

    /// Flags are cached per identity and per requested key set, so a narrow `getFeatureFlags(["a"])`
    /// never answers a later `getFeatureFlags()` from a partial result.
    static func flagsCacheKey(distinctId: String, keys: [String]?) -> String {
        guard let keys, !keys.isEmpty else {
            return "flags:\(distinctId):all"
        }
        let serialized = keys.sorted().map { "\($0.utf8.count):\($0)" }.joined()
        return "flags:\(distinctId):\(CacheNamespace.hash(serialized))"
    }

    static func paywallCacheKey(distinctId: String, location: String) -> String {
        return "paywall:\(distinctId):\(location)"
    }

    static func unassignedPaywallCacheKey(distinctId: String, location: String) -> String {
        return "paywall-unassigned:\(distinctId):\(location)"
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
    private func guarded<Value: Sendable>(
        _ operation: String,
        authenticationProbe: Bool = false,
        _ work: @Sendable () async throws -> Value
    ) async throws -> Value {
        let host = VoidhashClient.host(of: options.baseUrl)
        guard options.enabled, gate.allowsOutbound(probe: authenticationProbe) else {
            throw VoidhashApiError(
                code: "OUTBOUND_PAUSED",
                message: "Outbound requests are paused: the publishable key was rejected")
        }
        guard let permit = await breaker.acquire(host: host) else {
            throw VoidhashApiError(
                code: "CIRCUIT_OPEN",
                message: "Requests to \(host) are paused while it recovers")
        }

        do {
            let value = try await work()
            await breaker.release(permit, retryableFailure: nil)
            if gate.isPaused {
                // A request that got through while the gate was probing proves the key works.
                gate.endProbe(succeeded: true, now: clock.now())
            }
            return value
        } catch is CancellationError {
            await breaker.abandon(permit)
            throw CancellationError()
        } catch {
            await recordNetworkFailure(error, operation: operation, permit: permit)
            throw error
        }
    }

    private func recordNetworkFailure(
        _ error: any Error, operation: String, permit: CircuitBreakerPermit
    ) async {
        let apiError = error as? VoidhashApiError

        if apiError?.isAuthFailure == true {
            // A rejected key is a configuration problem, not an outage: pausing keeps the SDK
            // from burning a user's session on requests that can only fail, and the breaker is
            // deliberately left closed so a key rotation takes effect immediately.
            gate.pause(now: clock.now())
            gate.endProbe(succeeded: false, now: clock.now())
            diagnostics.emit(
                .auth, code: "AUTHENTICATION_FAILED", operation: operation,
                httpStatus: apiError?.statusCode,
                message: "The publishable key was rejected; outbound requests are paused")
            await breaker.release(permit, retryableFailure: false)
            return
        }

        let retryable = apiError?.isRetryable ?? true
        await breaker.release(
            permit,
            retryableFailure: NetworkPolicy.countsTowardsCircuitBreaker(
                statusCode: apiError?.statusCode))
        diagnostics.emit(
            .transport, code: apiError?.code ?? "NETWORK_ERROR", operation: operation,
            retryable: retryable, httpStatus: apiError?.statusCode,
            message: String(describing: error))
    }

    /// Surfaces a rejected publishable key exactly once, and only to a read that had nothing to
    /// serve. A read backed by cache stays a success: the app keeps working.
    private func surfaceAuthFailureIfUnserved(hasCache: Bool) throws {
        guard gate.isPaused, !hasCache, !didSurfaceAuthFailure else {
            return
        }
        didSurfaceAuthFailure = true
        throw VoidhashApiError(
            code: "AUTHENTICATION_FAILED",
            message:
                "The publishable key was rejected. Requests are paused; queued data is retained.",
            statusCode: 401
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
        // Not a task group: a group awaits its children before returning, and the refresh is an
        // unstructured task that keeps running past the budget by design.
        let race = FirstAcrossTheLine<Result<Value, any Error>?>()
        return await withCheckedContinuation { continuation in
            Task {
                let outcome = await VoidhashClient.outcome(of: task)
                race.resume(continuation, with: outcome)
            }
            Task {
                await sleepForBudget(budget)
                race.resume(continuation, with: nil)
            }
        }
    }

    /// Drops every entry keyed by `previousDistinctId`: its person, flags and paywall
    /// resolutions. Paywalls are assigned per person, so the old identity's entries can never
    /// answer a read again and would otherwise sit in the store for good.
    private func invalidatePerIdentityCache(previousDistinctId: String) async {
        await cacheManager.delete(VoidhashClient.personCacheKey(previousDistinctId))
        await cacheManager.deleteByPrefix("flags:\(previousDistinctId):")
        await cacheManager.deleteByPrefix("paywall:\(previousDistinctId):")
        await cacheManager.deleteByPrefix("paywall-unassigned:\(previousDistinctId):")
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
    private func handleConnectivityChange(isOnline: Bool) async {
        let previous = wasOnline
        wasOnline = isOnline
        guard isOnline, previous == false else {
            return
        }
        await handleConnectivityRestored()
    }

    /// Flushes the queues and refreshes stale state the moment a usable path comes back, at most
    /// once a minute together with the foreground refresh so a flapping link cannot re-probe.
    private func handleConnectivityRestored() async {
        guard dependencies.runBackgroundRefreshes,
            claimRecoveryRefresh(lastRefreshAt: &lastConnectivityRefreshAt)
        else {
            return
        }
        await breaker.halfOpenAll()
        await probeAuthPauseIfDue()
        guard await canReachNetwork() else {
            return
        }
        await analytics.flush()
        await outbox.drain()
        _ = try? await refreshPerson()
        _ = try? await refreshFlags(keys: nil)
    }

    /// Tries one request to find out whether a rejected key has since been fixed.
    ///
    /// The auth pause is not a latch: a key that was rotated, a clock skew that resolved or a
    /// backend that briefly answered 403 would otherwise keep the SDK silent until the app is
    /// killed. One probe a minute costs nothing and recovers on its own.
    private func probeAuthPauseIfDue() async {
        guard gate.beginProbe(now: clock.now()) else {
            return
        }
        let distinctId = await identityStore.getDistinctId()
        do {
            _ = try await fetchAndCachePerson(
                distinctId: distinctId, authenticationProbe: true)
            gate.endProbe(succeeded: true, now: clock.now())
            didSurfaceAuthFailure = false
            diagnostics.emit(
                .auth, code: "AUTHENTICATION_RECOVERED", operation: "client.probe",
                message: "The publishable key is accepted again; outbound requests resumed")
        } catch {
            gate.endProbe(succeeded: false, now: clock.now())
        }
    }

    /// Foreground handler: half-opens the breaker, flushes and refreshes, at most once a minute.
    ///
    /// Only placements whose cached configuration is stale are re-resolved: a fresh one would be
    /// a request per remembered placement on every foreground for nothing.
    private func handleForeground() async {
        guard dependencies.runBackgroundRefreshes,
            claimRecoveryRefresh(lastRefreshAt: &lastForegroundRefreshAt)
        else {
            return
        }
        await breaker.halfOpenAll()
        await probeAuthPauseIfDue()
        guard await canReachNetwork() else {
            return
        }
        await analytics.flush()
        await outbox.drain()
        _ = try? await refreshPerson()
        _ = try? await refreshFlags(keys: nil)
        let distinctId = await identityStore.getDistinctId()
        for placement in knownPlacements {
            guard await isPaywallStale(placement, distinctId: distinctId) else {
                continue
            }
            _ = try? await refreshPaywall(location: placement, distinctId: distinctId)
        }
    }

    private func isPaywallStale(_ location: String, distinctId: String) async -> Bool {
        if let assigned = await cacheManager.get(
            VoidhashClient.paywallCacheKey(distinctId: distinctId, location: location),
            as: SdkResolvedPaywall.self)
        {
            return assigned.isStale
        }
        if let unassigned = await cacheManager.get(
            VoidhashClient.unassignedPaywallCacheKey(distinctId: distinctId, location: location),
            as: Bool.self)
        {
            return unassigned.isStale
        }
        return true
    }

    /// Whether a recovery refresh may run now for the trigger owning `lastRefreshAt`; claims
    /// the window.
    private func claimRecoveryRefresh(lastRefreshAt: inout Double) -> Bool {
        let timestamp = clock.now()
        guard
            timestamp - lastRefreshAt >= VoidhashClient.foregroundRefreshDebounceMilliseconds
        else {
            return false
        }
        lastRefreshAt = timestamp
        return true
    }

    private static func outcome<Value: Sendable>(of task: Task<Value, any Error>) async -> Result<
        Value, any Error
    > {
        do {
            return .success(try await task.value)
        } catch {
            return .failure(error)
        }
    }

    private static func host(of url: URL) -> String {
        return url.host ?? url.absoluteString
    }

    /// A file-backed record store, falling back to the cache adapter where no writable
    /// Application Support directory exists.
    private static func defaultRecordStore(
        namespace: String, name: String, adapter: any CacheAdapter
    ) -> any RecordStore {
        if let store = FileRecordStore.applicationSupport(
            namespace: CacheNamespace.hash(namespace), name: name)
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

    private static let defaultOpenExternalUrl: @Sendable (String) async -> Void = { urlString in
        #if canImport(UIKit)
            guard let url = URL(string: urlString) else {
                return
            }
            await MainActor.run {
                UIApplication.shared.open(url)
            }
        #endif
    }
}

/// Whether a person write reached the backend.
public enum PersonWriteStatus: String, Sendable, Equatable {
    /// The backend confirmed the write.
    case confirmed
    /// The write is queued and will be applied when the queue drains.
    case deferred
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

/// Routes every orchestrator sync through the durable outbox.
///
/// The receipt is on disk before the request goes out, so an outage between the store handing a
/// transaction over and the backend recording it costs a retry, never the purchase.
struct OutboxTransactionSync: TransactionSyncing {
    let outbox: TransactionOutbox

    func syncTransaction(headers: [String: String], body: SdkSyncTransactionBody) async throws
        -> SdkSyncTransactionResponse
    {
        let distinctId =
            headers.first { $0.key.caseInsensitiveCompare("x-distinct-id") == .orderedSame }?
            .value ?? ""
        let result = await outbox.enqueue(body, distinctId: distinctId)
        return SdkSyncTransactionResponse(
            accepted: result.didAcknowledge(body.transactionId))
    }
}

#if canImport(UIKit)
    /// Holds the view controller a `presentPaywall(location:from:)` call named, if any.
    final class PresentationTargetBox: @unchecked Sendable {
        private let lock = NSLock()
        private weak var storage: UIViewController?

        var viewController: UIViewController? {
            get { lock.withLock { storage } }
            set { lock.withLock { storage = newValue } }
        }
    }

    /// Presents from the explicitly named view controller, falling back to the key window.
    @MainActor
    final class ExplicitPaywallPresentationContextProvider: PaywallPresentationContextProviding {
        private let target: PresentationTargetBox

        init(target: PresentationTargetBox) {
            self.target = target
        }

        func topViewController() -> UIViewController? {
            if let viewController = target.viewController {
                return viewController
            }
            return DefaultPaywallPresentationContextProvider().topViewController()
        }
    }
#else
    /// Stand-in used where no WebView presenter exists (macOS builds of the package).
    final class UnavailablePaywallPresenter: PaywallPresenting {
        func preload(locationSlug: String, htmlUrl: String) async throws -> Bool {
            throw VoidhashStoreError.paywallPresenterNotAvailable
        }

        func show(
            locationSlug: String,
            htmlUrl: String,
            onBridgeEvent: PaywallRawEventHandler?,
            onDismiss: PaywallDismissedHandler?
        ) async throws -> Bool {
            throw VoidhashStoreError.paywallPresenterNotAvailable
        }

        func dismiss() async throws {
            throw VoidhashStoreError.paywallPresenterNotAvailable
        }

        func postMessage(locationSlug: String, data: String) {}

        func release(locationSlug: String) {}
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

    /// Installs a presenter after construction. Test affordance.
    func installPresenterForTesting(_ presenter: any PaywallPresenting) {
        paywallCoordinatorStorage = nil
        injectedPresenter = presenter
    }
}
