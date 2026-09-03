import Foundation
import VoidhashCore

/// Host app and device metadata as the React Native SDK reports it; the Nitro-free shape of the
/// `NativePlatformInfo` struct the `VoidhashPlatform` hybrid returns.
struct NativePlatformSnapshot: Equatable, Sendable {
    let bundleId: String
    let appBuild: String?
    let appName: String?
    let appVersion: String?
    let systemVersion: String?
    let deviceBrand: String?
    let deviceName: String?
    let locales: [String]
    let isDebugBuild: Bool
    let urlSchemes: [String]
}

/// The Nitro-free heart of `HybridVoidhashPlatform`: reads the platform metadata from the same
/// ``SdkDeviceInfo`` the Swift SDK builds its headers from, plus the URL schemes the app registers.
///
/// Kept separate from the hybrid so the React Native Swift package can unit test it without
/// React Native or Nitro; the hybrid only maps the snapshot into the generated struct.
enum VoidhashPlatformCore {
    /// Whether this binary was compiled with the `DEBUG` configuration.
    static var isDebugBuild: Bool {
        #if DEBUG
            return true
        #else
            return false
        #endif
    }

    /// Builds the snapshot; every input is injectable for tests.
    static func snapshot(
        device: SdkDeviceInfo = .current(),
        infoDictionary: [String: Any]? = Bundle.main.infoDictionary,
        isDebugBuild: Bool = VoidhashPlatformCore.isDebugBuild
    ) -> NativePlatformSnapshot {
        return NativePlatformSnapshot(
            bundleId: device.bundleId,
            appBuild: device.appBuild,
            appName: device.appName,
            appVersion: device.appVersion,
            systemVersion: device.systemVersion,
            deviceBrand: device.deviceBrand,
            deviceName: device.deviceName,
            locales: device.locales,
            isDebugBuild: isDebugBuild,
            urlSchemes: urlSchemes(from: infoDictionary)
        )
    }

    /// Every scheme declared under `CFBundleURLTypes`, in declaration order, blanks dropped.
    static func urlSchemes(from infoDictionary: [String: Any]?) -> [String] {
        let urlTypes = infoDictionary?["CFBundleURLTypes"] as? [[String: Any]] ?? []
        return urlTypes
            .flatMap { $0["CFBundleURLSchemes"] as? [String] ?? [] }
            .filter { !$0.isEmpty }
    }
}
