import Foundation
import VoidhashCore

/// Raw page → native bridge message.
public typealias PaywallRawEventHandler = @Sendable (String) -> Void
/// Invoked when the presented paywall is dismissed.
public typealias PaywallDismissedHandler = @Sendable () -> Void

/// The paywall presentation surface ``PaywallCoordinator`` drives.
///
/// ``PaywallPresenterCore`` conforms to it on UIKit platforms; tests supply their own double so
/// the coordinator can run on macOS.
public protocol PaywallPresenting: AnyObject, Sendable {
    /// Warms (or reloads) the WebView backing a location without presenting it.
    @discardableResult
    func preload(locationSlug: String, htmlUrl: String) async throws -> Bool
    /// Presents the paywall for a location.
    @discardableResult
    func show(
        locationSlug: String,
        htmlUrl: String,
        onBridgeEvent: PaywallRawEventHandler?,
        onDismiss: PaywallDismissedHandler?
    ) async throws -> Bool
    /// Dismisses the presented paywall.
    func dismiss() async throws
    /// Delivers a native → page message.
    func postMessage(locationSlug: String, data: String)
    /// Drops the warmed WebView for a location.
    func release(locationSlug: String)
}

#if canImport(UIKit)
    extension PaywallPresenterCore: PaywallPresenting {}
#endif
