# Paywall WebView Parity Checklist

Baseline: `react-native-webview` commit `5bc526fce5b9d6225df183bdf3d8cf542007d90a`

## Implemented (iOS + Android)

- Source loading (`uri`/`html` + headers, GET/POST support)
- Lifecycle callbacks (`onLoadingStart`, `onLoadingProgress`, `onLoadingFinish`, `onLoadingError`)
- HTTP error callback (`onHttpError`)
- JS bridge (`window.ReactNativeWebView.postMessage` -> native `onMessage`)
- JS injection (`injectedJavaScript`, `injectedJavaScriptBeforeContentLoaded`, imperative `injectJavaScript`)
- Imperative controls (`goBack`, `goForward`, `reload`, `stopLoading`, `requestFocus`, `loadUrl`)
- Cache/history/form controls (`clearCache`, `clearHistory`, `clearFormData`)
- Multiple windows callback (`onOpenWindow`)
- Render/content termination callbacks (`onRenderProcessGone`, `onContentProcessDidTerminate`)
- Download callback (`onFileDownload`)
- User agent controls (`userAgent`, `applicationNameForUserAgent`)
- Android parity settings (`mixedContentMode`, `androidLayerType`, `overScrollMode`, cookie/file access toggles)
- iOS media/playback toggles (`allowsInlineMediaPlayback`, `allowsPictureInPictureMediaPlayback`, `allowsAirPlayForMediaPlayback`)

## Current Gaps / Notes

- iOS full `WKDataDetectorTypes` mapping is not yet fully wired to native configuration updates.
- iOS `clearHistory`/`clearFormData` are no-op due platform API limits.
- Advanced Android file chooser flow parity is not fully ported yet (callback surface exists; full chooser lifecycle remains follow-up).
- Some advanced fullscreen/media edge cases may differ from upstream implementation details.

## Policy Behavior

- External navigation policy is enforced in JS wrapper through origin whitelist checks and external browser fallback.
- Component hard-fails at runtime when Fabric/New Architecture is unavailable.
