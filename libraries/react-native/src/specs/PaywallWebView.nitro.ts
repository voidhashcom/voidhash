import type {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
  Sync,
} from "react-native-nitro-modules";

export type PaywallWebViewNavigationType =
  | "click"
  | "formsubmit"
  | "backforward"
  | "reload"
  | "formresubmit"
  | "other";

export type PaywallWebViewMixedContentMode =
  | "never"
  | "always"
  | "compatibility";

export type PaywallWebViewOverScrollModeType = "always" | "content" | "never";

export type PaywallWebViewCacheMode =
  | "LOAD_DEFAULT"
  | "LOAD_CACHE_ONLY"
  | "LOAD_CACHE_ELSE_NETWORK"
  | "LOAD_NO_CACHE";

export type PaywallWebViewAndroidLayerType = "none" | "software" | "hardware";

export type PaywallWebViewDataDetectorType =
  | "phoneNumber"
  | "link"
  | "address"
  | "calendarEvent"
  | "trackingNumber"
  | "flightNumber"
  | "lookupSuggestion"
  | "none"
  | "all";

export interface PaywallWebViewHeader {
  name: string;
  value: string;
}

export interface PaywallWebViewSource {
  uri?: string;
  method?: string;
  body?: string;
  headers?: PaywallWebViewHeader[];
  html?: string;
  baseUrl?: string;
}

export interface PaywallWebViewBaseEvent {
  url: string;
  loading: boolean;
  title: string;
  canGoBack: boolean;
  canGoForward: boolean;
  lockIdentifier: number;
}

export interface PaywallWebViewNavigationEvent extends PaywallWebViewBaseEvent {
  navigationType: PaywallWebViewNavigationType;
  mainDocumentURL?: string;
}

export interface PaywallWebViewShouldStartLoadRequest
  extends PaywallWebViewNavigationEvent {
  isTopFrame: boolean;
}

export interface PaywallWebViewProgressEvent extends PaywallWebViewBaseEvent {
  progress: number;
}

export interface PaywallWebViewMessageEvent extends PaywallWebViewBaseEvent {
  data: string;
}

export interface PaywallWebViewErrorEvent extends PaywallWebViewBaseEvent {
  domain?: string;
  code: number;
  description: string;
}

export interface PaywallWebViewHttpErrorEvent extends PaywallWebViewBaseEvent {
  description: string;
  statusCode: number;
}

export interface PaywallWebViewOpenWindowEvent {
  targetUrl: string;
}

export interface PaywallWebViewFileDownloadEvent {
  downloadUrl: string;
}

export interface PaywallWebViewRenderProcessGoneEvent {
  didCrash: boolean;
}

export interface PaywallWebViewProps extends HybridViewProps {
  source?: PaywallWebViewSource;

  javaScriptEnabled: boolean;
  cacheEnabled: boolean;
  incognito: boolean;
  userAgent?: string;
  applicationNameForUserAgent?: string;

  injectedJavaScript?: string;
  injectedJavaScriptBeforeContentLoaded?: string;
  injectedJavaScriptForMainFrameOnly: boolean;
  injectedJavaScriptBeforeContentLoadedForMainFrameOnly: boolean;

  mediaPlaybackRequiresUserAction: boolean;
  allowsInlineMediaPlayback: boolean;
  allowsPictureInPictureMediaPlayback: boolean;
  allowsAirPlayForMediaPlayback: boolean;

  allowsFullscreenVideo: boolean;
  setSupportMultipleWindows: boolean;
  setBuiltInZoomControls: boolean;
  setDisplayZoomControls: boolean;
  scalesPageToFit: boolean;

  thirdPartyCookiesEnabled: boolean;
  sharedCookiesEnabled: boolean;

  allowFileAccess: boolean;
  allowFileAccessFromFileURLs: boolean;
  allowUniversalAccessFromFileURLs: boolean;

  textZoom: number;
  overScrollMode: PaywallWebViewOverScrollModeType;
  cacheMode: PaywallWebViewCacheMode;
  mixedContentMode: PaywallWebViewMixedContentMode;
  androidLayerType: PaywallWebViewAndroidLayerType;
  geolocationEnabled: boolean;

  pullToRefreshEnabled: boolean;
  nestedScrollEnabled: boolean;
  bounces: boolean;

  dataDetectorTypes: PaywallWebViewDataDetectorType[];
  originWhitelist: string[];

  messagingEnabled: boolean;

  onLoadingStart?: (event: PaywallWebViewNavigationEvent) => void;
  onLoadingProgress?: (event: PaywallWebViewProgressEvent) => void;
  onLoadingFinish?: (event: PaywallWebViewNavigationEvent) => void;
  onLoadingError?: (event: PaywallWebViewErrorEvent) => void;
  onHttpError?: (event: PaywallWebViewHttpErrorEvent) => void;
  onMessage?: (event: PaywallWebViewMessageEvent) => void;
  onOpenWindow?: (event: PaywallWebViewOpenWindowEvent) => void;
  onFileDownload?: (event: PaywallWebViewFileDownloadEvent) => void;
  onRenderProcessGone?: (event: PaywallWebViewRenderProcessGoneEvent) => void;
  onContentProcessDidTerminate?: (event: PaywallWebViewBaseEvent) => void;
  onShouldStartLoadWithRequest?: Sync<
    (event: PaywallWebViewShouldStartLoadRequest) => boolean
  >;
}

export interface PaywallWebViewMethods extends HybridViewMethods {
  goBack(): void;
  goForward(): void;
  reload(): void;
  stopLoading(): void;
  requestFocus(): void;
  postMessage(data: string): void;
  injectJavaScript(javascript: string): void;
  loadUrl(url: string): void;
  clearFormData(): void;
  clearHistory(): void;
  clearCache(includeDiskFiles: boolean): void;
}

export type PaywallWebView = HybridView<
  PaywallWebViewProps,
  PaywallWebViewMethods
>;
