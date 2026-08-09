import { Effect } from "effect";

import type { PublicFileObject } from "../storage/PublicFileStore.ts";

import { describe, expect, it } from "../../testing/effect-vitest.ts";
import { inlinePublicFileImages } from "./inlinePublicFileImages.ts";

const BASE_URL = "http://localhost:1337";

const makeStore = (objects: Record<string, PublicFileObject>) => {
  const reads: string[] = [];
  return {
    reads,
    store: {
      publicBaseUrl: BASE_URL,
      getObject: (key: string) =>
        Effect.sync(() => {
          reads.push(key);
          return objects[key] ?? null;
        }),
    },
  };
};

describe("inlinePublicFileImages", () => {
  it.effect("inlines img src and CSS background urls as data URIs", () =>
    Effect.gen(function* () {
      const { store } = makeStore({
        "paywall-assets/p1/logo.png": {
          body: new Uint8Array([1, 2, 3]),
          contentType: "image/png",
        },
        "paywall-assets/p1/bg.jpg": {
          body: new Uint8Array([4, 5]),
          contentType: "image/jpeg",
        },
      });
      const html =
        `<img src="${BASE_URL}/files/paywall-assets/p1/logo.png"/>` +
        `<div style="background-image:url(&quot;${BASE_URL}/files/paywall-assets/p1/bg.jpg&quot;)"></div>`;

      const result = yield* inlinePublicFileImages(html, store);

      expect(result).toBe(
        `<img src="data:image/png;base64,AQID"/>` +
          `<div style="background-image:url(&quot;data:image/jpeg;base64,BAU=&quot;)"></div>`,
      );
    }),
  );

  it.effect("fetches each distinct url once and leaves unknown keys untouched", () =>
    Effect.gen(function* () {
      const { reads, store } = makeStore({
        "a.png": { body: new Uint8Array([9]), contentType: "image/png" },
      });
      const html =
        `<img src="${BASE_URL}/files/a.png"/><img src="${BASE_URL}/files/a.png"/>` +
        `<img src="${BASE_URL}/files/missing.png"/>`;

      const result = yield* inlinePublicFileImages(html, store);

      expect(reads).toEqual(["a.png", "missing.png"]);
      expect(result).toBe(
        `<img src="data:image/png;base64,CQ=="/><img src="data:image/png;base64,CQ=="/>` +
          `<img src="${BASE_URL}/files/missing.png"/>`,
      );
    }),
  );

  it.effect("strips query fragments when deriving the key and decodes percent-encoding", () =>
    Effect.gen(function* () {
      const { reads, store } = makeStore({
        "sprüche/ä.png": { body: new Uint8Array([7]), contentType: null },
      });
      const html = `<img src="${BASE_URL}/files/spr%C3%BCche/%C3%A4.png?v=3"/>`;

      const result = yield* inlinePublicFileImages(html, store);

      expect(reads).toEqual(["sprüche/ä.png"]);
      expect(result).toBe(`<img src="data:image/png;base64,Bw=="/>`);
    }),
  );

  it.effect("skips urls continued by an html-escaped query separator", () =>
    Effect.gen(function* () {
      const { reads, store } = makeStore({
        "a.png": { body: new Uint8Array([1]), contentType: "image/png" },
      });
      const html = `<img src="${BASE_URL}/files/a.png?v=1&amp;r=2"/>`;

      const result = yield* inlinePublicFileImages(html, store);

      expect(reads).toEqual([]);
      expect(result).toBe(html);
    }),
  );

  it.effect("skips images that would push the document over the byte budget", () =>
    Effect.gen(function* () {
      const { store } = makeStore({
        "big.png": { body: new Uint8Array(64).fill(1), contentType: "image/png" },
        "small.png": { body: new Uint8Array([1]), contentType: "image/png" },
      });
      const html = `<img src="${BASE_URL}/files/big.png"/>` + `<img src="${BASE_URL}/files/small.png"/>`;

      const result = yield* inlinePublicFileImages(html, store, { maxHtmlBytes: html.length + 20 });

      expect(result).toContain(`${BASE_URL}/files/big.png`);
      expect(result).toContain("data:image/png;base64,");
    }),
  );
});
