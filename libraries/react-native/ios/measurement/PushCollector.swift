import Foundation

/** Build environment associated with an APNs device token. */
@objc public enum VoidhashPushEnvironment: Int {
    case development
    case production
}

struct VoidhashObservedPushToken {
    let token: String
    let environment: VoidhashPushEnvironment
}

enum VoidhashPushCollectorEvent {
    case tokenChanged
    case registrationError(String)
}

/** Native APNs callback sink that is safe to invoke before the JavaScript runtime starts. */
@objcMembers public final class VoidhashPushCollector: NSObject, @unchecked Sendable {
    public static let shared = VoidhashPushCollector()

    private let lock = NSLock()
    private var token: VoidhashObservedPushToken?
    private var listeners: [UUID: (VoidhashPushCollectorEvent) -> Void] = [:]

    /** Stores an APNs token using a lowercase, zero-padded hexadecimal representation. */
    public func didRegister(
        deviceToken: Data,
        environment: VoidhashPushEnvironment
    ) {
        let value = deviceToken.map { String(format: "%02x", $0) }.joined()
        guard !value.isEmpty else {
            didFailToRegister(code: "APNS_EMPTY_DEVICE_TOKEN")
            return
        }
        let callbacks = lock.withLock { () -> [(VoidhashPushCollectorEvent) -> Void] in
            token = VoidhashObservedPushToken(token: value, environment: environment)
            return Array(listeners.values)
        }
        callbacks.forEach { $0(.tokenChanged) }
    }

    /** Records a typed APNs registration failure without retaining its message or credentials. */
    public func didFailToRegister(code: String) {
        let safeCode = code.isEmpty ? "APNS_REGISTRATION_FAILED" : code
        let callbacks = lock.withLock { Array(listeners.values) }
        callbacks.forEach { $0(.registrationError(safeCode)) }
    }

    func currentToken() -> VoidhashObservedPushToken? { lock.withLock { token } }

    func subscribe(_ listener: @escaping (VoidhashPushCollectorEvent) -> Void) -> UUID {
        lock.withLock {
            let id = UUID()
            listeners[id] = listener
            return id
        }
    }

    func unsubscribe(_ id: UUID) { lock.withLock { _ = listeners.removeValue(forKey: id) } }
}
