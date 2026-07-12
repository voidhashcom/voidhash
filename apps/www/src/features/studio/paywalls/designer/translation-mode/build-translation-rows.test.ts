import type { RootSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { describe, expect, test } from "vite-plus/test";

import type { GetLocalizablePropInfos } from "../hooks/use-localizable-props";
import { buildTranslationRows, filterTranslationGroups } from "./build-translation-rows";

// ---------------------------------------------------------------------------
// Hand-built plain snapshot fixtures (entryValue tolerates unwrapped entries).
// ---------------------------------------------------------------------------

const noImage = { resizeMode: "cover", url: "" };
const image = (url: string) => ({ resizeMode: "cover" as const, url });

function textNode(
  id: string,
  name: string,
  text: string,
  localized: { locale: string; overrides: { text?: string } }[] = [],
) {
  return { children: [], data: { localized, name, text }, id, type: "text" };
}

function viewNode(
  id: string,
  name: string,
  backgroundUrl: string,
  localized: { locale: string; overrides: { backgroundImage?: { url: string; resizeMode: string } } }[] = [],
) {
  return {
    children: [],
    data: { localized, name, style: { backgroundImage: backgroundUrl === "" ? noImage : image(backgroundUrl) } },
    id,
    type: "view",
  };
}

function componentNode(
  id: string,
  props: {
    name: string;
    value: unknown;
    localizedValues?: { locale: string; value: unknown }[];
  }[],
) {
  return {
    children: [],
    data: { componentSource: "catalog", contentHash: "hash", name: id, props },
    id,
    type: "component",
  };
}

function screenNode(id: string, name: string, children: unknown[]) {
  return {
    children,
    data: { localized: [], name, style: { backgroundImage: noImage } },
    id,
    type: "screen",
  };
}

function rootNode(children: unknown[]): RootSnapshotNode {
  return {
    children,
    data: { localization: { defaultLocale: "en", locales: [{ tag: "de" }] }, name: "Doc" },
    id: "root",
    type: "root",
  } as unknown as RootSnapshotNode;
}

const getLocalizableProps: GetLocalizablePropInfos = () => [
  { kind: "string", label: "Title", propName: "title" },
  { kind: "image", label: "Artwork", propName: "art" },
];

function fixtureRoot(): RootSnapshotNode {
  return rootNode([
    screenNode("s1", "Intro", [
      textNode("t1", "Headline", "Hello", [{ locale: "de", overrides: { text: "Hallo" } }]),
      textNode("t2", "Subtitle", "World"),
      viewNode("v1", "Hero", "https://base", [
        { locale: "de", overrides: { backgroundImage: image("https://de") } },
      ]),
      viewNode("v2", "Plain", ""),
    ]),
    screenNode("s2", "Checkout", [
      componentNode("c1", [
        {
          localizedValues: [{ locale: "de", value: { key: "string", value: "Kaufen" } }],
          name: "title",
          value: { type: "literal", value: { key: "string", value: "Buy" } },
        },
        {
          name: "art",
          value: { type: "literal", value: { key: "string", value: "https://art-base" } },
        },
      ]),
    ]),
  ]);
}

describe("buildTranslationRows", () => {
  test("groups slots by screen in tree order with screen names", () => {
    const groups = buildTranslationRows(fixtureRoot(), {
      defaultLocale: "en",
      getLocalizableProps,
      locale: "de",
    });
    expect(groups.map((group) => [group.screenId, group.screenName])).toEqual([
      ["s1", "Intro"],
      ["s2", "Checkout"],
    ]);
    expect(groups[0]?.rows.map((row) => row.key)).toEqual(["t1", "t2", "v1"]);
    expect(groups[1]?.rows.map((row) => row.key)).toEqual(["c1/title", "c1/art"]);
  });

  test("resolves text overrides for the target locale (missing → null)", () => {
    const groups = buildTranslationRows(fixtureRoot(), {
      defaultLocale: "en",
      getLocalizableProps,
      locale: "de",
    });
    const [translated, untranslated] = groups[0]?.rows ?? [];
    expect(translated).toMatchObject({ base: "Hello", kind: "text", override: "Hallo" });
    expect(untranslated).toMatchObject({ base: "World", kind: "text", override: null });
  });

  test("emits image rows only for non-empty base urls and resolves overrides", () => {
    const groups = buildTranslationRows(fixtureRoot(), {
      defaultLocale: "en",
      getLocalizableProps,
      locale: "de",
    });
    const imageRows = groups.flatMap((group) => group.rows).filter((row) => row.kind === "image");
    expect(imageRows).toHaveLength(1);
    expect(imageRows[0]).toMatchObject({
      base: { url: "https://base" },
      nodeId: "v1",
      override: { url: "https://de" },
    });
  });

  test("carries the manifest prop kind and resolves localizedValues", () => {
    const groups = buildTranslationRows(fixtureRoot(), {
      defaultLocale: "en",
      getLocalizableProps,
      locale: "de",
    });
    const propRows = groups.flatMap((group) => group.rows);
    expect(propRows.find((row) => row.key === "c1/title")).toMatchObject({
      base: "Buy",
      kind: "componentProp",
      override: "Kaufen",
      propKind: "string",
    });
    expect(propRows.find((row) => row.key === "c1/art")).toMatchObject({
      base: "https://art-base",
      override: null,
      propKind: "image",
    });
  });

  test("skips component props without a manifest lookup", () => {
    const groups = buildTranslationRows(fixtureRoot(), { defaultLocale: "en", locale: "de" });
    expect(groups.flatMap((group) => group.rows).some((row) => row.kind === "componentProp")).toBe(
      false,
    );
  });
});

describe("filterTranslationGroups", () => {
  const groups = buildTranslationRows(fixtureRoot(), {
    defaultLocale: "en",
    getLocalizableProps,
    locale: "de",
  });

  test("untranslatedOnly keeps rows without an override", () => {
    const filtered = filterTranslationGroups(groups, { untranslatedOnly: true });
    expect(filtered.flatMap((group) => group.rows).map((row) => row.key)).toEqual([
      "t2",
      "c1/art",
    ]);
  });

  test("filters by kind and by screen", () => {
    expect(
      filterTranslationGroups(groups, { kind: "image" }).flatMap((group) => group.rows),
    ).toHaveLength(1);
    const byScreen = filterTranslationGroups(groups, { screenId: "s2" });
    expect(byScreen.map((group) => group.screenId)).toEqual(["s2"]);
  });

  test("searches label, base and override values case-insensitively", () => {
    expect(
      filterTranslationGroups(groups, { search: "kaufen" }).flatMap((group) => group.rows),
    ).toHaveLength(1);
    expect(
      filterTranslationGroups(groups, { search: "HEADLINE" }).flatMap((group) => group.rows),
    ).toHaveLength(1);
    expect(filterTranslationGroups(groups, { search: "no-match-xyz" })).toEqual([]);
  });

  test("drops groups that end up empty", () => {
    const filtered = filterTranslationGroups(groups, { kind: "componentProp" });
    expect(filtered.map((group) => group.screenId)).toEqual(["s2"]);
  });
});
