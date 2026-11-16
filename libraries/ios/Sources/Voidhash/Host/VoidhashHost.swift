import Foundation
import VoidhashCore

// The surface a host SDK built on this client (the React Native SDK) drives it through. It is
// `@_spi(VoidhashHost)`: public to the host's module, not part of the documented API.

/// What a host SDK adds to a ``VoidhashClient``'s configuration.
@_spi(VoidhashHost)
public struct VoidhashHostOptions: Sendable {
    /// `x-sdk` and `$sdk` of every request and event, e.g. `react-native`.
    public var sdkName: String
    /// `x-sdk-version` and `$sdk_version`: the host package's version.
    public var sdkVersion: String
    /// A runtime schema to use instead of fetching one; the client then never fetches it.
    public var internalSchema: RuntimeSchema?
    /// Resolves paywalls for ``VoidhashClient/getPaywall(location:)`` even without a native
    /// renderer, for a host that presents them its own way.
    public var resolvesPaywalls: Bool
    /// Runs once the client holds its storage (a client it replaced has retired and handed its
    /// queues over) and before it reads any of it: where a host imports what it stored itself.
    public var prepareStorage: (@Sendable () async -> Void)?
    /// Receives every ``VoidhashClientEvent``, in the order the client produced them. Called on
    /// an arbitrary thread, one event at a time; it must return quickly.
    public var events: (@Sendable (VoidhashClientEvent) -> Void)?

    public init(
        sdkName: String,
        sdkVersion: String,
        internalSchema: RuntimeSchema? = nil,
        resolvesPaywalls: Bool = false,
        prepareStorage: (@Sendable () async -> Void)? = nil,
        events: (@Sendable (VoidhashClientEvent) -> Void)? = nil
    ) {
        self.prepareStorage = prepareStorage
        self.sdkName = sdkName
        self.sdkVersion = sdkVersion
        self.internalSchema = internalSchema
        self.resolvesPaywalls = resolvesPaywalls
        self.events = events
    }
}

/// An identity the client adopted, under the generation it adopted it.
@_spi(VoidhashHost)
public struct VoidhashIdentityChange: Sendable, Equatable {
    public let distinctId: String
    /// The identity before the change; empty for the identity `hostStart()` loaded.
    public let previousDistinctId: String
    /// Grows with every identity any client in the process adopts, and never resets, so an
    /// answer read under an identity switched away from is told apart even after a switch back
    /// to the same distinct id, or a client configured again.
    public let generation: Int

    public init(distinctId: String, previousDistinctId: String, generation: Int) {
        self.distinctId = distinctId
        self.previousDistinctId = previousDistinctId
        self.generation = generation
    }
}

/// A person answer and the identity it was read under.
@_spi(VoidhashHost)
public struct VoidhashPersonAnswer: Sendable {
    public let distinctId: String
    public let generation: Int
    public let state: Stale<SdkPerson?>
}

/// A flag evaluation and the identity it was read under.
@_spi(VoidhashHost)
public struct VoidhashFlagsAnswer: Sendable {
    public let distinctId: String
    public let generation: Int
    /// The keys the evaluation answers; `nil` for every flag.
    public let keys: [String]?
    public let state: Stale<[SdkFeatureFlagResult]>
}

/// One state change of a client, see ``VoidhashHostOptions/events``.
@_spi(VoidhashHost)
public enum VoidhashClientEvent: Sendable {
    /// The identity `hostStart()` loaded, and every later switch. Dispatched before the call
    /// that switched settles, and before any person or flag answer of the new generation.
    case identity(VoidhashIdentityChange)
    /// The current person, or its freshness, changed.
    case person(VoidhashPersonAnswer)
    /// An evaluation of the current identity was cached.
    case flags(VoidhashFlagsAnswer)
    /// A runtime schema was loaded or fetched, as the API's JSON.
    case schema(String)
    /// The analytics consent in effect changed, including the one `hostStart()` settled on.
    case consent(AnalyticsConsent)
    case diagnostic(VoidhashDiagnostic)
}

/// Delivers a client's events to its host in order. Until the client announced what it loaded
/// at start, events are held and replayed after the announcement, so nothing reaches the host
/// ahead of the identity it belongs to.
final class HostEventSink: @unchecked Sendable {
    /// Events held before the announcement; past this the oldest is dropped. A client that is
    /// started late, or waits for the device to be unlocked, would otherwise hold every one.
    static let maxHeldBeforeAnnouncement = 100

    private let lock = NSRecursiveLock()
    private let handler: (@Sendable (VoidhashClientEvent) -> Void)?
    private var announced = false
    private var held: [VoidhashClientEvent] = []
    private var droppedBeforeAnnouncement = 0

    init(handler: (@Sendable (VoidhashClientEvent) -> Void)?) {
        self.handler = handler
    }

    var isActive: Bool {
        return handler != nil
    }

    func emit(_ event: VoidhashClientEvent) {
        guard let handler else {
            return
        }
        lock.withLock {
            guard announced else {
                held.append(event)
                if held.count > HostEventSink.maxHeldBeforeAnnouncement {
                    held.removeFirst()
                    droppedBeforeAnnouncement += 1
                }
                return
            }
            handler(event)
        }
    }

    /// Delivers `announcements` first, then what was held meanwhile, and from then on every
    /// event as it comes.
    ///
    /// - Returns: How many held events were dropped to stay within
    ///   ``maxHeldBeforeAnnouncement``.
    @discardableResult
    func announce(_ announcements: [VoidhashClientEvent]) -> Int {
        guard let handler else {
            return 0
        }
        return lock.withLock {
            announcements.forEach(handler)
            let replay = held
            held = []
            replay.forEach(handler)
            announced = true
            defer { droppedBeforeAnnouncement = 0 }
            return droppedBeforeAnnouncement
        }
    }
}

/// Hands out identity generations, process-wide.
enum IdentityGenerations {
    private static let lock = NSLock()
    private nonisolated(unsafe) static var last = 0

    static func next() -> Int {
        return lock.withLock {
            last += 1
            return last
        }
    }
}

/// An event the synchronous intake stamped at call time, see
/// ``VoidhashClient/captureNow(_:properties:)``.
struct StampedCapture: Sendable {
    let name: String
    let properties: [String: JSONValue]
    let capturedAt: Double
    /// `nil` for an event taken before the client started: attributed to the identity, groups
    /// and session start loads.
    var distinctId: String?
    var sessionId: String?
    var groups: [String: String]?
}

/// The client state a synchronous call reads without reaching the actor: the current identity,
/// and the events taken in but not handed to the queue yet.
final class HostIntake: @unchecked Sendable {
    /// Events kept before the client started; past this the oldest is dropped.
    static let maxHeldBeforeStart = 100

    private let lock = NSLock()
    private var identity: VoidhashIdentityChange?
    private var started = false
    private var waiting: [StampedCapture] = []
    private var droppedBeforeStart = 0
    private var draining = false

    var currentIdentity: VoidhashIdentityChange? {
        return lock.withLock { identity }
    }

    func setIdentity(_ change: VoidhashIdentityChange) {
        lock.withLock { identity = change }
    }

    /// Takes an event in. Returns whether the caller must start a drain.
    func take(_ capture: StampedCapture) -> Bool {
        return lock.withLock {
            waiting.append(capture)
            if !started {
                if waiting.count > HostIntake.maxHeldBeforeStart {
                    waiting.removeFirst()
                    droppedBeforeStart += 1
                }
                return false
            }
            guard !draining else {
                return false
            }
            draining = true
            return true
        }
    }

    var isStarted: Bool {
        return lock.withLock { started }
    }

    /// Opens the intake: what was held before start is stamped with `distinctId` and handed on.
    ///
    /// - Returns: How many events were dropped before start, and whether a drain must start.
    func open(distinctId: String) -> (dropped: Int, drains: Bool) {
        return lock.withLock {
            started = true
            for index in waiting.indices where waiting[index].distinctId == nil {
                waiting[index].distinctId = distinctId
            }
            let dropped = droppedBeforeStart
            droppedBeforeStart = 0
            guard !waiting.isEmpty, !draining else {
                return (dropped, false)
            }
            draining = true
            return (dropped, true)
        }
    }

    /// The next event to hand on, or `nil` when the drain is done.
    func next() -> StampedCapture? {
        return lock.withLock {
            guard !waiting.isEmpty else {
                draining = false
                return nil
            }
            return waiting.removeFirst()
        }
    }
}
