import Foundation
import NitroModules

/// Exposes the bare-native platform metadata to the React Native SDK. The behaviour lives in
/// ``VoidhashPlatformCore``; this class only maps its snapshot into the Nitro struct.
final class HybridVoidhashPlatform: HybridVoidhashPlatformSpec {
    func getInfo() throws -> NativePlatformInfo {
        let snapshot = VoidhashPlatformCore.snapshot()
        return NativePlatformInfo(
            bundleId: snapshot.bundleId,
            appBuild: snapshot.appBuild,
            appName: snapshot.appName,
            appVersion: snapshot.appVersion,
            systemVersion: snapshot.systemVersion,
            deviceBrand: snapshot.deviceBrand,
            deviceName: snapshot.deviceName,
            locales: snapshot.locales,
            isDebugBuild: snapshot.isDebugBuild,
            urlSchemes: snapshot.urlSchemes
        )
    }
}
