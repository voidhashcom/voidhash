import Foundation
import VoidhashCore

/// Lock-guarded boolean shared between the client and the components that read it live
/// (the purchase orchestrator's read-only decision, the header builder).
final class AtomicBool: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: Bool

    init(_ value: Bool) {
        storage = value
    }

    var value: Bool {
        get { lock.withLock { storage } }
        set { lock.withLock { storage = newValue } }
    }
}

/// Late-bound weak reference to the client being constructed, so callbacks wired up during
/// `init` can reach it once initialization completes.
final class WeakClientBox: @unchecked Sendable {
    private let lock = NSLock()
    private var storage: VoidhashClient?

    func set(_ client: VoidhashClient?) {
        lock.withLock { storage = client }
    }

    func get() -> VoidhashClient? {
        return lock.withLock { storage }
    }
}

/// Builds the per-request SDK header set for the current identity and read-only state.
struct SdkHeaderFactory: Sendable {
    let publishableKey: String
    let sdkVersion: String
    let device: SdkDeviceInfo
    let isDebugBuild: Bool
    let identityStore: IdentityStore
    let readOnly: AtomicBool
    /// Backend environment mode; `development` while the dev gateway is active.
    var environmentProvider: @Sendable () -> String = { "production" }

    func build() async -> [String: String] {
        let distinctId = await identityStore.getDistinctId()
        return build(distinctId: distinctId)
    }

    func build(distinctId: String) -> [String: String] {
        return SdkHeaders.build(
            publishableKey: publishableKey,
            distinctId: distinctId,
            sdkVersion: sdkVersion,
            device: device,
            isDebugBuild: isDebugBuild,
            readOnly: readOnly.value,
            environment: environmentProvider()
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
