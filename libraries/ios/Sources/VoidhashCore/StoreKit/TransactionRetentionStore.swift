import Foundation

/// Thread-safe retention of store transactions between purchase/restore and `finishTransaction`.
public final class TransactionRetentionStore<Value>: @unchecked Sendable {
    private let lock = NSLock()
    private var retained: [String: Value] = [:]

    public init() {}

    public func retain(id: String, value: Value) {
        lock.withLock {
            retained[id] = value
        }
    }

    public func value(for id: String) -> Value? {
        lock.withLock {
            retained[id]
        }
    }

    @discardableResult
    public func remove(id: String) -> Value? {
        lock.withLock {
            retained.removeValue(forKey: id)
        }
    }

    public func removeAll() {
        lock.withLock {
            retained.removeAll()
        }
    }

    public func values() -> [Value] {
        lock.withLock {
            Array(retained.values)
        }
    }
}
