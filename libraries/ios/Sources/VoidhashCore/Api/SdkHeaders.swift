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
/// see `src/core/utils/get-common-sdk-headers.ts`. `build` returns raw values, which is what code
/// reading the distinct id back out of a header set expects; ``encodedForTransport(_:)`` makes
/// them safe to send.
public enum SdkHeaders {
    /// Header naming the identity a request acts for.
    public static let distinctIdHeader = "x-distinct-id"
    /// Header marking a percent-encoded ``distinctIdHeader`` value.
    public static let distinctIdEncodingHeader = "x-distinct-id-encoding"
    /// Header carrying the end user's ``AnalyticsConsent`` when it is not `granted`.
    public static let analyticsConsentHeader = "x-analytics-consent"

    /// Value of `x-sdk` for this platform.
    public static let sdkName = "ios"
    /// Value of `x-platform` for this platform.
    public static let platformName = "ios"

    /// - Parameters:
    ///   - publishableKey: Project publishable key.
    ///   - distinctId: Current distinct id.
    ///   - sdkName: `x-sdk`; ``sdkName`` unless a host SDK drives this one.
    ///   - sdkVersion: Version of this SDK package, or of the host SDK driving it.
    ///   - device: Device and app metadata.
    ///   - isDebugBuild: Whether the host app is a debug build.
    ///   - readOnly: Whether the SDK runs in observer mode.
    ///   - analyticsConsent: The end user's analytics consent, sent as
    ///     ``analyticsConsentHeader`` unless it is `granted`.
    ///   - nonce: Per-request nonce, injectable for tests.
    public static func build(
        publishableKey: String,
        distinctId: String,
        sdkName: String = SdkHeaders.sdkName,
        sdkVersion: String,
        device: SdkDeviceInfo,
        isDebugBuild: Bool,
        readOnly: Bool,
        analyticsConsent: AnalyticsConsent = .granted,
        nonce: String = UUID().uuidString.lowercased()
    ) -> [String: String] {
        var headers: [String: String] = [
            "x-client-bundle-id": device.bundleId,
            distinctIdHeader: distinctId,
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

        if analyticsConsent != .granted {
            headers[analyticsConsentHeader] = analyticsConsent.rawValue
        }
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

    /// Makes every header value safe to hand to `URLRequest`.
    ///
    /// `URLSession` writes header values as ISO-8859-1 and cuts a value at the first character it
    /// cannot represent, so `用户1` would go out empty and `user_张三` as `user_`. A distinct id
    /// made only of printable ASCII (`0x20`–`0x7E`) is sent as is; any other is sent as its RFC
    /// 3986 percent-encoded UTF-8 form together with `x-distinct-id-encoding: percent`, which the
    /// backend decodes. Every other value is informational (device model, app version, locales),
    /// so only its characters outside printable ASCII are percent-encoded, without a marker.
    public static func encodedForTransport(_ headers: [String: String]) -> [String: String] {
        var encoded: [String: String] = [:]
        for (name, value) in headers {
            if name.caseInsensitiveCompare(distinctIdHeader) == .orderedSame,
                !isPrintableASCII(value)
            {
                encoded[name] = percentEncoded(value, keeping: isUnreserved)
                encoded[distinctIdEncodingHeader] = "percent"
            } else {
                encoded[name] =
                    isPrintableASCII(value)
                    ? value : percentEncoded(value, keeping: isPrintableASCIIByte)
            }
        }
        return encoded
    }

    private static func isPrintableASCII(_ value: String) -> Bool {
        return value.utf8.allSatisfy(isPrintableASCIIByte)
    }

    private static func isPrintableASCIIByte(_ byte: UInt8) -> Bool {
        return (0x20...0x7E).contains(byte)
    }

    // RFC 3986 section 2.3.
    private static func isUnreserved(_ byte: UInt8) -> Bool {
        switch byte {
        case UInt8(ascii: "A")...UInt8(ascii: "Z"), UInt8(ascii: "a")...UInt8(ascii: "z"),
            UInt8(ascii: "0")...UInt8(ascii: "9"), UInt8(ascii: "-"), UInt8(ascii: "."),
            UInt8(ascii: "_"), UInt8(ascii: "~"):
            return true
        default:
            return false
        }
    }

    private static func percentEncoded(_ value: String, keeping keeps: (UInt8) -> Bool) -> String {
        let hexDigits = Array("0123456789ABCDEF".utf8)
        var bytes: [UInt8] = []
        for byte in value.utf8 {
            if keeps(byte) {
                bytes.append(byte)
            } else {
                bytes += [UInt8(ascii: "%"), hexDigits[Int(byte >> 4)], hexDigits[Int(byte & 0x0F)]]
            }
        }
        return String(decoding: bytes, as: UTF8.self)
    }
}
