import Foundation
import NitroModules
import UserNotifications
import UIKit

final class HybridNotifications: HybridNotificationsSpec {
    private var listeners: [String: (NativeNotificationEvent) -> Void] = [:]
    private lazy var collectorSubscription = VoidhashPushCollector.shared.subscribe { [weak self] event in
        guard let self else { return }
        let kind: NativeNotificationEventKind
        let errorCode: String?
        switch event {
        case .tokenChanged:
            kind = .tokenchanged
            errorCode = nil
        case .registrationError(let code):
            kind = .registrationerror
            errorCode = code
        }
        let observed = NativeNotificationEvent(
            id: "notification_\(UUID().uuidString.lowercased())",
            kind: kind,
            occurredAt: ISO8601DateFormatter().string(from: Date()),
            protectedPayloadRef: nil,
            pushNotificationSendId: nil,
            link: nil,
            errorCode: errorCode
        )
        self.listeners.values.forEach { $0(observed) }
    }

    init() { _ = collectorSubscription }

    deinit { VoidhashPushCollector.shared.unsubscribe(collectorSubscription) }

    func getPermissionStatus() throws -> Promise<String> {
        Promise.async {
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            switch settings.authorizationStatus {
            case .authorized: return "authorized"
            case .provisional, .ephemeral: return "provisional"
            case .denied: return "denied"
            case .notDetermined: return "notDetermined"
            @unknown default: return "notDetermined"
            }
        }
    }

    func requestPermission(provisional: Bool) throws -> Promise<String> {
        Promise.async {
            var options: UNAuthorizationOptions = [.alert, .badge, .sound]
            if provisional { options.insert(.provisional) }
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: options)
            if granted {
                await MainActor.run { UIApplication.shared.registerForRemoteNotifications() }
            }
            return granted ? (provisional ? "provisional" : "authorized") : "denied"
        }
    }

    func getToken() throws -> Promise<NativePushToken> {
        Promise.async {
            guard let observed = VoidhashPushCollector.shared.currentToken() else {
                throw RuntimeError.error(withMessage: "PUSH_TOKEN_NOT_OBSERVED")
            }
            return NativePushToken(
                token: observed.token,
                provider: .apns,
                environment: observed.environment == .development ? .development : .production
            )
        }
    }

    func setBadgeCount(count: Double) throws -> Promise<Void> {
        guard count >= 0, count.rounded() == count else {
            throw RuntimeError.error(withMessage: "INVALID_BADGE_COUNT")
        }
        return Promise.async {
            if #available(iOS 16.0, *) {
                try await UNUserNotificationCenter.current().setBadgeCount(Int(count))
            } else {
                await MainActor.run { UIApplication.shared.applicationIconBadgeNumber = Int(count) }
            }
        }
    }

    func subscribe(subscriptionId: String, listener: @escaping (NativeNotificationEvent) -> Void) throws {
        listeners[subscriptionId] = listener
    }

    func unsubscribe(subscriptionId: String) throws { listeners.removeValue(forKey: subscriptionId) }
}
