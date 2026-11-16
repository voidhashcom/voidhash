import Foundation
import StoreKit
import VoidhashCore

#if canImport(UIKit)
    import UIKit
#endif

/// What happens to the messages the App Store asks the app to show: a price increase to agree
/// to, a billing issue, a win-back offer.
public enum VoidhashAppStoreMessagesHandling: Sendable, Hashable {
    /// The App Store shows them as they arrive, even over a paywall.
    case automatic
    /// They are shown as they arrive, except while a flow is on screen, which they wait for.
    case deferWhileFlowPresented
    /// The app takes them from ``VoidhashAppStore/messages()`` and shows them with
    /// ``VoidhashAppStore/display(_:)``. While nothing reads them, the App Store shows them as it
    /// would on its own.
    case manual
}

/// What happens when the user starts a purchase outside the app: an in-app purchase promoted on
/// the App Store, or a win-back offer the App Store showed.
public enum VoidhashPurchaseIntentHandling: Sendable, Hashable {
    /// Bought through ``VoidhashClient/purchase(_:options:)`` once the client has initialized,
    /// so the purchase belongs to the person the app restored. The transaction arrives through
    /// ``VoidhashClient/transactionUpdates()``.
    case purchaseWhenReady
    /// The app takes them from ``VoidhashAppStore/purchaseIntents()`` and buys them with
    /// ``VoidhashClient/purchase(_:options:)`` when it is ready, for example after sign-in.
    case manual
}

/// A purchase the user started outside the app.
public struct VoidhashPurchaseIntent: Sendable, Hashable {
    public let product: VoidhashProduct
    /// The offer the App Store showed with it; from iOS 18.
    public let offer: VoidhashOffer?

    /// The options that buy what the user chose: the offer shown, or the automatic price.
    public var purchaseOptions: VoidhashPurchaseOptions {
        return VoidhashPurchaseOptions(offer: offer.map { .offer($0) } ?? .automatic)
    }
}

/// The renewal state of one subscription the Apple account has in a group.
public struct VoidhashAppStoreSubscriptionStatus: Sendable, Equatable {
    public typealias State = StoreKitSubscriptionStatusInfo.State

    public let state: State
    /// The subscription's latest transaction.
    public let transaction: VoidhashTransaction
    /// `nil` when StoreKit could not verify the renewal information.
    public let renewalInfo: VoidhashAppStoreRenewalInfo?
}

/// An App Store message the client holds until it can show it.
protocol DeferredAppStoreMessage: Sendable {
    /// What the message is about, for a warning.
    var reasonName: String { get }
    /// Shows the message on the scene the user is looking at.
    ///
    /// - Throws: `WINDOW_SCENE_NOT_FOUND` when no scene is in the foreground.
    @MainActor func display() throws
}

#if os(iOS) || os(visionOS)
    /// A message the App Store asks the app to show.
    @available(iOS 16.0, *)
    public struct VoidhashAppStoreMessage: Sendable, Hashable, DeferredAppStoreMessage {
        public enum Reason: String, Sendable, Hashable {
            case generic
            /// The user has to agree to a subscription's higher price.
            case priceIncreaseConsent
            /// The App Store could not charge the user's payment method.
            case billingIssue
            /// A win-back offer for a former subscriber.
            case winBackOffer
            /// A reason this SDK version does not know.
            case unknown
        }

        public let reason: Reason
        /// The StoreKit message.
        public let storeKitMessage: Message

        var reasonName: String { reason.rawValue }

        init(_ message: Message) {
            storeKitMessage = message
            switch message.reason {
            case .generic:
                reason = .generic
            case .priceIncreaseConsent:
                reason = .priceIncreaseConsent
            default:
                if #available(iOS 16.4, *), message.reason == .billingIssue {
                    reason = .billingIssue
                } else if #available(iOS 18.0, visionOS 2.0, *),
                    message.reason == .winBackOffer
                {
                    reason = .winBackOffer
                } else {
                    reason = .unknown
                }
            }
        }

        /// Shows the message on the scene the user is looking at.
        @MainActor
        func display() throws {
            guard let scene = DefaultWindowSceneProvider().currentWindowScene() else {
                throw VoidhashStoreError.windowSceneNotFound
            }
            try storeKitMessage.display(in: scene)
        }
    }
#endif

/// The App Store's own features, for an app that builds its purchase screens itself: refunds,
/// subscription status, entitlements, the app transaction, App Store messages and purchases
/// started on the App Store. Reached through ``VoidhashClient/appStore``.
public struct VoidhashAppStore: Sendable {
    let client: VoidhashClient

    /// Shows the App Store's refund request sheet for the transaction `transactionId`. A refund
    /// Apple grants arrives later, as a revocation Voidhash learns of.
    ///
    /// - Throws: `STOREKIT_NOT_INITIALIZED` on a disabled client, and the App Store's failures as
    ///   `REFUND_REQUEST_FAILED`.
    public func beginRefundRequest(transactionId: String) async throws
        -> VoidhashRefundRequestStatus
    {
        return try await client.beginRefundRequest(transactionId: transactionId)
    }

    /// The renewal state of each subscription the Apple account has in the subscription group
    /// `groupId`, as StoreKit reports it on the device, the current person's first: one bought
    /// for them, then one the account bought rather than shares through Family Sharing, the
    /// latest first. Empty on a disabled client.
    ///
    /// For what Voidhash knows across devices and stores, read the person's subscriptions.
    public func subscriptionStatus(groupId: String) async throws
        -> [VoidhashAppStoreSubscriptionStatus]
    {
        return try await client.subscriptionStatus(groupId: groupId)
    }

    /// The transactions that entitle the Apple account right now, as StoreKit lists them on the
    /// device. Empty on a disabled client. Check access with the person's entitlements, which
    /// also count purchases made on other devices and stores.
    public func currentEntitlements() async throws -> [VoidhashTransaction] {
        return try await client.currentEntitlements()
    }

    /// The App Store's record of the user getting the app: which version they first had, when,
    /// and its signed form for a server. Needs iOS 16.
    ///
    /// - Throws: `STOREKIT_NOT_INITIALIZED` on a disabled client.
    public func appTransaction() async throws -> VoidhashAppTransaction {
        return try await client.appTransaction()
    }

    #if os(iOS) || os(visionOS)
        /// The messages the App Store asks the app to show, with
        /// ``VoidhashOptions/appStoreMessages`` set to ``VoidhashAppStoreMessagesHandling/manual``.
        /// Show each with ``display(_:)``, when the app is ready to. Each call makes a stream of
        /// its own; with another handling the stream ends at once.
        @available(iOS 16.0, *)
        public func messages() -> AsyncStream<VoidhashAppStoreMessage> {
            guard client.options.enabled, client.options.appStoreMessages == .manual else {
                return AsyncStream { $0.finish() }
            }
            return AsyncStream { continuation in
                let task = Task {
                    for await message in Message.messages {
                        continuation.yield(VoidhashAppStoreMessage(message))
                    }
                    continuation.finish()
                }
                continuation.onTermination = { _ in task.cancel() }
            }
        }

        /// Shows a message ``messages()`` delivered, on the scene the user is looking at.
        @available(iOS 16.0, *)
        @MainActor
        public func display(_ message: VoidhashAppStoreMessage) throws {
            try message.display()
        }
    #endif

    /// The purchases the user started on the App Store, with
    /// ``VoidhashOptions/purchaseIntents`` set to ``VoidhashPurchaseIntentHandling/manual``. Buy
    /// each with `purchase(intent.product, options: intent.purchaseOptions)`. Up to 10 that arrive
    /// before anything reads them are kept for the first stream. Each call makes a stream of
    /// its own; needs iOS 16.4.
    public func purchaseIntents() -> AsyncStream<VoidhashPurchaseIntent> {
        return client.purchaseIntentBroadcaster.stream()
    }
}
