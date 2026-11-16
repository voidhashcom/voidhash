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
