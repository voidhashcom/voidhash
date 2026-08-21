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
    }

    private static let personCacheTtlMilliseconds: Double = 1000 * 60 * 60 * 24 * 2
    private static let personCacheStaleTimeMilliseconds: Double = 1000 * 60 * 5

    private let options: VoidhashOptions
    private let dependencies: Dependencies
    private let warn: VoidhashWarningHandler
    private let readOnlyFlag: AtomicBool
    private let cacheManager: CacheManager
    private let identityStore: IdentityStore
    private let apiClient: VoidhashApiClient
    private let engine: any StoreKitEngineProtocol
    private let schemaManager: SchemaManager
    private let headerFactory: SdkHeaderFactory
    private let analytics: AnalyticsClient

    private var orchestratorStorage: PurchaseOrchestrator?
    private var paywallCoordinatorStorage: PaywallCoordinator?
    private var initializationTask: Task<RuntimeSchema, any Error>?
    private var currentSchema: RuntimeSchema?

    #if canImport(UIKit)
        private let presentationTarget = PresentationTargetBox()
    #endif

    public init(publishableKey: String, options: VoidhashOptions = VoidhashOptions()) {
        self.init(publishableKey: publishableKey, options: options, dependencies: Dependencies())
    }

    init(publishableKey: String, options: VoidhashOptions, dependencies: Dependencies) {
        self.options = options
        self.dependencies = dependencies
        warn = options.onWarning ?? VoidhashWarnings.standard
        readOnlyFlag = AtomicBool(options.readOnly)
        cacheManager = CacheManager(adapter: dependencies.cacheAdapter)
        identityStore = IdentityStore(cacheManager: cacheManager)
        apiClient = VoidhashApiClient(baseUrl: options.baseUrl, session: dependencies.session)
        engine = dependencies.engine ?? StoreKitEngine()
        schemaManager = SchemaManager(
            apiClient: apiClient,
            cacheManager: cacheManager,
            appVersion: dependencies.device.appVersion
        )
        headerFactory = SdkHeaderFactory(
            publishableKey: publishableKey,
            sdkVersion: Voidhash.sdkVersion,
            device: dependencies.device,
            isDebugBuild: options.debug,
            identityStore: identityStore,
            readOnly: readOnlyFlag
        )
        analytics = AnalyticsClient(
            publishableKey: publishableKey,
            ingestUrl: options.ingestUrl ?? options.baseUrl,
            session: dependencies.session,
            distinctIdProvider: { [identityStore] in await identityStore.getDistinctId() },
            standardProperties: AnalyticsClient.standardProperties(
                device: dependencies.device, sdkVersion: Voidhash.sdkVersion),
            now: dependencies.analyticsNow,
            sleep: dependencies.analyticsSleep,
            debug: options.debug,
            warn: options.onWarning ?? VoidhashWarnings.standard
        )
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
    public func purchase(product: VoidhashProduct) async throws {
        guard options.enabled else {
            return
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

    /// Clears the persisted identity and every cached response.
    ///
    /// The next ``getDistinctId()`` allocates a fresh anonymous distinct id.
    public func reset() async {
        await identityStore.reset()
    }

    /// Returns the current distinct id, allocating an anonymous one when needed.
    public func getDistinctId() async -> String {
        return await identityStore.getDistinctId()
    }

    /// Toggles observer mode. Purchases already in flight still finish with the store.
    public func setReadOnly(_ readOnly: Bool) {
        readOnlyFlag.value = readOnly
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

    // MARK: - Store sheets

    /// Presents the offer code redemption sheet.
    public func presentCodeRedemptionSheet() throws {
        guard options.enabled else {
            return
        }
        try engine.presentCodeRedemptionSheet()
    }

    /// Presents the subscription management sheet.
    public func showManageSubscriptions() async throws {
        guard options.enabled else {
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
        guard options.enabled else {
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
        try await paywallCoordinator().dismiss()
    }

    // MARK: - Internals

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

        let schema = try await schemaManager.resolveSchema(headers: await headerFactory.build())
        currentSchema = schema

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
