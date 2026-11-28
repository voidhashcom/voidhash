# VoidhashUI

The native renderer of the Voidhash iOS SDK: it presents paywalls and flows with UIKit's own
views, on a prebuilt core that lays them out and runs them.

Install it as the **VoidhashUI** product of the Swift package at
`https://github.com/voidhashcom/voidhash`, next to **Voidhash**, at the same exact version:

```swift
.product(name: "Voidhash", package: "voidhash"),
.product(name: "VoidhashUI", package: "voidhash"),
```

Linking it is enough: `presentFlow()` finds the renderer without an option. The
[iOS SDK's README](../ios/README.md#paywalls-and-flows) covers installation, presenting paywalls and
customizing the renderer, and the [documentation](https://voidhash.com/docs/sdks/swift/paywalls)
has the full guide.

The prebuilt core is an asset of each release, which the package's manifest names with its
checksum. Third-party licenses of the core are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

[MIT](LICENSE.md)
