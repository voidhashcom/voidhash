import Foundation
import NitroModules
import VoidhashCore

class HybridPaywallPresenter: HybridPaywallPresenterSpec {
    private let presenter = PaywallPresenterCore()

    func preload(locationSlug: String, htmlUrl: String) throws -> Promise<Bool> {
        Promise.async {
            do {
                return try await self.presenter.preload(
                    locationSlug: locationSlug, htmlUrl: htmlUrl)
            } catch let error as VoidhashStoreError {
                throw RuntimeError.error(withMessage: error.description)
            }
        }
    }

    func show(
        locationSlug: String,
        htmlUrl: String,
        onBridgeEvent: ((_ rawEvent: String) -> Void)?,
        onDismiss: (() -> Void)?
    ) throws -> Promise<Bool> {
        let bridgeEventHandler: PaywallBridgeEventHandler? = onBridgeEvent.map { callback in
            { @Sendable rawEvent in callback(rawEvent) }
        }
        let dismissHandler: PaywallDismissHandler? = onDismiss.map { callback in
            { @Sendable in callback() }
        }

        return Promise.async {
            do {
                return try await self.presenter.show(
                    locationSlug: locationSlug,
                    htmlUrl: htmlUrl,
                    onBridgeEvent: bridgeEventHandler,
                    onDismiss: dismissHandler
                )
            } catch let error as VoidhashStoreError {
                throw RuntimeError.error(withMessage: error.description)
            }
        }
    }

    func dismiss() throws -> Promise<Void> {
        Promise.async {
            do {
                try await self.presenter.dismiss()
            } catch let error as VoidhashStoreError {
                throw RuntimeError.error(withMessage: error.description)
            }
        }
    }

    func release(locationSlug: String) throws {
        presenter.release(locationSlug: locationSlug)
    }

    func postMessage(locationSlug: String, data: String) throws {
        presenter.postMessage(locationSlug: locationSlug, data: data)
    }
}
