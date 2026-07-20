import Foundation

#if os(iOS) && canImport(AdServices)
import AdServices
#endif

#if os(iOS) && canImport(UIKit)
import UIKit
#endif

#if os(iOS) && canImport(AppTrackingTransparency) && canImport(AdSupport) && !VOIDHASH_STRICT_NO_IDFA
import AdSupport
import AppTrackingTransparency
#endif

struct AppleAttTransition: Equatable, Sendable {
    let previous: String?
    let current: String
    let source: String
    let observedAt: String
}

final class AppleAttTransitionObserver: @unchecked Sendable {
    typealias StatusProvider = @Sendable () -> String

    private let lock = NSLock()
    private let statusProvider: StatusProvider
    private var previous: String?

    init(previous: String? = nil, statusProvider: @escaping StatusProvider) {
        self.previous = previous
        self.statusProvider = statusProvider
    }

    func observe(source: String, observedAt: String) -> AppleAttTransition? {
        lock.lock()
        defer { lock.unlock() }
        let current = statusProvider()
        guard current != previous else { return nil }
        let transition = AppleAttTransition(
            previous: previous,
            current: current,
            source: source,
            observedAt: observedAt
        )
        previous = current
        return transition
    }
}

enum AppleSystemIdentifiers {
    static var strictNoIdfa: Bool {
        #if VOIDHASH_STRICT_NO_IDFA
        true
        #else
        false
        #endif
    }

    static func attStatus() -> String {
        #if os(iOS) && canImport(AppTrackingTransparency) && !VOIDHASH_STRICT_NO_IDFA
        switch ATTrackingManager.trackingAuthorizationStatus {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        case .authorized: return "authorized"
        @unknown default: return "restricted"
        }
        #else
        return "restricted"
        #endif
    }

    static func providers() -> [AppleIdentifierKind: AppleIdentifierCollector.Provider] {
        var result: [AppleIdentifierKind: AppleIdentifierCollector.Provider] = [:]
        #if os(iOS) && canImport(UIKit)
        result[.idfv] = { UIDevice.current.identifierForVendor?.uuidString }
        #endif
        #if os(iOS) && canImport(AppTrackingTransparency) && canImport(AdSupport) && !VOIDHASH_STRICT_NO_IDFA
        result[.idfa] = {
            let value = ASIdentifierManager.shared().advertisingIdentifier
            return value == UUID(uuidString: "00000000-0000-0000-0000-000000000000") ? nil : value.uuidString
        }
        #endif
        #if os(iOS) && canImport(AdServices)
        if #available(iOS 14.3, *) {
            result[.appleAdsToken] = { try AAAttribution.attributionToken() }
        }
        #endif
        return result
    }
}
