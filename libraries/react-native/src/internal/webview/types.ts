import type { ReactElement } from "react";
import type { StyleProp, ViewStyle } from "react-native";

import type {
  PaywallWebViewBaseEvent,
  PaywallWebViewDataDetectorType,
  PaywallWebViewErrorEvent,
  PaywallWebViewFileDownloadEvent,
  PaywallWebViewHttpErrorEvent,
  PaywallWebViewMessageEvent,
  PaywallWebViewNavigationEvent,
  PaywallWebViewOpenWindowEvent,
  PaywallWebViewProgressEvent,
  PaywallWebViewRenderProcessGoneEvent,
  PaywallWebViewShouldStartLoadRequest,
  PaywallWebViewSource,
} from "../../specs/PaywallWebView.nitro";

export interface NativeEvent<TEvent> {
  nativeEvent: TEvent;
}

export type PaywallWebViewNavigationEventHandler = (
  event: NativeEvent<PaywallWebViewNavigationEvent>,
) => void;

export type PaywallWebViewProgressEventHandler = (
  event: NativeEvent<PaywallWebViewProgressEvent>,
) => void;

export type PaywallWebViewMessageEventHandler = (
  event: NativeEvent<PaywallWebViewMessageEvent>,
) => void;

export type PaywallWebViewErrorEventHandler = (
  event: NativeEvent<PaywallWebViewErrorEvent>,
) => void;

export type PaywallWebViewHttpErrorEventHandler = (
  event: NativeEvent<PaywallWebViewHttpErrorEvent>,
) => void;

export type PaywallWebViewOpenWindowEventHandler = (
  event: NativeEvent<PaywallWebViewOpenWindowEvent>,
) => void;

export type PaywallWebViewFileDownloadEventHandler = (
  event: NativeEvent<PaywallWebViewFileDownloadEvent>,
) => void;

export type PaywallWebViewRenderProcessGoneEventHandler = (
  event: NativeEvent<PaywallWebViewRenderProcessGoneEvent>,
) => void;

export type PaywallWebViewBaseEventHandler = (event: NativeEvent<PaywallWebViewBaseEvent>) => void;

export type PaywallWebViewShouldStartLoadWithRequest = (
  event: PaywallWebViewShouldStartLoadRequest,
) => boolean;

export interface PaywallWebViewImperativeRef {
  goBack: () => void;
  goForward: () => void;
  reload: () => void;
  stopLoading: () => void;
  postMessage: (data: string) => void;
  injectJavaScript: (javascript: string) => void;
  requestFocus: () => void;
  clearFormData: () => void;
  clearHistory: () => void;
  clearCache: (includeDiskFiles: boolean) => void;
  loadUrl: (url: string) => void;
}

export interface PaywallWebViewProps {
  source?:
    | PaywallWebViewSource
    | {
        uri?: string;
        method?: string;
        body?: string;
        headers?: Record<string, string>;
        html?: string;
        baseUrl?: string;
      };
  originWhitelist?: string[];
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;

  javaScriptEnabled?: boolean;
  cacheEnabled?: boolean;
  incognito?: boolean;
  userAgent?: string;
  applicationNameForUserAgent?: string;
  injectedJavaScript?: string;
  injectedJavaScriptBeforeContentLoaded?: string;
  injectedJavaScriptForMainFrameOnly?: boolean;
  injectedJavaScriptBeforeContentLoadedForMainFrameOnly?: boolean;
  mediaPlaybackRequiresUserAction?: boolean;
  allowsInlineMediaPlayback?: boolean;
  allowsPictureInPictureMediaPlayback?: boolean;
  allowsAirPlayForMediaPlayback?: boolean;
  allowsFullscreenVideo?: boolean;
  setSupportMultipleWindows?: boolean;
  setBuiltInZoomControls?: boolean;
  setDisplayZoomControls?: boolean;
  scalesPageToFit?: boolean;
  thirdPartyCookiesEnabled?: boolean;
  sharedCookiesEnabled?: boolean;
  allowFileAccess?: boolean;
  allowFileAccessFromFileURLs?: boolean;
  allowUniversalAccessFromFileURLs?: boolean;
  textZoom?: number;
  geolocationEnabled?: boolean;
  pullToRefreshEnabled?: boolean;
  nestedScrollEnabled?: boolean;
  bounces?: boolean;
  dataDetectorTypes?: PaywallWebViewDataDetectorType[];

  onLoadStart?: PaywallWebViewNavigationEventHandler;
  onLoad?: PaywallWebViewNavigationEventHandler;
  onLoadEnd?: PaywallWebViewNavigationEventHandler;
  onLoadProgress?: PaywallWebViewProgressEventHandler;
  onError?: PaywallWebViewErrorEventHandler;
  onHttpError?: PaywallWebViewHttpErrorEventHandler;
  onMessage?: PaywallWebViewMessageEventHandler;
  onOpenWindow?: PaywallWebViewOpenWindowEventHandler;
  onFileDownload?: PaywallWebViewFileDownloadEventHandler;
  onRenderProcessGone?: PaywallWebViewRenderProcessGoneEventHandler;
  onContentProcessDidTerminate?: PaywallWebViewBaseEventHandler;
  onShouldStartLoadWithRequest?: PaywallWebViewShouldStartLoadWithRequest;

  startInLoadingState?: boolean;
  renderLoading?: () => ReactElement;
  renderError?: (domain: string | undefined, code: number, description: string) => ReactElement;
}
