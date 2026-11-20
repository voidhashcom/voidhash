import Foundation
import VoidhashCore

#if canImport(UIKit)
    import UIKit
#endif

/// A flow message, as JSON, from the presented flow to the SDK.
public typealias FlowMessageHandler = @Sendable (String) -> Void
/// Invoked once when the presented flow has left the screen, whoever dismissed it: the SDK, the
/// app, or the system taking its window away.
public typealias FlowDismissedHandler = @Sendable () -> Void
/// Invoked when the presented flow can no longer be drawn, with the reason. The SDK then ends
/// the flow and dismisses it.
public typealias FlowFailedHandler = @Sendable (String) -> Void

/// A native renderer for flows published as flow packages.
///
/// The renderer lives in the separate `VoidhashUI` module: linking it is enough, the client finds
/// it through ``FlowRendererDiscovery``. ``VoidhashOptions/flowRenderer`` overrides it, for tests
/// and custom hosts. The SDK downloads, verifies and caches each package and handles every
/// message the flow sends (purchases, restores, permissions, attributes, analytics, saved state);
/// the renderer only draws the package and relays messages.
public protocol FlowRenderer: Sendable {
    /// Creates the presenter the client shows flow packages with. Called at most once per client.
    func makePresenter(context: FlowRendererContext) -> any FlowPresenting

    /// What the renderer's engine can run, reported when the SDK resolves a paywall so the
    /// backend serves only flows it can show. `nil` reports nothing, and the backend then serves
    /// only flows the first engine release could show.
    var engineCapabilities: FlowEngineCapabilities? { get }
}

extension FlowRenderer {
    public var engineCapabilities: FlowEngineCapabilities? {
        return nil
    }
}

/// Implemented by the class a renderer module registers under
/// ``FlowRendererDiscovery/providerClassName``, so hosts that cannot name the module at compile
/// time (the client itself, and the React Native SDK) find the renderer when the app links it.
public protocol FlowRendererProviding: AnyObject {
    static func makeRenderer() -> any FlowRenderer
    /// Switches the renderer to flow runtime modules, process-wide. Called before the client
    /// resolves its first flow.
    static func useRuntimeModules()
}

extension FlowRendererProviding {
    public static func useRuntimeModules() {}
}

/// Finds a renderer the app linked without naming it.
public enum FlowRendererDiscovery {
    /// The Objective-C name of the `VoidhashUI` renderer's provider class.
    public static let providerClassName = "VoidhashFlowRendererProvider"

    /// The linked renderer, or `nil` when the app did not add one; with `runtimeModules`,
    /// switched to flow runtime modules first (the React Native `flowRuntime` option).
    public static func linkedRenderer(runtimeModules: Bool = false) -> (any FlowRenderer)? {
        guard
            let provider = NSClassFromString(providerClassName)
                as? any FlowRendererProviding.Type
        else { return nil }
        if runtimeModules {
            provider.useRuntimeModules()
        }
        return provider.makeRenderer()
    }
}

/// What a ``FlowRenderer`` needs from the client it presents for.
public struct FlowRendererContext: Sendable {
    /// Receives renderer diagnostics the paywall never sees.
    public let warn: VoidhashWarningHandler
    /// Where the images flows show are kept on the device. A renderer reads an image there
    /// before it downloads it, and stores what it downloads; `nil` keeps none.
    public let imageStore: FlowImageStore?

    #if canImport(UIKit)
        /// Resolves the view controller to present from: the one passed to
        /// ``VoidhashClient/presentFlow(location:revision:input:actions:from:)``, or else the
        /// top view controller of the key window.
        public let presentingViewController: @MainActor @Sendable () -> UIViewController?

        public init(
            warn: @escaping VoidhashWarningHandler,
            presentingViewController: @escaping @MainActor @Sendable () -> UIViewController?,
            imageStore: FlowImageStore? = nil
        ) {
            self.warn = warn
            self.presentingViewController = presentingViewController
            self.imageStore = imageStore
        }
    #else
        public init(warn: @escaping VoidhashWarningHandler, imageStore: FlowImageStore? = nil) {
            self.warn = warn
            self.imageStore = imageStore
        }
    #endif
}

/// The surface a ``FlowRenderer`` presents flow packages on.
///
/// The presenter reports every envelope the flow emits through `onBridgeEvent` and delivers the
/// envelopes the SDK answers with through ``postMessage(locationSlug:data:)``.
///
/// The SDK shows one flow at a time and never overlaps two transitions: it calls
/// ``dismiss()`` only after the ``show(locationSlug:package:onBridgeEvent:onDismiss:onFailure:)``
/// before it returned, and shows the next flow only after the one before it left the screen.
public protocol FlowPresenting: AnyObject, Sendable {
    /// Whether this presenter reads flow packages of `abiVersion`.
    func supportsFlowPackage(abiVersion: Int) -> Bool
    /// Presents `package`, a verified flow package, for a location, and returns once the
    /// presentation finished.
    ///
    /// - Parameters:
    ///   - onDismiss: Called once when a flow that was presented has left the screen, also when
    ///     the SDK did not dismiss it. Never called when nothing was presented.
    ///   - onFailure: Called when the presented flow can no longer be drawn.
    /// - Returns: `false` when the flow could not be presented; nothing is on screen then.
    @discardableResult
    func show(
        locationSlug: String,
        package: Data,
        onBridgeEvent: FlowMessageHandler?,
        onDismiss: FlowDismissedHandler?,
        onFailure: FlowFailedHandler?
    ) async throws -> Bool
    /// Dismisses the presented flow and returns once it has left the screen.
    func dismiss() async throws
    /// Delivers an SDK → flow envelope (`configure`, `input`, `status`, `response`).
    func postMessage(locationSlug: String, data: String)
    /// Whether this presenter can show the release whose package is `flowPackage`. A presenter
    /// running the flow runtime as a downloaded module shows any release that names a runtime
    /// module; by default, whether it reads the package's format.
    func supportsFlowPackage(_ flowPackage: SdkResolvedPaywall.FlowPackage) -> Bool
    /// Presents `package`, the verified package `flowPackage` describes; see
    /// ``show(locationSlug:package:onBridgeEvent:onDismiss:onFailure:)``, which it calls by
    /// default. A presenter running the flow runtime as a module first gets the runtime module
    /// `flowPackage` names.
    @discardableResult
    func show(
        locationSlug: String,
        package: Data,
        flowPackage: SdkResolvedPaywall.FlowPackage,
        onBridgeEvent: FlowMessageHandler?,
        onDismiss: FlowDismissedHandler?,
        onFailure: FlowFailedHandler?
    ) async throws -> Bool
}

extension FlowPresenting {
    public func supportsFlowPackage(_ flowPackage: SdkResolvedPaywall.FlowPackage) -> Bool {
        return supportsFlowPackage(abiVersion: flowPackage.abiVersion)
    }

    @discardableResult
    public func show(
        locationSlug: String,
        package: Data,
        flowPackage: SdkResolvedPaywall.FlowPackage,
        onBridgeEvent: FlowMessageHandler?,
        onDismiss: FlowDismissedHandler?,
        onFailure: FlowFailedHandler?
    ) async throws -> Bool {
        return try await show(
            locationSlug: locationSlug, package: package, onBridgeEvent: onBridgeEvent,
            onDismiss: onDismiss, onFailure: onFailure)
    }
}

#if canImport(UIKit)
    /// A view controller a renderer presents flows in. Automatic screen tracking skips it: the
    /// flow reports each of its own screens.
    public protocol FlowHostingViewController: UIViewController {}

    extension FlowRendererContext {
        /// The view controller a flow is presented from when the app names none: the top one of
        /// the key window of the scene in the foreground, or `nil` when there is none, as inside
        /// an app extension.
        ///
        /// A scene that is in the foreground but inactive counts when none is active: an app is
        /// inactive while it launches and while a system alert or the purchase sheet covers it.
        /// A controller that is being dismissed is not presented from: the one below it is.
        @MainActor
        public static func keyWindowTopViewController() -> UIViewController? {
            let scenes =
                ExtensionSafeApplication.shared?.connectedScenes.compactMap { $0 as? UIWindowScene }
                ?? []
            let scene =
                scenes.first(where: { $0.activationState == .foregroundActive })
                ?? scenes.first(where: { $0.activationState == .foregroundInactive })
            guard var top = scene?.windows.first(where: { $0.isKeyWindow })?.rootViewController
            else {
                return nil
            }
            while let presented = top.presentedViewController, !presented.isBeingDismissed {
                top = presented
            }
            return top
        }
    }
#endif
