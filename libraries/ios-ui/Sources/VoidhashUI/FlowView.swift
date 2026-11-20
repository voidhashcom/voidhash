#if os(iOS)
    import Foundation
    import QuartzCore
    import UIKit
    import Voidhash
    import VoidhashCore
    import VoidhashUICore

    /// A view that shows a Voidhash flow package with UIKit's own views.
    ///
    /// The package is interpreted and laid out by the views core, which after every frame hands
    /// the view the operations that bring its subviews up to date; the view draws them with
    /// UIKit and Core Animation, measures and draws text with Core Text, scrolls with UIKit and
    /// serves VoiceOver from its subviews. It speaks the flow bridge envelopes
    /// (`{"version":1,"type":…}`): what the flow emits arrives in ``onMessage``, and
    /// ``postMessage(_:)`` delivers the host's `configure` and `status` answers. The view itself
    /// reports the device's locale, Reduce Motion setting and appearance to the flow, and
    /// again whenever one of them changes.
    ///
    /// Most apps never create one: ``FlowViewRenderer`` presents it for the SDK. Use
    /// it directly only to embed a flow in your own view hierarchy. The view must be used on
    /// the main thread; it runs frames while it is in a window.
    public final class FlowView: UIView {
        /// Newest flow package format version this renderer reads.
        public nonisolated static var packageAbiVersion: Int {
            return Int(vhv_package_abi_version())
        }

        /// Oldest flow package format version this renderer reads.
        public nonisolated static var minPackageAbiVersion: Int {
            return Int(vhv_min_package_abi_version())
        }

        /// What a view without app components can run, as the SDK reports it when resolving a
        /// paywall: the renderer's own components, and in module mode the runtime bridge
        /// version, so the server serves releases by the runtime module they name.
        /// ``FlowViewRenderer`` reports what its views show, its app components included.
        public nonisolated static var engineCapabilities: FlowEngineCapabilities {
            return NativeComponentRegistry.capabilities(of: nil)
        }

        /// The flow runtime flows are shown with, process-wide: ``RuntimeMode/linked``, the one
        /// built into the SDK (the default), or ``RuntimeMode/module``, flow runtime modules the
        /// SDK downloads, verifies and caches. Set it before the SDK resolves its first flow.
        ///
        /// In module mode an app component cannot write its props back to the flow, and a text
        /// field in a package format only the module reads gets its keyboard set up when it is
        /// first focused.
        public nonisolated static var runtimeMode: RuntimeMode {
            get { vhv_runtime_mode() == 1 ? .module : .linked }
            set { vhv_set_runtime_mode(newValue == .module ? 1 : 0) }
        }

        /// Which flow runtime shows flows; see ``runtimeMode``.
        public enum RuntimeMode: Sendable {
            /// The flow runtime built into the SDK.
            case linked
            /// Flow runtime modules: each release names the one it needs, which the SDK
            /// downloads once, verifies and caches, and runs in its interpreter.
            case module
        }

        /// Whether the flow's time stands still. While it is held, nothing in the flow that
        /// waits on time moves on: an app call's timeout, a timed step, an animation. Touches
        /// still reach the flow, at the held moment. When it is released, the flow's time runs
        /// on from where it stood. Hosts that stand in for the app, such as a preview where a
        /// person answers app calls by hand, hold it while the person answers.
        public var isClockHeld: Bool = false {
            didSet {
                guard isClockHeld != oldValue else {
                    return
                }
                let now = CACurrentMediaTime()
                if isClockHeld {
                    clockHeldSince = now
                } else if let heldSince = clockHeldSince {
                    clockOffset += now - heldSince
                    clockHeldSince = nil
                }
                requestFrames()
            }
        }

        /// When the flow's time was held, on the display link's clock; `nil` while it runs.
        private var clockHeldSince: CFTimeInterval?
        /// How long the flow's time stood still in all, which it lags the display link's clock by.
        private var clockOffset: CFTimeInterval = 0

        /// The flow's time of a moment on the display link's clock.
        func flowTime(_ real: CFTimeInterval) -> CFTimeInterval {
            return min(real, clockHeldSince ?? real) - clockOffset
        }

        /// Receives every envelope the flow emits, as JSON (`ready`, `purchase`, `finish`,
        /// `state`, …). Image requests are served by the view and not reported.
        public var onMessage: ((String) -> Void)?

        /// Receives renderer failures: a package that cannot be shown, a frame that failed, an
        /// image that could not be loaded, operations the view could not apply.
        public var onError: ((String) -> Void)?

        /// Receives the reason, once, when the flow can no longer be shown: several frames
        /// in a row failed. A flow in that state takes no input either, its own close
        /// control included, so take the view down. It changes nothing more until another
        /// package is loaded.
        public var onFailure: ((String) -> Void)?

        // Destroyed in `deinit`, which is not main-actor isolated; the view is only ever
        // released on the main thread, which is the thread the surface belongs to.
        private nonisolated(unsafe) var surface: OpaquePointer?
        private nonisolated(unsafe) var displayLink: CADisplayLink?
        /// Resumes the paused display link when a component's timer is due.
        private nonisolated(unsafe) var wakeTimer: Timer?
        private nonisolated(unsafe) var imageRequests: [String: Task<Void, Never>] = [:]
        private nonisolated(unsafe) var settingsObservers: [NSObjectProtocol] = []
        /// Measures and draws text, for the core's layout and for the text views alike. The
        /// surface's callbacks reach it through an unretained pointer, so it lives as long as
        /// the view, which destroys the surface first.
        let textSystem = TextSystem()
        private lazy var tree = ViewTree(host: self)
        /// Animates screens in and out, and moves them with gestures.
        private(set) lazy var transitions = TransitionCoordinator(container: self)
        private var images: [String: UIImage] = [:]
        /// `data:` URLs whose image did not decode, reported once.
        private var undecodableImages: Set<String> = []
        private var operationBuffer = [UInt8](repeating: 0, count: 64 * 1024)
        private var messageBuffer = [UInt8](repeating: 0, count: 4096)
        private let imageSession: URLSession
        private let imageStore: FlowImageStore?
        /// The last `context` envelope sent, so unchanged settings are not sent again.
        private var postedContext: String?
        private var frameFailures = FrameFailures()
        private var lastPointerId: Int64 = 0
        /// The app's components, by the renderer name the core gives their external views.
        private let components: [String: VoidhashNativeComponentRegistration]
        /// Components the view was given that its registry refused, reported on the first load.
        private var refusedComponents: [VoidhashNativeComponentError] = []
        /// Renderers no component provides, reported once.
        private var missingRenderers: Set<String> = []
        /// Something asked for a frame while one ran; the frame loop must not pause after it.
        private var framePending = false
        /// Follows the system keyboard, whose height the flow lays out above.
        private(set) var keyboardInset: FlowKeyboardInset?
        /// Hears taps outside every text field, before the press of the same tap.
        let tapOutside = TapOutsideRecognizer()
        /// The text field that has the keyboard.
        private(set) weak var focusedField: TextInputNodeView?
        /// The focused field is kept clear of the keyboard after the next batch: the keyboard
        /// or the focus moved.
        private var revealPending = false
        /// Safe-area insets used instead of the view's own, to render at fixed insets.
        var safeAreaOverride: UIEdgeInsets? {
            didSet { updateViewport() }
        }

        /// Creates the view and its views core.
        ///
        /// - Parameters:
        ///   - imageSession: Session the images the flow shows are downloaded with. Defaults
        ///     to the SDK's download session, which gives up on an image after 60 seconds. Only
        ///     `http` and `https` images are loaded, and none larger than 10 MB.
        ///   - imageStore: Where the SDK keeps flow images on the device. An image it holds
        ///     is shown without a request, so also while its host cannot be reached, and a
        ///     downloaded one is stored there. `nil`, the default, downloads every image.
        public convenience init(
            frame: CGRect = .zero, imageSession: URLSession = NetworkPolicy.downloadSession,
            imageStore: FlowImageStore? = nil
        ) {
            self.init(
                frame: frame, imageSession: imageSession, imageStore: imageStore, registrations: [])
        }

        /// Creates the view and its views core, also showing the app's own components, in a
        /// registry of the view's own; otherwise as ``init(frame:imageSession:imageStore:)``.
        /// A component the registry refuses (see
        /// ``FlowViewRenderer/init(components:)``) is reported to ``onError`` when
        /// the first package loads, and flows show what they fall back to instead.
        @_spi(NativeComponents)
        public convenience init(
            frame: CGRect = .zero, imageSession: URLSession = NetworkPolicy.downloadSession,
            imageStore: FlowImageStore? = nil, components: [any VoidhashNativeComponent.Type]
        ) {
            self.init(
                frame: frame, imageSession: imageSession, imageStore: imageStore,
                registrations: components.map(VoidhashNativeComponentRegistration.init))
        }

        /// Creates the view and its views core, showing the app's own components each created
        /// by its registration's factory; otherwise as
        /// ``init(frame:imageSession:imageStore:components:)``.
        @_spi(NativeComponents)
        public convenience init(
            frame: CGRect = .zero, imageSession: URLSession = NetworkPolicy.downloadSession,
            imageStore: FlowImageStore? = nil, registrations: [VoidhashNativeComponentRegistration]
        ) {
            var refused: [VoidhashNativeComponentError] = []
            let registry = NativeComponentRegistry(
                registering: registrations, refused: { refused.append($0) })
            self.init(
                frame: frame, imageSession: imageSession, imageStore: imageStore,
                registry: registry)
            refusedComponents = refused
        }

        /// A view showing the components of `registry`, which its surface keeps a reference
        /// to; the view itself does not keep the registry.
        init(
            frame: CGRect = .zero, imageSession: URLSession = NetworkPolicy.downloadSession,
            imageStore: FlowImageStore? = nil, registry: NativeComponentRegistry
        ) {
            self.imageSession = imageSession
            self.imageStore = imageStore
            components = registry.components
            super.init(frame: frame)
            isMultipleTouchEnabled = true
            backgroundColor = .black
            addSubview(tree.root)
            registerDefaultFonts()
            var host = VhvHost(
                context: Unmanaged.passUnretained(textSystem).toOpaque(),
                measure_text: { context, request in
                    guard let context, let request = request?.pointee else {
                        return VhvTextSize(width: 0, height: 0)
                    }
                    let system = Unmanaged<TextSystem>.fromOpaque(context).takeUnretainedValue()
                    let size = system.measure(
                        utf8(request.text, request.text_length),
                        style: TextStyle(request: request),
                        maxWidth: CGFloat(request.max_width))
                    return VhvTextSize(width: Float(size.width), height: Float(size.height))
                },
                register_font: { context, family, familyLength, data, length in
                    guard let context, let data, length > 0 else {
                        return false
                    }
                    let system = Unmanaged<TextSystem>.fromOpaque(context).takeUnretainedValue()
                    let registered = system.fonts.register(
                        family: utf8(family, familyLength), data: Data(bytes: data, count: length))
                    system.fontsChanged()
                    return registered
                })
            surface = vhv_surface_create(&host, registry.pointer)
            transitions.onDismissed = { [weak self] screen in
                self?.screenEvent(screen.id, "dismissed", closing: false)
            }
            keyboardInset = FlowKeyboardInset(view: self) { [weak self] in
                self?.keyboardInsetChanged()
            }
            tapOutside.onTap = { [weak self] in self?.tappedOutsideTextFields() }
            addGestureRecognizer(tapOutside)
            observeSettings()
        }

        @available(*, unavailable)
        required init?(coder: NSCoder) {
            fatalError("init(coder:) has not been implemented")
        }

        deinit {
            for observer in settingsObservers {
                NotificationCenter.default.removeObserver(observer)
            }
            displayLink?.invalidate()
            wakeTimer?.invalidate()
            for request in imageRequests.values {
                request.cancel()
            }
            // The app's components are told they are disposed, as on a reset.
            if Thread.isMainThread {
                MainActor.assumeIsolated { tree.release() }
            }
            if let surface {
                vhv_surface_destroy(surface)
            }
        }

        /// Validates `package` and shows it. An invalid package leaves the current one on screen.
        ///
        /// - Throws: ``FlowViewError`` with the core's reason.
        public func load(package: Data) throws {
            try load(package: package, runtimeSha256: "")
        }

        /// Shows `package` with the runtime its release needs: in module mode, the module
        /// ``RuntimeModules/prepare(_:using:)`` got for the release's module `runtimeSha256`
        /// (empty for a release naming none, which runs the module the SDK bundles); otherwise
        /// as ``load(package:)``.
        ///
        /// - Throws: ``FlowViewError`` with the core's reason.
        public func load(package: Data, runtimeSha256: String) throws {
            let surface = try requireSurface()
            for refused in refusedComponents {
                onError?(refused.description)
            }
            refusedComponents = []
            var sha256 = Array(runtimeSha256.utf8)
            let loaded = package.withUnsafeBytes { bytes in
                vhv_surface_load_package_for(
                    surface, bytes.bindMemory(to: UInt8.self).baseAddress, bytes.count,
                    &sha256, sha256.count)
            }
            guard loaded else {
                throw FlowViewError(message: Self.lastError())
            }
            frameFailures = FrameFailures()
            if window != nil {
                startDisplayLink()
            }
            requestFrames()
        }

        /// Delivers a host → flow bridge envelope, such as `configure` or `status`.
        public func postMessage(_ message: String) {
            guard let surface else {
                return
            }
            var utf8 = Array(message.utf8)
            if !vhv_surface_post_message(surface, &utf8, utf8.count) {
                onError?("Rejected flow message: \(Self.lastError())")
            }
            requestFrames()
        }

        /// The default font, which the core carries, registered for this view only.
        private func registerDefaultFonts() {
            for index in 0..<vhv_default_font_count() {
                var font = VhvFont()
                guard vhv_default_font(index, &font), let bytes = font.data else {
                    continue
                }
                // The core keeps the bytes for the life of the process.
                let data = Data(
                    bytesNoCopy: UnsafeMutableRawPointer(mutating: bytes), count: font.length,
                    deallocator: .none)
                textSystem.fonts.register(
                    family: FontRegistry.defaultFamily, data: data, weight: Int(font.weight))
            }
        }

        // MARK: - Layout

        override public func layoutSubviews() {
            super.layoutSubviews()
            updateViewport()
        }

        override public func safeAreaInsetsDidChange() {
            super.safeAreaInsetsDidChange()
            updateViewport()
        }

        override public func didMoveToWindow() {
            super.didMoveToWindow()
            if window != nil {
                // The window decides the appearance the view inherits.
                postContext()
                updateViewport()
                startDisplayLink()
            } else {
                stopDisplayLink()
                // No keyboard covers a view that is not on screen.
                keyboardInset?.reset()
            }
        }

        private func updateViewport() {
            guard let surface, bounds.width > 0, bounds.height > 0 else {
                return
            }
            tree.layoutRoot(in: CGRect(origin: .zero, size: bounds.size))
            let insets = safeAreaOverride ?? safeAreaInsets
            vhv_surface_set_viewport(
                surface,
                Float(bounds.width), Float(bounds.height),
                Float(insets.top), Float(insets.right), Float(insets.bottom), Float(insets.left),
                Float(displayScale))
            requestFrames()
        }

        // MARK: - Device settings

        private func observeSettings() {
            let center = NotificationCenter.default
            for name in FlowBridge.contextNotifications {
                settingsObservers.append(
                    center.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                        MainActor.assumeIsolated { self?.postContext() }
                    })
            }
            if #available(iOS 17.0, *) {
                registerForTraitChanges([UITraitUserInterfaceStyle.self]) {
                    (view: FlowView, _: UITraitCollection) in
                    view.postContext()
                }
            }
            postContext()
        }

        @available(iOS, deprecated: 17.0, message: "Trait changes are registered for on iOS 17")
        override public func traitCollectionDidChange(_ previous: UITraitCollection?) {
            super.traitCollectionDidChange(previous)
            if traitCollection.userInterfaceStyle != previous?.userInterfaceStyle {
                postContext()
            }
        }

        /// Sends the flow the settings ABI 2 components read as `$context`.
        private func postContext() {
            guard let message = FlowBridge.contextEnvelope(for: traitCollection),
                message != postedContext
            else {
                return
            }
            postedContext = message
            postMessage(message)
        }

        // MARK: - Frames

        private func startDisplayLink() {
            guard displayLink == nil, !frameFailures.reachedLimit else {
                return
            }
            let link = CADisplayLink(
                target: ViewsDisplayLinkTarget(view: self),
                selector: #selector(ViewsDisplayLinkTarget.tick(_:)))
            link.add(to: .main, forMode: .common)
            displayLink = link
        }

        private func stopDisplayLink() {
            displayLink?.invalidate()
            displayLink = nil
            wakeTimer?.invalidate()
            wakeTimer = nil
        }

        /// Resumes the display link after something changed that the next frame must show.
        private func requestFrames() {
            framePending = true
            wakeTimer?.invalidate()
            wakeTimer = nil
            displayLink?.isPaused = false
        }

        /// Keeps the display link paused until `wake` (on the flow's clock), when a
        /// component's timer is due; input, messages and layout changes resume it earlier.
        private func scheduleWake(at wake: CFTimeInterval) {
            wakeTimer?.invalidate()
            wakeTimer = nil
            // Nothing falls due while the flow's time stands still.
            guard wake.isFinite, displayLink != nil, clockHeldSince == nil else {
                return
            }
            let delay = max(0, wake + clockOffset - CACurrentMediaTime())
            let timer = Timer(timeInterval: delay, repeats: false) { [weak self] _ in
                MainActor.assumeIsolated { self?.requestFrames() }
            }
            // Common modes, so the timer also fires while a scroll tracks the touch.
            RunLoop.main.add(timer, forMode: .common)
            wakeTimer = timer
        }

        /// Whether the display link runs frames: it exists while the view is in a window, and
        /// runs while the core wants another frame.
        var runsFrames: Bool {
            return displayLink.map { !$0.isPaused } ?? false
        }

        func displayLinkFired(timestamp: CFTimeInterval) {
            guard surface != nil else {
                stopDisplayLink()
                return
            }
            guard let wantsNext = runFrame(at: timestamp) else {
                // The display link keeps running: the next frame shows what this one could
                // not, or is the next failure in the row.
                if frameFailures.reachedLimit {
                    stopDisplayLink()
                }
                return
            }
            // Idle until input, a message, a layout change or a component's timer needs
            // another frame.
            let idle = !wantsNext && !framePending
            displayLink?.isPaused = idle
            if idle, let surface {
                scheduleWake(at: vhv_surface_wake_time(surface))
            }
        }

        /// Runs one frame of the core at `timestamp` (seconds on `CACurrentMediaTime`'s clock,
        /// the flow's time while its clock is held), applies its operations and handles its
        /// messages. Returns whether the core wants
        /// another frame, or `nil` when the frame failed.
        @discardableResult
        func runFrame(at timestamp: CFTimeInterval) -> Bool? {
            guard let surface, !frameFailures.reachedLimit else {
                return nil
            }
            framePending = false
            // The keyboard is sliding: the flow follows it frame by frame.
            let keyboardMoving = keyboardInset?.isAnimating == true
            if keyboardMoving, let keyboardInset {
                vhv_surface_set_keyboard_inset(surface, Float(keyboardInset.current))
            }
            let flags = vhv_surface_frame(surface, flowTime(timestamp))
            if flags & UInt32(VHV_FRAME_ERROR) != 0 {
                let reason = Self.lastError()
                onError?("Paywall frame failed: \(reason)")
                if frameFailures.frameFailed() {
                    onFailure?("\(FrameFailures.limit) frames in a row failed: \(reason)")
                }
                return nil
            }
            frameFailures.frameSucceeded()
            if flags & UInt32(VHV_FRAME_HAS_OPERATIONS) != 0 {
                applyOperations(surface)
            }
            if flags & UInt32(VHV_FRAME_HAS_MESSAGES) != 0 {
                drainMessages(surface)
            }
            if revealPending {
                revealFocusedField()
                revealPending = keyboardMoving
            }
            return flags & UInt32(VHV_FRAME_WANTS_NEXT) != 0 || framePending || keyboardMoving
        }

        private func applyOperations(_ surface: OpaquePointer) {
            var length = vhv_surface_take_operations(
                surface, &operationBuffer, operationBuffer.count)
            if length > operationBuffer.count {
                operationBuffer = [UInt8](repeating: 0, count: length)
                length = vhv_surface_take_operations(
                    surface, &operationBuffer, operationBuffer.count)
            }
            let batch: (operations: [ViewOperation], skipped: [String])
            do {
                batch = try OperationBatch.decode(Array(operationBuffer[0..<length]))
            } catch {
                onError?("Paywall view operations could not be read: \(error)")
                return
            }
            let changes = tree.apply(batch.operations)
            let issues = batch.skipped + changes.issues
            if !issues.isEmpty {
                onError?("Paywall view operations skipped: \(issues.joined(separator: "; "))")
            }
            if changes.reset {
                transitions.reset()
                UIAccessibility.post(notification: .screenChanged, argument: nil)
            }
            for screen in changes.deletedScreens {
                transitions.remove(screen)
            }
            for screen in changes.enteredScreens {
                transitions.enter(screen)
            }
            for screen in changes.closingScreens {
                let id = screen.id
                transitions.leave(screen) { [weak self] in
                    self?.screenEvent(id, "transitionEnd", closing: true)
                }
            }
            transitions.update(screens: tree.screens)
        }

        // MARK: - Text fields and the keyboard

        /// Tells the flow how much of its bottom the keyboard covers, so its content ends above
        /// the keyboard, and keeps the focused field clear of it.
        private func keyboardInsetChanged() {
            guard let surface, let keyboardInset else {
                return
            }
            vhv_surface_set_keyboard_inset(surface, Float(keyboardInset.current))
            revealPending = true
            requestFrames()
        }

        private func tappedOutsideTextFields() {
            guard let surface, focusedField?.field.isFirstResponder == true else {
                return
            }
            vhv_surface_text_tap_outside(surface)
            requestFrames()
        }

        /// Scrolls the focused field into view within its nearest scroll view, above the
        /// keyboard. The flow already ends its content at the keyboard's top, so this only
        /// moves a scroll view's offset; nothing else avoids the keyboard.
        private func revealFocusedField() {
            guard let field = focusedField, field.window != nil else {
                return
            }
            var ancestor = field.superview
            while let current = ancestor, !(current is ScrollNodeView) {
                ancestor = current.superview
            }
            guard let scrollNode = ancestor as? ScrollNodeView,
                scrollNode.props["scrollDirection"]?.string != "horizontal"
            else {
                return
            }
            let scroll = scrollNode.scrollView
            let visible = scroll.convert(scroll.bounds, to: self)
            let keyboardTop = bounds.height - (keyboardInset?.current ?? 0)
            let bottom = min(visible.maxY, keyboardTop)
            let frame = field.convert(field.bounds, to: self)
            var delta: CGFloat = 0
            if frame.maxY > bottom {
                // Its bottom above the keyboard, unless that pushes its top out of view.
                delta = min(frame.maxY - bottom, frame.minY - visible.minY)
            } else if frame.minY < visible.minY {
                delta = frame.minY - visible.minY
            }
            guard delta != 0 else {
                return
            }
            let maxOffset = max(
                -scroll.adjustedContentInset.top,
                scroll.contentSize.height + scroll.adjustedContentInset.bottom - scroll.bounds.height)
            scroll.contentOffset.y = min(
                max(scroll.contentOffset.y + delta, -scroll.adjustedContentInset.top), maxOffset)
        }

        // MARK: - Accessibility

        /// The escape gesture goes back, as the platform's back gesture does.
        override public func accessibilityPerformEscape() -> Bool {
            guard transitions.canGoBack else {
                return false
            }
            postMessage(#"{"version":1,"type":"back","payload":{}}"#)
            return true
        }

        private func screenEvent(_ id: Int32, _ event: String, closing: Bool) {
            guard let surface else {
                return
            }
            var bytes = Array(event.utf8)
            _ = vhv_surface_screen_event(surface, id, &bytes, bytes.count, closing)
            requestFrames()
        }

        private func drainMessages(_ surface: OpaquePointer) {
            while true {
                var length = vhv_surface_take_message(
                    surface, &messageBuffer, messageBuffer.count)
                if length == 0 {
                    return
                }
                if length > messageBuffer.count {
                    messageBuffer = [UInt8](repeating: 0, count: length)
                    length = vhv_surface_take_message(
                        surface, &messageBuffer, messageBuffer.count)
                }
                let message = String(decoding: messageBuffer[0..<length], as: UTF8.self)
                if let url = FlowBridge.imageRequestUrl(message) {
                    loadImage(url)
                } else {
                    onMessage?(message)
                }
            }
        }

        // MARK: - Images

        private func loadImage(_ urlString: String) {
            guard imageRequests[urlString] == nil, images[urlString] == nil else {
                return
            }
            let session = imageSession
            let store = imageStore
            imageRequests[urlString] = Task { [weak self] in
                let result: Result<UIImage?, any Error>
                do {
                    let data = try await FlowImageLoader.load(
                        urlString, using: session, store: store)
                    result = .success(await Self.decode(data))
                } catch {
                    result = .failure(error)
                }
                guard !Task.isCancelled else {
                    return
                }
                self?.provideImage(urlString, result: result)
            }
        }

        /// Decodes an image off the main thread, ready to draw.
        private nonisolated static func decode(_ data: Data) async -> UIImage? {
            guard let image = UIImage(data: data) else {
                return nil
            }
            return image.preparingForDisplay() ?? image
        }

        private func provideImage(_ url: String, result: Result<UIImage?, any Error>) {
            switch result {
            case .success(let image?):
                images[url] = image
                imageRequests[url] = nil
                showLoadedImage(url)
            case .success(nil):
                onError?("Could not decode flow image \(url)")
                // Bytes that do not decode must not be what the store hands back on every
                // later presentation, and the next request for the image starts over, from
                // the network.
                imageRequests[url] = nil
                if let imageStore {
                    Task { await imageStore.remove(at: url) }
                }
            case .failure(let error):
                // Left out of the cache of requests so a later request for it tries again.
                imageRequests[url] = nil
                onError?("Could not load flow image \(url): \(error.localizedDescription)")
            }
        }

        /// Tells the core and every view showing `url` that it is loaded.
        func showLoadedImage(_ url: String) {
            guard let surface else {
                return
            }
            var bytes = Array(url.utf8)
            _ = vhv_surface_image_loaded(surface, &bytes, bytes.count)
            tree.imageLoaded(url)
            requestFrames()
        }

        /// The tree the operations built.
        var viewTree: ViewTree {
            return tree
        }

        // MARK: - Errors

        private func requireSurface() throws -> OpaquePointer {
            guard let surface else {
                throw FlowViewError(
                    message: "The views core could not be created: \(Self.lastError())")
            }
            return surface
        }

        nonisolated static func lastError() -> String {
            var buffer = [UInt8](repeating: 0, count: 512)
            var length = vhv_last_error(&buffer, buffer.count)
            if length > buffer.count {
                buffer = [UInt8](repeating: 0, count: length)
                length = vhv_last_error(&buffer, buffer.count)
            }
            guard length > 0 else {
                return "unknown error"
            }
            return String(decoding: buffer[0..<min(length, buffer.count)], as: UTF8.self)
        }
    }

    extension FlowView: NodeHost {
        var displayScale: CGFloat {
            return window?.screen.scale ?? traitCollection.displayScale
        }

        func image(for url: String) -> UIImage? {
            if let image = images[url] {
                return image
            }
            guard url.hasPrefix("data:"), !undecodableImages.contains(url) else {
                return nil
            }
            // A `data:` URL carries its image: decoded here, once, with no request and no
            // `image_loaded` call.
            guard let data = FlowImageData.decode(dataURL: url), let image = UIImage(data: data)
            else {
                undecodableImages.insert(url)
                onError?("Could not decode a flow image from a data URL")
                return nil
            }
            images[url] = image
            return image
        }

        func press(_ handler: UInt32) {
            guard let surface else {
                return
            }
            vhv_surface_press(surface, handler)
            requestFrames()
        }

        func pointer(_ handler: UInt32, pointer: Int64, phase: UInt8, at location: CGPoint) {
            guard let surface else {
                return
            }
            _ = vhv_surface_pointer(
                surface, handler, pointer, phase, Float(location.x), Float(location.y))
            requestFrames()
        }

        func accessibilityAction(_ handler: UInt32, name: String) -> Bool {
            guard let surface else {
                return false
            }
            var bytes = Array(name.utf8)
            let taken = vhv_surface_accessibility_action(surface, handler, &bytes, bytes.count)
            requestFrames()
            return taken
        }

        func nativeComponent(renderer: String) -> VoidhashNativeComponentRegistration? {
            if let component = components[renderer] {
                return component
            }
            // Its props stay out of the report: they may hold the end user's data.
            if missingRenderers.insert(renderer).inserted {
                onError?(
                    "No native component registered with this view provides renderer "
                        + "\"\(renderer)\"; it shows nothing")
            }
            return nil
        }

        func componentEvent(_ id: Int32, name: String, payload: String) {
            guard let surface else {
                return
            }
            var nameBytes = Array(name.utf8)
            var payloadBytes = Array(payload.utf8)
            let result = vhv_surface_deliver_component_event(
                surface, id, &nameBytes, nameBytes.count, &payloadBytes, payloadBytes.count)
            // An ignored event (the flow ended, or the component stopped running) is dropped.
            // The payload stays out of the report: it may hold the end user's data.
            if Int(result) == Int(VHV_COMPONENT_EVENT_FAILED) {
                onError?(
                    "The flow could not take the event \"\(name)\" of a native component: "
                        + Self.lastError())
            }
            requestFrames()
        }

        func writeComponentProp(_ id: Int32, name: String, json: String) {
            guard let surface else {
                return
            }
            var nameBytes = Array(name.utf8)
            var jsonBytes = Array(json.utf8)
            let result = vhv_surface_write_component_prop(
                surface, id, &nameBytes, nameBytes.count, &jsonBytes, jsonBytes.count)
            // An ignored write (a prop it may not write, the value already held, the flow
            // ended) changes nothing. The value stays out of the report: it may hold the end
            // user's data.
            if Int(result) == Int(VHV_COMPONENT_PROP_FAILED) {
                onError?(
                    "The flow could not take the write of prop \"\(name)\" of a native "
                        + "component: " + Self.lastError())
            }
            requestFrames()
        }

        func componentSize(_ id: Int32, _ size: CGSize) {
            guard let surface else {
                return
            }
            guard vhv_surface_set_component_size(surface, id, Float(size.width), Float(size.height))
            else {
                onError?("The size of a native component was refused: \(Self.lastError())")
                return
            }
            requestFrames()
        }

        func nextPointerId() -> Int64 {
            lastPointerId += 1
            return lastPointerId
        }

        func textFocused(_ field: TextInputNodeView) {
            focusedField = field
            revealPending = true
            guard let surface else {
                return
            }
            _ = vhv_surface_text_focused(surface, field.id)
            requestFrames()
        }

        func textBlurred(_ field: TextInputNodeView) {
            if focusedField === field {
                focusedField = nil
            }
            guard let surface else {
                return
            }
            // False when the surface already moved the keyboard on; nothing to do then.
            _ = vhv_surface_text_blurred(surface, field.id)
            requestFrames()
        }

        func textChanged(
            _ field: TextInputNodeView, _ state: TextFieldState, edit: TextEdit?, byUser: Bool
        ) -> UInt64? {
            guard let surface else {
                return nil
            }
            var bytes = Array(state.text.utf8)
            let base = UInt32(clamping: state.selectionBase)
            let extent = UInt32(clamping: state.selectionExtent)
            let revision: UInt64
            if let edit {
                revision = vhv_surface_text_edited(
                    surface, field.id, &bytes, bytes.count, base, extent,
                    UInt32(clamping: edit.replaced.lowerBound),
                    UInt32(clamping: edit.replaced.upperBound),
                    UInt32(clamping: edit.insertedLength), state.composing, byUser)
            } else {
                revision = vhv_surface_text_changed(
                    surface, field.id, &bytes, bytes.count, base, extent, state.composing, byUser)
            }
            requestFrames()
            return revision == UInt64.max ? nil : revision
        }

        func textAction(_ field: TextInputNodeView, _ action: String) {
            guard let surface else {
                return
            }
            var bytes = Array(action.utf8)
            _ = vhv_surface_text_action(surface, field.id, &bytes, bytes.count)
            requestFrames()
        }
    }

    /// A failure reported by the flow's views core.
    public struct FlowViewError: Error, Sendable, Equatable,
        CustomStringConvertible
    {
        /// The core's reason.
        public let message: String

        public var description: String {
            return "PAYWALL_RENDER_FAILED: \(message)"
        }
    }

    /// Breaks the retain cycle between a display link, which retains its target, and the view.
    private final class ViewsDisplayLinkTarget: NSObject {
        private weak var view: FlowView?

        init(view: FlowView) {
            self.view = view
        }

        @MainActor @objc func tick(_ link: CADisplayLink) {
            guard let view else {
                link.invalidate()
                return
            }
            view.displayLinkFired(timestamp: link.timestamp)
        }
    }

    /// The bytes of `data:` URLs (RFC 2397).
    enum FlowImageData {
        /// The bytes `url` carries, base64 or percent-encoded; `nil` when it is not a `data:`
        /// URL or its payload is malformed.
        static func decode(dataURL url: String) -> Data? {
            guard url.hasPrefix("data:"), let comma = url.firstIndex(of: ",") else {
                return nil
            }
            let header = url[url.index(url.startIndex, offsetBy: 5)..<comma]
            let payload = String(url[url.index(after: comma)...])
            if header.split(separator: ";").contains(where: { $0.lowercased() == "base64" }) {
                return Data(
                    base64Encoded: payload.removingPercentEncoding ?? payload,
                    options: .ignoreUnknownCharacters)
            }
            return payload.removingPercentEncoding.map { Data($0.utf8) }
        }
    }

    /// UTF-8 bytes the core passed, valid during the call.
    private func utf8(_ bytes: UnsafePointer<UInt8>?, _ length: Int) -> String {
        guard let bytes, length > 0 else {
            return ""
        }
        return String(decoding: UnsafeBufferPointer(start: bytes, count: length), as: UTF8.self)
    }

    extension TextStyle {
        /// The style of a measure request.
        init(request: VhvTextRequest) {
            self.init()
            family = utf8(request.font_family, request.font_family_length)
            size = request.font_size
            weight = request.font_weight
            italic = request.italic != 0
            lineHeight = request.line_height
            letterSpacing = request.letter_spacing
            alignment = Alignment(rawValue: request.text_align) ?? .left
            maxLines = request.max_lines
            if let runs = request.runs, request.run_count > 0 {
                self.runs = UnsafeBufferPointer(start: runs, count: request.run_count).map { run in
                    TextRun(
                        start: Int(run.start), end: Int(run.end),
                        weight: run.font_weight == 0 ? nil : run.font_weight,
                        italic: run.italic == 0 ? nil : run.italic == 2,
                        color: run.has_color == 1 ? run.color : nil,
                        underline: UInt32(run.lines) & UInt32(VHV_TEXT_LINE_UNDERLINE) != 0,
                        lineThrough: UInt32(run.lines) & UInt32(VHV_TEXT_LINE_THROUGH) != 0)
                }
            }
        }
    }
#endif
