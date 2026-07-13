import Foundation

final class TransactionRetentionStore<Value>: @unchecked Sendable {
    private let lock = NSLock()
    private var retained: [String: Value] = [:]

    func retain(id: String, value: Value) {
        lock.withLock {
            retained[id] = value
        }
    }

    func value(for id: String) -> Value? {
        lock.withLock {
            retained[id]
        }
    }

    @discardableResult
    func remove(id: String) -> Value? {
        lock.withLock {
            retained.removeValue(forKey: id)
        }
    }

    func removeAll() {
        lock.withLock {
            retained.removeAll()
        }
    }

    func values() -> [Value] {
        lock.withLock {
            Array(retained.values)
        }
    }
}
