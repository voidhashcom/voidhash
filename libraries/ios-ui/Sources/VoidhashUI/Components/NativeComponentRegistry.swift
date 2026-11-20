#if os(iOS)
    import VoidhashCore
    import VoidhashUICore

    /// The app components one renderer provides: the core's registry of them, and their
    /// registrations by the renderer name their external views carry.
    ///
    /// Ownership: this object holds the host's one handle to the core's registry and releases
    /// it when the object goes. A renderer keeps it for as long as it lives, and reads its
    /// capabilities from it. A view only passes it to `vhv_surface_create`: the surface keeps a
    /// reference of its own, so a surface outlives the registry object, and the registry
    /// object outlives any surface, without either keeping the other.
    final class NativeComponentRegistry: Sendable {
        /// The core's registry, as the bit pattern of its pointer (so the object stays
        /// `Sendable`: the core lets a registry be used from any thread); 0 when the core could
        /// not create one, which then shows only its linked components.
        private let handle: UInt
        /// The registered components, by their renderer name: their definition id. One id has
        /// one registration, so the name alone finds the view to create.
        let components: [String: VoidhashNativeComponentRegistration]

        /// Registers `registrations` in a new registry; `refused` hears each one the core or the
        /// uniqueness of ids refuses, which is then left out.
        init(
            registering registrations: [VoidhashNativeComponentRegistration],
            refused: (VoidhashNativeComponentError) throws -> Void
        ) rethrows {
            let created = vhv_components_create()
            handle = UInt(bitPattern: created)
            var components: [String: VoidhashNativeComponentRegistration] = [:]
            for registration in registrations {
                let id = registration.definitionId
                guard components[id] == nil else {
                    try refused(
                        VoidhashNativeComponentError(
                            definitionId: id, reason: "two components declare this id"))
                    continue
                }
                guard let created else {
                    try refused(
                        VoidhashNativeComponentError(
                            definitionId: id,
                            reason: "the registry could not be created: "
                                + FlowView.lastError()))
                    continue
                }
                var idBytes = Array(id.utf8)
                var version = Array(registration.version.utf8)
                // The external view names its renderer by the definition id, which a view
                // finds the component by.
                var renderer = Array(id.utf8)
                guard
                    vhv_components_register(
                        created, &idBytes, idBytes.count, &version, version.count, &renderer,
                        renderer.count)
                else {
                    try refused(
                        VoidhashNativeComponentError(
                            definitionId: id, reason: FlowView.lastError()))
                    continue
                }
                components[id] = registration
            }
            self.components = components
        }

        deinit {
            if let pointer {
                vhv_components_release(pointer)
            }
        }

        /// The core's registry, for `vhv_surface_create`; `nil` shows only linked components.
        var pointer: OpaquePointer? {
            return OpaquePointer(bitPattern: handle)
        }

        /// What a surface of this registry shows, as the SDK reports it: the linked components
        /// and the registered ones.
        var capabilities: FlowEngineCapabilities {
            return Self.capabilities(of: pointer)
        }

        /// The capabilities of a surface created with `registry`; `nil` lists only the
        /// components linked into the core.
        static func capabilities(of registry: OpaquePointer?) -> FlowEngineCapabilities {
            var buffer = [UInt8](repeating: 0, count: 1024)
            var length = vhv_components_capabilities(registry, &buffer, buffer.count)
            if length > buffer.count {
                buffer = [UInt8](repeating: 0, count: length)
                length = vhv_components_capabilities(registry, &buffer, buffer.count)
            }
            let list = String(decoding: buffer[0..<min(length, buffer.count)], as: UTF8.self)
            return FlowEngineCapabilities(
                packageAbiVersion: Int(vhv_package_abi_version()),
                guestAbiVersion: Int(vhv_guest_abi_version()),
                nativeComponents: list.split(separator: ",").map(String.init),
                runtimeBridgeVersion: FlowView.runtimeMode == .module
                    ? Int(vhv_runtime_bridge_version()) : nil)
        }
    }
#endif
