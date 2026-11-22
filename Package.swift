// swift-tools-version: 6.0
import PackageDescription

// Installs the iOS SDK from this repository's URL. The sources live in libraries/ios, whose own
// manifest serves local and npm installs; keep products, platforms and resources the same in both.
let package = Package(
    name: "Voidhash",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [
        .library(name: "VoidhashCore", targets: ["VoidhashCore"]),
        .library(name: "Voidhash", targets: ["Voidhash"]),
    ],
    targets: [
        .target(
            name: "VoidhashCore",
            path: "libraries/ios/Sources/VoidhashCore",
            resources: [.copy("PrivacyInfo.xcprivacy")]
        ),
        .target(
            name: "Voidhash",
            dependencies: ["VoidhashCore"],
            path: "libraries/ios/Sources/Voidhash"
        ),
    ]
)

// The prebuilt core of VoidhashUI, the flow renderer: an asset of this repository's release of
// the same version, set by each release. Until the first release has one, the package offers no
// VoidhashUI product. The sources live in libraries/ios-ui, whose own manifest links a local build.
let voidhashUICore: (url: String, checksum: String)? = (
    url: "https://github.com/voidhashcom/voidhash/releases/download/0.3.0/VoidhashUICore.xcframework.zip",
    checksum: "f83b485801fbd12fadb88a248f702e0f0289a9c52fa27e315d78478811c18271"
)

if let voidhashUICore {
    package.products.append(.library(name: "VoidhashUI", targets: ["VoidhashUI"]))
    package.targets += [
        .binaryTarget(
            name: "VoidhashUICore",
            url: voidhashUICore.url,
            checksum: voidhashUICore.checksum
        ),
        .target(
            name: "VoidhashUI",
            dependencies: [
                "Voidhash",
                "VoidhashCore",
                .target(name: "VoidhashUICore", condition: .when(platforms: [.iOS])),
            ],
            path: "libraries/ios-ui/Sources/VoidhashUI",
            linkerSettings: [
                .linkedFramework("CoreText"),
                .linkedFramework("QuartzCore", .when(platforms: [.iOS])),
            ]
        ),
    ]
}
