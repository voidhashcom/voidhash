import Foundation

// Every declaration of this file is SPI: an app opts in to the app's own components with
// `@_spi(NativeComponents) import VoidhashUI`. They are not yet part of the public API.

#if os(iOS)
    import UIKit

    /// A view of the app's own, built from UIKit views, that a flow shows in place of one of its
    /// components: a map, a video player, a view of another SDK, or the app's own rendering of
    /// a component designed in the editor and marked for native rendering.
    ///
    /// An app usually implements ``VoidhashNativeComponent``, which adds the id, the version
    /// and the initializer the renderer creates it with. Code that registers views at run time,
    /// such as the code `voidhash types generate` writes for native-rendered components,
    /// implements this protocol and registers a factory with
    /// ``VoidhashNativeComponentRegistration/init(definitionId:version:make:)``.
    ///
    /// A component is created when its flow node is shown and disposed when the node goes, so
    /// one flow may hold several at once. Its ``view`` fills the node's frame and follows it.
    /// Everything runs on the main thread.
    ///
    /// **Size.** Where the flow leaves the node's width or height to its content, the view
    /// gives it: the renderer measures ``view`` after creating it, after each
    /// ``update(props:)``, after ``VoidhashNativeComponentContext/invalidateSize()``, and when
    /// the width the flow lays it out at changes, always at that width with the height left
    /// open (before the node has a width, at no limit), so a height may depend on the width but
    /// never the other way round. A view that holds Auto Layout constraints of its own
    /// (`view.constraints` is not empty, as when its subviews are pinned to it) is measured
    /// with `systemLayoutSizeFitting(_:withHorizontalFittingPriority:verticalFittingPriority:)`;
    /// constrain its content to all four edges so the height follows. Any other view is
    /// measured with `sizeThatFits(_:)` when its class overrides it (UIKit's controls and
    /// labels do), and otherwise by its `intrinsicContentSize`: an axis without an intrinsic
    /// metric, or a view that offers neither, leaves that axis to the flow's layout, as an
    /// axis the flow fixes or stretches always is. Call
    /// ``VoidhashNativeComponentContext/invalidateSize()`` when the view's size changes
    /// without an update, such as after loading its content.
    ///
    /// **Touches.** The component's views take their touches directly; the flow puts no press
    /// of its own over them. To tell the flow about a tap, emit an event. A drag that starts on
    /// the component goes to its own gesture recognizers first: a sheet does not move while one
    /// of them may still recognize, and a swipe back starts only within the screen's leading
    /// edge. Everything else is UIKit's gesture delegation: let a recognizer fail
    /// (`gestureRecognizerShouldBegin(_:)` returning false) to give the drag to the flow, or
    /// return true from `gestureRecognizer(_:shouldBeRequiredToFailBy:)` for a flow scroll
    /// view's `UIScrollView.panGestureRecognizer` to keep a drag that scroll view would take.
    ///
    /// **Accessibility.** The component's own views are what VoiceOver reads; the flow hides
    /// them only by hiding the component. When the flow makes the component pressable,
    /// VoiceOver reads a button first (the flow's label, or its own text around the
    /// component), then the component's elements in their order.
    ///
    /// **Screen transitions.** The view moves with its screen. A shared element holding a
    /// component does not fly between screens: each screen keeps its own live view. A flow
    /// effect that draws a picture of its content, such as a blur, shows the component as its
    /// views draw into a layer after each update of the flow; content the GPU composites, such
    /// as video or a map's tiles, may be missing from that picture.
    @_spi(NativeComponents)
    @MainActor
    public protocol VoidhashNativeComponentView: AnyObject {
        /// The view the flow shows, sized to the node's frame. Read once, after creation.
        var view: UIView { get }

        /// The props the flow gives the component: once after creation, then whenever one of
        /// them, ``VoidhashNativeComponentContext/state`` or
        /// ``VoidhashNativeComponentContext/isDisabled`` changes. A value the component wrote
        /// with ``VoidhashNativeComponentContext/write(_:_:)`` comes back here too.
        func update(props: [String: VoidhashNativeComponentValue])

        /// The locale, reduced motion, colour scheme or layout direction changed; the context
        /// already holds the new environment.
        func environmentDidChange(_ environment: VoidhashNativeComponentEnvironment)

        /// The node left the flow: stop work and release resources. Called once; the view is
        /// removed from the flow after it, and the context's events and writes are dropped.
        func dispose()
    }

    @_spi(NativeComponents)
    extension VoidhashNativeComponentView {
        public func environmentDidChange(_ environment: VoidhashNativeComponentEnvironment) {}

        public func dispose() {}
    }

    /// A ``VoidhashNativeComponentView`` that declares what it implements, so the renderer can
    /// register it from its type.
    ///
    /// Implement it in the app, then pass the type to the renderer, which registers it before
    /// the SDK reports what it can show:
    ///
    /// ```swift
    /// final class MapComponent: VoidhashNativeComponent {
    ///     nonisolated static let definitionId = "acme/map"
    ///     nonisolated static let version = "1.0.0"
    ///
    ///     private let context: VoidhashNativeComponentContext
    ///     private let map = MKMapView()
    ///     var view: UIView { map }
    ///
    ///     init(context: VoidhashNativeComponentContext) {
    ///         self.context = context
    ///     }
    ///
    ///     func update(props: [String: VoidhashNativeComponentValue]) {
    ///         if let zoom = props["zoom"]?.number { map.setZoom(zoom) }
    ///         map.isUserInteractionEnabled = !context.isDisabled
    ///     }
    ///
    ///     func pinTapped(_ pin: Pin) {
    ///         context.write("place", .string(pin.name))
    ///         context.emit("picked", payload: ["value": .string(pin.name)])
    ///     }
    /// }
    ///
    /// var options = VoidhashOptions()
    /// options.flowRenderer = try FlowViewRenderer(components: [MapComponent.self])
    /// ```
    ///
    /// The server then serves this build the flows that place `acme/map`. A build without the
    /// component is served flows that do not need it, or shows what the flow falls back to.
    ///
    /// A component designed in the editor and marked for native rendering is `native/<name>`
    /// at its contract's version, a hash of its props and events; a build whose view
    /// implements another version shows the editor's version of the component instead.
    /// `voidhash types generate` writes a typed registration for each such component.
    @_spi(NativeComponents)
    public protocol VoidhashNativeComponent: VoidhashNativeComponentView, Sendable {
        /// The component definition's id, `namespace/name`, as the flow names it. The `vh`
        /// and `voidhash` namespaces are Voidhash's own.
        nonisolated static var definitionId: String { get }

        /// The definition version the component implements, such as `1.2.0`. Flows built for
        /// that version place it.
        nonisolated static var version: String { get }

        /// Creates the component for one node of a flow. ``update(props:)`` follows at once
        /// with its props. Keep the context to emit events, write props and read the
        /// environment.
        init(context: VoidhashNativeComponentContext)
    }

    /// A component the renderer provides: the definition id and version flows place it by,
    /// and how to create its view for a node.
    ///
    /// ```swift
    /// let map = VoidhashNativeComponentRegistration(
    ///     definitionId: "acme/map", version: "1.0.0",
    ///     make: { context in MapView(context: context) })
    /// options.flowRenderer = try FlowViewRenderer(registrations: [map])
    /// ```
    @_spi(NativeComponents)
    public struct VoidhashNativeComponentRegistration: Sendable {
        /// The component definition's id, `namespace/name`; `native/<name>` for a component
        /// designed in the editor and marked for native rendering.
        public let definitionId: String
        /// The definition version the view implements; the contract's version for a
        /// native-rendered component.
        public let version: String
        /// Creates the view for one node of a flow, on the main thread.
        let make:
            @MainActor @Sendable (VoidhashNativeComponentContext) -> any VoidhashNativeComponentView
        /// The type the registration was made from, when it was.
        let type: (any VoidhashNativeComponent.Type)?

        /// A registration of a view created by `make`, which the renderer calls for each node
        /// of a flow that places `definitionId` at `version`.
        public init(
            definitionId: String, version: String,
            make:
                @escaping @MainActor @Sendable (VoidhashNativeComponentContext) ->
                any VoidhashNativeComponentView
        ) {
            self.definitionId = definitionId
            self.version = version
            self.make = make
            self.type = nil
        }

        /// The registration `type` declares: its id, its version, and its initializer.
        public init(_ type: any VoidhashNativeComponent.Type) {
            definitionId = type.definitionId
            version = type.version
            make = { context in type.init(context: context) }
            self.type = type
        }
    }

    /// What a ``VoidhashNativeComponentView`` has of the flow showing it: its events and
    /// writes go out through it, and it holds what the flow knows of the device.
    @_spi(NativeComponents)
    @MainActor
    public final class VoidhashNativeComponentContext {
        /// The flow's locale, Reduce Motion setting, colour scheme, and the direction the flow
        /// lays the component out in.
        public internal(set) var environment: VoidhashNativeComponentEnvironment

        /// The state the flow shows the component in (`$state`), when its node names one.
        public internal(set) var state: VoidhashNativeComponentValue?

        /// Whether the flow disables the component's node (`$disabled`). A disabled
        /// component should look it and take no input; the flow does not stop its views'
        /// touches itself. ``VoidhashNativeComponentView/update(props:)`` follows a change.
        public internal(set) var isDisabled: Bool = false

        /// The view hosting the component; `nil` once it is disposed.
        weak var container: ExternalNodeView?

        init(container: ExternalNodeView, environment: VoidhashNativeComponentEnvironment) {
            self.container = container
            self.environment = environment
        }

        /// Sends the flow event `name` with `payload`; the flow runs the action its node binds
        /// to that name, reading a bound field from the payload. Callable from any thread: it
        /// is delivered on the main thread, in order. Dropped after the component is disposed.
        ///
        /// On a component node the bound action may be any action, a purchase, a restore or
        /// opening a URL included. Inside a code component's tree the event reaches that
        /// component as no input of the end user, which then may not purchase, restore or
        /// open a URL.
        public nonisolated func emit(
            _ name: String, payload: [String: VoidhashNativeComponentValue] = [:]
        ) {
            onMain { $0.container?.emit(name, payload: VoidhashNativeComponentValue.json(payload)) }
        }

        /// Writes prop `key` (its contract key) to `value`: the flow sets what the instance
        /// gives the prop, such as a variable bound to it, and the new value comes back in
        /// ``VoidhashNativeComponentView/update(props:)`` after the next frame. The value has
        /// the prop's type: a string (an enum's option, or a product's id for a product), a
        /// finite number, a boolean, or for a list an array of distinct strings.
        ///
        /// Callable from any thread: it is applied on the main thread, in order with
        /// ``emit(_:payload:)``. A prop the component may not write (a computed one, or one
        /// bound to something that cannot be written) keeps its value, as does a write after
        /// the flow ended or the component was disposed. A write the flow refuses (no such
        /// prop, a value of the wrong type) is reported to the view's `onError`, not thrown.
        public nonisolated func write(_ key: String, _ value: VoidhashNativeComponentValue) {
            onMain { $0.container?.write(key, json: value.jsonFragment) }
        }

        /// Measures the component's view again and gives the flow its size, when it changed.
        /// Call it when the view's size changes without an
        /// ``VoidhashNativeComponentView/update(props:)``. Callable from any thread.
        public nonisolated func invalidateSize() {
            onMain { $0.container?.invalidateSize() }
        }

        /// Runs `body` on the main thread: at once when called there, otherwise queued in
        /// order with the context's other calls.
        private nonisolated func onMain(
            _ body: @escaping @MainActor @Sendable (VoidhashNativeComponentContext) -> Void
        ) {
            if Thread.isMainThread {
                MainActor.assumeIsolated { body(self) }
            } else {
                DispatchQueue.main.async {
                    MainActor.assumeIsolated { body(self) }
                }
            }
        }
    }

    /// What the flow knows of the device, as a component reads it.
    @_spi(NativeComponents)
    public struct VoidhashNativeComponentEnvironment: Equatable, Sendable {
        /// The locale the flow is shown in.
        public var locale: Locale
        /// Whether the end user asked for reduced motion.
        public var reducesMotion: Bool
        /// `.light` or `.dark`.
        public var colorScheme: UIUserInterfaceStyle
        /// The direction the flow lays the component out in, which its view is set to
        /// (`semanticContentAttribute`, and on iOS 17 the layout direction trait of every view
        /// under it): the flow's, not the device's.
        public var layoutDirection: UIUserInterfaceLayoutDirection

        public init(
            locale: Locale, reducesMotion: Bool, colorScheme: UIUserInterfaceStyle,
            layoutDirection: UIUserInterfaceLayoutDirection
        ) {
            self.locale = locale
            self.reducesMotion = reducesMotion
            self.colorScheme = colorScheme
            self.layoutDirection = layoutDirection
        }
    }

    /// A component could not be registered: ``FlowViewRenderer/init(components:)``
    /// and ``FlowViewRenderer/init(registrations:)`` throw it, and no flow can
    /// place the component until the app is fixed.
    @_spi(NativeComponents)
    public struct VoidhashNativeComponentError: Error, Sendable, Equatable,
        CustomStringConvertible
    {
        /// The id the component declared.
        public let definitionId: String
        /// Why it was refused.
        public let reason: String

        public var description: String {
            return "The native component \"\(definitionId)\" could not be registered: \(reason)"
        }
    }
#endif

/// A prop or event value of a native component: what JSON can hold.
@_spi(NativeComponents)
public enum VoidhashNativeComponentValue: Equatable, Sendable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([VoidhashNativeComponentValue])
    case object([String: VoidhashNativeComponentValue])

    public var bool: Bool? {
        guard case .bool(let value) = self else { return nil }
        return value
    }

    public var number: Double? {
        guard case .number(let value) = self else { return nil }
        return value
    }

    public var string: String? {
        guard case .string(let value) = self else { return nil }
        return value
    }

    public var array: [VoidhashNativeComponentValue]? {
        guard case .array(let value) = self else { return nil }
        return value
    }

    public var object: [String: VoidhashNativeComponentValue]? {
        guard case .object(let value) = self else { return nil }
        return value
    }

    public var isNull: Bool {
        return self == .null
    }

    /// The entry `key` of an object; `nil` for anything else.
    public subscript(key: String) -> VoidhashNativeComponentValue? {
        return object?[key]
    }

    /// The value of a prop as the flow sent it; `nil` for one left undefined.
    init?(_ prop: PropValue) {
        switch prop {
        case .undefined: return nil
        case .null: self = .null
        case .bool(let value): self = .bool(value)
        case .number(let value): self = .number(value)
        case .string(let value): self = .string(value)
        case .array(let items): self = .array(items.map { Self($0) ?? .null })
        case .object(let entries): self = .object(entries.compactMapValues { Self($0) })
        }
    }

    /// `object` as a JSON object. A number JSON cannot hold (infinite or NaN) is `null`.
    static func json(_ object: [String: VoidhashNativeComponentValue]) -> String {
        let data = try? JSONSerialization.data(withJSONObject: object.mapValues(\.foundation))
        return data.map { String(decoding: $0, as: UTF8.self) } ?? "{}"
    }

    /// The value as JSON, a scalar included. A number JSON cannot hold (infinite or NaN) is
    /// `null`.
    var jsonFragment: String {
        let data = try? JSONSerialization.data(
            withJSONObject: foundation, options: [.fragmentsAllowed])
        return data.map { String(decoding: $0, as: UTF8.self) } ?? "null"
    }

    /// The value as `JSONSerialization` takes it.
    private var foundation: Any {
        switch self {
        case .null: return NSNull()
        case .bool(let flag): return flag
        case .number(let number): return number.isFinite ? number : NSNull()
        case .string(let text): return text
        case .array(let items): return items.map(\.foundation)
        case .object(let entries): return entries.mapValues(\.foundation)
        }
    }
}

@_spi(NativeComponents)
extension VoidhashNativeComponentValue: ExpressibleByNilLiteral, ExpressibleByBooleanLiteral,
    ExpressibleByIntegerLiteral, ExpressibleByFloatLiteral, ExpressibleByStringLiteral,
    ExpressibleByArrayLiteral, ExpressibleByDictionaryLiteral
{
    public init(nilLiteral: ()) {
        self = .null
    }

    public init(booleanLiteral value: Bool) {
        self = .bool(value)
    }

    public init(integerLiteral value: Int) {
        self = .number(Double(value))
    }

    public init(floatLiteral value: Double) {
        self = .number(value)
    }

    public init(stringLiteral value: String) {
        self = .string(value)
    }

    public init(arrayLiteral elements: VoidhashNativeComponentValue...) {
        self = .array(elements)
    }

    public init(dictionaryLiteral elements: (String, VoidhashNativeComponentValue)...) {
        self = .object(Dictionary(elements, uniquingKeysWith: { _, last in last }))
    }
}
