// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "voidhash-conformance",
    targets: [
        .target(name: "ConformanceCore"),
        .testTarget(
            name: "ConformanceTests",
            dependencies: ["ConformanceCore"]
        ),
    ]
)
