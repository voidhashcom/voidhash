#if canImport(SwiftUI)
    import Foundation
    import SwiftUI

    struct VoidhashScreenModifier: ViewModifier {
        let name: String
        let title: String?
        @State private var identity = UUID().uuidString

        func body(content: Content) -> some View {
            content.onAppear {
                guard let client = Voidhash.shared else {
                    return
                }
                let view = ScreenView(
                    identity: identity, name: name, title: title, source: .swiftui)
                Task { await client.trackScreen(view) }
            }
        }
    }

    extension View {
        /// Reports this view as a screen when it appears.
        ///
        /// The identity is bound to the modifier instance, so a view that re-appears without
        /// being recreated does not emit twice in a row. Once any screen has been reported this
        /// way, automatic capture stops counting hosting controllers as screens.
        public func voidhashScreen(_ name: String, title: String? = nil) -> some View {
            return modifier(VoidhashScreenModifier(name: name, title: title))
        }
    }
#endif
