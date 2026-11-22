import Foundation
@_spi(VoidhashFlows) import VoidhashCore

/// An analytics event about a flow, ready to capture.
struct FlowAnalyticsEvent: Sendable, Equatable {
    let name: String
    let properties: [String: JSONValue]
}

/// What one presentation of a flow reports to analytics.
///
/// A presentation is one attempt to show one resolve answer. It reports exactly one first event:
/// `$paywall_viewed` once the flow is drawn, or, before that, `$paywall_load_failed` or
/// `$paywall_load_cancelled`. The view is reported when the flow runtime tracks its own
/// `$paywall_viewed` (on its first configured frame), with the runtime's `flow_screen_index` and
/// `flow_screen_name`; a flow that ends before its view is never reported as viewed. A viewed
/// presentation then reports exactly one ending: `$paywall_completed` or `$paywall_dismissed`. A
/// presentation that never got an answer naming a flow package (nothing assigned, nothing cached
/// and the backend unreachable, a client that is disabled or has no renderer) reports nothing:
/// there was nothing to show.
///
/// The answer's exposure token rides on the first event only, unchanged, on every presentation of
/// that answer. Every value is bounded: no message from the device, the store or an error is ever
/// reported.
///
/// Confined to the ``FlowCoordinator`` actor.
final class FlowPresentationReport {
    static let viewedEvent = "$paywall_viewed"
    static let loadFailedEvent = "$paywall_load_failed"
    static let loadCancelledEvent = "$paywall_load_cancelled"
    static let completedEvent = "$paywall_completed"
    static let dismissedEvent = "$paywall_dismissed"
    /// An answer handed to the app, which may show it however it likes. Not a presentation: it
    /// only carries the exposure token.
    static let handedOffEvent = "$paywall_handed_off"
    /// An image the build pinned arrived as other bytes than the build recorded and was not
    /// shown: a health signal of the release, not a presentation.
    static let imageIntegrityFailedEvent = "$paywall_image_integrity_failed"

    /// The events only the SDK reports. A flow tracking one of these names is ignored: the flow
    /// runtime tracks its own `$paywall_viewed`, which the SDK replaces with the presentation's.
    static let lifecycleEvents: Set<String> = [
        viewedEvent, loadFailedEvent, loadCancelledEvent, completedEvent, dismissedEvent,
    ]
    /// The names a flow cannot track: the presentation's, the hand-off's and the refused image's.
    static let reservedEvents = lifecycleEvents.union([handedOffEvent, imageIntegrityFailedEvent])

    /// Why a presentation failed before its first frame (`reason`).
    enum LoadFailure: String {
        case packageDownloadFailed = "package_download_failed"
        case packageIntegrityFailed = "package_integrity_failed"
        case packageUnsupported = "package_unsupported"
        case runtimeDownloadFailed = "runtime_download_failed"
        case runtimeFailed = "runtime_failed"
        case renderFailed = "render_failed"
        case productsUnavailable = "products_unavailable"
        case timeout
        case other
    }

    /// Who gave up on a presentation before its first frame (`cancelledBy`).
    enum Canceller: String {
        case endUser = "end_user"
        case app
    }

    /// How a viewed flow ended.
    enum Ending {
        /// Through an end step (`finish`).
        case endStep
        /// A successful purchase that ends the flow.
        case purchase
        /// A successful restore that ends the flow.
        case restore
        /// The flow's own close action.
        case close
        /// The end user took it off the screen without the flow's close action, such as by a
        /// system gesture, where the presenter allows that.
        case system
        /// The app closed it: `dismissFlow()`, a cancelled task, another presentation, a
        /// shutdown, or it left the screen without the SDK closing it where the end user cannot
        /// do that (the app or the system took its window away).
        case app
        /// It could no longer be drawn.
        case error
    }

    let location: String
    /// When the app asked to present, in monotonic milliseconds.
    private let startedAt: Double
    /// The answer being shown, once resolved to one with a flow package.
    private var answer: SdkResolvedPaywall?
    /// Where the package shown came from, which every event about the flow carries once it is
    /// known as `packageSource`: `network` (downloaded for this presentation), `cache` (already
    /// on the device, a fallback to an earlier package included) or `bundled` (the app's own).
    var packageSource: String?
    /// Why loading failed, when it did.
    var loadFailure: LoadFailure?
    /// Whether the flow was configured without its products: the lookup failed, or found none
    /// of the products it shows.
    var productsUnavailable = false
    private(set) var isViewed = false
    private var reportedFirst = false
    private var reportedEnding = false

    init(location: String, startedAt: Double) {
        self.location = location
        self.startedAt = startedAt
    }

    /// The presentation shows `answer`; until then it reports nothing.
    func show(_ answer: SdkResolvedPaywall) {
        self.answer = answer
    }

    /// The properties naming the flow, which every event about it carries: its own `track`
    /// and `$screen` events too. Only `paywall_location` before the answer is known.
    var context: [String: JSONValue] {
        guard let answer else {
            return ["paywall_location": .string(location)]
        }
        var context = Self.flowProperties(location: location, answer: answer)
        if let packageSource {
            context["packageSource"] = .string(packageSource)
        }
        return context
    }

    /// The properties naming the flow `answer` shows at `location`.
    static func flowProperties(location: String, answer: SdkResolvedPaywall)
        -> [String: JSONValue]
    {
        var context: [String: JSONValue] = ["paywall_location": .string(location)]
        let showing = answer.showing
        context["paywallLocationId"] = .string(answer.location.id)
        context["paywallShowingId"] = .string(showing.id)
        if let paywallId = showing.paywallId ?? showing.paywall?.id {
            context["paywallId"] = .string(paywallId)
        }
        if let releaseId = showing.paywallReleaseId ?? showing.paywallRelease?.releaseId {
            context["paywallReleaseId"] = .string(releaseId)
        }
        return context
    }

    /// The SHA-256 of the package shown, once the answer is known.
    var packageSha256: String? {
        return answer?.showing.paywallRelease?.flowPackage?.sha256
    }

    /// The image at `url`, which the package pins, arrived as other bytes than its build
    /// recorded. Its address alone is reported, never its bytes; nothing before the answer is
    /// known.
    func imageIntegrityFailed(url: String) -> FlowAnalyticsEvent? {
        guard answer != nil else {
            return nil
        }
        return event(Self.imageIntegrityFailedEvent, ["imageUrl": .string(url)])
    }

    /// The flow runtime reported its view at `now`, with its `flow_screen_*` properties.
    func viewed(at now: Double, screen: [String: JSONValue]) -> FlowAnalyticsEvent? {
        guard !isViewed else {
            return nil
        }
        isViewed = true
        var properties = screen
        if productsUnavailable {
            properties["productsUnavailable"] = .bool(true)
        }
        return first(Self.viewedEvent, at: now, properties)
    }

    /// The presentation failed before its first frame.
    func failed(_ reason: LoadFailure, at now: Double) -> FlowAnalyticsEvent? {
        return first(Self.loadFailedEvent, at: now, ["reason": .string(reason.rawValue)])
    }

    /// The end user or the app gave up before the first frame.
    func cancelled(by canceller: Canceller, at now: Double) -> FlowAnalyticsEvent? {
        return first(
            Self.loadCancelledEvent, at: now, ["cancelledBy": .string(canceller.rawValue)])
    }

    /// The flow left the screen, or never got there, `ending` as the reason: the ending of a
    /// viewed flow, else the presentation's first event.
    func ended(_ ending: Ending, at now: Double) -> FlowAnalyticsEvent? {
        guard isViewed else {
            switch ending {
            case .error:
                return failed(.renderFailed, at: now)
            case .app:
                return cancelled(by: .app, at: now)
            case .system, .close, .endStep, .purchase, .restore:
                return cancelled(by: .endUser, at: now)
            }
        }
        guard !reportedEnding else {
            return nil
        }
        reportedEnding = true
        switch ending {
        case .endStep:
            return event(Self.completedEvent, ["completion": .string("end_step")])
        case .purchase:
            return event(Self.completedEvent, ["completion": .string("purchase")])
        case .restore:
            return event(Self.completedEvent, ["completion": .string("restore")])
        case .close:
            return event(Self.dismissedEvent, ["reason": .string("close")])
        case .system:
            return event(Self.dismissedEvent, ["reason": .string("system")])
        case .app:
            return event(Self.dismissedEvent, ["reason": .string("app")])
        case .error:
            return event(Self.dismissedEvent, ["reason": .string("error")])
        }
    }

    private func first(_ name: String, at now: Double, _ properties: [String: JSONValue])
        -> FlowAnalyticsEvent?
    {
        guard !reportedFirst, let answer else {
            return nil
        }
        reportedFirst = true
        var properties = properties
        properties["loadDurationMs"] = .number(Double(max(0, Int((now - startedAt).rounded()))))
        if let token = answer.showing.exposureToken {
            properties["exposureToken"] = .string(token.value)
        }
        return event(name, properties)
    }

    private func event(_ name: String, _ properties: [String: JSONValue]) -> FlowAnalyticsEvent {
        return FlowAnalyticsEvent(
            name: name, properties: properties.merging(context) { own, _ in own })
    }
}
