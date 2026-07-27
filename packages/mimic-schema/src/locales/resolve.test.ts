import { validate } from "@voidhash/mimic-core";
import { describe, expect, test } from "vite-plus/test";

import {
  PaywallDesignerDocument,
  type PaywallDesignerDocumentInput,
} from "../document.ts";
import type { ComponentNodeData } from "../nodes/component-node.ts";
import { localizationConfigSchema } from "../nodes/root-node.ts";
import type { ScreenNodeData } from "../nodes/screen-node.ts";
import type { TextNodeData } from "../nodes/text-node.ts";
import type { ViewNodeData } from "../nodes/view-node.ts";
import type { LocalizationConfig } from "./types.ts";
import {
  resolveBackgroundImage,
  resolveComponentPropValue,
  resolveLocale,
  resolveText,
} from "./resolve.ts";

function decodeDocument(input: PaywallDesignerDocumentInput) {
  const value = PaywallDesignerDocument.encode(input);
  const validated = validate(PaywallDesignerDocument.schema, value);
  return PaywallDesignerDocument.decode(validated)!;
}

function buildConfig(input: {
  defaultLocale?: string;
  locales?: { tag: string }[];
}): LocalizationConfig {
  const value = localizationConfigSchema.encode(input);
  return localizationConfigSchema.decode(validate(localizationConfigSchema.schema, value))!;
}

/** A screen holding one text, one view, and one component node for resolver tests. */
function buildScreen(): ScreenNodeData {
  const roots = decodeDocument([
    {
      type: "root",
      name: "Paywall",
      children: [
        {
          type: "screen",
          children: [
            {
              type: "text",
              name: "Headline",
              text: "Base text",
              localized: [
                { locale: "de", overrides: { text: "Basis" } },
                { locale: "fr", overrides: {} },
              ],
            },
            {
              type: "view",
              name: "Card",
              style: { backgroundImage: { url: "https://base.png", resizeMode: "cover" } },
              localized: [
                {
                  locale: "de",
                  overrides: { backgroundImage: { url: "https://de.png", resizeMode: "contain" } },
                },
              ],
            },
            {
              type: "component",
              componentSlug: "cta",
              componentVersion: 1,
              contentHash: "hash",
              props: [
                {
                  name: "title",
                  value: { type: "literal", value: { key: "string", value: "Buy" } },
                  localizedValues: [{ locale: "de", value: { key: "string", value: "Kaufen" } }],
                },
                {
                  name: "count",
                  value: { type: "variable-reference", value: { id: "var-1" } },
                },
              ],
            },
          ],
        },
      ],
    },
  ]);
  return roots[0]!.children[0]! as ScreenNodeData;
}

const screen = buildScreen();
const textNode = screen.children[0]! as TextNodeData;
const viewNode = screen.children[1]! as ViewNodeData;
const componentNode = screen.children[2]! as ComponentNodeData;

const titleProp = componentNode.data.props.find((entry) => entry.value?.name === "title")!.value!;
const countProp = componentNode.data.props.find((entry) => entry.value?.name === "count")!.value!;

describe("resolveLocale", () => {
  const config = buildConfig({ defaultLocale: "en", locales: [{ tag: "de" }, { tag: "pt-BR" }] });

  test("returns an exact match", () => {
    expect(resolveLocale(["de"], config)).toBe("de");
    expect(resolveLocale(["en"], config)).toBe("en");
  });

  test("language-prefix matches a preferred region tag to an enabled language", () => {
    expect(resolveLocale(["de-AT"], config)).toBe("de");
  });

  test("does not reverse-widen (enabled region tag not matched by bare language)", () => {
    const regionOnly = buildConfig({ defaultLocale: "en", locales: [{ tag: "de-DE" }] });
    expect(resolveLocale(["de"], regionOnly)).toBe("en");
  });

  test("walks preferred tags in order, exact then prefix per entry", () => {
    // First preferred (fr) has no exact/prefix match; second (de-AT) prefix-matches de.
    expect(resolveLocale(["fr", "de-AT"], config)).toBe("de");
    // An exact match on a later tag beats a prefix match on an earlier one only
    // per-entry: here the first tag pt-BR matches exactly and wins.
    expect(resolveLocale(["pt-BR", "de"], config)).toBe("pt-BR");
  });

  test("falls back to the default locale", () => {
    expect(resolveLocale(["ja", "ko"], config)).toBe("en");
    expect(resolveLocale([], config)).toBe("en");
  });

  test("matches case-insensitively, returns stored casing", () => {
    expect(resolveLocale(["PT-br"], config)).toBe("pt-BR");
  });
});

describe("resolveText", () => {
  test("returns base for the default locale or nullish locale", () => {
    expect(resolveText(textNode.data, "en", "en")).toBe("Base text");
    expect(resolveText(textNode.data, null, "en")).toBe("Base text");
    expect(resolveText(textNode.data, undefined, "en")).toBe("Base text");
  });

  test("returns an exact-locale override", () => {
    expect(resolveText(textNode.data, "de", "en")).toBe("Basis");
  });

  test("falls back through language prefix to base", () => {
    // de-AT prefix-matches the de override.
    expect(resolveText(textNode.data, "de-AT", "en")).toBe("Basis");
    // fr entry has no text override → falls back to base.
    expect(resolveText(textNode.data, "fr", "en")).toBe("Base text");
    // Unknown locale → base.
    expect(resolveText(textNode.data, "ja", "en")).toBe("Base text");
  });
});

describe("resolveBackgroundImage", () => {
  test("returns base for the default locale", () => {
    expect(resolveBackgroundImage(viewNode.data, "en", "en").url).toBe("https://base.png");
  });

  test("returns an exact-locale override (whole value)", () => {
    const resolved = resolveBackgroundImage(viewNode.data, "de", "en");
    expect(resolved.url).toBe("https://de.png");
    expect(resolved.resizeMode).toBe("contain");
  });

  test("falls back through language prefix and to base", () => {
    expect(resolveBackgroundImage(viewNode.data, "de-AT", "en").url).toBe("https://de.png");
    expect(resolveBackgroundImage(viewNode.data, "ja", "en").url).toBe("https://base.png");
  });
});

describe("resolveComponentPropValue", () => {
  test("returns base literal binding for the default locale", () => {
    const resolved = resolveComponentPropValue(titleProp, "en", "en");
    expect(resolved.type).toBe("literal");
    expect(resolved.value).toEqual({ key: "string", value: "Buy" });
  });

  test("returns a localized literal binding for an exact match", () => {
    const resolved = resolveComponentPropValue(titleProp, "de", "en");
    expect(resolved.type).toBe("literal");
    expect(resolved.value).toEqual({ key: "string", value: "Kaufen" });
  });

  test("language-prefix falls back to the localized value then base", () => {
    expect(resolveComponentPropValue(titleProp, "de-AT", "en").value).toEqual({
      key: "string",
      value: "Kaufen",
    });
    expect(resolveComponentPropValue(titleProp, "ja", "en").value).toEqual({
      key: "string",
      value: "Buy",
    });
  });

  test("returns variable-reference bindings untouched", () => {
    const resolved = resolveComponentPropValue(countProp, "de", "en");
    expect(resolved.type).toBe("variable-reference");
    expect(resolved.value).toEqual({ id: "var-1" });
  });
});

describe("duplicate locale entries", () => {
  test("first entry in array order wins deterministically", () => {
    const roots = decodeDocument([
      {
        type: "root",
        name: "Paywall",
        children: [
          {
            type: "screen",
            children: [
              {
                type: "text",
                name: "Headline",
                text: "Base",
                localized: [
                  { locale: "de", overrides: { text: "First" } },
                  { locale: "de", overrides: { text: "Second" } },
                ],
              },
            ],
          },
        ],
      },
    ]);
    const node = (roots[0]!.children[0]! as ScreenNodeData).children[0]! as TextNodeData;
    expect(resolveText(node.data, "de", "en")).toBe("First");
  });
});
