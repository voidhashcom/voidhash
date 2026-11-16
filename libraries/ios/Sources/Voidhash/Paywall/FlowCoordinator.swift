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

/// How a presented flow ended.
public enum FlowResult: Sendable, Equatable {
    /// The flow reached one of its finish actions. `result` is the finish action's result name;
    /// `variables` are the flow's variables at that moment.
    case finished(result: String, variables: [String: JSONValue])
    /// A purchase started from the flow completed; the flow was dismissed. Names the slug of the
    /// product bought.
    case purchased(productSlug: String)
    /// A restore started from the flow completed; the flow was dismissed.
    case restored
    /// The user or the app closed the flow, or the app cancelled its presentation before the
    /// flow was shown.
    case closed
    /// The flow could not be presented, or could no longer be drawn.
    case failed(FlowError)
}

/// Why a flow could not be presented, or stopped being shown.
public enum FlowError: Error, Sendable, Equatable, CustomStringConvertible {
    /// The SDK is disabled or shut down.
    case disabled
    /// No published flow is assigned to the placement for the current person.
    case notAssigned
    /// Nothing is cached for the placement and the backend cannot be reached, or the flow's
    /// package could not be downloaded.
    case unavailable
    /// The app did not add the `VoidhashUI` renderer.
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
            return "FLOW_NOT_ASSIGNED: no flow is assigned to this placement"
        case .unavailable:
            return
                "FLOW_UNAVAILABLE: the flow is not cached on this device and could not be loaded"
        case .rendererMissing:
            return
                "FLOW_RENDERER_MISSING: add the VoidhashUI package and set VoidhashOptions.paywallRenderer = VoidhashUIPaywallRenderer()"
        case .unsupportedPackage(let abiVersion):
            return
                "FLOW_UNSUPPORTED_PACKAGE: the flow uses package format \(abiVersion), which this SDK cannot read; update the SDK"
        case .presentationFailed(let message):
            return "FLOW_PRESENTATION_FAILED: \(message)"
        }
    }
}

/// Keeps a flow's variables between presentations, keyed by flow.
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
/// completed purchase or restore end the flow with a ``FlowResult``. Permissions, attributes,
/// links, analytics and saved state go to the ``FlowHost``. The renderer only relays messages.
///
/// One flow is on screen at a time, and the presenter is never asked for two transitions at
/// once: a flow is dismissed only after its presentation finished, the next one is presented only
/// after the one before it left the screen, and a presentation returns its result only then.
public actor FlowCoordinator {
    /// Loads the verified bytes of a placement's flow package.
    public typealias PackageLoader =
        @Sendable (_ placement: String, _ package: SdkResolvedPaywall.FlowPackage) async throws
        -> Data

    /// One flow handed to the presenter. Only one holds the screen at a time.
    private final class Session {
        let id: Int
        let placement: String
        let paywallId: String?
        /// The paywall a purchase started here names.
        let paywallContext: SdkPurchasePaywallContext
        /// Key of the flow's saved state.
        let stateKey: String
        let productIds: [String]
        /// Paywalls end after a purchase or restore; onboarding flows continue.
        let shouldEndFlowOnPurchase: Bool
        /// How the flow ended, set as soon as that is decided: its messages are ignored from
        /// then on. The caller hears it once the flow has left the screen.
        var result: FlowResult?
        /// The presenter showing the flow; yields whether it got on screen.
        var presentation: Task<Bool, any Error>?
        /// Takes the flow off the screen and then returns `result` to the caller.
        var ending: Task<Void, Never>?
        var continuation: CheckedContinuation<FlowResult, Never>?
        var actionInFlight = false
        /// Answers the flow's `ready`; a purchase or restore waits for it.
        var configuring: Task<Void, Never>?
        /// Feeds the flow's messages to the coordinator; finished when the session ends, which
        /// ends the task reading them.
        var messages: AsyncStream<String>.Continuation?

        init(
            id: Int, placement: String, paywallId: String?,
            paywallContext: SdkPurchasePaywallContext, stateKey: String, productIds: [String],
            shouldEndFlowOnPurchase: Bool
        ) {
            self.id = id
            self.placement = placement
            self.paywallId = paywallId
            self.paywallContext = paywallContext
            self.stateKey = stateKey
            self.productIds = productIds
            self.shouldEndFlowOnPurchase = shouldEndFlowOnPurchase
        }
    }

    /// A presentation with nothing on screen yet: it is resolving its placement, loading its
    /// package or waiting for the flow before it to leave the screen.
    private final class PendingPresentation {
        var isCancelled = false
        /// What the presentation returns once cancelled: closed, unless the client was shut
        /// down under it or it ran out of time.
        var cancelledResult = FlowResult.closed
        /// Cancels the presentation when it has taken too long to reach the presenter.
        var deadline: Task<Void, Never>?
        /// The session to present and its package, or why there is none, once resolved and
        /// loaded.
        var loaded: Result<(session: Session, package: Data), FlowError>?
        /// Resumed when `loaded` is set or the presentation is cancelled, whichever is first.
        var loading: CheckedContinuation<Void, Never>?
    }

    private let presenter: (any FlowPaywallPresenting)?
    private let loadPackage: PackageLoader
    private let resolvePaywall: @Sendable (String) async throws -> SdkResolvedPaywall?
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
    ///   - resolvePaywall: Resolves what is assigned to a placement; throws when nothing is cached
    ///     and the backend cannot be reached.
    ///   - host: What flows can reach in the app.
    ///   - presentationDeadline: Returns once a presentation has had its time to reach the
    ///     presenter, ``NetworkPolicy/flowPresentationDeadlineSeconds`` unless a test says
    ///     otherwise.
    public init(
        presenter: (any FlowPaywallPresenting)?,
        loadPackage: @escaping PackageLoader,
        resolvePaywall: @escaping @Sendable (String) async throws -> SdkResolvedPaywall?,
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
    public func preload(placement: String, release: SdkResolvedPaywall.Release) async throws {
        guard let presenter, let flowPackage = release.flowPackage,
            presenter.supportsFlowPackage(abiVersion: flowPackage.abiVersion)
        else {
            return
        }
        _ = try await loadPackage(placement, flowPackage)
    }

    /// Presents the flow assigned to `placement` and returns how it ended, once it has left
    /// the screen.
    ///
    /// A flow already on screen is closed first; its presentation returns ``FlowResult/closed``.
    /// Cancelling the calling task, or ``dismiss()``, closes the flow, or keeps it from being
    /// shown while it is still loading; the presentation then returns ``FlowResult/closed``.
    ///
    /// A flow not handed to the presenter within
    /// ``NetworkPolicy/flowPresentationDeadlineSeconds`` of this call is not shown, then or
    /// later: by then the user is doing something else. The presentation fails with
    /// ``FlowError/unavailable``, while its package is still downloaded and cached for the next
    /// one. Once the presenter has the flow, no deadline applies.
    public func present(placement: String) async -> FlowResult {
        guard !isShutDown else {
            return .failed(.disabled)
        }
        guard let presenter else {
            host.warn(FlowError.rendererMissing.description)
            return .failed(.rendererMissing)
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
            self.presentationTookTooLong(id, placement: placement)
        }
        return await withTaskCancellationHandler {
            await present(id: id, placement: placement, presenter: presenter)
        } onCancel: {
            Task { await self.cancel(id) }
        }
    }

    private func present(id: Int, placement: String, presenter: any FlowPaywallPresenting) async
        -> FlowResult
    {
        let presentation = pending[id]
        defer {
            presentation?.deadline?.cancel()
            pending[id] = nil
        }
        guard let loaded = await load(id: id, placement: placement, presenter: presenter) else {
            return presentation?.cancelledResult ?? .closed
        }
        let session: Session
        let package: Data
        switch loaded {
        case .success(let loaded):
            (session, package) = loaded
        case .failure(let error):
            return .failed(error)
        }

        // Calls can overlap, and each wait below lets another one in: the screen is taken only
        // when no session holds it, checked again after every wait.
        while let previous = active, pending[id]?.isCancelled == false {
            await end(previous, with: .closed)
        }
        guard pending[id]?.isCancelled == false, !Task.isCancelled else {
            return presentation?.cancelledResult ?? .closed
        }
        // The presenter has the flow from here on, and with it the deadline is met.
        presentation?.deadline?.cancel()
        pending[id] = nil
        active = session

        // The flow announces `ready` once it is on screen, through the handler registered
        // here, and is configured in answer.
        let onBridgeEvent = messageHandler(for: session)
        let onDismiss: PaywallDismissedHandler = { [weak self] in
            Task { await self?.presenterDidDismiss(sessionId: id) }
        }
        let onFailure: PaywallFailedHandler = { [weak self] message in
            Task { await self?.presenterDidFail(sessionId: id, message: message) }
        }
        // On its own task, so cancelling the caller cannot interrupt the presentation halfway
        // and ending the session can wait for it.
        let showing = Task {
            try await presenter.show(
                locationSlug: placement, package: package, onBridgeEvent: onBridgeEvent,
                onDismiss: onDismiss, onFailure: onFailure)
        }
        session.presentation = showing
        do {
            if try await !showing.value {
                await end(
                    session,
                    with: .failed(.presentationFailed("the renderer could not show the flow")))
            }
        } catch {
            await end(session, with: .failed(.presentationFailed(describe(error))))
        }
        return await result(of: session)
    }

    /// Closes the presented flow and cancels every presentation that is still loading; each
    /// returns ``FlowResult/closed``. Returns once the flow has left the screen.
    public func dismiss() async {
        for presentation in pending.values {
            cancel(presentation)
        }
        guard let active else {
            return
        }
        await end(active, with: .closed)
    }

    /// Ends every flow of a client that was shut down, which is no way to keep one: the flow on
    /// screen is closed and its presentation returns ``FlowResult/closed``, and a presentation
    /// still loading, like every later one, fails with ``FlowError/disabled``. Returns once the
    /// flow has left the screen.
    public func shutDown() async {
        isShutDown = true
        for presentation in pending.values {
            presentation.cancelledResult = .failed(.disabled)
            cancel(presentation)
        }
        guard let active else {
            return
        }
        await end(active, with: .closed)
    }

    // MARK: - Loading

    /// The session of presentation `id` and the package to present, or why there is none; `nil`
    /// when the presentation was cancelled first.
    private func load(id: Int, placement: String, presenter: any FlowPaywallPresenting) async
        -> Result<(session: Session, package: Data), FlowError>?
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
            Task { await self.resolveSession(id: id, placement: placement, presenter: presenter) }
        }
        guard let presentation = pending[id], !presentation.isCancelled else {
            return nil
        }
        return presentation.loaded
    }

    private func resolveSession(id: Int, placement: String, presenter: any FlowPaywallPresenting)
        async
    {
        let loaded = await makeSession(id: id, placement: placement, presenter: presenter)
        guard let presentation = pending[id] else {
            return
        }
        presentation.loaded = loaded
        presentation.loading?.resume()
        presentation.loading = nil
    }

    private func makeSession(id: Int, placement: String, presenter: any FlowPaywallPresenting)
        async -> Result<(session: Session, package: Data), FlowError>
    {
        let resolved: SdkResolvedPaywall?
        do {
            resolved = try await resolvePaywall(placement)
        } catch {
            host.warn("Flow \"\(placement)\" is unavailable: \(describe(error))")
            return .failure(.unavailable)
        }
        guard let showing = resolved?.showing, let release = showing.paywallRelease else {
            return .failure(.notAssigned)
        }
        guard let flowPackage = release.flowPackage else {
            host.warn("The release assigned to \"\(placement)\" has no flow package")
            return .failure(.notAssigned)
        }
        guard presenter.supportsFlowPackage(abiVersion: flowPackage.abiVersion) else {
            let error = FlowError.unsupportedPackage(abiVersion: flowPackage.abiVersion)
            host.warn("Flow \"\(placement)\": \(error)")
            return .failure(error)
        }

        let package: Data
        do {
            package = try await loadPackage(placement, flowPackage)
        } catch {
            host.warn("Flow \"\(placement)\" is unavailable: \(describe(error))")
            return .failure(.unavailable)
        }

        let paywallId = showing.paywallId ?? showing.paywall?.id
        let session = Session(
            id: id, placement: placement, paywallId: paywallId,
            paywallContext: SdkPurchasePaywallContext(
                showingId: showing.id, placement: placement, paywallId: paywallId,
                paywallReleaseId: showing.paywallReleaseId ?? release.releaseId),
            stateKey: paywallId ?? placement, productIds: flowPackage.productIds,
            shouldEndFlowOnPurchase: flowPackage.shouldEndFlowOnPurchase ?? true)
        return .success((session, package))
    }

    /// The task awaiting presentation `id` was cancelled.
    private func cancel(_ id: Int) async {
        if let presentation = pending[id] {
            cancel(presentation)
        } else if let active, active.id == id {
            await end(active, with: .closed)
        }
    }

    /// Presentation `id` has not reached the presenter in the time it had.
    private func presentationTookTooLong(_ id: Int, placement: String) {
        guard let presentation = pending[id], !presentation.isCancelled else {
            return
        }
        host.warn(
            "Flow \"\(placement)\" was not ready within \(Int(NetworkPolicy.flowPresentationDeadlineSeconds)) seconds and is not shown; its package is still loaded for the next presentation"
        )
        presentation.cancelledResult = .failed(.unavailable)
        cancel(presentation)
    }

    /// Keeps a presentation with nothing on screen yet from showing anything.
    private func cancel(_ presentation: PendingPresentation) {
        presentation.isCancelled = true
        presentation.loading?.resume()
        presentation.loading = nil
    }

    // MARK: - Session lifetime

    private func result(of session: Session) async -> FlowResult {
        if session.ending == nil {
            return await withCheckedContinuation { continuation in
                session.continuation = continuation
            }
        }
        await session.ending?.value
        return session.result ?? .closed
    }

    /// Ends `session` with `result` and returns once it has left the screen; of several ends
    /// the first decides the result.
    ///
    /// The flow's messages are ignored from the first call on. The caller of
    /// ``present(placement:)`` hears the result only after the dismissal completed, so whatever
    /// it presents next does not run into the dismissal.
    private func end(_ session: Session, with result: FlowResult) async {
        if session.ending == nil {
            session.result = result
            // On its own task: the dismissal runs to its end whoever asked for it.
            session.ending = Task { await self.leaveScreen(session, with: result) }
        }
        await session.ending?.value
    }

    private func leaveScreen(_ session: Session, with result: FlowResult) async {
        // The presentation finishes first: the presenter is never asked for two transitions at
        // once. A flow the presenter reported as gone is dismissed all the same, which costs
        // nothing when it is gone and takes it down when it is not: a flow left on screen
        // after its session ended could not be closed.
        let presented = (try? await session.presentation?.value) ?? false
        if presented, let presenter {
            do {
                try await presenter.dismiss()
            } catch {
                host.warn("Could not dismiss flow \"\(session.placement)\": \(describe(error))")
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
        await end(session, with: .closed)
    }

    private func presenterDidFail(sessionId: Int, message: String) async {
        guard let session = session(sessionId) else {
            return
        }
        host.warn("Flow \"\(session.placement)\" failed: \(message)")
        await end(session, with: .failed(.presentationFailed(message)))
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
        presenter?.postMessage(locationSlug: session.placement, data: message)
    }

    // MARK: - Messages

    /// Feeds a presentation's messages to ``dispatch(sessionId:rawMessage:)`` in the order the
    /// flow emitted them.
    private func messageHandler(for session: Session) -> PaywallRawEventHandler {
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
            await end(session, with: .closed)
        case .purchase, .restore:
            await runAction(session, envelope: envelope)
        case .finish:
            let variables = envelope.object("variables") ?? [:]
            await host.state.clear(session.stateKey)
            await end(
                session,
                with: .finished(result: envelope.string("result") ?? "", variables: variables))
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
                    "Flow \"\(session.placement)\" asked for an unknown permission \"\(envelope.string("permission") ?? "")\""
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
                    "Flow \"\(session.placement)\" set attribute \"\(name)\" to a list or object; attributes are flat values"
                )
                return
            default:
                break
            }
            do {
                try await host.setAttribute(name, value)
            } catch {
                host.warn("Flow \"\(session.placement)\" could not set \"\(name)\": \(describe(error))")
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
            await host.state.save(session.stateKey, envelope.object("variables") ?? [:])
        case .log:
            let level = envelope.string("level") ?? "info"
            guard level != "debug", level != "info", let message = envelope.string("message")
            else {
                return
            }
            host.warn("Flow \"\(session.placement)\": \(message)")
        }
    }

    /// Handles a message of the flow on screen as if it arrived now. Test affordance.
    func handleActiveMessage(_ rawMessage: String) async {
        guard let active else {
            return
        }
        await handle(sessionId: active.id, rawMessage: rawMessage)
    }

    /// The flow's placement and id, added to what it reports to analytics.
    private func context(of session: Session) -> [String: JSONValue] {
        var context: [String: JSONValue] = ["paywall_location": .string(session.placement)]
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
                "Flow \"\(session.placement)\" tried to \(action), but the app did not grant the \"\(capability.rawValue)\" capability"
            )
            return false
        }
        return true
    }

    /// Answers `ready` with the products the package references, the granted capabilities and
    /// the saved state. A failed product lookup still configures the flow, without products.
    private func configure(_ session: Session, requestId: String?) async {
        var products: [VoidhashProduct] = []
        do {
            products = try await host.getProducts()
        } catch {
            host.warn(
                "Configuring flow \"\(session.placement)\" without products: \(describe(error))")
        }
        let referenced = session.productIds.compactMap { productId in
            FlowCoordinator.findProduct(products, id: productId)
        }
        let saved = await host.state.load(session.stateKey)
        let configuration = FlowConfiguration.make(
            products: referenced,
            capabilities: host.capabilities,
            savedVariables: saved,
            platform: SdkHeaders.platformName,
            locale: host.locale
        )
        post(
            session,
            PaywallBridgeProtocol.configureMessage(
                configuration, requestId: requestId, warn: host.warn))
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
                    "Flow \"\(session.placement)\" \(envelope.type.rawValue) failed: \(message)")
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
        // An onboarding flow carries on after a purchase; a paywall is done.
        guard session.shouldEndFlowOnPurchase else { return }
        await host.state.clear(session.stateKey)
        await end(session, with: .purchased(productSlug: product.slug))
    }

    private func runRestore(_ session: Session, envelope: PaywallBridgeEnvelope) async throws {
        post(session, PaywallBridgeProtocol.statusMessage(.restoring, requestId: envelope.requestId))

        try await host.restorePurchases()

        post(session, PaywallBridgeProtocol.statusMessage(.restored, requestId: envelope.requestId))
        post(
            session,
            PaywallBridgeProtocol.successResponse(.restore, requestId: envelope.requestId))
        guard session.shouldEndFlowOnPurchase else { return }
        await end(session, with: .restored)
    }

    /// Resolves a product a flow names: by slug, which flows name products by, then by store
    /// product id, which packages built before slug references name.
    static func findProduct(_ products: [VoidhashProduct], id: String) -> VoidhashProduct? {
        return products.first { $0.slug == id } ?? products.first { $0.storeProductId == id }
    }

    private func describe(_ error: any Error) -> String {
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
