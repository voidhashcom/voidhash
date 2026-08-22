import Foundation
import Voidhash
import VoidhashCore

/// Forwards ``VoidhashPaywallDelegate`` callbacks to a single handler.
///
/// The SDK holds the delegate weakly, so whoever presents the paywall owns the only strong
/// reference and has to keep it alive until the paywall is dismissed — a released delegate
/// stops receiving callbacks without any error. Callbacks arrive off the main actor; the
/// handler is responsible for hopping.
final class PaywallEventRelay: VoidhashPaywallDelegate {
    /// What the paywall did while it was on screen.
    enum Event: Sendable {
        case purchased(productId: String)
        case restored
        case failed(message: String)
        case dismissed
    }

    private let onEvent: @Sendable (Event) -> Void

    init(onEvent: @escaping @Sendable (Event) -> Void) {
        self.onEvent = onEvent
    }

    func paywall(
        _ locationSlug: String, didPurchaseProductId productId: String, requestId: String?
    ) {
        onEvent(.purchased(productId: productId))
    }

    func paywallDidRestore(_ locationSlug: String, requestId: String?) {
        onEvent(.restored)
    }

    func paywall(
        _ locationSlug: String,
        didFailAction action: PaywallBridgeActionType,
        error: any Error,
        requestId: String?
    ) {
        if let storeError = error as? VoidhashStoreError, storeError.code == "USER_CANCELLED" {
            return
        }
        onEvent(.failed(message: "\(action.rawValue) failed: \(AppModel.describe(error))"))
    }

    func paywallDidDismiss(_ locationSlug: String) {
        onEvent(.dismissed)
    }
}
