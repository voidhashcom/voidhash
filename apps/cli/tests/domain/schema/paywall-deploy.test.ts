import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  DEPLOY_MANIFEST_VERSION,
  DeployManifestSchema,
} from "../../../src/domain/schema/paywall-deploy";

const decode = Schema.decodeUnknownSync(DeployManifestSchema);

const hash = (char: string): string => char.repeat(64);

const file = (path: string, char: string) => ({
  bytes: 1024,
  path,
  sha256: hash(char),
});

const artifact = (path: string, char: string, contentType: string) => ({
  ...file(path, char),
  contentType,
});

/** A fully-populated, contract-§1-shaped manifest fixture. */
const validManifest = () => ({
  assets: [
    artifact(".voidhash/.build/paywalls/onboarding/assets/hero-AB12CD.png", "e", "image/png"),
  ],
  cliVersion: "0.0.1-alpha.1",
  components: [
    {
      artifacts: {
        panel: null,
        runtime: artifact(
          ".voidhash/.build/components/product-option/runtime.js",
          "9",
          "text/javascript; charset=utf-8",
        ),
      },
      contentHash: hash("0"),
      id: "product-option",
      manifest: artifact(
        ".voidhash/.build/components/product-option/manifest.json",
        "7",
        "application/json",
      ),
      previews: [
        {
          file: artifact(
            ".voidhash/.build/components/product-option/previews/default.json",
            "8",
            "application/json",
          ),
          state: "default",
        },
      ],
      source: file(".voidhash/components/product-option.tsx", "6"),
      title: "Product Option",
    },
  ],
  config: file("voidhash.config.ts", "d"),
  createdAt: "2026-06-11T10:00:00.000Z",
  paywalls: [
    {
      artifacts: {
        html: artifact(
          ".voidhash/.build/paywalls/onboarding/index.html",
          "b",
          "text/html; charset=utf-8",
        ),
        js: artifact(
          ".voidhash/.build/paywalls/onboarding/bundle.js",
          "c",
          "text/javascript; charset=utf-8",
        ),
      },
      assets: [".voidhash/.build/paywalls/onboarding/assets/hero-AB12CD.png"],
      contentHash: hash("1"),
      description: "Full-screen onboarding paywall.",
      id: "onboarding",
      products: ["yearly", "monthly"],
      source: file(".voidhash/paywalls/onboarding.tsx", "a"),
      title: "Onboarding",
      variables: { accentColor: "#16a34a", maxRows: 3, showTrial: true },
    },
  ],
  project: "dev-proj",
  runtimeVersion: "0.0.1-alpha.1",
  schemaVersion: DEPLOY_MANIFEST_VERSION,
  team: "voidhash-dev-sro",
});

describe("DeployManifestSchema", () => {
  it("decodes a contract-§1 manifest", () => {
    const manifest = decode(validManifest());

    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.paywalls[0]?.id).toBe("onboarding");
    expect(manifest.paywalls[0]?.variables).toEqual({
      accentColor: "#16a34a",
      maxRows: 3,
      showTrial: true,
    });
    expect(manifest.components[0]?.artifacts.panel).toBeNull();
  });

  it("accepts a component-only manifest and a panel artifact", () => {
    const fixture = validManifest();
    fixture.paywalls = [];
    fixture.components[0]!.artifacts.panel = artifact(
      ".voidhash/.build/components/product-option/panel.js",
      "f",
      "text/javascript; charset=utf-8",
    ) as never;

    const manifest = decode(fixture);
    expect(manifest.components[0]?.artifacts.panel?.sha256).toBe(hash("f"));
  });

  it("rejects unknown schema versions", () => {
    expect(() => decode({ ...validManifest(), schemaVersion: 1 })).toThrow();
  });

  it("rejects ids that do not match the slug regex", () => {
    const fixture = validManifest();
    fixture.paywalls[0]!.id = "Bad_Id";
    expect(() => decode(fixture)).toThrow();
  });

  it("rejects non-scalar variable values", () => {
    const fixture = validManifest();
    fixture.paywalls[0]!.variables = {
      accentColor: { hex: "#16a34a" },
    } as never;
    expect(() => decode(fixture)).toThrow();
  });

  it("rejects malformed sha256 digests", () => {
    const fixture = validManifest();
    fixture.paywalls[0]!.contentHash = "not-a-hash";
    expect(() => decode(fixture)).toThrow();
  });

  it("rejects a manifest with no paywalls and no components", () => {
    const fixture = validManifest();
    fixture.paywalls = [];
    fixture.components = [];
    expect(() => decode(fixture)).toThrow();
  });

  it("rejects missing required fields", () => {
    const { config: _config, ...withoutConfig } = validManifest();
    expect(() => decode(withoutConfig)).toThrow();
  });
});
