import { Screenshot, ScreenshotError } from "@voidhash/platform/Screenshot";
import { Effect, Layer } from "effect";
import { createServer } from "node:http";
import { describe, expect, it } from "vitest";

import { NodePlatformRuntimeLive } from "../src/PlatformRuntime.ts";
import { ChromiumScreenshotLive } from "../src/Screenshot.ts";

const executablePath =
  process.env.PLATFORM_NODE_CHROMIUM_EXECUTABLE_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const screenshotLayer = () =>
  Layer.merge(ChromiumScreenshotLive({ executablePath }), NodePlatformRuntimeLive);
const describeChromium =
  process.env.PLATFORM_NODE_CHROMIUM_TEST === "1" ? describe : describe.skip;

const pngDimensions = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

describeChromium("Chromium screenshot renderer", () => {
  it("renders a viewport PNG at the requested device scale", async () => {
    const png = await Effect.runPromise(
      Effect.gen(function* () {
        const screenshot = yield* Screenshot;
        return yield* screenshot.renderPng({
          html: "<!doctype html><style>html,body{margin:0;background:#123456}</style>",
          width: 160,
          height: 90,
          deviceScaleFactor: 2,
        });
      }).pipe(Effect.provide(screenshotLayer())),
    );

    expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(pngDimensions(png)).toEqual({ width: 320, height: 180 });
  });

  it("rejects external requests from rendered documents", async () => {
    let requestCount = 0;
    const server = createServer((_request, response) => {
      requestCount += 1;
      response.writeHead(200, { "content-type": "image/png" });
      response.end();
    });
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (address === null || typeof address === "string") {
      throw new Error("test server did not expose a TCP port");
    }

    try {
      const url = `http://127.0.0.1:${address.port}/blocked.png`;
      const png = await Effect.runPromise(
        Effect.gen(function* () {
          const screenshot = yield* Screenshot;
          return yield* screenshot.renderPng({
            html: `<!doctype html><img src="${url}"><script>fetch("${url}")</script>`,
            width: 40,
            height: 30,
            deviceScaleFactor: 1,
          });
        }).pipe(Effect.provide(screenshotLayer())),
      );

      expect(pngDimensions(png)).toEqual({ width: 40, height: 30 });
      expect(requestCount).toBe(0);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("validates viewport limits through the stable error channel", async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const screenshot = yield* Screenshot;
        return yield* screenshot
          .renderPng({ html: "", width: 0, height: 30, deviceScaleFactor: 1 })
          .pipe(Effect.flip);
      }).pipe(Effect.provide(screenshotLayer())),
    );

    expect(error).toBeInstanceOf(ScreenshotError);
    expect(error.operation).toBe("validate");
  });
});
