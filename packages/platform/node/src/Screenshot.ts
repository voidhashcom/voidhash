import {
  Screenshot,
  ScreenshotError,
  type ScreenshotOptions,
  type ScreenshotShape,
} from "@voidhash/platform/Screenshot";
import { PlatformRuntime } from "@voidhash/platform/PlatformRuntime";
import { Config, Effect, Layer, Option } from "effect";
import { chromium, type Browser } from "playwright-core";

/** Headless Chromium launch and resource limits. */
export interface ChromiumScreenshotConfig {
  readonly executablePath?: string;
  readonly disableSandbox?: boolean;
  readonly timeoutMillis?: number;
  readonly maxWidth?: number;
  readonly maxHeight?: number;
  readonly maxDeviceScaleFactor?: number;
  readonly maxHtmlBytes?: number;
  readonly maxRenderedPixels?: number;
}

const screenshotError = (operation: string, cause: unknown) =>
  new ScreenshotError({ operation, cause: String(cause) });

const sandboxArgs = (disableSandbox: boolean | undefined): ReadonlyArray<string> => {
  if (disableSandbox) return ["--no-sandbox"];
  return [];
};

const positiveInteger = (value: number, maximum: number): boolean =>
  Number.isInteger(value) && value > 0 && value <= maximum;

/** Validates screenshot memory and viewport budgets before Chromium is invoked. */
export const validateChromiumScreenshotOptions = (
  options: ScreenshotOptions,
  config: ChromiumScreenshotConfig,
): Effect.Effect<void, ScreenshotError> => {
  const maxWidth = config.maxWidth ?? 4_096;
  const maxHeight = config.maxHeight ?? 4_096;
  const maxScale = config.maxDeviceScaleFactor ?? 4;
  const maxHtmlBytes = config.maxHtmlBytes ?? 4 * 1_024 * 1_024;
  const maxRenderedPixels = config.maxRenderedPixels ?? 16_777_216;
  if (!positiveInteger(options.width, maxWidth)) {
    return Effect.fail(screenshotError("validate", `width must be between 1 and ${maxWidth}`));
  }
  if (!positiveInteger(options.height, maxHeight)) {
    return Effect.fail(screenshotError("validate", `height must be between 1 and ${maxHeight}`));
  }
  if (
    !Number.isFinite(options.deviceScaleFactor) ||
    options.deviceScaleFactor < 1 ||
    options.deviceScaleFactor > maxScale
  ) {
    return Effect.fail(
      screenshotError("validate", `deviceScaleFactor must be between 1 and ${maxScale}`),
    );
  }
  if (new TextEncoder().encode(options.html).byteLength > maxHtmlBytes) {
    return Effect.fail(screenshotError("validate", `html must be at most ${maxHtmlBytes} bytes`));
  }
  const renderedPixels =
    options.width * options.height * options.deviceScaleFactor * options.deviceScaleFactor;
  if (renderedPixels > maxRenderedPixels) {
    return Effect.fail(
      screenshotError("validate", `rendered image must be at most ${maxRenderedPixels} pixels`),
    );
  }
  return Effect.void;
};

const render = (browser: Browser, config: ChromiumScreenshotConfig, options: ScreenshotOptions) =>
  validateChromiumScreenshotOptions(options, config).pipe(
    Effect.andThen(
      Effect.acquireUseRelease(
        Effect.tryPromise({
          try: () =>
            browser.newContext({
              viewport: { width: Math.floor(options.width), height: Math.floor(options.height) },
              deviceScaleFactor: options.deviceScaleFactor,
              javaScriptEnabled: false,
              serviceWorkers: "block",
            }),
          catch: (cause) => screenshotError("openContext", cause),
        }),
        (context) =>
          Effect.gen(function* () {
            yield* Effect.tryPromise({
              try: () => context.setOffline(true),
              catch: (cause) => screenshotError("render", cause),
            });
            const page = yield* Effect.tryPromise({
              try: () => context.newPage(),
              catch: (cause) => screenshotError("render", cause),
            });
            yield* Effect.tryPromise({
              try: () => page.route("**/*", (route) => route.abort("blockedbyclient")),
              catch: (cause) => screenshotError("render", cause),
            });
            yield* Effect.tryPromise({
              try: () =>
                page.setContent(options.html, {
                  waitUntil: "load",
                  timeout: config.timeoutMillis ?? 15_000,
                }),
              catch: (cause) => screenshotError("render", cause),
            });
            const png = yield* Effect.tryPromise({
              try: () =>
                page.screenshot({
                  type: "png",
                  fullPage: false,
                  animations: "disabled",
                  timeout: config.timeoutMillis ?? 15_000,
                }),
              catch: (cause) => screenshotError("render", cause),
            });
            return new Uint8Array(png);
          }),
        (context) =>
          Effect.promise(() => context.close()).pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("failed to close screenshot browser context", {
                cause: String(cause),
              }),
            ),
          ),
      ),
    ),
  );

const makeRenderer = (browser: Browser, config: ChromiumScreenshotConfig): ScreenshotShape => ({
  renderPng: (options) => PlatformRuntime.pipe(Effect.andThen(render(browser, config, options))),
});

/** Chromium-backed PNG screenshot layer with network and JavaScript disabled. */
export const ChromiumScreenshotLive = (
  config: ChromiumScreenshotConfig = {},
): Layer.Layer<Screenshot, ScreenshotError> =>
  Layer.effect(
    Screenshot,
    Effect.acquireRelease(
      Effect.gen(function* () {
        const configuredPath = yield* Config.string("CHROMIUM_EXECUTABLE_PATH").pipe(
          Config.option,
          Effect.map(Option.getOrUndefined),
          Effect.orDie,
        );
        return yield* Effect.tryPromise({
          try: () =>
            chromium.launch({
              executablePath: config.executablePath ?? configuredPath,
              headless: true,
              args: ["--disable-dev-shm-usage", ...sandboxArgs(config.disableSandbox)],
            }),
          catch: (cause) => screenshotError("launch", cause),
        });
      }),
      (browser) =>
        Effect.promise(() => browser.close()).pipe(
          Effect.catchCause((cause) =>
            Effect.logWarning("failed to close screenshot browser", {
              cause: String(cause),
            }),
          ),
        ),
    ).pipe(Effect.map((browser) => makeRenderer(browser, config))),
  );
