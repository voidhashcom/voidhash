import Foundation
import Testing

@testable import VoidhashCore

@Suite("SDK headers")
struct SdkHeadersTests {
    private let device = SdkDeviceInfo(
        bundleId: "com.voidhash.example",
        appVersion: "1.2.3",
        systemVersion: "17.4",
        deviceBrand: "Apple",
        deviceName: "iPhone",
        locales: ["en-US", "de-DE"]
    )

    private func build(isDebugBuild: Bool = false, readOnly: Bool = false) -> [String: String] {
        return SdkHeaders.build(
            publishableKey: "pk_test",
            distinctId: "vh:anon:abc",
            sdkVersion: "0.0.1-alpha.1",
            device: device,
            isDebugBuild: isDebugBuild,
            readOnly: readOnly,
            nonce: "11111111-1111-4111-8111-111111111111"
        )
    }

    @Test("emits the full common header set")
    func fullHeaderSet() {
        let headers = build()

        #expect(
            headers == [
                "x-client-bundle-id": "com.voidhash.example",
                "x-client-locale": "en-US",
                "x-client-version": "1.2.3",
                "x-distinct-id": "vh:anon:abc",
                "x-environment": "production",
                "x-is-backgrounded": "false",
                "x-is-debug-build": "false",
                "x-nonce": "11111111-1111-4111-8111-111111111111",
                "x-observer-mode": "false",
                "x-platform": "ios",
                "x-platform-brand": "Apple",
                "x-platform-device": "iPhone",
                "x-platform-flavor": "native",
                "x-platform-flavor-version": "1.2.3",
                "x-platform-version": "17.4",
                "x-preferred-locales": "en-US,de-DE",
                "x-publishable-key": "pk_test",
                "x-sdk": "ios",
                "x-sdk-version": "0.0.1-alpha.1",
            ])
    }

    @Test("read-only mode sets observer mode")
    func observerMode() {
        #expect(build(readOnly: true)["x-observer-mode"] == "true")
        #expect(build(readOnly: false)["x-observer-mode"] == "false")
    }

    @Test("debug builds are flagged")
    func debugBuild() {
        #expect(build(isDebugBuild: true)["x-is-debug-build"] == "true")
        #expect(build(isDebugBuild: false)["x-is-debug-build"] == "false")
    }

    @Test("optional device metadata is omitted rather than sent empty")
    func minimalDevice() {
        let headers = SdkHeaders.build(
            publishableKey: "pk_test",
            distinctId: "user-123",
            sdkVersion: "0.0.1-alpha.1",
            device: SdkDeviceInfo(bundleId: "com.voidhash.example"),
            isDebugBuild: false,
            readOnly: false,
            nonce: "nonce"
        )

        #expect(headers["x-client-version"] == nil)
        #expect(headers["x-platform-version"] == nil)
        #expect(headers["x-platform-brand"] == nil)
        #expect(headers["x-platform-device"] == nil)
        #expect(headers["x-client-locale"] == nil)
        #expect(headers["x-preferred-locales"] == nil)
        #expect(headers["x-client-bundle-id"] == "com.voidhash.example")
    }

    @Test("the current device info reads app and system metadata off the main thread")
    func currentDeviceInfo() async {
        // `current()` has to be callable from any task: it is the default for the client's
        // dependencies and runs wherever the first request is built.
        let info = await Task.detached { SdkDeviceInfo.current() }.value

        #expect(info.deviceBrand == "Apple")
        #expect(info.systemVersion?.isEmpty == false)
        #expect(info.deviceName?.isEmpty == false)
        #expect(info.locales == Locale.preferredLanguages)
    }

    @Test("the operating system version drops a zero patch component")
    func operatingSystemVersionFormatting() {
        #expect(
            SdkDeviceInfo.operatingSystemVersion(
                OperatingSystemVersion(majorVersion: 17, minorVersion: 4, patchVersion: 0))
                == "17.4")
        #expect(
            SdkDeviceInfo.operatingSystemVersion(
                OperatingSystemVersion(majorVersion: 17, minorVersion: 4, patchVersion: 1))
                == "17.4.1")
    }

    @Test("the device model prefers the simulated model over the host hardware")
    func deviceModelIdentifier() {
        #expect(
            SdkDeviceInfo.deviceModelIdentifier(
                environment: ["SIMULATOR_MODEL_IDENTIFIER": "iPhone15,2"]) == "iPhone15,2")
        #expect(SdkDeviceInfo.deviceModelIdentifier(environment: [:])?.isEmpty == false)
    }

    @Test("a generated nonce is a lowercase uuid")
    func generatedNonce() {
        let headers = SdkHeaders.build(
            publishableKey: "pk_test",
            distinctId: "user-123",
            sdkVersion: "0.0.1-alpha.1",
            device: device,
            isDebugBuild: false,
            readOnly: false
        )
        let nonce = headers["x-nonce"] ?? ""

        #expect(UUID(uuidString: nonce) != nil)
        #expect(nonce == nonce.lowercased())
    }
}
