import { NodeHttpServer } from "@effect/platform-node";
import { Screenshot, ScreenshotError } from "@voidhash/platform/Screenshot";
import { Config, Effect, Layer, Option } from "effect";
import { HttpServer, HttpServerResponse } from "effect/unstable/http";
import { describe, expect, it } from "vitest";

import { SelfhostPlatformRuntimeLive } from "../src/PlatformRuntime.ts";
import { ChromiumScreenshotLive } from "../src/Screenshot.ts";

const darwinChrome = (): string | undefined => {
  if (process.platform === "darwin") {
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }
  return undefined;
};

const readExecutablePath = Config.string("PLATFORM_SELFHOST_CHROMIUM_EXECUTABLE_PATH").pipe(
  Config.option,
  Effect.map(Option.getOrUndefined),
  Effect.map((configured) => configured ?? darwinChrome()),
  Effect.orDie,
);

const screenshotLayer = () =>
  Layer.unwrap(
    readExecutablePath.pipe(
      Effect.map((executablePath) =>
        Layer.merge(ChromiumScreenshotLive({ executablePath }), SelfhostPlatformRuntimeLive),
      ),
    ),
  );

const pngDimensions = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

const tcpPort = (address: HttpServer.Address): Effect.Effect<number> => {
  if (address._tag === "TcpAddress") return Effect.succeed(address.port);
  return Effect.die(new Error("test server did not expose a TCP port"));
};

/**
 * Starts a server that redirects every request at the cloud metadata endpoint
 * and counts the requests it received, so a screenshot that reaches the network
 * is visible as a non-zero count.
 */
const redirectingServer = Effect.gen(function* () {
  const requests = { count: 0 };
  const server = yield* HttpServer.HttpServer;
  yield* HttpServer.serveEffect(
    Effect.sync(() => {
      requests.count += 1;
      return HttpServerResponse.empty({
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data/" },
      });
    }),
  );
  const port = yield* tcpPort(server.address);
  return { requests, port };
});

describe("Chromium screenshot renderer", () => {
  it("renders a viewport PNG at the requested device scale", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const png = yield* Effect.gen(function* () {
          const screenshot = yield* Screenshot;
          return yield* screenshot.renderPng({
            html: "<!doctype html><style>html,body{margin:0;background:#123456}</style>",
            width: 160,
            height: 90,
            deviceScaleFactor: 2,
          });
        }).pipe(Effect.provide(screenshotLayer()));

        expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
        expect(pngDimensions(png)).toEqual({ width: 320, height: 180 });
      }),
    ));

  it("blocks resource loads and redirecting navigation before any network access", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const { requests, port } = yield* redirectingServer;
        const url = `http://127.0.0.1:${port}/blocked.png`;
        const png = yield* Effect.gen(function* () {
          const screenshot = yield* Screenshot;
          return yield* screenshot.renderPng({
            html: `<!doctype html>
              <meta http-equiv="refresh" content="0;url=${url}">
              <style>@import url("${url}");</style>
              <img src="${url}">
              <iframe src="${url}"></iframe>
              <script>fetch("${url}")</script>`,
            width: 40,
            height: 30,
            deviceScaleFactor: 1,
          });
        }).pipe(Effect.provide(screenshotLayer()));

        expect(pngDimensions(png)).toEqual({ width: 40, height: 30 });
        expect(requests.count).toBe(0);
      }).pipe(Effect.provide(NodeHttpServer.layerTest), Effect.scoped),
    ));

  it("validates viewport limits through the stable error channel", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const error = yield* Effect.gen(function* () {
          const screenshot = yield* Screenshot;
          return yield* screenshot
            .renderPng({ html: "", width: 0, height: 30, deviceScaleFactor: 1 })
            .pipe(Effect.flip);
        }).pipe(Effect.provide(screenshotLayer()));

        expect(error).toBeInstanceOf(ScreenshotError);
        expect(error.operation).toBe("validate");
      }),
    ));
});
