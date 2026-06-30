import type { PaywallWebViewSource } from "../../specs/PaywallWebView.nitro";
import type { PaywallWebViewProps } from "./types";

export function wrapNitroCallback<T extends Function | undefined>(
  callback: T,
): { f: T } | undefined {
  if (!callback) {
    return undefined;
  }

  return { f: callback };
}

export function normalizeSource(
  source?: PaywallWebViewProps["source"],
): PaywallWebViewSource | undefined {
  if (!source || typeof source === "number") {
    return undefined;
  }

  if (source.headers && !Array.isArray(source.headers)) {
    return {
      ...source,
      headers: Object.entries(source.headers).map(([name, value]) => ({
        name,
        value,
      })),
    };
  }

  return source as PaywallWebViewSource;
}

export function createNativeEvent<TEvent>(nativeEvent: TEvent): { nativeEvent: TEvent } {
  return { nativeEvent };
}
