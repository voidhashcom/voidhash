import Foundation
import VoidhashCore

/// The end user's analytics consent, read synchronously by the header builder and the analytics
/// queue on every request and capture.
///
/// Starts from the `analyticsConsent` option. The decision persisted by an earlier launch replaces
/// it once persisted state has loaded, unless the host already set one in this process: the most
/// recent decision of the end user always wins.
final class AnalyticsConsentState: @unchecked Sendable {
    /// Cache key of the persisted decision. Kept apart from the `analytics:` keys, which belong to
    /// the data consent governs.
    static let cacheKey = "consent:analytics"
    /// Cache key marking the persisted grant as implied by an identify rather than decided by
    /// the end user. Absent for an explicit decision.
    static let impliedCacheKey = "consent:analytics:implied"

    private let lock = NSLock()
    private var current: AnalyticsConsent
    private var implied = false
    private var setInThisProcess = false

    init(_ initial: AnalyticsConsent) {
        current = initial
    }

    var value: AnalyticsConsent {
        return lock.withLock { current }
    }

    /// Whether the consent in effect is a grant implied by an identify, which a sign-out takes
    /// back.
    var isImplied: Bool {
        return lock.withLock { implied }
    }

    /// Stores the host's decision, which a persisted one no longer replaces. The decision is
    /// explicit: a grant implied before it no longer is.
    func set(_ consent: AnalyticsConsent) {
        lock.withLock {
            current = consent
            implied = false
            setInThisProcess = true
        }
    }

    /// Grants consent on the end user's behalf while it is `pending`. Returns whether it did: a
    /// decision already made, `denied` or `granted`, is left as it is.
    func grantImplied() -> Bool {
        return lock.withLock {
            guard current == .pending else {
                return false
            }
            current = .granted
            implied = true
            setInThisProcess = true
            return true
        }
    }

    /// Returns an implied grant to `pending`. Returns whether it did: an explicit decision is
    /// left as it is.
    func withdrawImplied() -> Bool {
        return lock.withLock {
            guard implied else {
                return false
            }
            current = .pending
            implied = false
            setInThisProcess = true
            return true
        }
    }

    /// Adopts the decision persisted by an earlier launch, unless the host set one since this
    /// process started.
    func adoptPersisted(_ consent: AnalyticsConsent, implied: Bool) {
        lock.withLock {
            guard !setInThisProcess else {
                return
            }
            current = consent
            self.implied = implied && consent == .granted
        }
    }
}
