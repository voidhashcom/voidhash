import { Effect } from "effect";
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActivityIndicator, Linking, Platform, Text, View } from "react-native";

import type {
  PaywallWebViewErrorEvent,
  PaywallWebViewNavigationEvent,
  PaywallWebViewShouldStartLoadRequest,
} from "../../specs/PaywallWebView.nitro";
import { PaywallWebViewHost, type PaywallWebViewHostRef } from "./PaywallWebViewHost";
import { styles } from "./styles";
import type { PaywallWebViewImperativeRef, PaywallWebViewProps } from "./types";
import { createNativeEvent, normalizeSource, wrapNitroCallback } from "./utils";
import { compileWhitelist, passesWhitelist } from "./whitelist";

const defaultOriginWhitelist = ["http://*", "https://*"];
const PaywallWebViewNativeComponent = PaywallWebViewHost as React.ComponentType<any>;

type ViewState = "IDLE" | "LOADING" | "ERROR";

function defaultRenderLoading() {
  return (
    <View style={styles.loadingOrErrorView}>
      <ActivityIndicator />
    </View>
  );
}

function defaultRenderError(domain: string | undefined, code: number, description: string) {
  return (
    <View style={styles.loadingOrErrorView}>
      <Text style={styles.errorTextTitle}>Error loading page</Text>
      <Text style={styles.errorText}>{`Domain: ${domain ?? "N/A"}`}</Text>
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((globalThis as any).nativeFabricUIManager == null) {
      return Effect.runSync(
        Effect.die(
          new Error("PaywallWebView requires React Native New Architecture (Fabric) enabled."),
        ),
      );
    }

    const hybridViewRef = useRef<PaywallWebViewHostRef | null>(null);
    const [viewState, setViewState] = useState<ViewState>(startInLoadingState ? "LOADING" : "IDLE");
    const [lastErrorEvent, setLastErrorEvent] = useState<PaywallWebViewErrorEvent | null>(null);
    const startUrl = useRef<string | null>(null);

    const sourceNormalized = useMemo(() => normalizeSource(source), [source]);
    const compiledWhitelist = useMemo(() => compileWhitelist(originWhitelist), [originWhitelist]);

    const onHybridRef = useCallback((hybridRef: PaywallWebViewHostRef) => {
      hybridViewRef.current = hybridRef;
    }, []);

    const onLoadingStart = useCallback(
      (event: PaywallWebViewNavigationEvent) => {
        startUrl.current = event.url;
        onLoadStart?.(createNativeEvent(event));
      },
      [onLoadStart],
    );

    const onLoadingFinish = useCallback(
      (event: PaywallWebViewNavigationEvent) => {
        onLoad?.(createNativeEvent(event));
        onLoadEnd?.(createNativeEvent(event));

        if (Platform.OS !== "android" || event.url === startUrl.current) {
          setViewState("IDLE");
        }
      },
      [onLoad, onLoadEnd],
    );

    const onLoadingError = useCallback(
      (event: PaywallWebViewErrorEvent) => {
        onError?.(createNativeEvent(event));
        setViewState("ERROR");
        setLastErrorEvent(event);
      },
      [onError],
    );

    const onLoadingProgress = useCallback(
      (event: { progress: number } & PaywallWebViewNavigationEvent) => {
        if (Platform.OS === "android" && event.progress === 1) {
          setViewState((prev) => (prev === "LOADING" ? "IDLE" : prev));
        }
        onLoadProgress?.(createNativeEvent(event));
      },
      [onLoadProgress],
    );

    const onShouldStartLoad = useCallback(
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

    useImperativeHandle(
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

    let otherView: React.ReactElement | null = null;
    if (viewState === "LOADING") {
      otherView = (renderLoading ?? defaultRenderLoading)();
    } else if (viewState === "ERROR" && lastErrorEvent != null) {
      otherView = (renderError ?? defaultRenderError)(
        lastErrorEvent.domain,
        lastErrorEvent.code,
        lastErrorEvent.description,
      );
    }

    return (
      <View style={[styles.container, containerStyle]}>
        <PaywallWebViewNativeComponent
          style={[styles.webView, style] as any}
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
          messagingEnabled={typeof onMessage === "function"}
          mixedContentMode="never"
          nestedScrollEnabled={nestedScrollEnabled}
          onContentProcessDidTerminate={wrapNitroCallback(
            onContentProcessDidTerminate
              ? (event: any) => {
                  onContentProcessDidTerminate(createNativeEvent(event));
                }
              : undefined,
          )}
          onFileDownload={wrapNitroCallback(
            onFileDownload
              ? (event: any) => {
                  onFileDownload(createNativeEvent(event));
                }
              : undefined,
          )}
          onHttpError={wrapNitroCallback(
            onHttpError
              ? (event: any) => {
                  onHttpError(createNativeEvent(event));
                }
              : undefined,
          )}
          onLoadingError={wrapNitroCallback(onLoadingError)}
          onLoadingFinish={wrapNitroCallback(onLoadingFinish)}
          onLoadingProgress={wrapNitroCallback(onLoadingProgress as any)}
          onLoadingStart={wrapNitroCallback(onLoadingStart)}
          onMessage={wrapNitroCallback(
            onMessage
              ? (event: any) => {
                  onMessage(createNativeEvent(event));
                }
              : undefined,
          )}
          onOpenWindow={wrapNitroCallback(
            onOpenWindow
              ? (event: any) => {
                  onOpenWindow(createNativeEvent(event));
                }
              : undefined,
          )}
          onRenderProcessGone={wrapNitroCallback(
            onRenderProcessGone
              ? (event: any) => {
                  onRenderProcessGone(createNativeEvent(event));
                }
              : undefined,
          )}
          onShouldStartLoadWithRequest={wrapNitroCallback(onShouldStartLoad as any)}
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
        {otherView}
      </View>
    );
  },
);

PaywallWebView.displayName = "PaywallWebView";
