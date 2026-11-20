<p align="center">
  <picture>
    <source srcset="./banner-dark.png" media="(prefers-color-scheme: dark)">
    <source srcset="./banner.png" media="(prefers-color-scheme: light)">
    <img src="./banner.png" alt="Voidhash Logo">
  </picture>
</p>

<h2 align="center">Voidhash SDKs and CLI</h2>

<p align="center">
  In-app purchases, subscriptions, paywalls, entitlements and analytics for your apps and backends.
  <br />
  <br />
  <a href="https://voidhash.com"><strong>Website</strong></a>
  ·
  <a href="https://voidhash.com/docs">Documentation</a>
  ·
  <a href="https://x.com/voidhashcom">Twitter</a>
</p>

This repository holds the source of the libraries you install to integrate
Voidhash, and the example apps that use them. Voidhash is in alpha: APIs can
still change between releases.

## SDKs

| Platform         | Package                                  | Source                                             |
| ---------------- | ---------------------------------------- | -------------------------------------------------- |
| React Native     | `@voidhash/react-native`                 | [`libraries/react-native`](libraries/react-native) |
| iOS (Swift)      | Swift package from this repository       | [`libraries/ios`](libraries/ios)                   |
| Android (Kotlin) | `com.voidhash:voidhash` on Maven Central | [`libraries/android`](libraries/android)           |
| Web              | `@voidhash/web`                          | [`libraries/web`](libraries/web)                   |
| Node.js          | `@voidhash/node`                         | [`libraries/node`](libraries/node)                 |
| Go               | `github.com/voidhashcom/voidhash-go`     | [`libraries/go`](libraries/go)                     |
| PHP              | `voidhash/voidhash-php`                  | [`libraries/php`](libraries/php)                   |
| Rust             | `voidhash`                               | [`libraries/rust`](libraries/rust)                 |

The [`voidhash-cli`](apps/cli) package manages your projects from the terminal,
in scripts and in CI.

Each library's README covers installation and usage; the
[documentation](https://voidhash.com/docs) has quickstarts for every platform.

## Examples

Every example implements the same small notes app with a Pro tier, so you can
read the one in your language and recognise the shape of the others:
[React Native](examples/app-react-native), [iOS](examples/app-ios),
[Android](examples/app-android), [Web](examples/app-web),
[Node.js](examples/backend-node), [Go](examples/backend-go),
[PHP](examples/backend-php) and [Rust](examples/backend-rust).

## Contributing

Issues and pull requests are welcome; see the [contributing guide](CONTRIBUTING.md).
Report vulnerabilities privately as described in the [security policy](SECURITY.md).

## License

The SDKs, the CLI and the examples are [MIT-licensed](LICENSE.md).
