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
        var session: URLSession = .shared
        var cacheAdapter: any CacheAdapter = UserDefaultsCacheAdapter()
        var engine: (any StoreKitEngineProtocol)?
        var presenter: (any PaywallPresenting)?
        var device: SdkDeviceInfo = SdkDeviceInfo.current()
        var analyticsNow: @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 }
        var analyticsSleep: @Sendable (Double) async -> Void = { milliseconds in
            try? await Task.sleep(nanoseconds: UInt64(milliseconds * 1_000_000))
        }
        var openExternalUrl: (@Sendable (String) async -> Void)?
        var startAutoFlush = true
        var lifecycleObserver: any AppLifecycleObserving = VoidhashClient.defaultLifecycleObserver
        /// The commerce release gate; tests flip it to exercise owner-mode behaviour.
        var isCommerceEnabled = commerceFeaturesEnabled
    }

    private static let personCacheTtlMilliseconds: Double = 1000 * 60 * 60 * 24 * 2
    /// Cache key of the `{appBuild, appVersion}` pair seen on the previous launch; shared with
    /// the React Native SDK so both read the same envelope.
    static let lastSeenAppReleaseCacheKey = "voidhash:analytics:last-seen-app-release"

    struct AppReleaseInfo: Codable, Sendable, Equatable {
        let appBuild: String
        let appVersion: String
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
    private var currentSchema: RuntimeSchema?
    private var lifecycleTracker = LifecycleTracker()
    private var lifecycleSubscription: (any AppLifecycleSubscription)?
    private let lifecycleQueue = SerialTaskQueue()
    private var screenTracker: ScreenTracker
    private var manualScreenCounter = 0

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
        cacheManager = CacheManager(adapter: dependencies.cacheAdapter)
        identityStore = IdentityStore(cacheManager: cacheManager)
        apiClient = VoidhashApiClient(baseUrl: options.baseUrl, session: dependencies.session)
        engine = dependencies.engine ?? (developmentMode ? DevelopmentStoreEngine() : StoreKitEngine())
        let clientBox = WeakClientBox()
        schemaManager = SchemaManager(
            apiClient: apiClient,
            cacheManager: cacheManager,
            appVersion: dependencies.device.appVersion,
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
            debug: options.debug,
            warn: options.onWarning ?? VoidhashWarnings.standard
        )
        clientBox.set(self)
    }

    /// Kicks off initialization without waiting for it.
    public func start() {
        guard options.enabled else {
            return
        }
        _ = ensureInitializationTask()
    }

    /// Awaits initialization, returning the resolved runtime schema.
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
    /// - Parameter forceFetch: Bypasses the cached snapshot.
    public func getCurrentPerson(forceFetch: Bool = false) async throws -> SdkPerson? {
        guard options.enabled else {
            return nil
        }

        let distinctId = await identityStore.getDistinctId()
        let cacheKey = VoidhashClient.personCacheKey(distinctId)

        if !forceFetch, let cached = await cacheManager.get(cacheKey, as: SdkPerson.self),
            !cached.isStale
        {
            return cached.value
        }

        let headers = headerFactory.build(distinctId: distinctId)
        guard let person = try await apiClient.getPerson(headers: headers) else {
            return nil
        }
        await cachePerson(person, distinctId: distinctId)
        return person
    }

    /// Switches the current identity to `externalUserId` and returns the merged person.
    public func identify(externalUserId: String, email: String? = nil, name: String? = nil)
        async throws -> SdkPerson?
    {
        guard options.enabled else {
            return nil
        }

        let currentDistinctId = await identityStore.getDistinctId()
        let person = try await apiClient.identify(
            headers: headerFactory.build(distinctId: currentDistinctId),
            body: SdkIdentifyBody(distinctId: externalUserId, email: email, name: name)
        )

        await identityStore.identify(distinctId: externalUserId)
        await cachePerson(person, distinctId: externalUserId)
        return person
    }

    /// Sets person traits on the backend and returns the updated person.
    public func setPersonAttributes(_ attributes: [String: JSONValue]) async throws -> SdkPerson? {
        guard options.enabled else {
            return nil
        }

        let distinctId = await identityStore.getDistinctId()
        let person = try await apiClient.setPersonTraits(
            headers: headerFactory.build(distinctId: distinctId),
            body: SdkPersonTraitsBody(traits: attributes)
        )
        await cachePerson(person, distinctId: distinctId)
        return person
    }

    /// Clears the persisted identity and every cached response, and starts a new analytics
    /// session.
    ///
    /// Captures `$sign_out` under the identity and session being cleared, then the next
    /// ``getDistinctId()`` allocates a fresh anonymous distinct id.
    public func reset() async {
        guard options.enabled else {
            return
        }
        if options.automaticLifecycleEvents {
            await analytics.capture(AutomaticEvents.signOut)
        }
        await identityStore.reset()
        // After the cache clear, so the fresh session record is the one that gets persisted.
        await sessionManager.rotate()
    }

    /// Returns the current distinct id, allocating an anonymous one when needed.
    public func getDistinctId() async -> String {
        return await identityStore.getDistinctId()
    }

    /// Returns the analytics session id the next captured event will carry.
    ///
    /// Sessions end after 30 minutes without a capture and on ``reset()``; reading the id does
    /// not extend the session.
    public func sessionId() async -> String {
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
    /// - Parameter keys: Flag keys to evaluate; `nil` evaluates every flag.
    public func getFeatureFlags(_ keys: [String]? = nil) async throws -> [SdkFeatureFlagResult] {
        guard options.enabled else {
            return []
        }

        let distinctId = await identityStore.getDistinctId()
        let response = try await apiClient.evaluateFlags(
            headers: headerFactory.build(distinctId: distinctId), flagKeys: keys)
        return response.flags
    }

    /// Queues an analytics event.
    public func capture(_ eventName: String, properties: [String: JSONValue] = [:]) async {
        guard options.enabled else {
            return
        }
        await analytics.capture(eventName, properties: properties)
    }

    /// Sends every queued analytics event.
    public func flush() async {
        guard options.enabled else {
            return
        }
        await analytics.flush()
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
        lifecycleSubscription?.cancel()
        lifecycleSubscription = nil
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
    /// Embedded hosts (for example the React Native SDK) use this together with their own
    /// presenter; the returned envelope carries everything a renderer needs.
    public func getPaywall(location: String) async throws -> SdkResolvedPaywall? {
        guard options.enabled, commerceEnabled else {
            return nil
        }
        _ = try await ensureInitialized()
        let headers = await headerFactory.build()
        return try await apiClient.resolvePaywall(headers: headers, locationSlug: location)
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
        return await headerFactory.build(distinctId: distinctId)
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

    /// Syncs a store transaction; returns whether the backend accepted it.
    public func syncStoreTransaction(
        _ body: SdkSyncTransactionBody,
        distinctId: String
    ) async throws -> Bool {
        return try await apiClient.syncTransaction(
            headers: headers(for: distinctId), body: body).accepted
    }

    /// Records a development purchase through the development gateway.
    public func recordDevelopmentPurchase(
        _ body: SdkDevelopmentPurchaseBody,
        distinctId: String
    ) async throws {
        try await apiClient.developmentPurchase(headers: headers(for: distinctId), body: body)
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
            return try await task.value
        } catch {
            forgetFailedInitializationTask(task)
            throw error
        }
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
        if let distinctId = options.distinctId {
            await identityStore.identify(distinctId: distinctId)
        }

        // A failed store connection is fatal: without the transaction observer nothing would
        // reconcile purchases made outside this session, so initialization fails and retries.
        _ = try await engine.initConnection(onTransaction: { [weak self] storeTransaction in
            guard let self else { return }
            Task { await self.handleObservedTransaction(storeTransaction) }
        })

        let schema: RuntimeSchema
        if let currentSchema {
            schema = currentSchema
        } else {
            schema = try await schemaManager.resolveSchema(headers: await headerFactory.build())
        }
        currentSchema = schema

        if options.automaticLifecycleEvents {
            await captureStartupEvents()
            observeLifecycle()
        }
        if dependencies.startAutoFlush {
            await analytics.startAutoFlush()
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

    // Mirrors `captureAutomaticStartupEvents` in the React Native SDK. The adapter cannot
    // fail, so a present-but-undecodable entry is the degraded case: it costs the
    // install/update event, never the `$app_opened` that marks the session.
    private func captureStartupEvents() async {
        let current = AppReleaseInfo(
            appBuild: dependencies.device.appBuild ?? "",
            appVersion: dependencies.device.appVersion ?? ""
        )
        let key = VoidhashClient.lastSeenAppReleaseCacheKey
        let previous = await cacheManager.get(key, as: AppReleaseInfo.self)?.value
        let hasEntry = await dependencies.cacheAdapter.get(key) != nil

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
        lifecycleSubscription = dependencies.lifecycleObserver.subscribe { [weak self, lifecycleQueue] state in
            guard let self else {
                return
            }
            lifecycleQueue.enqueue { await self.handleLifecycleState(state) }
        }
    }

    private func handleLifecycleState(_ state: String) async {
        guard let eventName = lifecycleTracker.transition(to: state) else {
            return
        }
        await analytics.capture(eventName)
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
            api: apiClient,
            developmentApi: apiClient,
            isDevelopmentMode: isDevelopmentMode,
            cacheManager: cacheManager,
            headersProvider: { [headerFactory] in await headerFactory.build() },
            distinctIdProvider: { [identityStore] in await identityStore.getDistinctId() },
            isReadOnly: { [readOnlyFlag] in readOnlyFlag.value },
            refreshPerson: { [weak self, warn] in
                do {
                    _ = try await self?.getCurrentPerson(forceFetch: true)
                } catch {
                    warn("Failed to refresh the person after a transaction: \(error)")
                }
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
            resolvePaywall: { [apiClient, headerFactory] locationSlug in
                let headers = await headerFactory.build()
                return try await apiClient.resolvePaywall(
                    headers: headers, locationSlug: locationSlug)
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
