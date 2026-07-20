# Bare React Native integration

Install `@voidhash/react-native`, pods, and the Android Gradle dependencies, then make the same native changes produced by the Expo plugin.

On iOS, add associated domains and URL schemes, forward application/scene/SwiftUI URLs to the Voidhash link collector, add `aps-environment` and remote-notification background mode when push is enabled, forward APNs registration/receipt/open callbacks, and set the SKAdNetwork and AdAttributionKit HTTPS postback origins. Select StoreKit 1, StoreKit 2, or disabled purchase observation explicitly. A strict-no-IDFA build must not link an IDFA collector.

On Android, add verified App Link/custom-scheme intent filters and forward `onNewIntent`, register the lifecycle collector before React starts, configure Firebase and notification permission/channel policy, explicitly include or remove AD_ID, retain the measurement database under `noBackupFilesDir`, and include Google Play referrer plus only the requested optional-store providers. Select Billing 8 or disabled observation explicitly.

Configure cloud or self-host origins through `endpoints`. Origins must not contain credentials, path, query, or fragment; production uses HTTPS. Self-host deployments configure rotating signed-measurement keys and a positive configuration version. Run `npx voidhash-doctor`; resolve every error before building the release archive/APK.
