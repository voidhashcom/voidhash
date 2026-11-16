// swift-tools-version: 6.0
import PackageDescription

// The repository root carries a second manifest over these sources, so the SDK installs from the
// repository URL. Keep its products, platforms and resources the same as here.
let package = Package(
    name: "Voidhash",
    platforms: [.iOS(.v15), .macOS(.v13)],
    products: [
        .library(name: "VoidhashCore", targets: ["VoidhashCore"]),
        .library(name: "Voidhash", targets: ["Voidhash"]),
    ],
    targets: [
        .target(name: "VoidhashCore", resources: [.copy("PrivacyInfo.xcprivacy")]),
        .target(name: "Voidhash", dependencies: ["VoidhashCore"]),
    ]
)
