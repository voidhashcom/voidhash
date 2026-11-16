/**
 * The script-tag build: the SDK as the `Voidhash` global, for pages without a
 * bundler.
 *
 * A `<script>` tag that carries `data-publishable-key`, or loads after a
 * loader snippet that set `window.voidhash.options`, also creates a client
 * from those options and its `data-*` attributes, starts it, and makes it
 * `window.voidhash`. Calls the loader snippet queued on `window.voidhash`
 * before the file arrived, such as `capture`, `identify` and `on`, are then
 * made on the client, in order.
 */
import * as P from "effect/Predicate";
import * as Result from "effect/Result";

import { createVoidhashClient, type VoidhashClientOptions } from "./client";
import { METHODS_BEFORE_INITIALIZE } from "./methods-before-initialize";
import { VoidhashConfigurationError, VoidhashError } from "./errors";
import { isAnalyticsConsent } from "./core/analytics/analytics-consent";

export * from "./index";

/**
 * The methods the loader snippet queues, such as `capture` and `identify`: the
 * ones a client takes before it started, and `on`. The others need a started
 * client.
 */
const QUEUEABLE_METHODS: ReadonlySet<string> = new Set([
  ...METHODS_BEFORE_INITIALIZE,
  "on",
  "setAnalyticsConsent",
]);

/**
 * Reports a failure of a call nobody can await, as the browser reports an
 * uncaught error, without stopping the calls after it.
 */
const report = (error: unknown) => {
  if (P.isFunction(globalThis.reportError)) {
    globalThis.reportError(error);
    return;
  }
  setTimeout(() => {
    throw error;
  }, 0);
};

/** `"false"` turns a flag off; present with any other value, it is on. */
// oxlint-disable-next-line effect/prefer-option-over-null -- a `data-*` attribute reads as `undefined` when absent, and the options take it as is.
const readFlag = (value: string | undefined) =>
  value === undefined ? undefined : value !== "false";

/**
 * The client options the loader snippet left as `window.voidhash.options`,
 * for options a `data-*` attribute cannot carry, such as functions. Only the
 * shape is checked here; `createVoidhashClient` checks every option.
 */
const isSnippetOptions = (value: unknown): value is Partial<VoidhashClientOptions> =>
  P.isObject(value) && !Array.isArray(value) && !P.isFunction(value);

const startFromScriptTag = (script: HTMLScriptElement) => {
  const { dataset } = script;
  const queued: unknown = Reflect.get(globalThis, "voidhash");
  // Another copy of the script already started a client.
  if (queued !== undefined && !(P.hasProperty(queued, "q") && Array.isArray(queued.q))) return;

  const options =
    P.hasProperty(queued, "options") && isSnippetOptions(queued.options) ? queued.options : {};
  const publishableKey = dataset.publishableKey ?? options.publishableKey;
  if (publishableKey === undefined) return;

  const consent = dataset.analyticsConsent;
  // A misspelled consent must not fall back to the `granted` default.
  if (consent !== undefined && !isAnalyticsConsent(consent)) {
    report(
      new VoidhashConfigurationError(
        `data-analytics-consent must be "granted", "denied", or "pending"; Voidhash did not start.`,
      ),
    );
    return;
  }
  const consentSource = dataset.analyticsConsentSource;
  if (consentSource !== undefined && consentSource !== "sdk" && consentSource !== "app") {
    report(
      new VoidhashConfigurationError(
        `data-analytics-consent-source must be "sdk" or "app"; Voidhash did not start.`,
      ),
    );
    return;
  }
  const whilePending = dataset.analyticsWhilePending;
  if (whilePending !== undefined && whilePending !== "drop" && whilePending !== "buffer") {
    report(
      new VoidhashConfigurationError(
        `data-analytics-while-pending must be "drop" or "buffer"; Voidhash did not start.`,
      ),
    );
    return;
  }
  const grantConsentOnIdentify = readFlag(dataset.grantConsentOnIdentify);
  const capturePageViews = readFlag(dataset.capturePageViews);
  const capturePageLeaves = readFlag(dataset.capturePageLeaves);
  const captureOutboundClicks = readFlag(dataset.captureOutboundClicks);
  const storeBeforeConsent = readFlag(dataset.storeBeforeConsent);
  const crossSubdomainIdentity = readFlag(dataset.crossSubdomainIdentity);
  // The tag's attributes win over the snippet's options. A wrong option is
  // reported, and the page goes on without Voidhash rather than with an
  // exception thrown from the script.
  const created = Result.try({
    catch: (error) => error,
    try: () =>
      createVoidhashClient({
        ...options,
        publishableKey,
        ...(dataset.baseUrl !== undefined && { baseUrl: dataset.baseUrl }),
        ...(isAnalyticsConsent(consent) && { analyticsConsent: consent }),
        ...(consentSource !== undefined && { analyticsConsentSource: consentSource }),
        ...(whilePending !== undefined && { analyticsWhilePending: whilePending }),
        ...(grantConsentOnIdentify !== undefined && { grantConsentOnIdentify }),
        analytics: {
          ...options.analytics,
          ...(capturePageViews !== undefined && { capturePageViews }),
          ...(capturePageLeaves !== undefined && { capturePageLeaves }),
          ...(captureOutboundClicks !== undefined && { captureOutboundClicks }),
        },
        ...(storeBeforeConsent !== undefined && { storeBeforeConsent }),
        ...(crossSubdomainIdentity !== undefined && { crossSubdomainIdentity }),
      }),
  });
  if (Result.isFailure(created)) {
    report(created.failure);
    return;
  }
  const client = created.success;
  Reflect.set(globalThis, "voidhash", client);
  client.initialize().catch(report);

  // Calls made while the client starts wait for it, so they keep their order.
  const calls: ReadonlyArray<unknown> =
    P.hasProperty(queued, "q") && Array.isArray(queued.q) ? queued.q : [];
  calls.forEach((call) => {
    const [name, args]: ReadonlyArray<unknown> = Array.isArray(call) ? call : [];
    const method: unknown =
      P.isString(name) && QUEUEABLE_METHODS.has(name) ? Reflect.get(client, name) : undefined;
    if (!P.isFunction(method)) {
      report(new VoidhashError(`window.voidhash cannot queue ${String(name)} before it loads.`));
      return;
    }
    // The snippet queues each call's `arguments`, which is iterable.
    const result: unknown = Reflect.apply(method, client, P.isIterable(args) ? [...args] : []);
    if (result instanceof Promise) result.catch(report);
  });
};

if (!P.isUndefined(globalThis.document) && document.currentScript instanceof HTMLScriptElement) {
  startFromScriptTag(document.currentScript);
}
