import * as P from "effect/Predicate";
import * as Option from "effect/Option";
import React, { forwardRef } from "react";
import { ActivityIndicator, Linking, Platform, StyleSheet, Text, View } from "react-native";

import type {
  PaywallWebViewErrorEvent,
  PaywallWebViewBaseEvent,
  PaywallWebViewFileDownloadEvent,
  PaywallWebViewHttpErrorEvent,
  PaywallWebViewNavigationEvent,
  PaywallWebViewMessageEvent,
  PaywallWebViewOpenWindowEvent,
  PaywallWebViewProgressEvent,
  PaywallWebViewRenderProcessGoneEvent,
  PaywallWebViewShouldStartLoadRequest,
} from "../../specs/PaywallWebView.nitro";
import { PaywallWebViewHost, type PaywallWebViewHostRef } from "./PaywallWebViewHost";
import { styles } from "./styles";
import type { PaywallWebViewImperativeRef, PaywallWebViewProps } from "./types";
import { createNativeEvent, normalizeSource, wrapNitroCallback } from "./utils";
import { compileWhitelist, passesWhitelist } from "./whitelist";

const defaultOriginWhitelist = ["http://*", "https://*"];
const PaywallWebViewNativeComponent = PaywallWebViewHost;

type ViewState = "IDLE" | "LOADING" | "ERROR";

function defaultRenderLoading() {
  return (
    <View style={styles.loadingOrErrorView}>
      <ActivityIndicator />
    </View>
  );
}

function defaultRenderError(domain: Option.Option<string>, code: number, description: string) {
  return (
    <View style={styles.loadingOrErrorView}>
      <Text style={styles.errorTextTitle}>Error loading page</Text>
      <Text style={styles.errorText}>{`Domain: ${Option.getOrElse(domain, () => "N/A")}`}</Text>
      <Text style={styles.errorText}>{`Error Code: ${code}`}</Text>
      <Text style={styles.errorText}>{`Description: ${description}`}</Text>
    </View>
  );
}

export const PaywallWebView = forwardRef<PaywallWebViewImperativeRef, PaywallWebViewProps>(
  (
    {
      source,
      originWhitelist = defaultOriginWhitelist,
      style,
      containerStyle,
      javaScriptEnabled = true,
      cacheEnabled = true,
      incognito = false,
      userAgent,
      applicationNameForUserAgent,
      injectedJavaScript,
      injectedJavaScriptBeforeContentLoaded,
      injectedJavaScriptForMainFrameOnly = true,
      injectedJavaScriptBeforeContentLoadedForMainFrameOnly = true,
      mediaPlaybackRequiresUserAction = true,
      allowsInlineMediaPlayback = false,
      allowsPictureInPictureMediaPlayback = true,
      allowsAirPlayForMediaPlayback = true,
      allowsFullscreenVideo = false,
      setSupportMultipleWindows = true,
      setBuiltInZoomControls = true,
      setDisplayZoomControls = false,
      scalesPageToFit = true,
      thirdPartyCookiesEnabled = true,
      sharedCookiesEnabled = false,
      allowFileAccess = false,
      allowFileAccessFromFileURLs = false,
      allowUniversalAccessFromFileURLs = false,
      textZoom = 100,
      geolocationEnabled = false,
      pullToRefreshEnabled = false,
      nestedScrollEnabled = false,
      bounces = true,
      dataDetectorTypes = ["phoneNumber"],
      onLoadStart,
      onLoad,
      onLoadEnd,
      onLoadProgress,
      onError,
      onHttpError,
      onMessage,
      onOpenWindow,
      onFileDownload,
      onRenderProcessGone,
      onContentProcessDidTerminate,
      onShouldStartLoadWithRequest,
      startInLoadingState = false,
      renderLoading,
      renderError,
    },
    ref,
  ) => {
    // Nitro Views rely on Fabric/New Architecture.
    if (!("nativeFabricUIManager" in globalThis)) {
      throw new TypeError(
        "PaywallWebView requires React Native New Architecture (Fabric) enabled.",
      );
    }

    const hybridViewRef = React.useRef<PaywallWebViewHostRef>(undefined);
    const [viewState, setViewState] = React.useState<ViewState>(
      startInLoadingState ? "LOADING" : "IDLE",
    );
    const [lastErrorEvent, setLastErrorEvent] = React.useState<
      Option.Option<PaywallWebViewErrorEvent>
    >(Option.none());
    const startUrl = React.useRef<string>(undefined);

    const sourceNormalized = React.useMemo(() => normalizeSource(source), [source]);
    const compiledWhitelist = React.useMemo(
      () => compileWhitelist(originWhitelist),
      [originWhitelist],
    );

    const onHybridRef = React.useCallback((hybridRef: PaywallWebViewHostRef) => {
      hybridViewRef.current = hybridRef;
    }, []);

    const onLoadingStart = React.useCallback(
      (event: PaywallWebViewNavigationEvent) => {
        startUrl.current = event.url;
        onLoadStart?.(createNativeEvent(event));
      },
      [onLoadStart],
    );

    const onLoadingFinish = React.useCallback(
      (event: PaywallWebViewNavigationEvent) => {
        onLoad?.(createNativeEvent(event));
        onLoadEnd?.(createNativeEvent(event));

        if (Platform.OS !== "android" || event.url === startUrl.current) {
          setViewState("IDLE");
        }
      },
      [onLoad, onLoadEnd],
    );

    const onLoadingError = React.useCallback(
      (event: PaywallWebViewErrorEvent) => {
        onError?.(createNativeEvent(event));
        setViewState("ERROR");
        setLastErrorEvent(Option.some(event));
      },
      [onError],
    );

    const onLoadingProgress = React.useCallback(
      (event: PaywallWebViewProgressEvent) => {
        if (Platform.OS === "android" && event.progress === 1) {
          setViewState((prev) => (prev === "LOADING" ? "IDLE" : prev));
        }
        onLoadProgress?.(createNativeEvent(event));
      },
      [onLoadProgress],
    );

    const onShouldStartLoad = React.useCallback(
      (event: PaywallWebViewShouldStartLoadRequest) => {
        const { url } = event;

        if (!passesWhitelist(compiledWhitelist, url)) {
          Linking.canOpenURL(url)
            .then((supported) => {
              if (supported) {
                return Linking.openURL(url);
              }
              return undefined;
            })
            .catch(() => {
              // Best effort only; navigation is still blocked in webview.
            });
          return false;
        }

        if (onShouldStartLoadWithRequest) {
          return onShouldStartLoadWithRequest(event);
        }

        return true;
      },
      [compiledWhitelist, onShouldStartLoadWithRequest],
    );

    React.useImperativeHandle(
      ref,
      (): PaywallWebViewImperativeRef => ({
        clearCache(includeDiskFiles: boolean) {
          hybridViewRef.current?.clearCache(includeDiskFiles);
        },
        clearFormData() {
          hybridViewRef.current?.clearFormData();
        },
        clearHistory() {
          hybridViewRef.current?.clearHistory();
        },
        goBack() {
          hybridViewRef.current?.goBack();
        },
        goForward() {
          hybridViewRef.current?.goForward();
        },
        injectJavaScript(javascript: string) {
          hybridViewRef.current?.injectJavaScript(javascript);
        },
        loadUrl(url: string) {
          hybridViewRef.current?.loadUrl(url);
        },
        postMessage(data: string) {
          hybridViewRef.current?.postMessage(data);
        },
        reload() {
          setViewState("LOADING");
          hybridViewRef.current?.reload();
        },
        requestFocus() {
          hybridViewRef.current?.requestFocus();
        },
        stopLoading() {
          hybridViewRef.current?.stopLoading();
        },
      }),
      [],
    );

    const otherView =
      viewState === "LOADING"
        ? (renderLoading ?? defaultRenderLoading)()
        : viewState === "ERROR" && Option.isSome(lastErrorEvent)
          ? (renderError ?? defaultRenderError)(
              Option.fromUndefinedOr(lastErrorEvent.value.domain),
              lastErrorEvent.value.code,
              lastErrorEvent.value.description,
            )
          : undefined;

    return (
      <View style={[styles.container, containerStyle]}>
        <View style={StyleSheet.flatten([styles.webView, style])}>
          <PaywallWebViewNativeComponent
            style={styles.webView}
            allowFileAccess={allowFileAccess}
            allowFileAccessFromFileURLs={allowFileAccessFromFileURLs}
            allowUniversalAccessFromFileURLs={allowUniversalAccessFromFileURLs}
            allowsAirPlayForMediaPlayback={allowsAirPlayForMediaPlayback}
            allowsFullscreenVideo={allowsFullscreenVideo}
            allowsInlineMediaPlayback={allowsInlineMediaPlayback}
            allowsPictureInPictureMediaPlayback={allowsPictureInPictureMediaPlayback}
            androidLayerType="none"
            applicationNameForUserAgent={applicationNameForUserAgent}
            bounces={bounces}
            cacheEnabled={cacheEnabled}
            cacheMode="LOAD_DEFAULT"
            dataDetectorTypes={dataDetectorTypes}
            geolocationEnabled={geolocationEnabled}
            hybridRef={wrapNitroCallback(onHybridRef)}
            incognito={incognito}
            injectedJavaScript={injectedJavaScript}
            injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
            injectedJavaScriptBeforeContentLoadedForMainFrameOnly={
              injectedJavaScriptBeforeContentLoadedForMainFrameOnly
            }
            injectedJavaScriptForMainFrameOnly={injectedJavaScriptForMainFrameOnly}
            javaScriptEnabled={javaScriptEnabled}
            mediaPlaybackRequiresUserAction={mediaPlaybackRequiresUserAction}
            messagingEnabled={P.isFunction(onMessage)}
            mixedContentMode="never"
            nestedScrollEnabled={nestedScrollEnabled}
            onContentProcessDidTerminate={wrapNitroCallback(
              onContentProcessDidTerminate
                ? (event: PaywallWebViewBaseEvent) => {
                    onContentProcessDidTerminate(createNativeEvent(event));
                  }
                : undefined,
            )}
            onFileDownload={wrapNitroCallback(
              onFileDownload
                ? (event: PaywallWebViewFileDownloadEvent) => {
                    onFileDownload(createNativeEvent(event));
                  }
                : undefined,
            )}
            onHttpError={wrapNitroCallback(
              onHttpError
                ? (event: PaywallWebViewHttpErrorEvent) => {
                    onHttpError(createNativeEvent(event));
                  }
                : undefined,
            )}
            onLoadingError={wrapNitroCallback(onLoadingError)}
            onLoadingFinish={wrapNitroCallback(onLoadingFinish)}
            onLoadingProgress={wrapNitroCallback(onLoadingProgress)}
            onLoadingStart={wrapNitroCallback(onLoadingStart)}
            onMessage={wrapNitroCallback(
              onMessage
                ? (event: PaywallWebViewMessageEvent) => {
                    onMessage(createNativeEvent(event));
                  }
                : undefined,
            )}
            onOpenWindow={wrapNitroCallback(
              onOpenWindow
                ? (event: PaywallWebViewOpenWindowEvent) => {
                    onOpenWindow(createNativeEvent(event));
                  }
                : undefined,
            )}
            onRenderProcessGone={wrapNitroCallback(
              onRenderProcessGone
                ? (event: PaywallWebViewRenderProcessGoneEvent) => {
                    onRenderProcessGone(createNativeEvent(event));
                  }
                : undefined,
            )}
            onShouldStartLoadWithRequest={wrapNitroCallback(onShouldStartLoad)}
            originWhitelist={originWhitelist}
            overScrollMode="always"
            pullToRefreshEnabled={pullToRefreshEnabled}
            scalesPageToFit={scalesPageToFit}
            setBuiltInZoomControls={setBuiltInZoomControls}
            setDisplayZoomControls={setDisplayZoomControls}
            setSupportMultipleWindows={setSupportMultipleWindows}
            sharedCookiesEnabled={sharedCookiesEnabled}
            source={sourceNormalized}
            textZoom={textZoom}
            thirdPartyCookiesEnabled={thirdPartyCookiesEnabled}
            userAgent={userAgent}
          />
        </View>
        {otherView}
      </View>
    );
  },
);

PaywallWebView.displayName = "PaywallWebView";
