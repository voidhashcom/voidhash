import Foundation

/// Device and app metadata reported to the backend on every SDK request.
public struct SdkDeviceInfo: Sendable, Equatable {
    /// Host app bundle identifier.
    public let bundleId: String
    /// Host app build number (`CFBundleVersion`).
    public let appBuild: String?
    /// Host app display name (`CFBundleDisplayName`, falling back to `CFBundleName`).
    public let appName: String?
    /// Host app version (`CFBundleShortVersionString`).
    public let appVersion: String?
    /// Operating system version.
    public let systemVersion: String?
    /// Device manufacturer, always `Apple` on this platform.
    public let deviceBrand: String?
    /// Device model identifier, e.g. `iPhone15,2`.
    public let deviceName: String?
    /// Preferred locale identifiers, most preferred first.
    public let locales: [String]

    public init(
        bundleId: String,
        appBuild: String? = nil,
        appName: String? = nil,
        appVersion: String? = nil,
        systemVersion: String? = nil,
        deviceBrand: String? = nil,
        deviceName: String? = nil,
        locales: [String] = []
    ) {
        self.bundleId = bundleId
        self.appBuild = appBuild
        self.appName = appName
        self.appVersion = appVersion
        self.systemVersion = systemVersion
        self.deviceBrand = deviceBrand
        self.deviceName = deviceName
        self.locales = locales
    }

    /// Reads the metadata of the currently running app and device.
    ///
    /// Everything is read through `Bundle`, `ProcessInfo` and `uname` rather than `UIDevice`, so
    /// the SDK can build its headers from any thread.
    public static func current(bundle: Bundle = .main) -> SdkDeviceInfo {
        func info(_ key: String) -> String? {
            return bundle.object(forInfoDictionaryKey: key) as? String
        }

        return SdkDeviceInfo(
            bundleId: bundle.bundleIdentifier ?? "",
            appBuild: info("CFBundleVersion"),
            appName: info("CFBundleDisplayName") ?? info("CFBundleName"),
            appVersion: info("CFBundleShortVersionString"),
            systemVersion: operatingSystemVersion(),
            deviceBrand: "Apple",
            deviceName: deviceModelIdentifier(),
            locales: Locale.preferredLanguages
        )
    }

    /// `major.minor` — with the patch component appended when there is one — matching the
    /// `Platform.Version` string the React Native SDK reports.
    static func operatingSystemVersion(
        _ version: OperatingSystemVersion = ProcessInfo.processInfo.operatingSystemVersion
    ) -> String {
        let base = "\(version.majorVersion).\(version.minorVersion)"
        return version.patchVersion == 0 ? base : "\(base).\(version.patchVersion)"
    }

    /// Hardware identifier from `uname`, e.g. `iPhone15,2`. Simulators report the model they
    /// simulate rather than the host architecture.
    static func deviceModelIdentifier(
        environment: [String: String] = ProcessInfo.processInfo.environment
    ) -> String? {
        if let simulated = environment["SIMULATOR_MODEL_IDENTIFIER"], !simulated.isEmpty {
            return simulated
        }

        var systemInfo = utsname()
        guard uname(&systemInfo) == 0 else {
            return nil
        }

        let identifier = withUnsafeBytes(of: &systemInfo.machine) { buffer in
            String(cString: buffer.baseAddress!.assumingMemoryBound(to: CChar.self))
        }
        return identifier.isEmpty ? nil : identifier
    }
}

/// Builds the common header set sent to `/api/v1/sdk/*`.
///
/// Header names and values are a wire contract shared with the React Native and Android SDKs —
/// see `src/core/utils/get-common-sdk-headers.ts`.
public enum SdkHeaders {
    /// Value of `x-sdk` for this platform.
    public static let sdkName = "ios"
    /// Value of `x-platform` for this platform.
    public static let platformName = "ios"

    /// - Parameters:
    ///   - publishableKey: Project publishable key.
    ///   - distinctId: Current distinct id.
    ///   - sdkVersion: Version of this SDK package.
    ///   - device: Device and app metadata.
    ///   - isDebugBuild: Whether the host app is a debug build.
    ///   - readOnly: Whether the SDK runs in observer mode.
    ///   - environment: Backend environment, `production` in v0.
    ///   - nonce: Per-request nonce, injectable for tests.
    public static func build(
        publishableKey: String,
        distinctId: String,
        sdkVersion: String,
        device: SdkDeviceInfo,
        isDebugBuild: Bool,
        readOnly: Bool,
        environment: String = "production",
        nonce: String = UUID().uuidString.lowercased()
    ) -> [String: String] {
        var headers: [String: String] = [
            "x-client-bundle-id": device.bundleId,
            "x-distinct-id": distinctId,
            "x-environment": environment,
            "x-is-backgrounded": "false",
            "x-is-debug-build": isDebugBuild ? "true" : "false",
            "x-nonce": nonce,
            "x-observer-mode": readOnly ? "true" : "false",
            "x-platform": platformName,
            "x-platform-flavor": "native",
            "x-publishable-key": publishableKey,
            "x-sdk": sdkName,
            "x-sdk-version": sdkVersion,
        ]

        if let appVersion = device.appVersion {
            headers["x-client-version"] = appVersion
            headers["x-platform-flavor-version"] = appVersion
        }
        if let systemVersion = device.systemVersion {
            headers["x-platform-version"] = systemVersion
        }
        if let deviceBrand = device.deviceBrand {
            headers["x-platform-brand"] = deviceBrand
        }
        if let deviceName = device.deviceName {
            headers["x-platform-device"] = deviceName
        }
        if let clientLocale = device.locales.first {
            headers["x-client-locale"] = clientLocale
        }
        if !device.locales.isEmpty {
            headers["x-preferred-locales"] = device.locales.joined(separator: ",")
        }

        return headers
    }
}
