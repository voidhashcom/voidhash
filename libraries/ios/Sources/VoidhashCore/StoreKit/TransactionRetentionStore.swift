import Foundation

/// Thread-safe retention of store transactions between purchase/restore and `finishTransaction`.
///
/// Every retained transaction can be finished. Only the ones the store handed over as awaiting
/// a finish (a purchase, an update, an unfinished transaction) are pending; a transaction a read
/// of the purchase history returned is retained without becoming pending.
public final class TransactionRetentionStore<Value>: @unchecked Sendable {
    private let lock = NSLock()
    private var retained: [String: Value] = [:]
    private var pendingIds: Set<String> = []

    public init() {}

    /// - Parameter pending: `false` for a transaction a read of the purchase history returned.
    ///   A transaction already pending stays pending.
    public func retain(id: String, value: Value, pending: Bool = true) {
        lock.withLock {
            retained[id] = value
            if pending {
                pendingIds.insert(id)
            }
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
            pendingIds.remove(id)
            return retained.removeValue(forKey: id)
        }
    }

    public func removeAll() {
        lock.withLock {
            retained.removeAll()
            pendingIds.removeAll()
        }
    }

    public func values() -> [Value] {
        lock.withLock {
            Array(retained.values)
        }
    }

    /// The retained transactions awaiting a finish.
    public func pendingValues() -> [Value] {
        lock.withLock {
            pendingIds.compactMap { retained[$0] }
        }
    }
}
