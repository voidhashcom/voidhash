import Foundation
import Voidhash
import VoidhashCore

#if os(iOS)
    import UIKit
    import VoidhashUICore
#endif

/// Renders Voidhash flows with UIKit's own views.
///
/// An app that links `VoidhashUI` needs no option: the SDK finds this renderer through
/// ``VoidhashFlowRendererProvider``, and ``VoidhashClient/presentFlow(location:revision:input:actions:)``
/// shows flows full screen in a ``FlowView``:
///
/// ```swift
/// import Voidhash
///
/// let voidhash = Voidhash.configure(publishableKey: "vh_pk_…")
/// let result = try await voidhash.presentFlow(location: "onboarding")
/// ```
///
/// Pass one as ``VoidhashOptions/flowRenderer`` only to configure it, such as with the app's own
/// components.
///
/// It shows flows with the flow runtime linked into it, unless ``FlowView/runtimeMode`` is
/// ``FlowView/RuntimeMode/module``: it then reports its runtime bridge version, is served
/// releases by the runtime module they name, and shows each with that module.
public struct FlowViewRenderer: FlowRenderer {
    #if os(iOS)
        /// The app's own components this renderer shows, as they were registered; see
        /// ``VoidhashNativeComponentView``.
        @_spi(NativeComponents)
        public let registrations: [VoidhashNativeComponentRegistration]

        /// The types of the components this renderer shows that were registered from a type
        /// (``init(components:)``, or ``VoidhashNativeComponentRegistration/init(_:)``).
        @_spi(NativeComponents)
        public var components: [any VoidhashNativeComponent.Type] {
            return registrations.compactMap(\.type)
        }

        /// The renderer's own registry of its components, which every view it presents shows
        /// and its capabilities are read from. Copies of the renderer share it; it is released
        /// with the last of them, while views already showing a flow keep what they show.
        let registry: NativeComponentRegistry

        public init() {
            registrations = []
            registry = NativeComponentRegistry(registering: [], refused: { _ in })
        }

        /// A renderer that also shows the app's own components, which flows place by their
        /// definition ids. Create it before the SDK resolves a flow: it reports them so the
        /// server serves this build the flows that use them. Only the views this renderer
        /// presents show them; a renderer created without one shows what the flow falls back
        /// to.
        ///
        /// - Throws: ``VoidhashNativeComponentError`` for a component that cannot be
        ///   registered: an id that is not `namespace/name` or is in the `vh` or `voidhash`
        ///   namespace, a version that is not one, or two components with one id. Thrown
        ///   rather than logged, so the mistake shows when the app starts instead of as flows
        ///   that quietly fall back.
        @_spi(NativeComponents)
        public init(components: [any VoidhashNativeComponent.Type]) throws {
            try self.init(registrations: components.map(VoidhashNativeComponentRegistration.init))
        }

        /// A renderer that also shows the app's own components, each created by its
        /// registration's factory: what code registering views at run time passes, such as the
        /// registrations `voidhash types generate` writes for components marked for native
        /// rendering. Otherwise as ``init(components:)``.
        ///
        /// - Throws: ``VoidhashNativeComponentError`` for a registration that cannot be
        ///   registered, as ``init(components:)`` does.
        @_spi(NativeComponents)
        public init(registrations: [VoidhashNativeComponentRegistration]) throws {
            registry = try NativeComponentRegistry(
                registering: registrations, refused: { throw $0 })
            self.registrations = registrations
        }

        /// What this renderer can run, read from its registry whenever the SDK resolves a
        /// paywall: the renderer's own components and the app's it was created with, and in
        /// module mode its runtime bridge version.
        public var engineCapabilities: FlowEngineCapabilities? {
            return registry.capabilities
        }
    #else
        public init() {}

        public var engineCapabilities: FlowEngineCapabilities? {
            return nil
        }
    #endif

    public func makePresenter(context: FlowRendererContext) -> any FlowPresenting {
        #if os(iOS)
            let registry = registry
            return FlowPresenter<FlowView>(
                context: context,
                packageAbiVersions: FlowView
                    .minPackageAbiVersion...FlowView.packageAbiVersion,
                makeView: { imageStore in
                    FlowView(imageStore: imageStore, registry: registry)
                })
        #else
            return UnsupportedPlatformPresenter()
        #endif
    }
}

#if os(iOS)
    extension FlowView: FlowViewHost {
        /// In module mode, the module the release names. A release naming none, and every
        /// release in linked mode, is loaded without one prepared.
        package nonisolated static func runtimeModule(
            for flowPackage: SdkResolvedPaywall.FlowPackage
        ) -> SdkResolvedPaywall.FlowPackage.RuntimeModule? {
            guard runtimeMode == .module else {
                return nil
            }
            return flowPackage.runtime
        }

        package nonisolated static func prepareRuntimeModule(
            _ runtimeModule: SdkResolvedPaywall.FlowPackage.RuntimeModule
        ) async throws {
            try await RuntimeModules.prepare(runtimeModule, using: .shared)
        }

        package func load(
            package: Data, runtimeModule: SdkResolvedPaywall.FlowPackage.RuntimeModule?
        ) throws {
            try load(package: package, runtimeSha256: runtimeModule?.sha256 ?? "")
        }
    }
#endif

/// Lets the SDK find the renderer when the app links this module, without an option; see
/// ``FlowRendererDiscovery``.
@objc(VoidhashFlowRendererProvider)
public final class VoidhashFlowRendererProvider: NSObject, FlowRendererProviding {
    public static func makeRenderer() -> any FlowRenderer {
        return FlowViewRenderer()
    }

    /// Switches every flow view to runtime modules (``FlowView/runtimeMode``).
    public static func useRuntimeModules() {
        #if os(iOS)
            FlowView.runtimeMode = .module
        #endif
    }
}
