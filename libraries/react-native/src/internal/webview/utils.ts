import * as R from "effect/Record";
import * as P from "effect/Predicate";
import type { PaywallWebViewSource } from "../../specs/PaywallWebView.nitro";
import type { PaywallWebViewProps } from "./types";

export function wrapNitroCallback<T>(callback: T) {
  if (!P.isFunction(callback)) {
    return undefined;
  }

  return { f: callback };
}

export function normalizeSource(source?: PaywallWebViewProps["source"]) {
  if (!source || P.isNumber(source)) {
    return undefined;
  }

  const { headers, ...rest } = source;
  if (headers && !Array.isArray(headers)) {
    return {
      ...rest,
      headers: R.toEntries(headers).map(([name, value]) => ({
        name,
        value,
      })),
    } satisfies PaywallWebViewSource;
  }

  return {
    ...rest,
    headers,
  } satisfies PaywallWebViewSource;
}

export function createNativeEvent<TEvent>(nativeEvent: TEvent): { nativeEvent: TEvent } {
  return { nativeEvent };
}
