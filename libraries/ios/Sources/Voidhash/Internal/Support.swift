import Foundation
import VoidhashCore

/// Late-bound weak reference to the client being constructed, so callbacks wired up during
/// `init` can reach it once initialization completes.
final class WeakClientBox: @unchecked Sendable {
    private let lock = NSLock()
    private weak var storage: VoidhashClient?

    func set(_ client: VoidhashClient?) {
        lock.withLock { storage = client }
    }

    func get() -> VoidhashClient? {
        return lock.withLock { storage }
    }
}

/// The live client over each storage namespace (publishable key and API origin), so no two
/// clients hold the queue, outbox and identity files of one namespace at once.
final class StorageOwners: @unchecked Sendable {
    private let lock = NSLock()
    private var owners: [String: WeakClientBox] = [:]

    /// Records the client in `box` as the owner of `namespace`, returning the client that owned
    /// it until now, which the new owner retires before it reads the files.
    func claim(_ namespace: String, for box: WeakClientBox) -> VoidhashClient? {
        return lock.withLock {
            let previous = owners[namespace]?.get()
            owners[namespace] = box
            return previous
        }
    }

    /// The client that owns `namespace`, while it is alive.
    func owner(of namespace: String) -> VoidhashClient? {
        return lock.withLock { owners[namespace]?.get() }
    }
}

/// Builds the per-request SDK header set for the current identity, read-only state and
/// analytics consent.
struct SdkHeaderFactory: Sendable {
    let publishableKey: String
    /// `x-sdk`: this SDK's name, or the host SDK's driving it.
    var sdkName: String = SdkHeaders.sdkName
    let sdkVersion: String
    let device: SdkDeviceInfo
    let isDebugBuild: Bool
    let identityStore: IdentityStore
    let readOnly: AtomicBool
    let analyticsConsent: AnalyticsConsentState

    func build() async -> [String: String] {
        let distinctId = await identityStore.getDistinctId()
        return build(distinctId: distinctId)
    }

    func build(distinctId: String) -> [String: String] {
        return SdkHeaders.build(
            publishableKey: publishableKey,
            distinctId: distinctId,
            sdkName: sdkName,
            sdkVersion: sdkVersion,
            device: device,
            isDebugBuild: isDebugBuild,
            readOnly: readOnly.value,
            analyticsConsent: analyticsConsent.value
        )
    }
}

/// Runs async work strictly in submission order.
///
/// Lifecycle notifications and view-controller appearances arrive synchronously on the main
/// thread but are handled on the client actor; spawning one detached `Task` per event would let
/// them interleave, so each unit waits for the previous one before running.
final class SerialTaskQueue: @unchecked Sendable {
    private let lock = NSLock()
    private var last: Task<Void, Never>?

    func submit<Value: Sendable>(
        _ operation: @escaping @Sendable () async throws -> Value
    ) -> Task<Value, any Error> {
        lock.withLock {
            let previous = last
            let task = Task {
                await previous?.value
                try Task.checkCancellation()
                return try await operation()
            }
            last = Task { _ = try? await task.value }
            return task
        }
    }

    func enqueue(_ operation: @escaping @Sendable () async -> Void) {
        lock.withLock {
            let previous = last
            last = Task {
                await previous?.value
                await operation()
            }
        }
    }
}

/// Who learns how a call the app awaits for a bounded time ended: decided once, by whichever of
/// the call's own settling and its deadline gets there first.
///
/// The settling claims the outcome for the caller before it decides anything the caller is told
/// about; the deadline gives up on the caller only if nothing claimed it yet. So a caller that
/// was told "deferred" never sees the settling act as if it were still waiting, and one the
/// settling counted on is waited for, however close to the deadline that was.
final class CallerWait: @unchecked Sendable {
    private enum State {
        case waiting
        case callerSees
        case stopped
    }

    private let lock = NSLock()
    private var state = State.waiting

    /// Claims the outcome for the waiting caller. `false` when the caller already stopped
    /// waiting, so whatever happens next must be reported some other way.
    func claimForCaller() -> Bool {
        return lock.withLock {
            if state == .waiting {
                state = .callerSees
            }
            return state == .callerSees
        }
    }

    /// Gives up on the caller at the deadline. `false` when the settling already claimed the
    /// outcome for it: the caller then waits for that outcome.
    func stop() -> Bool {
        return lock.withLock {
            if state == .waiting {
                state = .stopped
            }
            return state == .stopped
        }
    }

    /// Whether the caller stopped waiting.
    var isStopped: Bool {
        return lock.withLock { state == .stopped }
    }
}
