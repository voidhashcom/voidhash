import Foundation
import VoidhashCore

@_spi(VoidhashHost) import Voidhash

/// A failure the bridge reports to JavaScript, whose message is `"<CODE>: <detail>"`.
struct NativeClientError: Error, CustomStringConvertible, LocalizedError, Equatable {
    let code: String
    let detail: String

    var description: String {
        return "\(code): \(detail)"
    }

    var errorDescription: String? {
        return description
    }

    static func notInitialized(_ detail: String = "the client is not started") -> NativeClientError {
        return NativeClientError(code: "NOT_INITIALIZED", detail: detail)
    }

    static func invalidArgument(_ detail: String) -> NativeClientError {
        return NativeClientError(code: "INVALID_ARGUMENT", detail: detail)
    }

    /// What a Google Play member answers on iOS, where it does nothing.
    static func unsupportedPlatform(_ member: String) -> NativeClientError {
        return NativeClientError(
            code: "UNSUPPORTED_PLATFORM", detail: "\(member) is available on Google Play only")
    }

    /// The coded error a native failure reaches JavaScript as: its own code where it has one,
    /// `fallback` otherwise.
    static func from(_ error: any Error, fallback: String = "NATIVE_ERROR") -> NativeClientError {
        switch error {
        case let error as NativeClientError:
            return error
        case let error as VoidhashStoreError:
            return NativeClientError(code: error.code, detail: error.message)
        case let error as VoidhashApiError:
            return NativeClientError(code: error.code, detail: error.message)
        case let error as ReconcileTransactionsError:
            return NativeClientError(code: error.code, detail: error.message)
        case is CancellationError:
            return NativeClientError(code: "CANCELLED", detail: "the call was cancelled")
        default:
            return NativeClientError(code: fallback, detail: String(describing: error))
        }
    }
}

/// The configuration the facade validated, see `NativeClientConfiguration` in the spec.
/// Runs an app action in JavaScript: takes the action's name and its arguments as a JSON object,
/// and returns the reply as a JSON object or throws.
typealias NativeFlowAction =
    @Sendable (_ name: String, _ argumentsJson: String) async throws -> String

/// A flow result as the facade reads it; `productId` is present for a purchase only.
private struct NativeFlowResultPayload: Encodable {
    let outcome: String
    let output: [String: FlowValue]
    let productId: String?

    init(_ result: FlowResult) {
        outcome = result.outcome
        output = result.output
        productId = result.productId
    }
}

struct NativeClientCoreConfiguration: Sendable, Equatable {
    var publishableKey: String
    var baseUrl: String
    var ingestUrl: String?
    var debug: Bool
    var developmentMode: Bool
    var distinctId: String?
    var readOnly: Bool
    var analyticsConsent: AnalyticsConsent
    var chosenAnalyticsConsent: AnalyticsConsent?
    var analyticsWhilePending: PendingAnalytics = .drop
    var grantConsentOnIdentify: Bool = false
    var automaticLifecycleEvents: Bool
    var installAttribution: Bool
    var preloadLocations: [String]
    /// The interface revision the app was built against, by location slug.
    var flowRevisions: [String: Int]
    var flowCapabilities: Set<FlowCapability>
    /// Flows are drawn with flow runtime modules (the `flowRuntime` option); `false` leaves the
    /// renderer as it is.
    var flowRuntimeModules: Bool = false
    var screenTrackingEnabled: Bool
    /// `nil` keeps the native client's default wait.
    var featureFlagMaxWaitMilliseconds: Double? = nil
    var featureFlagDefaults: [String: Bool] = [:]
    var internalSchemaJson: String?
    var appStoreMessages: VoidhashAppStoreMessagesHandling = .deferWhileFlowPresented
    var purchaseIntents: VoidhashPurchaseIntentHandling = .purchaseWhenReady
    var sdkVersion: String
}

/// A person answer as the bridge carries it.
struct NativePersonPayload: Sendable, Equatable {
    let distinctId: String
    let generation: Int
    let personJson: String?
    let isStale: Bool
    let isExpired: Bool
    let reason: StaleReason
}

struct NativeFlagPayload: Sendable, Equatable {
    let key: String
    let enabled: Bool
    let variantKey: String?
    let payloadJson: String?
}

struct NativeFlagsPayload: Sendable, Equatable {
    let distinctId: String
    let generation: Int
    let flagKeys: [String]?
    let flags: [NativeFlagPayload]
    let isStale: Bool
}

struct NativeIdentifyPayload: Sendable, Equatable {
    let identity: VoidhashIdentityChange
    let status: PersonWriteStatus
    let personJson: String?
}

struct NativePersonWritePayload: Sendable, Equatable {
    let status: PersonWriteStatus
    let personJson: String?
}

/// What `purchase()` buys beyond the product, see `NativePurchaseOptions` in the spec. Google
/// Play's options and `replacing` are left out: the App Store ignores them.
struct NativePurchaseRequest: Sendable, Equatable {
    enum Offer: Sendable, Equatable {
        case automatic
        case regularPrice
        /// The offer `id` names among the product's current offers, of `kind` when the app passed
        /// an offer rather than an id.
        case offer(id: String, kind: VoidhashOfferKind?)
    }

    var offer: Offer = .automatic
    /// As JavaScript sent it; a whole number of at least 1.
    var quantity: Double = 1
    var simulatesAskToBuyInSandbox: Bool = false
}

/// A purchase another billing integration reported.
struct NativeReportedTransactionPayload: Sendable, Equatable {
    /// `ios` or `android`.
    let platform: String
    let transactionId: String?
    let purchaseToken: String?
    /// `purchased`, `pending` or `unspecified`; `nil` counts as purchased.
    let purchaseState: String?
    /// The App Store transaction's JWS, when the host's purchase flow returned it.
    var signedTransaction: String? = nil
}

/// One event for the bridge's listener, see `NativeClientEvent` in the spec.
enum NativeClientCoreEvent: Sendable {
    case identity(VoidhashIdentityChange)
    case person(NativePersonPayload)
    case flags(NativeFlagsPayload)
    case schema(String)
    case consent(AnalyticsConsent)
    case diagnostic(VoidhashDiagnostic)
    /// An element of the client's ``VoidhashClient/transactionUpdates()``.
    case transaction(VoidhashTransactionUpdate)
    /// An App Store purchase intent, with `purchaseIntents: manual`.
    case purchaseIntent(VoidhashPurchaseIntent)
}

/// Calls in flight, so `shutdown()` can settle every one of them before it resolves: a call
/// that has not finished by then rejects `NOT_INITIALIZED`, and its late result is dropped.
final class PendingNativeCalls: @unchecked Sendable {
    private let lock = NSLock()
    private var nextId: UInt64 = 0
    private var rejecters: [UInt64: @Sendable (NativeClientError) -> Void] = [:]

    func run<Value: Sendable>(
        _ operation: @escaping @Sendable () async throws -> Value
    ) async throws -> Value {
        let settle = SettleOnce<Value>()
        return try await withCheckedThrowingContinuation { continuation in
            let id = lock.withLock { () -> UInt64 in
                nextId += 1
                rejecters[nextId] = { error in settle.resume(continuation, .failure(error)) }
                return nextId
            }
            Task {
                let result: Result<Value, any Error>
                do {
                    result = .success(try await operation())
                } catch {
                    result = .failure(error)
                }
                _ = lock.withLock { rejecters.removeValue(forKey: id) }
                settle.resume(continuation, result)
            }
        }
    }

    /// Rejects every call still in flight with `error`.
    func rejectAll(_ error: NativeClientError) {
        let pending = lock.withLock { () -> [@Sendable (NativeClientError) -> Void] in
            defer { rejecters.removeAll() }
            return Array(rejecters.values)
        }
        pending.forEach { $0(error) }
    }
}

/// Runs work strictly in submission order. Submitting is synchronous, so calls made one after
/// the other on the JavaScript thread run in that order, whatever thread their promise settles on.
final class OrderedNativeCalls: @unchecked Sendable {
    private let lock = NSLock()
    private var last: Task<Void, Never>?

    func submit<Value: Sendable>(
        _ operation: @escaping @Sendable () async throws -> Value
    ) -> Task<Value, any Error> {
        return lock.withLock {
            let previous = last
            let task = Task {
                await previous?.value
                return try await operation()
            }
            last = Task { _ = await task.result }
            return task
        }
    }
}

/// A `start()` in flight: the callers joined to it, and its outcome once settled. Guarded by the
/// core's lock.
final class StartInFlight: @unchecked Sendable {
    let signal = OneShotSignal()
    var settles: [@Sendable (Result<Void, any Error>) -> Void]
    var outcome: Result<Void, any Error>?

    init(_ settle: @escaping @Sendable (Result<Void, any Error>) -> Void) {
        settles = [settle]
    }
}

/// Resolves the callers waiting for it once fired; later callers do not wait.
final class OneShotSignal: @unchecked Sendable {
    private let lock = NSLock()
    private var fired = false
    private var waiters: [CheckedContinuation<Void, Never>] = []

    func fire() {
        let waiting = lock.withLock { () -> [CheckedContinuation<Void, Never>] in
            fired = true
            defer { waiters = [] }
            return waiters
        }
        waiting.forEach { $0.resume() }
    }

    func wait() async {
        await withCheckedContinuation { continuation in
            let resumeNow = lock.withLock { () -> Bool in
                if fired { return true }
                waiters.append(continuation)
                return false
            }
            if resumeNow { continuation.resume() }
        }
    }
}

/// Resumes a continuation once, whichever of the call and the shutdown gets there first.
private final class SettleOnce<Value: Sendable>: @unchecked Sendable {
    private let lock = NSLock()
    private var resumed = false

    func resume(
        _ continuation: CheckedContinuation<Value, any Error>, _ result: Result<Value, any Error>
    ) {
        let first = lock.withLock { () -> Bool in
            defer { resumed = true }
            return !resumed
        }
        if first {
            continuation.resume(with: result)
        }
    }
}

/// The React Native client's native side, over the native ``VoidhashClient``: the behaviour
/// behind `HybridVoidhashNativeClient`, kept free of Nitro so it can be tested with SwiftPM.
///
/// `configure()` only records the options; `start()` imports what the TypeScript core left on
/// the device, creates the native client and starts it from local state. Every later call goes
/// to that client and rejects `NOT_INITIALIZED` once it was shut down, or retired by a newer
/// instance over the same storage (a JavaScript reload).
final class VoidhashNativeClientCore: @unchecked Sendable {
    /// Events taken before `start()`, kept with their call time; past this the oldest is dropped.
    static let maxCapturesBeforeStart = 100
    /// The value of `x-sdk` and `$sdk`.
    static let sdkName = "react-native"
    /// The version of the bridge contract (`src/specs/VoidhashNativeClient.nitro.ts`) this module
    /// implements: the facade's `NATIVE_CONTRACT_VERSION`, which starts no client of another.
    static let contractVersion = 1

    /// Whether some client of this process started already: the `distinctId` option applies to
    /// the first start of the process only.
    private static let processStarted = AtomicBool(false)

    private struct HeldCapture {
        let name: String
        let properties: [String: JSONValue]
        let capturedAt: Double
    }

    private let lock = NSLock()
    private let calls = PendingNativeCalls()
    private let makeClient: @Sendable (String, VoidhashOptions, VoidhashHostOptions) -> VoidhashClient
    private let importLegacyData: @Sendable (NativeClientCoreConfiguration) async -> Void
    private let now: @Sendable () -> Double
    private let shutdownAwaitsStart: @Sendable () -> Void
    private var configuration: NativeClientCoreConfiguration?
    private var client: VoidhashClient?
    /// The client `start()` created and is still starting: captures go to it from then on (its
    /// intake holds them until it opens), and `shutdown()` can stop it.
    private var startingClient: VoidhashClient?
    /// The `start()` in progress. Its signal fires once it settled, resolved or rejected, so a
    /// `shutdown()` that overtook it resolves only after it: a start then answers before the
    /// next one runs.
    private var inFlightStart: StartInFlight?
    /// Identity changes and person writes, in call order.
    private let ordered = OrderedNativeCalls()
    /// Bumped by every `shutdown()`, so a `start()` it overtook rejects instead of leaving a live
    /// client behind.
    private var run = 0
    private var listener: (@Sendable (NativeClientCoreEvent) -> Void)?
    private var heldCaptures: [HeldCapture] = []
    private var droppedCaptures = 0
    /// The products the started client's last `getProducts()` answered, by slug: the ones
    /// `purchase()` buys and `showManageSubscriptions()` names. Dropped once a purchase or a
    /// restore may have changed the offers the end user is eligible for.
    private var heldProducts: [String: VoidhashProduct] = [:]
    /// Counts the products loads begun and the drops of the products held: only the latest load
    /// begun since the last drop is held, so an earlier, slower one never replaces its answer.
    private var productsLoads = 0
    /// Forward the started client's transaction updates and purchase intents as events, until
    /// `shutdown()` ends them.
    private var updateForwarders: [Task<Void, Never>] = []

    /// - Parameters:
    ///   - makeClient: Creates the native client; tests inject one over stubbed dependencies.
    ///   - importLegacyData: Imports what the TypeScript core persisted, before the client loads.
    ///   - shutdownAwaitsStart: Called when a `shutdown()` found no client yet and waits for the
    ///     start still building it; tests synchronize on it.
    init(
        makeClient: @escaping @Sendable (String, VoidhashOptions, VoidhashHostOptions) ->
            VoidhashClient = { key, options, host in
                VoidhashClient(publishableKey: key, options: options, host: host)
            },
        importLegacyData: @escaping @Sendable (NativeClientCoreConfiguration) async -> Void = {
            configuration in
            await VoidhashLegacyImporter.forConfiguration(configuration)?.run()
        },
        now: @escaping @Sendable () -> Double = { Date().timeIntervalSince1970 * 1000 },
        shutdownAwaitsStart: @escaping @Sendable () -> Void = {}
    ) {
        self.makeClient = makeClient
        self.importLegacyData = importLegacyData
        self.now = now
        self.shutdownAwaitsStart = shutdownAwaitsStart
    }

    // MARK: - Lifecycle

    func configure(_ configuration: NativeClientCoreConfiguration) {
        lock.withLock { self.configuration = configuration }
    }

    /// Starts the configured client. A start while one is in flight joins it, with its outcome;
    /// one on a started client resolves without effect. `settle` receives the outcome before a
    /// `shutdown()` that overtook the start resolves, so the bridge rejects the start's promise
    /// first.
    func start(
        settle: @escaping @Sendable (Result<Void, any Error>) -> Void = { _ in }
    ) async throws {
        enum Entry {
            case begin(NativeClientCoreConfiguration, run: Int, StartInFlight)
            case join(StartInFlight)
            case started
        }
        let entry: Entry
        do {
            entry = try lock.withLock { () -> Entry in
                if client != nil {
                    return .started
                }
                if let inFlightStart {
                    inFlightStart.settles.append(settle)
                    return .join(inFlightStart)
                }
                guard let configuration = self.configuration else {
                    throw NativeClientError.notInitialized("configure() first")
                }
                let inFlight = StartInFlight(settle)
                inFlightStart = inFlight
                return .begin(configuration, run: run, inFlight)
            }
        } catch {
            settle(.failure(error))
            throw error
        }
        switch entry {
        case .started:
            settle(.success(()))
        case .join(let inFlight):
            await inFlight.signal.wait()
            try lock.withLock { inFlight.outcome }?.get()
        case .begin(let configuration, let startRun, let inFlight):
            let result: Result<Void, any Error>
            do {
                try await performStart(configuration, run: startRun)
                result = .success(())
            } catch {
                result = .failure(error)
            }
            // Joined in under the lock until here; none can join once the start is cleared.
            let settles = lock.withLock { () -> [@Sendable (Result<Void, any Error>) -> Void] in
                inFlight.outcome = result
                inFlightStart = nil
                return inFlight.settles
            }
            settles.forEach { $0(result) }
            inFlight.signal.fire()
            try result.get()
        }
    }

    /// Builds and starts the client of `run`. A `shutdown()` since ends `run`: the client it
    /// built is shut down here, as nothing else holds it.
    private func performStart(_ configuration: NativeClientCoreConfiguration, run startRun: Int)
        async throws
    {
        guard let baseUrl = URL(string: configuration.baseUrl) else {
            throw NativeClientError.invalidArgument("baseUrl is not a URL")
        }
        let internalSchema = try configuration.internalSchemaJson.map { json in
            do {
                return try JSONDecoder().decode(RuntimeSchema.self, from: Data(json.utf8))
            } catch {
                throw NativeClientError.invalidArgument("internalSchemaJson is not a schema")
            }
        }

        var options = VoidhashOptions(
            baseUrl: baseUrl,
            ingestUrl: configuration.ingestUrl.flatMap(URL.init(string:)),
            debug: configuration.debug,
            distinctId: VoidhashNativeClientCore.processStarted.exchange(true)
                ? nil : configuration.distinctId,
            readOnly: configuration.readOnly,
            dev: configuration.developmentMode,
            preloadLocations: configuration.preloadLocations,
            flowRevisions: configuration.flowRevisions,
            // Screens arrive through `screen()`, already mapped by the facade.
            screenTracking: ScreenTrackingOptions(automatic: false),
            automaticLifecycleEvents: configuration.automaticLifecycleEvents,
            analyticsConsent: configuration.analyticsConsent,
            flowRenderer: FlowRendererDiscovery.linkedRenderer(
                runtimeModules: configuration.flowRuntimeModules),
            flowCapabilities: configuration.flowCapabilities,
            featureFlags: FeatureFlagOptions(
                maxWaitMilliseconds: configuration.featureFlagMaxWaitMilliseconds
                    ?? FeatureFlagOptions().maxWaitMilliseconds,
                defaults: configuration.featureFlagDefaults),
            installAttribution: configuration.installAttribution,
            analyticsWhilePending: configuration.analyticsWhilePending,
            grantConsentOnIdentify: configuration.grantConsentOnIdentify,
            appStoreMessages: configuration.appStoreMessages,
            purchaseIntents: configuration.purchaseIntents)
        // Diagnostics reach the facade as events, which its `onDiagnostic` dispatches.
        options.onWarning = VoidhashWarnings.ignore
        let host = VoidhashHostOptions(
            sdkName: VoidhashNativeClientCore.sdkName, sdkVersion: configuration.sdkVersion,
            internalSchema: internalSchema, resolvesPaywalls: true,
            // Imported once the client holds the storage, after a client still holding it (a
            // JavaScript reload leaves one running) retired and handed its queues over.
            prepareStorage: { [weak self, importLegacyData] in
                if !VoidhashLegacyImporter.namespaceMatches(configuration) {
                    self?.deliver(
                        .diagnostic(
                            VoidhashDiagnostic(
                                kind: .cache, code: "LEGACY_IMPORT_SKIPPED",
                                operation: "start",
                                message:
                                    "The base URL as configured maps to a different storage namespace than the native client's; data stored by the earlier SDK version is not imported"
                            )))
                }
                await importLegacyData(configuration)
            },
            events: { [weak self] event in self?.forward(event) })
        let client = makeClient(configuration.publishableKey, options, host)
        // Subscribed before the client starts, so nothing it reports while starting is missed,
        // and forwarded once it started: after the identity and state it announces.
        let transactionUpdates = client.transactionUpdates()
        let purchaseIntents =
            configuration.purchaseIntents == .manual ? client.appStore.purchaseIntents() : nil
        // From here on captures go to the client, in order after the ones held so far.
        let published = lock.withLock { () -> Int? in
            guard run == startRun else {
                return nil
            }
            for capture in heldCaptures {
                client.captureNow(
                    capture.name, properties: capture.properties, capturedAt: capture.capturedAt)
            }
            let dropped = droppedCaptures
            heldCaptures = []
            droppedCaptures = 0
            startingClient = client
            return dropped
        }
        guard let dropped = published else {
            await client.shutdown()
            throw NativeClientError.notInitialized("shutdown() ended the start")
        }
        if let chosen = configuration.chosenAnalyticsConsent {
            await client.setAnalyticsConsent(chosen)
        }
        await client.hostStart()
        let stopped = lock.withLock { () -> Bool in
            startingClient = nil
            guard run == startRun else {
                return true
            }
            self.client = client
            updateForwarders = [
                Task { [weak self] in
                    for await update in transactionUpdates {
                        // A renewal of a subscription the end user has changes no offer.
                        if update.transaction.isRenewal != true {
                            self?.dropHeldProducts()
                        }
                        self?.deliver(.transaction(update))
                    }
                }
            ]
            if let purchaseIntents {
                updateForwarders.append(
                    Task { [weak self] in
                        for await intent in purchaseIntents {
                            self?.deliver(.purchaseIntent(intent))
                        }
                    })
            }
            return false
        }
        guard !stopped else {
            await client.shutdown()
            throw NativeClientError.notInitialized("shutdown() ended the start")
        }
        if dropped > 0 {
            deliver(
                .diagnostic(
                    VoidhashDiagnostic(
                        kind: .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "capture",
                        message:
                            "Dropped the \(dropped) oldest event(s) captured before start(); \(VoidhashNativeClientCore.maxCapturesBeforeStart) are kept"
                    )))
        }
    }

    /// How many calls joined the `start()` in flight, beyond the one that began it. Test
    /// affordance.
    var startsJoinedForTesting: Int {
        return lock.withLock { (inFlightStart?.settles.count ?? 1) - 1 }
    }

    func shutdown() async throws -> FlushStatus {
        let overtakenStart = lock.withLock { inFlightStart?.signal }
        let (stopping, forwarders) = lock.withLock {
            () -> (VoidhashClient?, [Task<Void, Never>]) in
            defer {
                self.client = nil
                startingClient = nil
                heldCaptures = []
                droppedCaptures = 0
                heldProducts = [:]
                productsLoads += 1
                updateForwarders = []
                run += 1
            }
            return (self.client ?? startingClient, updateForwarders)
        }
        guard let client = stopping else {
            // A start that has not built its client yet sees the shutdown and stops it itself.
            if let overtakenStart {
                shutdownAwaitsStart()
                await overtakenStart.wait()
            }
            throw NativeClientError.notInitialized()
        }
        let status = await client.shutdownAfterFlush()
        // The client ended its streams; what they still hold is not delivered after shutdown.
        for forwarder in forwarders {
            forwarder.cancel()
            await forwarder.value
        }
        calls.rejectAll(.notInitialized("the client was shut down"))
        await overtakenStart?.wait()
        return status
    }

    func setEventListener(_ listener: @escaping @Sendable (NativeClientCoreEvent) -> Void) {
        lock.withLock { self.listener = listener }
    }

    func removeEventListener() {
        lock.withLock { listener = nil }
    }

    private func forward(_ event: VoidhashClientEvent) {
        deliver(VoidhashNativeClientCore.coreEvent(event))
    }

    private func deliver(_ event: NativeClientCoreEvent) {
        lock.withLock { listener }?(event)
    }

    /// The started client, or `NOT_INITIALIZED` before `start()`, after `shutdown()` and once a
    /// newer instance over the same storage retired it.
    private func started() throws -> VoidhashClient {
        guard let client = lock.withLock({ client }), !client.isRetired else {
            throw NativeClientError.notInitialized()
        }
        return client
    }

    /// Runs `operation` on the started client, settled by `shutdown()` at the latest.
    private func call<Value: Sendable>(
        _ operation: @escaping @Sendable (VoidhashClient) async throws -> Value
    ) async throws -> Value {
        let client = try started()
        do {
            return try await calls.run { try await operation(client) }
        } catch {
            throw NativeClientError.from(error)
        }
    }

    // MARK: - Identity and person

    func getDistinctId() async throws -> String {
        return try await call { client in await client.getDistinctId() }
    }

    /// Identity changes and person writes run in call order: an un-awaited `identify(u)` then
    /// `setPersonAttributes(x)` writes `x` for `u`, and `setPersonAttributes(x)` then `reset()`
    /// writes it for the identity being reset. A call therefore waits for the ones before it to
    /// settle: a `setPersonAttributes(x)` behind an un-awaited `identify(u)` resolves only once
    /// that identify did, which may take its whole wait on Voidhash for the profile write.
    func identify(externalUserId: String, email: String?, name: String?)
        -> Task<NativeIdentifyPayload, any Error>
    {
        return ordered.submit {
            try await self.performIdentify(externalUserId: externalUserId, email: email, name: name)
        }
    }

    func reset() -> Task<VoidhashIdentityChange, any Error> {
        return ordered.submit { try await self.performReset() }
    }

    func signOut() -> Task<VoidhashIdentityChange, any Error> {
        return ordered.submit { try await self.performSignOut() }
    }

    func setPersonAttributes(_ attributesJson: String) -> Task<Void, any Error> {
        return ordered.submit { try await self.performSetPersonAttributes(attributesJson) }
    }

    /// Puts the end user in a group, in call order with identity changes: a `group` made right
    /// after an un-awaited `reset()` belongs to the identity the reset switched to.
    func group(type: String, key: String, propertiesJson: String?) -> Task<Void, any Error> {
        return ordered.submit {
            if let reason = IdentityStore.invalidGroupReason(type: type, key: key) {
                throw NativeClientError.invalidArgument(reason)
            }
            let properties = try propertiesJson.map { json in
                guard let properties = VoidhashNativeClientCore.object(json) else {
                    throw NativeClientError.invalidArgument("group properties must be a JSON object")
                }
                return properties
            }
            try await self.call { client in
                await client.group(type: type, key: key, properties: properties)
            }
        }
    }

    /// Replaces every group the end user is in, in call order with identity changes.
    /// `groupsJson` is an object from group type to `{ id, properties? }`.
    func setGroups(groupsJson: String) -> Task<Void, any Error> {
        return ordered.submit {
            guard let document = VoidhashNativeClientCore.object(groupsJson) else {
                throw NativeClientError.invalidArgument("groups must be a JSON object")
            }
            let groups = try document.mapValues { value in
                guard case .object(let group) = value, case .string(let id)? = group["id"] else {
                    throw NativeClientError.invalidArgument("a group must be an object with a string id")
                }
                guard case .object(let properties)? = group["properties"] else {
                    return VoidhashGroup(id: id)
                }
                return VoidhashGroup(id: id, properties: properties)
            }
            try await self.call { client in await client.setGroups(groups) }
        }
    }

    func resetGroups() -> Task<Void, any Error> {
        return ordered.submit { try await self.call { client in await client.resetGroups() } }
    }

    /// The groups the end user belongs to, read synchronously; empty before `start()`.
    func getGroups() -> [String: String] {
        return lock.withLock { client }?.currentGroups ?? [:]
    }

    func setPersonAttributesState(_ attributesJson: String)
        -> Task<NativePersonWritePayload, any Error>
    {
        return ordered.submit { try await self.performSetPersonAttributesState(attributesJson) }
    }

    private func performIdentify(externalUserId: String, email: String?, name: String?)
        async throws -> NativeIdentifyPayload
    {
        return try await call { client in
            let result = try await client.identifyState(
                externalUserId: externalUserId, email: email, name: name)
            guard let identity = client.currentIdentity else {
                throw NativeClientError.notInitialized()
            }
            return NativeIdentifyPayload(
                identity: identity, status: result.status,
                personJson: VoidhashNativeClientCore.json(result.person))
        }
    }

    private func performReset() async throws -> VoidhashIdentityChange {
        return try await call { client in
            let wasSignedIn =
                client.currentIdentity.map { !Voidhash.isAnonymousDistinctId($0.distinctId) } ?? false
            await client.reset()
            let identity = try VoidhashNativeClientCore.identity(of: client)
            // Someone signed in was signed out: what they left queued goes out now, as after
            // `signOut()`. A fresh visitor in place of an anonymous one sends nothing.
            if wasSignedIn {
                _ = await client.flush()
            }
            return identity
        }
    }

    private func performSignOut() async throws -> VoidhashIdentityChange {
        return try await call { client in
            let previous = client.currentIdentity?.distinctId
            await client.signOut()
            let identity = try VoidhashNativeClientCore.identity(of: client)
            // The identity switched at once; what the person signing out left queued goes out
            // now. Nobody signed in means nothing switched, and nothing is sent.
            if identity.distinctId != previous {
                _ = await client.flush()
            }
            return identity
        }
    }

    private func performSetPersonAttributes(_ attributesJson: String) async throws {
        let attributes = try VoidhashNativeClientCore.attributes(attributesJson)
        // On disk, in call order, before the promise resolves; only the delivery is left to the
        // queue.
        try await call { client in try await client.queuePersonAttributes(attributes) }
    }

    private func performSetPersonAttributesState(_ attributesJson: String) async throws
        -> NativePersonWritePayload
    {
        let attributes = try VoidhashNativeClientCore.attributes(attributesJson)
        return try await call { client in
            let result = try await client.setPersonAttributesState(attributes)
            return NativePersonWritePayload(
                status: result.status, personJson: VoidhashNativeClientCore.json(result.person))
        }
    }

    func getPersonState(forceFetch: Bool) async throws -> NativePersonPayload {
        return try await call { client in
            VoidhashNativeClientCore.personPayload(
                try await client.hostPersonState(forceFetch: forceFetch))
        }
    }

    func resetPersonCache() async throws {
        try await call { client in await client.resetPersonCache() }
    }

    // MARK: - Flags, paywalls and products

    func getFeatureFlags(_ flagKeys: [String]?) async throws -> NativeFlagsPayload {
        return try await call { client in
            VoidhashNativeClientCore.flagsPayload(try await client.hostFeatureFlags(flagKeys))
        }
    }

    func getPaywall(location: String) async throws -> String {
        return try await call { client in
            let state = try await client.getPaywallState(location: location)
            if state.value == nil, state.isStale, state.isExpired {
                throw NativeClientError(
                    code: "PAYWALL_UNAVAILABLE",
                    detail: "nothing is cached for \"\(location)\" and Voidhash cannot be reached")
            }
            return VoidhashNativeClientCore.json(state.value) ?? "null"
        }
    }

    /// Every product the App Store sells, sorted by slug, held for `purchase()`.
    func getProducts() async throws -> [VoidhashProduct] {
        let load = lock.withLock { () -> Int in
            productsLoads += 1
            return productsLoads
        }
        return try await call { client in
            let products = try await client.getProducts()
            self.lock.withLock {
                // A load that a shutdown, a later load or a purchase overtook is not held: it
                // belongs to a client no longer started, or answers for outdated offers.
                guard self.client === client, self.productsLoads == load else { return }
                self.heldProducts = Dictionary(
                    products.map { ($0.slug, $0) }, uniquingKeysWith: { _, last in last })
            }
            return products
        }
    }

    /// Forgets the products held, and any load running, after a purchase or a restore: what the
    /// end user bought can change the offers they are eligible for. Until the facade loads them
    /// again, `purchase()` asks the App Store for the product it buys.
    private func dropHeldProducts() {
        lock.withLock {
            heldProducts = [:]
            productsLoads += 1
        }
    }

    /// The product `slug` names: the one the last `getProducts()` answered, else the App Store's
    /// answer now. `nil` when Studio has no such product or the App Store does not sell it.
    private func product(_ slug: String, of client: VoidhashClient) async throws
        -> VoidhashProduct?
    {
        if let held = lock.withLock({ heldProducts[slug] }) {
            return held
        }
        return try await client.getProducts(slugs: [slug]).first ?? nil
    }

    // MARK: - Purchases

    /// Buys the product `productSlug` names. A cancelled sheet and a pending payment are
    /// results; a client that buys nothing (retired, or before the first unlock) rejects
    /// `NOT_INITIALIZED`. An offer the App Store refused as the user is not eligible for it
    /// rejects `INELIGIBLE_FOR_OFFER`, as on Android, and outdates the products held.
    func purchase(productSlug: String, request: NativePurchaseRequest) async throws
        -> VoidhashPurchaseResult
    {
        return try await call { client in
            guard let product = try await self.product(productSlug, of: client) else {
                throw NativeClientError.invalidArgument(
                    "no product with the slug \"\(productSlug)\" is sold in the App Store")
            }
            let options = try VoidhashNativeClientCore.purchaseOptions(request, for: product)
            let result: VoidhashPurchaseResult
            do {
                result = try await client.purchase(product, options: options)
            } catch let error as VoidhashStoreError where error.reason == .ineligibleForOffer {
                self.dropHeldProducts()
                throw NativeClientError(code: "INELIGIBLE_FOR_OFFER", detail: error.message)
            }
            if result == .disabled {
                throw NativeClientError.notInitialized(
                    "the client is disabled or was replaced; nothing was bought")
            }
            if case .purchased = result {
                self.dropHeldProducts()
            }
            return result
        }
    }

    /// The native purchase options of `request` for `product`. An introductory kind means the
    /// product's current intro offer, whatever the id says: the App Store's has none.
    ///
    /// - Throws: `OFFER_UNAVAILABLE` for an offer the product does not have for this user, and
    ///   `INVALID_ARGUMENT` for a quantity that is not a whole number.
    static func purchaseOptions(_ request: NativePurchaseRequest, for product: VoidhashProduct)
        throws -> VoidhashPurchaseOptions
    {
        guard let quantity = Int(exactly: request.quantity) else {
            throw NativeClientError.invalidArgument("\(request.quantity) is not a quantity to buy")
        }
        let offer: VoidhashOfferSelection
        switch request.offer {
        case .automatic:
            offer = .automatic
        case .regularPrice:
            offer = .none
        case .offer(_, kind: .introductory?):
            guard let introOffer = product.subscription?.introOffer else {
                throw VoidhashStoreError.offerUnavailable(
                    "\(product.slug) has no introductory offer for this user")
            }
            offer = .offer(introOffer)
        case .offer(let id, kind: let kind?):
            let available = product.offers + [product.subscription?.introOffer].compactMap { $0 }
            guard let match = available.first(where: { $0.id == id && $0.kind == kind }) else {
                throw VoidhashStoreError.offerUnavailable(
                    "\(product.slug) has no \(kind.rawValue) offer \"\(id)\" for this user")
            }
            offer = .offer(match)
        case .offer(let id, kind: nil):
            offer = .id(id)
        }
        return VoidhashPurchaseOptions(
            offer: offer, quantity: quantity,
            appStore: VoidhashPurchaseOptions.AppStore(
                simulatesAskToBuyInSandbox: request.simulatesAskToBuyInSandbox))
    }

    /// Restores purchases and answers the person the restore refreshed, as a cache-first read
    /// answers it, as on Android: with the freshness it really has (`fresh` only when the refresh
    /// after the restore got an answer) and the generation it is read under.
    func restorePurchases() async throws -> NativePersonPayload {
        return try await call { client in
            _ = try await client.restorePurchases()
            self.dropHeldProducts()
            return VoidhashNativeClientCore.personPayload(
                try await client.hostPersonState(forceFetch: false))
        }
    }

    func syncPurchases() async throws {
        try await call { client in try await client.syncPurchases() }
    }

    func reportTransaction(_ transaction: NativeReportedTransactionPayload, isRestore: Bool)
        async throws
    {
        guard transaction.platform == "ios" else {
            throw NativeClientError(
                code: "UNSUPPORTED_PLATFORM",
                detail: "only App Store transactions can be reported on iOS")
        }
        guard let transactionId = transaction.transactionId,
            !transactionId.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw NativeClientError.invalidArgument("an App Store transaction id is required")
        }
        try await call { client in
            try await client.reportTransaction(
                transactionId: transactionId, signedTransaction: transaction.signedTransaction,
                isRestore: isRestore)
        }
    }

    // MARK: - Store actions

    /// Opens subscription management on the group of the product `productSlug` names; on no
    /// group when it names none, or one the App Store does not sell.
    func showManageSubscriptions(productSlug: String?) async throws {
        try await call { client in
            var product: VoidhashProduct?
            if let productSlug {
                // Only picks the group the sheet opens on: without one it opens on them all.
                product = try? await self.product(productSlug, of: client)
            }
            try await client.showManageSubscriptions(product: product)
        }
    }

    /// Shows the offer code sheet. A transaction it hands back is synced and arrives as a
    /// `transaction` event, as on OS versions where it arrives through the store observer.
    func presentCodeRedemption() async throws {
        try await call { client in _ = try await client.presentCodeRedemption() }
    }

    func getStorefront() async throws -> VoidhashStorefront? {
        return try await call { client in await client.getStorefront() }
    }

    func canMakePayments() async throws -> Bool {
        return try await call { client in await client.canMakePayments() }
    }

    // MARK: - App Store

    func appStoreBeginRefundRequest(transactionId: String) async throws
        -> VoidhashRefundRequestStatus
    {
        return try await call { client in
            try await client.appStore.beginRefundRequest(transactionId: transactionId)
        }
    }

    /// The group's statuses, the current person's first. One whose renewal info StoreKit could
    /// not verify is left out: the contract carries verified renewal info only.
    func appStoreSubscriptionStatus(groupId: String) async throws
        -> [VoidhashAppStoreSubscriptionStatus]
    {
        return try await call { client in
            try await client.appStore.subscriptionStatus(groupId: groupId).filter {
                $0.renewalInfo != nil
            }
        }
    }

    func appStoreCurrentEntitlements() async throws -> [VoidhashTransaction] {
        return try await call { client in try await client.appStore.currentEntitlements() }
    }

    /// The app transaction as the JSON the facade reads it from.
    func appStoreAppTransaction() async throws -> String {
        return try await call { client in
            NativeStoreJson.appTransaction(try await client.appStore.appTransaction())
        }
    }

    // MARK: - Configuration at runtime

    /// Records the consent. Before `start()` it becomes the chosen consent `start()` applies,
    /// and one other than `granted` discards the events taken meanwhile; it is stored once the
    /// client starts, so the answer is `false` then.
    func setAnalyticsConsent(_ consent: AnalyticsConsent) async throws -> Bool {
        let startedClient = lock.withLock { () -> VoidhashClient? in
            guard let client else {
                configuration?.chosenAnalyticsConsent = consent
                // A denial discards what was captured so far, as it does on a running client.
                if consent == .denied {
                    heldCaptures = []
                    droppedCaptures = 0
                }
                return nil
            }
            return client
        }
        guard startedClient != nil else {
            return false
        }
        return try await call { client in
            await client.setAnalyticsConsent(consent)
            return true
        }
    }

    func getAnalyticsConsent() -> AnalyticsConsent {
        if let client = lock.withLock({ client }) {
            return client.analyticsConsent
        }
        let configuration = lock.withLock { self.configuration }
        return configuration?.chosenAnalyticsConsent ?? configuration?.analyticsConsent
            ?? .granted
    }

    func setReadOnly(_ readOnly: Bool) {
        if let client = lock.withLock({ client }) {
            client.setReadOnly(readOnly)
        }
        lock.withLock { configuration?.readOnly = readOnly }
    }

    func isReadOnly() -> Bool {
        if let client = lock.withLock({ client }) {
            return client.isReadOnly
        }
        return lock.withLock { configuration?.readOnly ?? false }
    }

    // MARK: - Analytics

    /// Queues an event synchronously; never throws. One whose properties are not a JSON object
    /// is dropped and reported. `capturedAt` is the time of an event the facade held back, in
    /// milliseconds since the epoch; the time of this call without it.
    func capture(_ eventName: String, propertiesJson: String, capturedAt: Double? = nil) {
        guard let properties = VoidhashNativeClientCore.object(propertiesJson) else {
            deliver(
                .diagnostic(
                    VoidhashDiagnostic(
                        kind: .eviction, code: "ANALYTICS_EVENT_DROPPED", operation: "capture",
                        message: "Dropped \"\(eventName)\": its properties are not a JSON object")))
            return
        }
        let capturedAt = capturedAt ?? now()
        let target = lock.withLock { () -> VoidhashClient? in
            guard let client = client ?? startingClient else {
                heldCaptures.append(
                    HeldCapture(name: eventName, properties: properties, capturedAt: capturedAt))
                if heldCaptures.count > VoidhashNativeClientCore.maxCapturesBeforeStart {
                    heldCaptures.removeFirst()
                    droppedCaptures += 1
                }
                return nil
            }
            return client
        }
        target?.captureNow(eventName, properties: properties, capturedAt: capturedAt)
    }

    /// Queues a `$screen` view the facade's screen tracker built, with its properties as they are.
    func screen(_ name: String, propertiesJson: String, capturedAt: Double? = nil) {
        guard lock.withLock({ configuration?.screenTrackingEnabled ?? true }) else {
            return
        }
        capture("$screen", propertiesJson: propertiesJson, capturedAt: capturedAt)
    }

    func flush() async throws -> FlushStatus {
        return try await call { client in await client.flush() }
    }

    func getSessionId() -> String {
        return lock.withLock { client }?.currentSessionId() ?? ""
    }

    // MARK: - Flows

    /// Presents the flow at `location` and resolves with how it ended, as JSON: an outcome with
    /// its outputs, or the failure that kept the flow from being shown. A flow that could not be
    /// shown is part of that answer, never a thrown error.
    ///
    /// - Parameters:
    ///   - revision: The interface revision the app was built against; `nil` for the one the
    ///     configuration names for the location.
    ///   - inputJson: The app's inputs as a JSON object of strings, numbers and booleans.
    ///   - actions: The app actions JavaScript handles.
    ///   - onAction: Runs one of `actions` in JavaScript: takes its name and its arguments as a
    ///     JSON object, and returns the reply as a JSON object or throws.
    func presentFlow(
        location: String, revision: Int?, inputJson: String, actions: [String],
        onAction: @escaping NativeFlowAction
    ) async throws -> String {
        return try await call { client in
            do {
                let result = try await client.presentFlow(
                    location: location, revision: revision,
                    input: VoidhashNativeClientCore.flowValues(inputJson) ?? [:],
                    actions: VoidhashNativeClientCore.flowActionHandlers(
                        actions, onAction: onAction))
                // A flow that ended in a purchase or a restore outdates the products held.
                if result.outcome == FlowResult.purchased || result.outcome == FlowResult.restored {
                    self.dropHeldProducts()
                }
                return VoidhashNativeClientCore.flowResultJson(result)
            } catch let error as FlowError {
                return VoidhashNativeClientCore.flowFailureJson(error)
            }
        }
    }

    /// Changes inputs of the flow on screen; `valuesJson` is a JSON object of strings, numbers
    /// and booleans.
    func updateFlowInput(valuesJson: String) async throws {
        guard let values = VoidhashNativeClientCore.flowValues(valuesJson) else {
            throw NativeClientError(
                code: "INVALID_ARGUMENT", detail: "flow inputs must be a JSON object")
        }
        try await call { client in await client.updateFlowInput(values) }
    }

    func dismissFlow() async throws {
        try await call { client in await client.dismissFlow() }
    }

    // MARK: - Mapping

    /// How a presentation ended, as the JSON the facade reads a flow result from.
    static func flowResultJson(_ result: FlowResult) -> String {
        return json(NativeFlowResultPayload(result))
            ?? flowFailureJson(.presentationFailed("the flow's result could not be encoded"))
    }

    /// Why a flow could not be shown, as the JSON the facade reads a flow failure from.
    static func flowFailureJson(_ error: FlowError) -> String {
        let failure: JSONValue = .object([
            "failure": .object([
                "code": .string(flowErrorCode(error)), "message": .string(error.description),
            ])
        ])
        return json(failure)
            ?? #"{"failure":{"code":"FLOW_PRESENTATION_FAILED","message":"FLOW_PRESENTATION_FAILED: unencodable"}}"#
    }

    /// The strings, numbers, booleans and lists of strings of a JSON object, by name; `nil` when
    /// `json` is not an object. Entries of any other type, and arrays holding anything but
    /// strings, are left out.
    static func flowValues(_ json: String) -> [String: FlowValue]? {
        return object(json)?.compactMapValues { value in
            switch value {
            case .string(let string): return .string(string)
            case .number(let number): return .number(number)
            case .bool(let bool): return .bool(bool)
            case .array(let items):
                let strings = items.compactMap { item -> String? in
                    guard case .string(let string) = item else { return nil }
                    return string
                }
                return strings.count == items.count ? .list(strings) : nil
            case .null, .object: return nil
            }
        }
    }

    /// A handler per action JavaScript handles, each running `onAction` with the action's name
    /// and its arguments as JSON, and reading the reply back from JSON.
    static func flowActionHandlers(_ actions: [String], onAction: @escaping NativeFlowAction)
        -> [String: FlowActionHandler]
    {
        var handlers: [String: FlowActionHandler] = [:]
        for name in actions {
            handlers[name] = { arguments in
                guard let argumentsJson = json(arguments) else {
                    throw NativeClientError(
                        code: "INVALID_ARGUMENT",
                        detail: "the arguments of \"\(name)\" could not be encoded")
                }
                guard let reply = flowValues(try await onAction(name, argumentsJson)) else {
                    throw NativeClientError(
                        code: "INVALID_ARGUMENT",
                        detail: "the handler of \"\(name)\" must resolve with an object")
                }
                return reply
            }
        }
        return handlers
    }

    static func flowErrorCode(_ error: FlowError) -> String {
        switch error {
        case .disabled: return "FLOW_DISABLED"
        case .notAssigned: return "FLOW_NOT_ASSIGNED"
        case .unavailable: return "FLOW_UNAVAILABLE"
        case .rendererMissing: return "FLOW_RENDERER_MISSING"
        case .unsupportedPackage: return "FLOW_UNSUPPORTED_PACKAGE"
        case .presentationFailed: return "FLOW_PRESENTATION_FAILED"
        }
    }

    /// The contract's name for the operation a diagnostic comes from: a products load is named
    /// after the facade method that makes it, `getProducts`, as on Android.
    static func diagnosticOperation(_ operation: String) -> String {
        return operation == "products.load" ? "getProducts" : operation
    }

    /// The contract's name for a diagnostic kind. The SDK's `store` kind (a product the store
    /// did not return, or sells otherwise than configured) is the contract's `configuration`.
    static func diagnosticKind(_ kind: VoidhashDiagnosticKind) -> String {
        switch kind {
        case .transport: return "transport"
        case .eviction: return "eviction"
        case .breaker: return "breaker"
        case .auth: return "auth"
        case .cache: return "cache"
        case .consent: return "consent"
        case .store: return "configuration"
        }
    }

    private static func identity(of client: VoidhashClient) throws -> VoidhashIdentityChange {
        guard let identity = client.currentIdentity else {
            throw NativeClientError.notInitialized()
        }
        return identity
    }

    static func coreEvent(_ event: VoidhashClientEvent) -> NativeClientCoreEvent {
        switch event {
        case .identity(let change):
            return .identity(change)
        case .person(let answer):
            return .person(personPayload(answer))
        case .flags(let answer):
            return .flags(flagsPayload(answer))
        case .schema(let json):
            return .schema(json)
        case .consent(let consent):
            return .consent(consent)
        case .diagnostic(let diagnostic):
            return .diagnostic(diagnostic)
        }
    }

    static func personPayload(_ answer: VoidhashPersonAnswer) -> NativePersonPayload {
        return NativePersonPayload(
            distinctId: answer.distinctId, generation: answer.generation,
            personJson: json(answer.state.value), isStale: answer.state.isStale,
            isExpired: answer.state.isExpired, reason: answer.state.reason)
    }

    static func flagsPayload(_ answer: VoidhashFlagsAnswer) -> NativeFlagsPayload {
        return NativeFlagsPayload(
            distinctId: answer.distinctId, generation: answer.generation, flagKeys: answer.keys,
            flags: answer.state.value.map { flag in
                NativeFlagPayload(
                    key: flag.key, enabled: flag.enabled, variantKey: flag.variantKey,
                    payloadJson: flag.payload.flatMap { json($0) })
            },
            isStale: answer.state.isStale)
    }

    static func json<Value: Encodable>(_ value: Value?) -> String? {
        guard let value, let data = try? JSONEncoder().encode(value) else {
            return nil
        }
        return String(decoding: data, as: UTF8.self)
    }

    /// A JSON object string as values the SDK takes; `nil` for anything else.
    static func object(_ json: String) -> [String: JSONValue]? {
        guard let value = try? JSONDecoder().decode(JSONValue.self, from: Data(json.utf8)),
            case .object(let object) = value
        else {
            return nil
        }
        return object
    }

    /// Person attributes as the SDK takes them: a JSON object of flat values.
    static func attributes(_ json: String) throws -> [String: JSONValue] {
        guard let attributes = object(json) else {
            throw NativeClientError.invalidArgument("person attributes must be a JSON object")
        }
        let nested = attributes.filter { _, value in
            if case .array = value { return true }
            if case .object = value { return true }
            return false
        }.keys.sorted()
        guard nested.isEmpty else {
            throw NativeClientError.invalidArgument(
                "person attributes must be flat values; nested: \(nested.joined(separator: ", "))")
        }
        return attributes
    }
}
