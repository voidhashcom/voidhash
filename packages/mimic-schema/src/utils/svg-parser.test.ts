// @vitest-environment jsdom

import { describe, expect, it } from "vite-plus/test";

import { isSvgContent, parseSvg } from "./svg-parser.ts";

describe("svg-parser", () => {
  it("detects svg content", () => {
    expect(isSvgContent("<svg></svg>")).toBe(true);
    expect(isSvgContent('<?xml version="1.0"?><svg></svg>')).toBe(true);
    expect(isSvgContent("not svg")).toBe(false);
  });

  it("parses path styles with inheritance and transform composition", () => {
    const svg = `
      <svg viewBox="0 0 24 24">
        <g transform="translate(10, 20)" style="fill: #ff0000; stroke: rgb(0, 0, 255); stroke-width: 2;">
          <path
            id="icon-path"
            d="M0,0 L10,10"
            transform="scale(2)"
            fill-rule="evenodd"
            fill-opacity="0.5"
            stroke-opacity="0.25"
          />
        </g>
      </svg>
    `;

    const parsed = parseSvg(svg);
    expect(parsed.paths).toHaveLength(1);

    const [path] = parsed.paths;
    expect(path).toMatchObject({
      name: "icon-path",
      d: "M0,0 L10,10",
      transform: "translate(10, 20) scale(2)",
      fillColor: "rgba(255, 0, 0, 1)",
      fillEnabled: true,
      fillRule: "evenodd",
      fillOpacity: 0.5,
      strokeColor: "rgba(0, 0, 255, 1)",
      strokeEnabled: true,
      strokeWidth: 2,
      strokeOpacity: 0.25,
    });
  });

  it("converts non-path primitives to path data", () => {
    const svg = `
      <svg viewBox="0 0 100 100">
        <rect id="r" x="5" y="6" width="20" height="30" />
        <circle id="c" cx="20" cy="20" r="4" />
        <ellipse id="e" cx="30" cy="40" rx="10" ry="5" />
        <line id="l" x1="1" y1="2" x2="3" y2="4" stroke="#00ff00" />
        <polygon id="pg" points="0,0 10,0 10,10" />
        <polyline id="pl" points="1,1 2,2 3,3" stroke="#000" />
      </svg>
    `;

    const parsed = parseSvg(svg);
    expect(parsed.paths).toHaveLength(6);
    expect(parsed.paths.map((p) => p.name)).toEqual(["r", "c", "e", "l", "pg", "pl"]);
    expect(parsed.paths[0]?.d.startsWith("M5,6")).toBe(true);
    expect(parsed.paths[1]?.d.includes("a4,4")).toBe(true);
    expect(parsed.paths[2]?.d.includes("a10,5")).toBe(true);
    expect(parsed.paths[3]?.d).toBe("M1,2 L3,4");
    expect(parsed.paths[4]?.d.endsWith(" Z")).toBe(true);
    expect(parsed.paths[5]?.d.endsWith(" Z")).toBe(false);
    expect(parsed.paths[3]?.fillEnabled).toBe(false);
  });

  it("handles fill/stroke disabling and defaults", () => {
    const svg = `
      <svg width="48" height="48">
        <path d="M0,0 L1,1" fill="none" stroke="transparent" />
      </svg>
    `;

    const parsed = parseSvg(svg);
    expect(parsed.viewBox.width).toBe(48);
    expect(parsed.viewBox.height).toBe(48);
    expect(parsed.paths).toHaveLength(1);

    const [path] = parsed.paths;
    expect(path?.fillEnabled).toBe(false);
    expect(path?.strokeEnabled).toBe(false);
    expect(path?.fillColor).toBe("rgba(0, 0, 0, 1)");
    expect(path?.strokeColor).toBe("rgba(0, 0, 0, 1)");
  });

  it("returns empty result for malformed or non-svg input", () => {
    expect(parseSvg("not xml")).toMatchObject({
      width: null,
      height: null,
      paths: [],
    });

    expect(parseSvg("<svg><path></svg")).toMatchObject({
      width: null,
      height: null,
      paths: [],
    });
  });
});
