import Foundation
import NitroModules
import VoidhashCore

@_spi(VoidhashHost) import Voidhash

/// The native Voidhash client behind one React Native `VoidhashClient`. The behaviour lives in
/// ``VoidhashNativeClientCore``; this class only maps Nitro's types onto it and its answers back,
/// and reports every failure as a `"<CODE>: <detail>"` message.
final class HybridVoidhashNativeClient: HybridVoidhashNativeClientSpec {
    private let core = VoidhashNativeClientCore()

    // MARK: - Lifecycle

    func contractVersion() throws -> Double {
        return Double(VoidhashNativeClientCore.contractVersion)
    }

    func configure(configuration: NativeClientConfiguration) throws {
        core.configure(
            NativeClientCoreConfiguration(
                publishableKey: configuration.publishableKey,
                baseUrl: configuration.baseUrl,
                ingestUrl: configuration.ingestUrl,
                debug: configuration.debug,
                developmentMode: configuration.developmentMode,
                distinctId: configuration.distinctId,
                readOnly: configuration.readOnly,
                analyticsConsent: Self.consent(configuration.analyticsConsent),
                chosenAnalyticsConsent: configuration.chosenAnalyticsConsent.map(Self.consent),
                analyticsWhilePending: PendingAnalytics(
                    rawValue: configuration.analyticsWhilePending.stringValue) ?? .drop,
                grantConsentOnIdentify: configuration.grantConsentOnIdentify,
                automaticLifecycleEvents: configuration.automaticLifecycleEvents,
                installAttribution: configuration.installAttribution,
                preloadLocations: configuration.preloadLocations,
                flowRevisions: Dictionary(
                    configuration.flowRevisions.map { ($0.location, Int($0.revision)) },
                    uniquingKeysWith: { _, last in last }),
                flowCapabilities: Set(
                    configuration.flowCapabilities.compactMap {
                        FlowCapability(rawValue: $0.stringValue)
                    }),
                flowRuntimeModules: configuration.flowRuntime == .module,
                screenTrackingEnabled: configuration.screenTrackingEnabled,
                featureFlagMaxWaitMilliseconds: configuration.featureFlagMaxWaitMs,
                featureFlagDefaults: configuration.featureFlagDefaults ?? [:],
                internalSchemaJson: configuration.internalSchemaJson,
                appStoreMessages: configuration.appStoreMessages == .automatic
                    ? .automatic : .deferWhileFlowPresented,
                purchaseIntents: configuration.purchaseIntents == .manual
                    ? .manual : .purchaseWhenReady,
                sdkVersion: configuration.sdkVersion))
    }

    func start() throws -> Promise<Void> {
        // Settled from inside the start, so a shutdown() that overtook it resolves after the
        // start's rejection reached JavaScript.
        let promise = Promise<Void>()
        Task { [core] in
            try? await core.start { result in
                switch result {
                case .success:
                    promise.resolve()
                case .failure(let error):
                    promise.reject(withError: Self.bridged(error))
                }
            }
        }
        return promise
    }

    func shutdown() throws -> Promise<NativeFlushStatus> {
        return Self.promise { [core] in Self.flushStatus(try await core.shutdown()) }
    }

    func setEventListener(listener: @escaping (_ event: NativeClientEvent) -> Void) throws {
        let deliver = UncheckedListener(listener)
        core.setEventListener { event in deliver.call(Self.event(event)) }
    }

    func removeEventListener() throws {
        core.removeEventListener()
    }

    // MARK: - Identity and person

    func getDistinctId() throws -> Promise<String> {
        return Self.promise { [core] in try await core.getDistinctId() }
    }

    func identify(externalUserId: String, email: String?, name: String?) throws
        -> Promise<NativeIdentifyResult>
    {
        // Submitted now, on the calling thread, so identity changes keep call order.
        let identifying = core.identify(externalUserId: externalUserId, email: email, name: name)
        return Self.promise {
            let result = try await identifying.value
            return NativeIdentifyResult(
                identity: Self.identity(result.identity), status: Self.writeStatus(result.status),
                personJson: result.personJson)
        }
    }

    func reset() throws -> Promise<NativeIdentityChange> {
        let resetting = core.reset()
        return Self.promise { Self.identity(try await resetting.value) }
    }

    func signOut() throws -> Promise<NativeIdentityChange> {
        let signingOut = core.signOut()
        return Self.promise { Self.identity(try await signingOut.value) }
    }

    func group(groupType: String, groupKey: String, propertiesJson: String?) throws -> Promise<Void> {
        let grouping = core.group(type: groupType, key: groupKey, propertiesJson: propertiesJson)
        return Self.promise { try await grouping.value }
    }

    func setGroups(groupsJson: String) throws -> Promise<Void> {
        let setting = core.setGroups(groupsJson: groupsJson)
        return Self.promise { try await setting.value }
    }

    func resetGroups() throws -> Promise<Void> {
        let resetting = core.resetGroups()
        return Self.promise { try await resetting.value }
    }

    func getGroups() throws -> Dictionary<String, String> {
        return core.getGroups()
    }

    func setPersonAttributes(attributesJson: String) throws -> Promise<Void> {
        let writing = core.setPersonAttributes(attributesJson)
        return Self.promise { try await writing.value }
    }

    func setPersonAttributesState(attributesJson: String) throws
        -> Promise<NativePersonWriteResult>
    {
        let writing = core.setPersonAttributesState(attributesJson)
        return Self.promise {
            let result = try await writing.value
            return NativePersonWriteResult(
                status: Self.writeStatus(result.status), personJson: result.personJson)
        }
    }

    func getPersonState(forceFetch: Bool) throws -> Promise<NativePersonState> {
        return Self.promise { [core] in Self.person(try await core.getPersonState(forceFetch: forceFetch)) }
    }

    func resetPersonCache() throws -> Promise<Void> {
        return Self.promise { [core] in try await core.resetPersonCache() }
    }

    // MARK: - Flags, paywalls and products

    func getFeatureFlags(flagKeys: [String]?) throws -> Promise<NativeFeatureFlagsResult> {
        return Self.promise { [core] in Self.flags(try await core.getFeatureFlags(flagKeys)) }
    }

    func getPaywall(location: String) throws -> Promise<String> {
        return Self.promise { [core] in try await core.getPaywall(location: location) }
    }

    func getProducts() throws -> Promise<[NativeProduct]> {
        return Self.promise { [core] in try await core.getProducts().map(Self.product) }
    }

    // MARK: - Purchases

    func purchase(productSlug: String, options: NativePurchaseOptions) throws
        -> Promise<NativePurchaseResult>
    {
        // `replacing` and the Google Play options are for Google Play: the App Store moves a
        // subscriber between the products of one subscription group itself.
        let offer: NativePurchaseRequest.Offer
        switch options.offerSelection {
        case .automatic:
            offer = .automatic
        case .regularprice:
            offer = .regularPrice
        case .offer:
            offer = .offer(
                id: options.offerId ?? "",
                kind: options.offerKind.flatMap { VoidhashOfferKind(rawValue: $0.stringValue) })
        }
        let request = NativePurchaseRequest(
            offer: offer, quantity: options.quantity,
            simulatesAskToBuyInSandbox: options.appStore?.simulatesAskToBuyInSandbox ?? false)
        return Self.promise { [core] in
            switch try await core.purchase(productSlug: productSlug, request: request) {
            case .purchased(let transaction, let synced):
                return NativePurchaseResult(
                    outcome: .purchased, transaction: Self.transaction(transaction),
                    synced: synced)
            case .pending:
                return NativePurchaseResult(outcome: .pending, transaction: nil, synced: nil)
            case .cancelled:
                return NativePurchaseResult(outcome: .cancelled, transaction: nil, synced: nil)
            case .disabled:
                // The core rejects a purchase that bought nothing.
                throw NativeClientError.notInitialized()
            }
        }
    }

    func restorePurchases() throws -> Promise<NativePersonState> {
        return Self.promise { [core] in Self.person(try await core.restorePurchases()) }
    }

    func syncPurchases() throws -> Promise<Void> {
        return Self.promise { [core] in try await core.syncPurchases() }
    }

    func reportTransaction(transaction: NativeReportedTransaction, isRestore: Bool) throws
        -> Promise<Void>
    {
        let payload = NativeReportedTransactionPayload(
            // The core takes the store as the platform it runs on.
            platform: transaction.platform == .appstore ? "ios" : "android",
            transactionId: transaction.transactionId,
            purchaseToken: transaction.purchaseToken,
            purchaseState: transaction.purchaseState?.stringValue,
            signedTransaction: transaction.signedTransaction)
        return Self.promise { [core] in
            try await core.reportTransaction(payload, isRestore: isRestore)
        }
    }

    // MARK: - Store actions

    func showManageSubscriptions(productSlug: String?) throws -> Promise<Void> {
        return Self.promise { [core] in
            try await core.showManageSubscriptions(productSlug: productSlug)
        }
    }

    func presentCodeRedemption(code: String?) throws -> Promise<Void> {
        // The App Store's sheet takes no code: the end user types it in.
        return Self.promise { [core] in try await core.presentCodeRedemption() }
    }

    func getStorefront() throws -> Promise<NativeStorefront?> {
        return Self.promise { [core] in
            try await core.getStorefront().map { storefront in
                NativeStorefront(
                    countryCode: storefront.countryCode, currencyCode: storefront.currencyCode)
            }
        }
    }

    func canMakePayments() throws -> Promise<Bool> {
        return Self.promise { [core] in try await core.canMakePayments() }
    }

    // MARK: - App Store

    func appStoreBeginRefundRequest(transactionId: String) throws
        -> Promise<NativeRefundRequestStatus>
    {
        return Self.promise { [core] in
            switch try await core.appStoreBeginRefundRequest(transactionId: transactionId) {
            case .success: return .success
            case .userCancelled: return .usercancelled
            }
        }
    }

    func appStoreSubscriptionStatus(groupId: String) throws
        -> Promise<[NativeAppStoreSubscriptionStatus]>
    {
        return Self.promise { [core] in
            try await core.appStoreSubscriptionStatus(groupId: groupId).compactMap { status in
                status.renewalInfo.map { renewalInfo in
                    NativeAppStoreSubscriptionStatus(
                        state: NativeAppStoreSubscriptionState(fromString: status.state.rawValue)
                            ?? .unknown,
                        transaction: Self.transaction(status.transaction),
                        renewalInfoJson: NativeStoreJson.renewalInfo(renewalInfo))
                }
            }
        }
    }

    func appStoreCurrentEntitlements() throws -> Promise<[NativeTransaction]> {
        return Self.promise { [core] in
            try await core.appStoreCurrentEntitlements().map(Self.transaction)
        }
    }

    func appStoreAppTransaction() throws -> Promise<String> {
        return Self.promise { [core] in try await core.appStoreAppTransaction() }
    }

    // MARK: - Google Play

    func googlePlayShowInAppMessages() throws -> Promise<NativeInAppMessageResult> {
        return Promise.rejected(withError: Self.bridged(
            NativeClientError.unsupportedPlatform("googlePlay.showInAppMessages()")))
    }

    func googlePlayQueryPurchases(includeSuspended: Bool) throws -> Promise<[NativeTransaction]> {
        return Promise.rejected(withError: Self.bridged(
            NativeClientError.unsupportedPlatform("googlePlay.queryPurchases()")))
    }

    func googlePlayIsFeatureSupported(feature: String) throws -> Promise<Bool> {
        return Promise.rejected(withError: Self.bridged(
            NativeClientError.unsupportedPlatform("googlePlay.isFeatureSupported()")))
    }

    // MARK: - Configuration at runtime

    func setAnalyticsConsent(consent: NativeAnalyticsConsent) throws -> Promise<Bool> {
        let consent = Self.consent(consent)
        return Self.promise { [core] in try await core.setAnalyticsConsent(consent) }
    }

    func getAnalyticsConsent() throws -> NativeAnalyticsConsent {
        return Self.consent(core.getAnalyticsConsent())
    }

    func setReadOnly(readOnly: Bool) throws {
        core.setReadOnly(readOnly)
    }

    func isReadOnly() throws -> Bool {
        return core.isReadOnly()
    }

    // MARK: - Analytics

    func capture(eventName: String, propertiesJson: String) throws {
        core.capture(eventName, propertiesJson: propertiesJson)
    }

    func screen(name: String, propertiesJson: String) throws {
        core.screen(name, propertiesJson: propertiesJson)
    }

    func captureAt(eventName: String, propertiesJson: String, capturedAt: Double) throws {
        core.capture(eventName, propertiesJson: propertiesJson, capturedAt: capturedAt)
    }

    func screenAt(name: String, propertiesJson: String, capturedAt: Double) throws {
        core.screen(name, propertiesJson: propertiesJson, capturedAt: capturedAt)
    }

    func flush() throws -> Promise<NativeFlushStatus> {
        return Self.promise { [core] in Self.flushStatus(try await core.flush()) }
    }

    func getSessionId() throws -> String {
        return core.getSessionId()
    }

    // MARK: - Flows

    func presentFlow(
        location: String, presentation: NativeFlowPresentation,
        onAction: @escaping (_ name: String, _ argsJson: String) -> Promise<Promise<String>>
    ) throws -> Promise<String> {
        let revision = presentation.revision.map { Int($0) }
        let inputJson = presentation.inputJson
        let actions = presentation.actions
        let runAction = UncheckedFlowAction(onAction)
        return Self.promise { [core] in
            try await core.presentFlow(
                location: location, revision: revision, inputJson: inputJson, actions: actions,
                onAction: { name, argumentsJson in
                    try await runAction.call(name, argumentsJson)
                })
        }
    }

    func updateFlowInput(valuesJson: String) throws -> Promise<Void> {
        return Self.promise { [core] in try await core.updateFlowInput(valuesJson: valuesJson) }
    }

    func dismissFlow() throws -> Promise<Void> {
        return Self.promise { [core] in try await core.dismissFlow() }
    }

    // MARK: - Mapping

    /// Runs `work` as a Nitro promise whose rejection message is `"<CODE>: <detail>"`.
    private static func promise<Value>(
        _ work: @escaping @Sendable () async throws -> Value
    ) -> Promise<Value> {
        return Promise.async {
            do {
                return try await work()
            } catch {
                throw bridged(error)
            }
        }
    }

    private static func bridged(_ error: any Error) -> RuntimeError {
        return RuntimeError.error(withMessage: NativeClientError.from(error).description)
    }

    private static func consent(_ consent: NativeAnalyticsConsent) -> AnalyticsConsent {
        return AnalyticsConsent(rawValue: consent.stringValue) ?? .pending
    }

    private static func consent(_ consent: AnalyticsConsent) -> NativeAnalyticsConsent {
        return NativeAnalyticsConsent(fromString: consent.rawValue) ?? .pending
    }

    private static func writeStatus(_ status: PersonWriteStatus) -> NativeWriteStatus {
        return NativeWriteStatus(fromString: status.rawValue) ?? .deferred
    }

    private static func identity(_ change: VoidhashIdentityChange) -> NativeIdentityChange {
        return NativeIdentityChange(
            distinctId: change.distinctId, previousDistinctId: change.previousDistinctId,
            generation: Double(change.generation))
    }

    private static func person(_ person: NativePersonPayload) -> NativePersonState {
        return NativePersonState(
            distinctId: person.distinctId, generation: Double(person.generation),
            personJson: person.personJson, isStale: person.isStale, isExpired: person.isExpired,
            reason: NativeFreshnessReason(fromString: person.reason.rawValue) ?? .refreshfailed)
    }

    private static func flags(_ flags: NativeFlagsPayload) -> NativeFeatureFlagsResult {
        return NativeFeatureFlagsResult(
            distinctId: flags.distinctId, generation: Double(flags.generation),
            flagKeys: flags.flagKeys,
            flags: flags.flags.map { flag in
                NativeFeatureFlag(
                    key: flag.key, enabled: flag.enabled, variantKey: flag.variantKey,
                    payloadJson: flag.payloadJson)
            },
            isStale: flags.isStale)
    }

    private static func flushStatus(_ status: FlushStatus) -> NativeFlushStatus {
        return NativeFlushStatus(
            flushed: Double(status.flushed), pending: Double(status.pending),
            lastErrorMessage: status.lastError)
    }

    private static func price(_ price: VoidhashPrice) -> NativePrice {
        return NativePrice(
            amount: NativeStoreJson.number(price.amount),
            amountMicros: Double(price.amountMicros), currencyCode: price.currencyCode,
            formatted: price.formatted)
    }

    private static func period(_ period: VoidhashPeriod) -> NativePeriod {
        return NativePeriod(
            unit: NativePeriodUnit(fromString: period.unit.rawValue) ?? .unknown,
            count: Double(period.count), iso8601: period.iso8601)
    }

    private static func offer(_ offer: VoidhashOffer) -> NativeOffer {
        return NativeOffer(
            id: offer.id, kind: NativeOfferKind(fromString: offer.kind.rawValue) ?? .unknown,
            phases: offer.phases.map { phase in
                NativePricingPhase(
                    paymentMode: NativePaymentMode(fromString: phase.paymentMode.rawValue)
                        ?? .unknown,
                    price: price(phase.price), period: period(phase.period),
                    cycles: Double(phase.cycles))
            },
            price: offer.price.map(price))
    }

    private static func product(_ product: VoidhashProduct) -> NativeProduct {
        return NativeProduct(
            productId: product.productId, slug: product.slug,
            store: NativeStore(fromString: product.store.rawValue) ?? .unknown,
            storeProductId: product.storeProductId,
            type: NativeProductType(fromString: product.type.rawValue) ?? .unknown,
            name: product.name, displayName: product.displayName,
            description: product.description, price: price(product.price),
            subscription: product.subscription.map { subscription in
                NativeSubscriptionInfo(
                    period: period(subscription.period), groupId: subscription.groupId,
                    introOffer: subscription.introOffer.map(offer),
                    pricePerDay: price(subscription.pricePerDay),
                    pricePerWeek: price(subscription.pricePerWeek),
                    pricePerMonth: price(subscription.pricePerMonth),
                    pricePerYear: price(subscription.pricePerYear))
            },
            offers: product.offers.map(offer),
            appStoreJson: product.appStore.map(NativeStoreJson.product), googlePlayJson: nil)
    }

    private static func millis(_ date: Date) -> Double {
        return (date.timeIntervalSince1970 * 1000).rounded()
    }

    private static func transaction(_ transaction: VoidhashTransaction) -> NativeTransaction {
        return NativeTransaction(
            id: transaction.id, originalId: transaction.originalId,
            productSlug: transaction.productSlug, storeProductId: transaction.storeProductId,
            store: NativeStore(fromString: transaction.store.rawValue) ?? .unknown,
            purchasedAt: millis(transaction.purchasedAt),
            expiresAt: transaction.expiresAt.map(millis),
            quantity: Double(transaction.quantity), isRenewal: transaction.isRenewal,
            offer: transaction.offer.map { offer in
                NativeTransactionOffer(
                    id: offer.id,
                    kind: offer.kind.map {
                        NativeTransactionOfferKind(fromString: $0.rawValue) ?? .unknown
                    },
                    paymentMode: offer.paymentMode.map {
                        NativePaymentMode(fromString: $0.rawValue) ?? .unknown
                    })
            },
            environment: NativeEnvironment(fromString: transaction.environment.rawValue)
                ?? .unknown,
            appStoreJson: transaction.appStore.map(NativeStoreJson.transaction),
            googlePlayJson: nil)
    }

    private static func diagnostic(_ diagnostic: VoidhashDiagnostic) -> NativeDiagnostic {
        return NativeDiagnostic(
            kind: NativeDiagnosticKind(
                fromString: VoidhashNativeClientCore.diagnosticKind(diagnostic.kind))
                ?? .configuration,
            code: diagnostic.code,
            operation: VoidhashNativeClientCore.diagnosticOperation(diagnostic.operation),
            retryable: diagnostic.retryable, httpStatus: diagnostic.httpStatus.map(Double.init),
            message: diagnostic.message)
    }

    private static func event(_ event: NativeClientCoreEvent) -> NativeClientEvent {
        var identity: NativeIdentityChange?
        var person: NativePersonState?
        var flags: NativeFeatureFlagsResult?
        var schemaJson: String?
        var consent: NativeAnalyticsConsent?
        var diagnostic: NativeDiagnostic?
        var transaction: NativeTransactionUpdate?
        var purchaseIntent: NativePurchaseIntent?
        let type: NativeClientEventType
        switch event {
        case .identity(let change):
            type = .identity
            identity = Self.identity(change)
        case .person(let state):
            type = .person
            person = Self.person(state)
        case .flags(let result):
            type = .flags
            flags = Self.flags(result)
        case .schema(let json):
            type = .schema
            schemaJson = json
        case .consent(let value):
            type = .consent
            consent = Self.consent(value)
        case .diagnostic(let value):
            type = .diagnostic
            diagnostic = Self.diagnostic(value)
        case .transaction(let update):
            type = .transaction
            transaction = NativeTransactionUpdate(
                transaction: Self.transaction(update.transaction), synced: update.synced)
        case .purchaseIntent(let intent):
            type = .purchaseintent
            purchaseIntent = NativePurchaseIntent(
                productSlug: intent.product.slug, offer: intent.offer.map(Self.offer))
        }
        return NativeClientEvent(
            type: type, identity: identity, person: person, flags: flags, schemaJson: schemaJson,
            consent: consent, diagnostic: diagnostic, transaction: transaction,
            purchaseIntent: purchaseIntent)
    }
}

/// The JavaScript listener Nitro hands over, callable from any thread: Nitro dispatches each
/// call to the JavaScript thread in call order.
private final class UncheckedListener: @unchecked Sendable {
    private let listener: (NativeClientEvent) -> Void

    init(_ listener: @escaping (NativeClientEvent) -> Void) {
        self.listener = listener
    }

    func call(_ event: NativeClientEvent) {
        listener(event)
    }
}

/// The JavaScript function Nitro hands over for a flow's app actions, callable from any thread:
/// Nitro dispatches each call to the JavaScript thread.
private final class UncheckedFlowAction: @unchecked Sendable {
    private let action: (_ name: String, _ argsJson: String) -> Promise<Promise<String>>

    init(_ action: @escaping (_ name: String, _ argsJson: String) -> Promise<Promise<String>>) {
        self.action = action
    }

    /// Runs the JavaScript handler of `name` and returns its reply. The call into JavaScript
    /// resolves once the handler was invoked, with the promise the handler returned; the reply
    /// is that promise's value.
    func call(_ name: String, _ argumentsJson: String) async throws -> String {
        return try await action(name, argumentsJson).await().await()
    }
}
