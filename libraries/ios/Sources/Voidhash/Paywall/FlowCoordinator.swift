import Foundation
import VoidhashCore

/// What an app lets its flows do, granted at SDK setup.
///
/// Purchases, restores, closing and analytics need no grant. An action needing a capability the
/// app did not grant is dropped with a warning.
public enum FlowCapability: String, CaseIterable, Sendable, Hashable {
    /// Ask the user to allow notifications.
    case notifications
    /// Ask the user to allow tracking (App Tracking Transparency).
    case tracking
    /// Set attributes on the current person.
    case attributes
    /// Open links outside the app.
    case links
}

/// A system permission a flow can ask for.
public enum FlowPermission: String, Sendable, Equatable {
    case notifications
    case tracking
}

/// Why a flow could not be presented, or stopped being shown.
public enum FlowError: Error, Sendable, Equatable, CustomStringConvertible {
    /// The SDK is disabled or shut down.
    case disabled
    /// No published flow is assigned to the location for the current person.
    case notAssigned
    /// Nothing is cached for the location and the backend cannot be reached, or the flow's
    /// package could not be downloaded.
    case unavailable
    /// The app did not link the `VoidhashUI` renderer.
    case rendererMissing
    /// The flow was published in a package format this SDK version cannot read.
    case unsupportedPackage(abiVersion: Int)
    /// There was nothing to present from, the renderer could not show the flow, or it could no
    /// longer draw a flow it was showing.
    case presentationFailed(String)

    public var description: String {
        switch self {
        case .disabled:
            return "FLOW_DISABLED: Voidhash is disabled or shut down"
        case .notAssigned:
            return "FLOW_NOT_ASSIGNED: no flow is assigned to this location"
        case .unavailable:
            return
                "FLOW_UNAVAILABLE: the flow is not cached on this device and could not be loaded"
        case .rendererMissing:
            return
                "FLOW_RENDERER_MISSING: add the VoidhashUI product to the app; no option is needed"
        case .unsupportedPackage(let abiVersion):
            return
                "FLOW_UNSUPPORTED_PACKAGE: the flow uses package format \(abiVersion), which this SDK cannot read; update the SDK"
        case .presentationFailed(let message):
            return "FLOW_PRESENTATION_FAILED: \(message)"
        }
    }
}

/// Keeps a flow's variables between presentations, keyed by flow. These are the flow's own
/// working state, replayed to it when it is presented again; an app reads a flow's outputs from
/// its ``FlowResult``.
public struct FlowStateStore: Sendable {
    public var load: @Sendable (_ key: String) async -> [String: JSONValue]?
    public var save: @Sendable (_ key: String, _ variables: [String: JSONValue]) async -> Void
    public var clear: @Sendable (_ key: String) async -> Void

    public init(
        load: @escaping @Sendable (_ key: String) async -> [String: JSONValue]?,
        save: @escaping @Sendable (_ key: String, _ variables: [String: JSONValue]) async -> Void,
        clear: @escaping @Sendable (_ key: String) async -> Void
    ) {
        self.load = load
        self.save = save
        self.clear = clear
    }
}

/// What a flow can reach in the app presenting it.
///
/// ``VoidhashClient`` builds one over its own purchase, analytics and person APIs; embedding
/// hosts (the React Native SDK) build one over theirs.
public struct FlowHost: Sendable {
    public var capabilities: Set<FlowCapability>
    public var getProducts: @Sendable () async throws -> [VoidhashProduct]
    /// Buys a product the flow chose, with the offer the flow names (`nil` for the automatic
    /// choice), naming the paywall it was started from so its revenue is credited to it. An
    /// offer that cannot be bought must fail the purchase, never buy the product at its regular
    /// price instead.
    public var purchase:
        @Sendable (
            VoidhashProduct, _ offerId: String?, _ paywallContext: SdkPurchasePaywallContext
        ) async throws -> VoidhashPurchaseResult
    public var restorePurchases: @Sendable () async throws -> Void
    public var capture: @Sendable (_ event: String, _ properties: [String: JSONValue]) async -> Void
    public var screen: @Sendable (_ name: String, _ properties: [String: JSONValue]) async -> Void
    public var setAttribute: @Sendable (_ name: String, _ value: JSONValue) async throws -> Void
    /// Asks the user for a system permission; answers whether it is granted.
    public var requestPermission: @Sendable (FlowPermission) async -> Bool
    public var openUrl: @Sendable (String) async -> Void
    public var state: FlowStateStore
    /// Locale identifier reported to the flow.
    public var locale: String?
    public var warn: VoidhashWarningHandler

    public init(
        capabilities: Set<FlowCapability>,
        getProducts: @escaping @Sendable () async throws -> [VoidhashProduct],
        purchase:
            @escaping @Sendable (VoidhashProduct, String?, SdkPurchasePaywallContext) async throws
            -> VoidhashPurchaseResult,
        restorePurchases: @escaping @Sendable () async throws -> Void,
        capture: @escaping @Sendable (String, [String: JSONValue]) async -> Void,
        screen: @escaping @Sendable (String, [String: JSONValue]) async -> Void,
        setAttribute: @escaping @Sendable (String, JSONValue) async throws -> Void,
        requestPermission: @escaping @Sendable (FlowPermission) async -> Bool,
        openUrl: @escaping @Sendable (String) async -> Void,
        state: FlowStateStore,
        locale: String?,
        warn: @escaping VoidhashWarningHandler
    ) {
        self.capabilities = capabilities
        self.getProducts = getProducts
        self.purchase = purchase
        self.restorePurchases = restorePurchases
        self.capture = capture
        self.screen = screen
        self.setAttribute = setAttribute
        self.requestPermission = requestPermission
        self.openUrl = openUrl
        self.state = state
        self.locale = locale
        self.warn = warn
    }
}

/// Presents flows and answers every message they send.
///
/// A flow asks for work by message: `ready` is answered with a `configure` envelope (products,
/// granted capabilities, saved state), `purchase` and `restore` run through the host's single
/// purchase and restore entry points and report their progress, and `finish`, `close`, a
/// completed purchase or restore end the flow with a ``FlowResult``. An `appAction` runs the
/// handler the presentation registered for it and is answered with its reply. Permissions,
/// attributes, links, analytics and saved state go to the ``FlowHost``. The renderer only relays
/// messages.
///
/// One flow is on screen at a time, and the presenter is never asked for two transitions at
/// once: a flow is dismissed only after its presentation finished, the next one is presented only
/// after the one before it left the screen, and a presentation returns its result only then.
public actor FlowCoordinator {
    /// Loads the verified bytes of a location's flow package.
    public typealias PackageLoader =
        @Sendable (_ location: String, _ package: SdkResolvedPaywall.FlowPackage) async throws
        -> Data

    /// Resolves what is assigned to a location for an app built against `revision` of the
    /// location's interface.
    public typealias PaywallResolver =
        @Sendable (_ location: String, _ revision: Int) async throws -> SdkResolvedPaywall?

    /// How a presentation ended, or why nothing was presented.
    private typealias Ending = Result<FlowResult, FlowError>

    /// One flow handed to the presenter. Only one holds the screen at a time.
    private final class Session {
        let id: Int
        let location: String
        let paywallId: String?
        /// The paywall a purchase started here names.
        let paywallContext: SdkPurchasePaywallContext
        /// Key of the flow's saved state.
        let stateKey: String
        let productIds: [String]
        /// Paywalls end after a purchase or restore; onboarding flows continue.
        let shouldEndFlowOnPurchase: Bool
        /// The app's handlers by action name.
        let actions: [String: FlowActionHandler]
        /// The app's inputs, as last set.
        var input: [String: FlowValue]
        /// Whether the flow has its `configure`: from then on a changed input is sent to it.
        var isConfigured = false
        /// The outputs the flow last reported.
        var output: [String: FlowValue] = [:]
        /// App action handlers still running, by the `requestId` of their call; cancelled when
        /// the flow ends.
        var appActions: [String: Task<Void, Never>] = [:]
        /// How the flow ended, set as soon as that is decided: its messages are ignored from
        /// then on. The caller hears it once the flow has left the screen.
        var result: Ending?
        /// The presenter showing the flow; yields whether it got on screen.
        var presentation: Task<Bool, any Error>?
        /// Takes the flow off the screen and then returns `result` to the caller.
        var ending: Task<Void, Never>?
        var continuation: CheckedContinuation<Ending, Never>?
        var actionInFlight = false
        /// Answers the flow's `ready`; a purchase or restore waits for it.
        var configuring: Task<Void, Never>?
        /// Feeds the flow's messages to the coordinator; finished when the session ends, which
        /// ends the task reading them.
        var messages: AsyncStream<String>.Continuation?

        init(
            id: Int, location: String, paywallId: String?,
            paywallContext: SdkPurchasePaywallContext, stateKey: String, productIds: [String],
            shouldEndFlowOnPurchase: Bool, input: [String: FlowValue],
            actions: [String: FlowActionHandler]
        ) {
            self.id = id
            self.location = location
            self.paywallId = paywallId
            self.paywallContext = paywallContext
            self.stateKey = stateKey
            self.productIds = productIds
            self.shouldEndFlowOnPurchase = shouldEndFlowOnPurchase
            self.input = input
            self.actions = actions
        }
    }

    /// A presentation with nothing on screen yet: it is resolving its location, loading its
    /// package or waiting for the flow before it to leave the screen.
    private final class PendingPresentation {
        var isCancelled = false
        /// How the presentation ends once cancelled: dismissed, unless the client was shut
        /// down under it or it ran out of time.
        var cancelledResult = Ending.success(FlowResult(outcome: FlowResult.dismissed))
        /// Cancels the presentation when it has taken too long to reach the presenter.
        var deadline: Task<Void, Never>?
        /// The session to present and its package, or why there is none, once resolved and
        /// loaded.
        var loaded: Result<Loaded, FlowError>?
        /// Resumed when `loaded` is set or the presentation is cancelled, whichever is first.
        var loading: CheckedContinuation<Void, Never>?
    }

    private let presenter: (any FlowPresenting)?
    private let loadPackage: PackageLoader
    private let resolvePaywall: PaywallResolver
    private let host: FlowHost
    private let presentationDeadline: @Sendable () async -> Void
    /// The session holding the screen, from before its presentation until it has left.
    private var active: Session?
    private var pending: [Int: PendingPresentation] = [:]
    private var nextSessionId = 0
    private var isShutDown = false
    /// Tasks still reading a flow's messages: one per flow whose session has not ended. Test
    /// affordance.
    private(set) var runningMessageLoops = 0

    /// - Parameters:
    ///   - presenter: The renderer's presenter; `nil` when the app did not add one, which fails
    ///     every presentation with ``FlowError/rendererMissing``.
    ///   - loadPackage: Loads a flow package's verified bytes.
    ///   - resolvePaywall: Resolves what is assigned to a location for the interface revision
    ///     the presentation names; throws when nothing is cached and the backend cannot be
    ///     reached.
    ///   - host: What flows can reach in the app.
    ///   - presentationDeadline: Returns once a presentation has had its time to reach the
    ///     presenter, ``NetworkPolicy/flowPresentationDeadlineSeconds`` unless a test says
    ///     otherwise.
    public init(
        presenter: (any FlowPresenting)?,
        loadPackage: @escaping PackageLoader,
        resolvePaywall: @escaping PaywallResolver,
        host: FlowHost,
        presentationDeadline: @escaping @Sendable () async -> Void = {
            await NetworkPolicy.sleep(
                milliseconds: NetworkPolicy.flowPresentationDeadlineSeconds * 1000)
        }
    ) {
        self.presenter = presenter
        self.loadPackage = loadPackage
        self.resolvePaywall = resolvePaywall
        self.host = host
        self.presentationDeadline = presentationDeadline
    }

    /// Loads the package `release` would be shown with, so the next presentation needs no
    /// download.
    public func preload(location: String, release: SdkResolvedPaywall.Release) async throws {
        guard let presenter, let flowPackage = release.flowPackage,
            presenter.supportsFlowPackage(flowPackage)
        else {
            return
        }
        _ = try await loadPackage(location, flowPackage)
    }

    /// Presents the flow assigned to `location` and returns how it ended, once it has left
    /// the screen.
    ///
    /// A flow already on screen is closed first; its presentation ends as
    /// ``FlowResult/dismissed``. Cancelling the calling task, or ``dismiss()``, closes the flow,
    /// or keeps it from being shown while it is still loading; the presentation then ends as
    /// ``FlowResult/dismissed``.
    ///
    /// A flow not handed to the presenter within
    /// ``NetworkPolicy/flowPresentationDeadlineSeconds`` of this call is not shown, then or
    /// later: by then the user is doing something else. The presentation fails with
    /// ``FlowError/unavailable``, while its package is still downloaded and cached for the next
    /// one. Once the presenter has the flow, no deadline applies.
    ///
    /// - Parameters:
    ///   - location: The slug of the location.
    ///   - revision: The revision of the location's interface the app was built against, 0
    ///     for none. The location is resolved for it.
    ///   - input: The app's inputs by name, sent to the flow when it is configured.
    ///   - actions: Handlers of the app actions the flow may call, by name. A handler runs on a
    ///     task that is cancelled when the flow ends. A call with no handler, and a handler
    ///     that throws, fail the call in the flow.
    /// - Throws: ``FlowError`` when the flow could not be presented, or could no longer be
    ///   drawn while it was shown.
    public func present(
        location: String, revision: Int = 0, input: [String: FlowValue] = [:],
        actions: [String: FlowActionHandler] = [:]
    ) async throws -> FlowResult {
        guard !isShutDown else {
            throw FlowError.disabled
        }
        guard let presenter else {
            host.warn(FlowError.rendererMissing.description)
            throw FlowError.rendererMissing
        }

        nextSessionId += 1
        let id = nextSessionId
        let presentation = PendingPresentation()
        pending[id] = presentation
        presentation.deadline = Task { [presentationDeadline] in
            await presentationDeadline()
            guard !Task.isCancelled else {
                return
            }
            self.presentationTookTooLong(id, location: location)
        }
        let request = Request(
            location: location, revision: revision, input: representable(input, in: location),
            actions: actions)
        return try await withTaskCancellationHandler {
            try await present(id: id, request: request, presenter: presenter).get()
        } onCancel: {
            Task { await self.cancel(id) }
        }
    }

    /// A presentation's session with its verified package, ready for the presenter.
    private struct Loaded {
        let session: Session
        let package: Data
        let flowPackage: SdkResolvedPaywall.FlowPackage
    }

    /// What a presentation was asked to show.
    private struct Request: Sendable {
        let location: String
        let revision: Int
        let input: [String: FlowValue]
        let actions: [String: FlowActionHandler]
    }

    private func present(id: Int, request: Request, presenter: any FlowPresenting) async
        -> Ending
    {
        let presentation = pending[id]
        defer {
            presentation?.deadline?.cancel()
            pending[id] = nil
        }
        guard let loaded = await load(id: id, request: request, presenter: presenter) else {
            return presentation?.cancelledResult ?? FlowCoordinator.dismissed
        }
        let session: Session
        let package: Data
        let flowPackage: SdkResolvedPaywall.FlowPackage
        switch loaded {
        case .success(let loaded):
            (session, package, flowPackage) = (loaded.session, loaded.package, loaded.flowPackage)
        case .failure(let error):
            return .failure(error)
        }

        // Calls can overlap, and each wait below lets another one in: the screen is taken only
        // when no session holds it, checked again after every wait.
        while let previous = active, pending[id]?.isCancelled == false {
            await end(previous, outcome: FlowResult.dismissed)
        }
        guard pending[id]?.isCancelled == false, !Task.isCancelled else {
            return presentation?.cancelledResult ?? FlowCoordinator.dismissed
        }
        // The presenter has the flow from here on, and with it the deadline is met.
        presentation?.deadline?.cancel()
        pending[id] = nil
        active = session

        // The flow announces `ready` once it is on screen, through the handler registered
        // here, and is configured in answer.
        let onBridgeEvent = messageHandler(for: session)
        let onDismiss: FlowDismissedHandler = { [weak self] in
            Task { await self?.presenterDidDismiss(sessionId: id) }
        }
        let onFailure: FlowFailedHandler = { [weak self] message in
            Task { await self?.presenterDidFail(sessionId: id, message: message) }
        }
        // On its own task, so cancelling the caller cannot interrupt the presentation halfway
        // and ending the session can wait for it.
        let location = request.location
        let showing = Task {
            try await presenter.show(
                locationSlug: location, package: package, flowPackage: flowPackage,
                onBridgeEvent: onBridgeEvent, onDismiss: onDismiss, onFailure: onFailure)
        }
        session.presentation = showing
        do {
            if try await !showing.value {
                await end(
                    session,
                    with: .failure(.presentationFailed("the renderer could not show the flow")))
            }
        } catch {
            await end(session, with: .failure(.presentationFailed(describe(error))))
        }
        return await result(of: session)
    }

    /// Changes inputs of the flow on screen; does nothing when none is shown. A flow that is
    /// not configured yet receives them with its configuration.
    public func updateInput(_ values: [String: FlowValue]) {
        guard let session = active, session.result == nil else {
            return
        }
        let values = representable(values, in: session.location)
        guard !values.isEmpty else {
            return
        }
        session.input.merge(values) { _, changed in changed }
        if session.isConfigured {
            post(session, PaywallBridgeProtocol.inputMessage(values))
        }
    }

    /// `values` without the numbers JSON cannot carry, each reported.
    private func representable(_ values: [String: FlowValue], in location: String)
        -> [String: FlowValue]
    {
        return values.filter { name, value in
            if !value.isRepresentable {
                host.warn(
                    "Flow \"\(location)\": input \"\(name)\" is not a finite number and is not passed")
            }
            return value.isRepresentable
        }
    }

    /// Closes the presented flow and cancels every presentation that is still loading; each
    /// ends as ``FlowResult/dismissed``. Returns once the flow has left the screen.
    public func dismiss() async {
        for presentation in pending.values {
            cancel(presentation)
        }
        guard let active else {
            return
        }
        await end(active, outcome: FlowResult.dismissed)
    }

    /// Ends every flow of a client that was shut down, which is no way to keep one: the flow on
    /// screen is closed and its presentation ends as ``FlowResult/dismissed``, and a presentation
    /// still loading, like every later one, fails with ``FlowError/disabled``. Returns once the
    /// flow has left the screen.
    public func shutDown() async {
        isShutDown = true
        for presentation in pending.values {
            presentation.cancelledResult = .failure(.disabled)
            cancel(presentation)
        }
        guard let active else {
            return
        }
        await end(active, outcome: FlowResult.dismissed)
    }

    // MARK: - Loading

    /// The session of presentation `id` and the package to present, or why there is none; `nil`
    /// when the presentation was cancelled first.
    private func load(id: Int, request: Request, presenter: any FlowPresenting) async
        -> Result<Loaded, FlowError>?
    {
        guard pending[id]?.isCancelled == false else {
            return nil
        }
        // The presentation is read through `pending` on both sides of the wait rather than held
        // in a local: the closure runs on this actor, and a captured non-sendable local would be
        // a value sent into it.
        await withCheckedContinuation { continuation in
            guard let presentation = self.pending[id] else {
                continuation.resume()
                return
            }
            presentation.loading = continuation
            // On its own task: a cancelled presentation returns at once, while a download
            // already running finishes and leaves the package cached for the next one.
            Task { await self.resolveSession(id: id, request: request, presenter: presenter) }
        }
        guard let presentation = pending[id], !presentation.isCancelled else {
            return nil
        }
        return presentation.loaded
    }

    private func resolveSession(id: Int, request: Request, presenter: any FlowPresenting)
        async
    {
        let loaded = await makeSession(id: id, request: request, presenter: presenter)
        guard let presentation = pending[id] else {
            return
        }
        presentation.loaded = loaded
        presentation.loading?.resume()
        presentation.loading = nil
    }

    private func makeSession(id: Int, request: Request, presenter: any FlowPresenting)
        async -> Result<Loaded, FlowError>
    {
        let location = request.location
        let resolved: SdkResolvedPaywall?
        do {
            resolved = try await resolvePaywall(location, request.revision)
        } catch {
            host.warn("Flow \"\(location)\" is unavailable: \(describe(error))")
            return .failure(.unavailable)
        }
        guard let showing = resolved?.showing, let release = showing.paywallRelease else {
            return .failure(.notAssigned)
        }
        guard let flowPackage = release.flowPackage else {
            host.warn("The release assigned to \"\(location)\" has no flow package")
            return .failure(.notAssigned)
        }
        guard presenter.supportsFlowPackage(flowPackage) else {
            let error = FlowError.unsupportedPackage(abiVersion: flowPackage.abiVersion)
            host.warn("Flow \"\(location)\": \(error)")
            return .failure(error)
        }

        let package: Data
        do {
            package = try await loadPackage(location, flowPackage)
        } catch {
            host.warn("Flow \"\(location)\" is unavailable: \(describe(error))")
            return .failure(.unavailable)
        }

        let paywallId = showing.paywallId ?? showing.paywall?.id
        let session = Session(
            id: id, location: location, paywallId: paywallId,
            paywallContext: SdkPurchasePaywallContext(
                showingId: showing.id, placement: location, paywallId: paywallId,
                paywallReleaseId: showing.paywallReleaseId ?? release.releaseId),
            stateKey: paywallId ?? location, productIds: flowPackage.productIds,
            shouldEndFlowOnPurchase: flowPackage.shouldEndFlowOnPurchase ?? true,
            input: request.input, actions: request.actions)
        return .success(Loaded(session: session, package: package, flowPackage: flowPackage))
    }

    /// The task awaiting presentation `id` was cancelled.
    private func cancel(_ id: Int) async {
        if let presentation = pending[id] {
            cancel(presentation)
        } else if let active, active.id == id {
            await end(active, outcome: FlowResult.dismissed)
        }
    }

    /// Presentation `id` has not reached the presenter in the time it had.
    private func presentationTookTooLong(_ id: Int, location: String) {
        guard let presentation = pending[id], !presentation.isCancelled else {
            return
        }
        host.warn(
            "Flow \"\(location)\" was not ready within \(Int(NetworkPolicy.flowPresentationDeadlineSeconds)) seconds and is not shown; its package is still loaded for the next presentation"
        )
        presentation.cancelledResult = .failure(.unavailable)
        cancel(presentation)
    }

    /// Keeps a presentation with nothing on screen yet from showing anything.
    private func cancel(_ presentation: PendingPresentation) {
        presentation.isCancelled = true
        presentation.loading?.resume()
        presentation.loading = nil
    }

    // MARK: - Session lifetime

    private static let dismissed = Ending.success(FlowResult(outcome: FlowResult.dismissed))

    private func result(of session: Session) async -> Ending {
        if session.ending == nil {
            return await withCheckedContinuation { continuation in
                session.continuation = continuation
            }
        }
        await session.ending?.value
        return session.result ?? FlowCoordinator.dismissed
    }

    /// Ends `session` with `outcome` and the outputs the flow last reported, unless `output`
    /// names the ones it ended with.
    private func end(
        _ session: Session, outcome: String, output: [String: FlowValue]? = nil,
        productId: String? = nil
    ) async {
        await end(
            session,
            with: .success(
                FlowResult(
                    outcome: outcome, output: output ?? session.output, productId: productId)))
    }


    /// Ends `session` with `result` and returns once it has left the screen; of several ends
    /// the first decides the result.
    ///
    /// The flow's messages are ignored from the first call on. The caller of
    /// ``present(location:revision:input:actions:)`` hears the result only after the dismissal
    /// completed, so whatever it presents next does not run into the dismissal. The app action
    /// handlers still running are cancelled: nothing is left to answer.
    private func end(_ session: Session, with result: Ending) async {
        if session.ending == nil {
            session.result = result
            for handling in session.appActions.values {
                handling.cancel()
            }
            session.appActions = [:]
            // On its own task: the dismissal runs to its end whoever asked for it.
            session.ending = Task { await self.leaveScreen(session, with: result) }
        }
        await session.ending?.value
    }

    private func leaveScreen(_ session: Session, with result: Ending) async {
        // The presentation finishes first: the presenter is never asked for two transitions at
        // once. A flow the presenter reported as gone is dismissed all the same, which costs
        // nothing when it is gone and takes it down when it is not: a flow left on screen
        // after its session ended could not be closed.
        let presented = (try? await session.presentation?.value) ?? false
        if presented, let presenter {
            do {
                try await presenter.dismiss()
            } catch {
                host.warn("Could not dismiss flow \"\(session.location)\": \(describe(error))")
            }
        }
        if active === session {
            active = nil
        }
        // Nothing of the flow is answered any more; this ends the task reading its messages.
        session.messages?.finish()
        session.messages = nil
        session.continuation?.resume(returning: result)
        session.continuation = nil
    }

    /// The flow left the screen; unless the coordinator dismissed it, the app or the system did.
    private func presenterDidDismiss(sessionId: Int) async {
        guard let session = session(sessionId) else {
            return
        }
        await end(session, outcome: FlowResult.dismissed)
    }

    private func presenterDidFail(sessionId: Int, message: String) async {
        guard let session = session(sessionId) else {
            return
        }
        host.warn("Flow \"\(session.location)\" failed: \(message)")
        await end(session, with: .failure(.presentationFailed(message)))
    }

    private func session(_ id: Int) -> Session? {
        guard let active, active.id == id, active.result == nil else {
            return nil
        }
        return active
    }

    private func post(_ session: Session, _ message: String) {
        guard active === session, session.result == nil else {
            return
        }
        presenter?.postMessage(locationSlug: session.location, data: message)
    }

    // MARK: - Messages

    /// Feeds a presentation's messages to ``dispatch(sessionId:rawMessage:)`` in the order the
    /// flow emitted them.
    private func messageHandler(for session: Session) -> FlowMessageHandler {
        let sessionId = session.id
        let (messages, continuation) = AsyncStream<String>.makeStream()
        // A stream does not finish when its continuation is released, so the session finishes
        // it when it ends; until then this task waits for the flow's next message.
        session.messages = continuation
        runningMessageLoops += 1
        Task { [weak self] in
            for await message in messages {
                await self?.dispatch(sessionId: sessionId, rawMessage: message)
            }
            await self?.messageLoopEnded()
        }
        return { message in continuation.yield(message) }
    }

    private func messageLoopEnded() {
        runningMessageLoops -= 1
    }

    /// Handles a message in the order the flow sent it, without letting a slow one hold up the
    /// messages behind it.
    ///
    /// `ready` is answered on its own task, because the products it is answered with come from
    /// the store, which can take as long as the network does. Purchases and restores run on
    /// their own task too, after the `configure` they depend on. So a `close` or a second action
    /// is answered while any of them is in progress.
    private func dispatch(sessionId: Int, rawMessage: String) async {
        let type = try? PaywallBridgeProtocol.parse(rawMessage).type
        guard type == .ready || type == .purchase || type == .restore,
            let session = session(sessionId)
        else {
            await handle(sessionId: sessionId, rawMessage: rawMessage)
            return
        }
        let configuring = session.configuring
        let handling = Task {
            await configuring?.value
            await self.handle(sessionId: sessionId, rawMessage: rawMessage)
        }
        if type == .ready {
            session.configuring = handling
        }
    }

    /// Handles one flow → host message of presentation `sessionId`.
    func handle(sessionId: Int, rawMessage: String) async {
        guard let session = session(sessionId) else {
            return
        }
        let envelope: PaywallBridgeEnvelope
        do {
            envelope = try PaywallBridgeProtocol.parse(rawMessage)
        } catch {
            host.warn("Ignoring an unreadable flow message: \(error)")
            return
        }

        switch envelope.type {
        case .ready:
            await configure(session, requestId: envelope.requestId)
        case .close:
            await end(
                session, outcome: FlowResult.dismissed,
                output: envelope.object("output").map(FlowValue.values(in:)))
        case .purchase, .restore:
            await runAction(session, envelope: envelope)
        case .finish:
            await host.state.clear(session.stateKey)
            await end(
                session, outcome: envelope.string("result") ?? "",
                output: envelope.object("output").map(FlowValue.values(in:)))
        case .appAction:
            runAppAction(session, envelope: envelope)
        case .openExternal:
            guard granted(.links, for: session, action: "open a link"),
                let url = envelope.string("url")
            else {
                return
            }
            await host.openUrl(url)
        case .requestPermission:
            guard let permission = envelope.string("permission").flatMap(FlowPermission.init)
            else {
                host.warn(
                    "Flow \"\(session.location)\" asked for an unknown permission \"\(envelope.string("permission") ?? "")\""
                )
                return
            }
            let capability: FlowCapability =
                permission == .notifications ? .notifications : .tracking
            guard granted(capability, for: session, action: "ask for \(permission.rawValue)")
            else {
                return
            }
            _ = await host.requestPermission(permission)
        case .setAttribute:
            guard granted(.attributes, for: session, action: "set an attribute"),
                let name = envelope.string("name")
            else {
                return
            }
            let value = envelope.payload?["value"] ?? .null
            switch value {
            case .array, .object:
                host.warn(
                    "Flow \"\(session.location)\" set attribute \"\(name)\" to a list or object; attributes are flat values"
                )
                return
            default:
                break
            }
            do {
                try await host.setAttribute(name, value)
            } catch {
                host.warn("Flow \"\(session.location)\" could not set \"\(name)\": \(describe(error))")
            }
        case .track:
            guard let name = envelope.string("name") else {
                return
            }
            var properties = envelope.object("properties") ?? [:]
            properties.merge(context(of: session)) { _, context in context }
            await host.capture(name, properties)
        case .screen:
            guard let name = envelope.string("name") else {
                return
            }
            var properties = context(of: session)
            properties["flow_screen_index"] = .number(envelope.number("index") ?? 0)
            await host.screen(name, properties)
        case .state:
            if let output = envelope.object("output") {
                session.output = FlowValue.values(in: output)
            }
            await host.state.save(session.stateKey, envelope.object("variables") ?? [:])
        case .log:
            let level = envelope.string("level") ?? "info"
            guard level != "debug", level != "info", let message = envelope.string("message")
            else {
                return
            }
            host.warn("Flow \"\(session.location)\": \(message)")
        }
    }

    /// Handles a message of the flow on screen as if it arrived now. Test affordance.
    func handleActiveMessage(_ rawMessage: String) async {
        guard let active else {
            return
        }
        await handle(sessionId: active.id, rawMessage: rawMessage)
    }

    /// The flow's location and id, added to what it reports to analytics.
    private func context(of session: Session) -> [String: JSONValue] {
        var context: [String: JSONValue] = ["paywall_location": .string(session.location)]
        if let paywallId = session.paywallId {
            context["paywall_id"] = .string(paywallId)
        }
        return context
    }

    /// The runtime already drops actions the app did not grant; this keeps the host from ever
    /// running one.
    private func granted(_ capability: FlowCapability, for session: Session, action: String)
        -> Bool
    {
        guard host.capabilities.contains(capability) else {
            host.warn(
                "Flow \"\(session.location)\" tried to \(action), but the app did not grant the \"\(capability.rawValue)\" capability"
            )
            return false
        }
        return true
    }

    /// Answers `ready` with the products the package references, the granted capabilities, the
    /// app's inputs and the saved state. A failed product lookup still configures the flow, without products.
    private func configure(_ session: Session, requestId: String?) async {
        var products: [VoidhashProduct] = []
        do {
            products = try await host.getProducts()
        } catch {
            host.warn(
                "Configuring flow \"\(session.location)\" without products: \(describe(error))")
        }
        let referenced = session.productIds.compactMap { productId in
            FlowCoordinator.findProduct(products, id: productId)
        }
        let saved = await host.state.load(session.stateKey)
        let configuration = FlowConfiguration.make(
            products: referenced,
            capabilities: host.capabilities,
            input: session.input,
            savedVariables: saved,
            platform: SdkHeaders.platformName,
            locale: host.locale
        )
        post(
            session,
            PaywallBridgeProtocol.configureMessage(
                configuration, requestId: requestId, warn: host.warn))
        session.isConfigured = active === session && session.result == nil
    }

    // MARK: - App actions

    /// Runs the app's handler of the action a flow called and answers the call with its reply.
    ///
    /// The handler runs on a task of its own, so the flow's other messages are answered
    /// meanwhile, and the task is cancelled when the flow ends. A call the app has no handler
    /// for and a handler that throws are answered as failed, which runs the flow's failure
    /// action; the answer of a flow that has ended is dropped.
    private func runAppAction(_ session: Session, envelope: PaywallBridgeEnvelope) {
        let name = envelope.string("name") ?? ""
        guard let requestId = envelope.requestId else {
            host.warn(
                "Flow \"\(session.location)\" called the app action \"\(name)\" without a request id; it cannot be answered"
            )
            return
        }
        guard let handler = session.actions[name] else {
            #if DEBUG
                host.warn(
                    "Flow \"\(session.location)\" called the app action \"\(name)\", but no handler is registered for it. Pass one in `actions` when presenting \"\(session.location)\"; the call failed in the flow."
                )
            #endif
            post(
                session,
                PaywallBridgeProtocol.appActionResponse(
                    requestId: requestId,
                    .failure(
                        FlowActionError(
                            code: "ACTION_FAILED",
                            message: "The app has no handler for the action \"\(name)\""))))
            return
        }
        let arguments = FlowValue.values(in: envelope.object("args"))
        session.appActions[requestId] = Task {
            let answer: Result<[String: FlowValue], FlowActionError>
            do {
                answer = .success(try await handler(arguments))
            } catch {
                answer = .failure(
                    FlowActionError(code: "ACTION_FAILED", message: self.describe(error)))
            }
            self.answerAppAction(session, name: name, requestId: requestId, answer)
        }
    }

    private func answerAppAction(
        _ session: Session, name: String, requestId: String,
        _ answer: Result<[String: FlowValue], FlowActionError>
    ) {
        // An ended flow has nothing left to answer.
        guard active === session, session.result == nil else {
            return
        }
        session.appActions[requestId] = nil
        var answer = answer
        switch answer {
        case .success(let reply):
            if let unsendable = reply.first(where: { !$0.value.isRepresentable }) {
                answer = .failure(
                    FlowActionError(
                        code: "ACTION_FAILED",
                        message:
                            "The reply field \"\(unsendable.key)\" is not a finite number"))
                host.warn(
                    "Flow \"\(session.location)\": the handler of \"\(name)\" replied with \"\(unsendable.key)\" that is not a finite number; the call failed in the flow"
                )
            }
        case .failure(let error):
            host.warn(
                "Flow \"\(session.location)\": the handler of the app action \"\(name)\" failed: \(error.message)"
            )
        }
        post(session, PaywallBridgeProtocol.appActionResponse(requestId: requestId, answer))
    }

    // MARK: - Purchases

    private func runAction(_ session: Session, envelope: PaywallBridgeEnvelope) async {
        guard !session.actionInFlight else {
            post(
                session,
                PaywallBridgeProtocol.errorResponse(
                    envelope.type, code: "ACTION_BUSY",
                    message: "Another purchase or restore is already running",
                    requestId: envelope.requestId))
            return
        }
        session.actionInFlight = true
        defer { session.actionInFlight = false }

        do {
            if envelope.type == .purchase {
                try await runPurchase(session, envelope: envelope)
            } else {
                try await runRestore(session, envelope: envelope)
            }
        } catch {
            let cancelled = (error as? VoidhashStoreError)?.code == "USER_CANCELLED"
            let message = describe(error)
            if !cancelled {
                host.warn(
                    "Flow \"\(session.location)\" \(envelope.type.rawValue) failed: \(message)")
            }
            post(
                session,
                PaywallBridgeProtocol.statusMessage(
                    cancelled ? .cancelled : .failed, requestId: envelope.requestId,
                    error: message))
            post(
                session,
                PaywallBridgeProtocol.errorResponse(
                    envelope.type, code: (error as? FlowActionError)?.code ?? "ACTION_FAILED",
                    message: message, requestId: envelope.requestId))
        }
    }

    private func runPurchase(_ session: Session, envelope: PaywallBridgeEnvelope) async throws {
        let requestedProductId = envelope.string("productId") ?? ""
        post(
            session,
            PaywallBridgeProtocol.statusMessage(
                .purchasing, requestId: envelope.requestId, productId: requestedProductId))

        let products = try await host.getProducts()
        guard let product = FlowCoordinator.findProduct(products, id: requestedProductId) else {
            throw FlowActionError(
                code: "ACTION_FAILED", message: "Product not found: \(requestedProductId)")
        }

        let offerId = envelope.string("offerId").flatMap { $0.isEmpty ? nil : $0 }
        switch try await host.purchase(product, offerId, session.paywallContext) {
        case .purchased:
            break
        // Reported to the flow as the store's errors were before purchases returned results:
        // a cancel as cancelled, anything else as a failure that leaves the flow on screen.
        case .cancelled:
            throw VoidhashStoreError.userCancelled
        case .pending:
            throw VoidhashStoreError.purchasePending
        case .disabled:
            throw FlowActionError(code: "ACTION_FAILED", message: "Voidhash is disabled")
        }

        post(
            session,
            PaywallBridgeProtocol.statusMessage(
                .purchased, requestId: envelope.requestId, productId: product.slug))
        post(
            session,
            PaywallBridgeProtocol.successResponse(
                .purchase, requestId: envelope.requestId, data: ["productId": product.slug]))
        // The purchase says whether the flow is done; one that does not
        // follows the flow (a paywall is done, an onboarding carries on).
        guard envelope.bool("endsFlow") ?? session.shouldEndFlowOnPurchase else { return }
        await host.state.clear(session.stateKey)
        await end(session, outcome: FlowResult.purchased, productId: product.slug)
    }

    private func runRestore(_ session: Session, envelope: PaywallBridgeEnvelope) async throws {
        post(session, PaywallBridgeProtocol.statusMessage(.restoring, requestId: envelope.requestId))

        try await host.restorePurchases()

        post(session, PaywallBridgeProtocol.statusMessage(.restored, requestId: envelope.requestId))
        post(
            session,
            PaywallBridgeProtocol.successResponse(.restore, requestId: envelope.requestId))
        guard envelope.bool("endsFlow") ?? session.shouldEndFlowOnPurchase else { return }
        await end(session, outcome: FlowResult.restored)
    }

    /// Resolves a product a flow names: by slug, which flows name products by, then by store
    /// product id, which packages built before slug references name.
    static func findProduct(_ products: [VoidhashProduct], id: String) -> VoidhashProduct? {
        return products.first { $0.slug == id } ?? products.first { $0.storeProductId == id }
    }

    private nonisolated func describe(_ error: any Error) -> String {
        return String(describing: error)
    }
}

/// An action a flow requested that could not run; reported back to the flow.
struct FlowActionError: Error, Sendable, Equatable, CustomStringConvertible {
    let code: String
    let message: String

    var description: String {
        return message
    }
}
