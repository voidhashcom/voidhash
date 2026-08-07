import { constant, pick } from "@voidhash/lib/lang";

/**
 * SVG Parser utility for converting SVG strings to Shape + Path node data.
 * Handles flattening of SVG groups by applying transforms to path data.
 */

interface ViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

interface ParsedPath {
  name: string;
  d: string;
  transform: string | null;
  fillColor: string;
  fillEnabled: boolean;
  fillRule: "nonzero" | "evenodd";
  fillOpacity: number;
  strokeColor: string;
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeOpacity: number;
  strokeLinecap: "butt" | "round" | "square";
  strokeLinejoin: "miter" | "round" | "bevel";
}

export interface ParsedSvg {
  viewBox: ViewBox;
  width: number | null;
  height: number | null;
  paths: ParsedPath[];
}

const FALLBACK_VIEWBOX: ViewBox = {
  minX: 0,
  minY: 0,
  width: 24,
  height: 24,
};

const FALLBACK_COLOR = "rgba(0, 0, 0, 1)";

const INHERITABLE_STYLE_PROPERTIES = constant([
  "fill",
  "stroke",
  "stroke-width",
  "fill-rule",
  "fill-opacity",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
]);

const NAMED_COLORS: Record<string, string> = {
  black: "rgba(0, 0, 0, 1)",
  white: "rgba(255, 255, 255, 1)",
  red: "rgba(255, 0, 0, 1)",
  green: "rgba(0, 128, 0, 1)",
  blue: "rgba(0, 0, 255, 1)",
  yellow: "rgba(255, 255, 0, 1)",
  currentcolor: "rgba(0, 0, 0, 1)",
};

interface ResolvedPathStyle {
  fillColor: string;
  fillEnabled: boolean;
  fillRule: "nonzero" | "evenodd";
  fillOpacity: number;
  strokeColor: string;
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeOpacity: number;
  strokeLinecap: "butt" | "round" | "square";
  strokeLinejoin: "miter" | "round" | "bevel";
}

interface SvgElement {
  getAttribute(name: string): string | null;
  tagName: string;
  children: ArrayLike<SvgElement>;
}

interface SvgDocument {
  querySelector(selector: string): SvgElement | null;
}

type SvgParserConstructor = new () => {
  parseFromString(input: string, mimeType: string): SvgDocument;
};

function parseColorToRgba(color: string | null): string {
  if (!color || color === "none" || color === "transparent") {
    return FALLBACK_COLOR;
  }

  if (color.startsWith("rgba(")) {
    return color;
  }

  if (color.startsWith("rgb(")) {
    const match = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, 1)`;
    }
  }

  if (color.startsWith("#")) {
    const hex = color.slice(1);
    let red = 0;
    let green = 0;
    let blue = 0;

    if (hex.length === 3) {
      red = Number.parseInt((hex[0] ?? "0") + (hex[0] ?? "0"), 16);
      green = Number.parseInt((hex[1] ?? "0") + (hex[1] ?? "0"), 16);
      blue = Number.parseInt((hex[2] ?? "0") + (hex[2] ?? "0"), 16);
    } else if (hex.length === 6) {
      red = Number.parseInt(hex.slice(0, 2), 16);
      green = Number.parseInt(hex.slice(2, 4), 16);
      blue = Number.parseInt(hex.slice(4, 6), 16);
    } else {
      return FALLBACK_COLOR;
    }

    return `rgba(${red}, ${green}, ${blue}, 1)`;
  }

  return NAMED_COLORS[color.toLowerCase()] ?? FALLBACK_COLOR;
}

function parseStyleAttribute(styleAttribute: string | null): Record<string, string> {
  if (!styleAttribute) {
    return {};
  }

  const styles: Record<string, string> = {};

  for (const declaration of styleAttribute.split(";")) {
    const [rawProperty, rawValue] = declaration.split(":");
    const property = rawProperty?.trim();
    const value = rawValue?.trim();

    if (property && value) {
      styles[property] = value;
    }
  }

  return styles;
}

function resolveStyleProperty(
  element: SvgElement,
  property: string,
  inherited: Record<string, string>,
): string | null {
  const attributeValue = element.getAttribute(property);
  if (attributeValue !== null && attributeValue !== "inherit") {
    return attributeValue;
  }

  const styleValue = parseStyleAttribute(element.getAttribute("style"))[property];
  if (styleValue !== undefined && styleValue !== "inherit") {
    return styleValue;
  }

  return inherited[property] ?? null;
}

function buildInheritedStyles(
  element: SvgElement,
  inherited: Record<string, string>,
): Record<string, string> {
  const nextInherited = { ...inherited };

  for (const property of INHERITABLE_STYLE_PROPERTIES) {
    const value = resolveStyleProperty(element, property, inherited);
    if (value !== null && value !== "inherit") {
      nextInherited[property] = value;
    }
  }

  return nextInherited;
}

function combineTransforms(
  parentTransform: string | null,
  childTransform: string | null,
): string | null {
  if (!parentTransform && !childTransform) {
    return null;
  }
  if (!parentTransform) {
    return childTransform;
  }
  if (!childTransform) {
    return parentTransform;
  }
  return `${parentTransform} ${childTransform}`;
}

function parseNumber(value: string | null, fallback: number): number {
  if (value === null) {
    return fallback;
  }

  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

/** Maps a resolved `fill-rule` value onto the two rules the path node supports. */
function toFillRule(value: string | null): "nonzero" | "evenodd" {
  if (value === "evenodd") {
    return "evenodd";
  }
  return "nonzero";
}

/** Maps a resolved `stroke-linecap` value onto the supported cap union. */
function toStrokeLinecap(value: string | null): "butt" | "round" | "square" {
  if (value === "round") {
    return "round";
  }
  if (value === "square") {
    return "square";
  }
  return "butt";
}

/** Maps a resolved `stroke-linejoin` value onto the supported join union. */
function toStrokeLinejoin(value: string | null): "miter" | "round" | "bevel" {
  if (value === "round") {
    return "round";
  }
  if (value === "bevel") {
    return "bevel";
  }
  return "miter";
}

function resolvePathStyle(
  element: SvgElement,
  inherited: Record<string, string>,
  options?: { disableFill?: boolean },
): ResolvedPathStyle {
  const fill = resolveStyleProperty(element, "fill", inherited);
  const stroke = resolveStyleProperty(element, "stroke", inherited);
  const strokeWidth = resolveStyleProperty(element, "stroke-width", inherited);
  const fillRule = resolveStyleProperty(element, "fill-rule", inherited);
  const fillOpacity = resolveStyleProperty(element, "fill-opacity", inherited);
  const strokeOpacity = resolveStyleProperty(element, "stroke-opacity", inherited);
  const strokeLinecap = resolveStyleProperty(element, "stroke-linecap", inherited);
  const strokeLinejoin = resolveStyleProperty(element, "stroke-linejoin", inherited);

  const fillEnabled =
    !options?.disableFill && fill !== null && fill !== "none" && fill !== "transparent";
  const strokeEnabled = stroke !== null && stroke !== "none" && stroke !== "transparent";

  return {
    fillColor: parseColorToRgba(pick(fillEnabled, fill, "black")),
    fillEnabled,
    fillRule: toFillRule(fillRule),
    fillOpacity: parseNumber(fillOpacity, 1),
    strokeColor: parseColorToRgba(pick(strokeEnabled, stroke, "black")),
    strokeEnabled,
    strokeWidth: parseNumber(strokeWidth, 1),
    strokeOpacity: parseNumber(strokeOpacity, 1),
    strokeLinecap: toStrokeLinecap(strokeLinecap),
    strokeLinejoin: toStrokeLinejoin(strokeLinejoin),
  };
}

function nextPathName(
  pathCounter: { count: number },
  fallbackPrefix: string,
  id: string | null,
): string {
  pathCounter.count += 1;
  return id || `${fallbackPrefix} ${pathCounter.count}`;
}

function pushPath(paths: ParsedPath[], path: ParsedPath): void {
  paths.push(path);
}

function rectToPath(element: SvgElement): string {
  const x = parseNumber(element.getAttribute("x"), 0);
  const y = parseNumber(element.getAttribute("y"), 0);
  const width = parseNumber(element.getAttribute("width"), 0);
  const height = parseNumber(element.getAttribute("height"), 0);
  const rx = parseNumber(element.getAttribute("rx"), 0);
  const ry = parseNumber(element.getAttribute("ry"), rx);

  if (rx === 0 && ry === 0) {
    return `M${x},${y} h${width} v${height} h${-width} Z`;
  }

  return `M${x + rx},${y} h${width - 2 * rx} a${rx},${ry} 0 0 1 ${rx},${ry} v${height - 2 * ry} a${rx},${ry} 0 0 1 ${-rx},${ry} h${-(width - 2 * rx)} a${rx},${ry} 0 0 1 ${-rx},${-ry} v${-(height - 2 * ry)} a${rx},${ry} 0 0 1 ${rx},${-ry} Z`;
}

function circleToPath(element: SvgElement): string {
  const cx = parseNumber(element.getAttribute("cx"), 0);
  const cy = parseNumber(element.getAttribute("cy"), 0);
  const radius = parseNumber(element.getAttribute("r"), 0);

  return `M${cx - radius},${cy} a${radius},${radius} 0 1 0 ${2 * radius},0 a${radius},${radius} 0 1 0 ${-2 * radius},0`;
}

function ellipseToPath(element: SvgElement): string {
  const cx = parseNumber(element.getAttribute("cx"), 0);
  const cy = parseNumber(element.getAttribute("cy"), 0);
  const rx = parseNumber(element.getAttribute("rx"), 0);
  const ry = parseNumber(element.getAttribute("ry"), 0);

  return `M${cx - rx},${cy} a${rx},${ry} 0 1 0 ${2 * rx},0 a${rx},${ry} 0 1 0 ${-2 * rx},0`;
}

function lineToPath(element: SvgElement): string {
  const x1 = parseNumber(element.getAttribute("x1"), 0);
  const y1 = parseNumber(element.getAttribute("y1"), 0);
  const x2 = parseNumber(element.getAttribute("x2"), 0);
  const y2 = parseNumber(element.getAttribute("y2"), 0);

  return `M${x1},${y1} L${x2},${y2}`;
}

function pointsToPath(points: string, closePath: boolean): string | null {
  const coordinates = points
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (coordinates.length < 4) {
    return null;
  }

  let path = `M${coordinates[0]},${coordinates[1]}`;
  for (let i = 2; i < coordinates.length; i += 2) {
    path += ` L${coordinates[i]},${coordinates[i + 1]}`;
  }

  if (closePath) {
    path += " Z";
  }

  return path;
}

function parseViewBox(viewBoxString: string | null): ViewBox {
  if (!viewBoxString) {
    return { ...FALLBACK_VIEWBOX };
  }

  const parts = viewBoxString
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (parts.length !== 4) {
    return { ...FALLBACK_VIEWBOX };
  }

  return {
    minX: parts[0] ?? FALLBACK_VIEWBOX.minX,
    minY: parts[1] ?? FALLBACK_VIEWBOX.minY,
    width: parts[2] ?? FALLBACK_VIEWBOX.width,
    height: parts[3] ?? FALLBACK_VIEWBOX.height,
  };
}

function collectPaths(
  element: SvgElement,
  paths: ParsedPath[],
  parentTransform: string | null,
  inherited: Record<string, string>,
  pathCounter: { count: number },
): void {
  const inheritedForChildren = buildInheritedStyles(element, inherited);
  const elementTransform = element.getAttribute("transform");
  const combinedTransform = combineTransforms(parentTransform, elementTransform);

  for (let childIndex = 0; childIndex < element.children.length; childIndex += 1) {
    const child = element.children[childIndex];
    if (!child) {
      continue;
    }

    const tagName = child.tagName.toLowerCase();

    if (tagName === "g" || tagName === "svg") {
      collectPaths(child, paths, combinedTransform, inheritedForChildren, pathCounter);
      continue;
    }

    const childTransform = combineTransforms(combinedTransform, child.getAttribute("transform"));

    if (tagName === "path") {
      const d = child.getAttribute("d");
      if (!d) {
        continue;
      }

      pushPath(paths, {
        ...resolvePathStyle(child, inheritedForChildren),
        d,
        name: nextPathName(pathCounter, "Path", child.getAttribute("id")),
        transform: childTransform,
      });
      continue;
    }

    if (tagName === "rect") {
      pushPath(paths, {
        ...resolvePathStyle(child, inheritedForChildren),
        d: rectToPath(child),
        name: nextPathName(pathCounter, "Rect", child.getAttribute("id")),
        transform: childTransform,
      });
      continue;
    }

    if (tagName === "circle") {
      pushPath(paths, {
        ...resolvePathStyle(child, inheritedForChildren),
        d: circleToPath(child),
        name: nextPathName(pathCounter, "Circle", child.getAttribute("id")),
        transform: childTransform,
      });
      continue;
    }

    if (tagName === "ellipse") {
      pushPath(paths, {
        ...resolvePathStyle(child, inheritedForChildren),
        d: ellipseToPath(child),
        name: nextPathName(pathCounter, "Ellipse", child.getAttribute("id")),
        transform: childTransform,
      });
      continue;
    }

    if (tagName === "line") {
      pushPath(paths, {
        ...resolvePathStyle(child, inheritedForChildren, { disableFill: true }),
        d: lineToPath(child),
        name: nextPathName(pathCounter, "Line", child.getAttribute("id")),
        transform: childTransform,
      });
      continue;
    }

    if (tagName === "polygon" || tagName === "polyline") {
      const points = child.getAttribute("points");
      if (!points) {
        continue;
      }

      const d = pointsToPath(points, tagName === "polygon");
      if (!d) {
        continue;
      }

      pushPath(paths, {
        ...resolvePathStyle(child, inheritedForChildren, {
          disableFill: tagName === "polyline",
        }),
        d,
        name: nextPathName(
          pathCounter,
          pick(tagName === "polygon", "Polygon", "Polyline"),
          child.getAttribute("id"),
        ),
        transform: childTransform,
      });
    }
  }
}

function buildRootInheritedStyles(svg: SvgElement): Record<string, string> {
  const inherited: Record<string, string> = {};

  for (const property of INHERITABLE_STYLE_PROPERTIES) {
    const value = resolveStyleProperty(svg, property, inherited);
    if (value !== null && value !== "inherit") {
      inherited[property] = value;
    }
  }

  return inherited;
}

/** Narrows the ambient `DOMParser` global, absent outside the browser. */
function isSvgParserConstructor(value: unknown): value is SvgParserConstructor {
  return typeof value === "function";
}

/** `null` for a `NaN` measurement, so absent dimensions stay absent. */
function nullIfNaN(value: number): number | null {
  if (Number.isNaN(value)) {
    return null;
  }
  return value;
}

/**
 * Parse an SVG string into shape + paths data.
 */
export function parseSvg(svgString: string): ParsedSvg {
  const domParserConstructor: unknown = Reflect.get(globalThis, "DOMParser");
  if (!isSvgParserConstructor(domParserConstructor)) {
    return {
      viewBox: { ...FALLBACK_VIEWBOX },
      width: null,
      height: null,
      paths: [],
    };
  }

  const parser = new domParserConstructor();
  const document = parser.parseFromString(svgString, "image/svg+xml");
  const parserError = document.querySelector("parsererror");
  const svg = document.querySelector("svg");

  if (!svg || parserError) {
    return {
      viewBox: { ...FALLBACK_VIEWBOX },
      width: null,
      height: null,
      paths: [],
    };
  }

  const viewBox = parseViewBox(svg.getAttribute("viewBox"));

  const width = parseNumber(svg.getAttribute("width"), Number.NaN);
  const height = parseNumber(svg.getAttribute("height"), Number.NaN);

  const parsedWidth = nullIfNaN(width);
  const parsedHeight = nullIfNaN(height);

  if (!svg.getAttribute("viewBox") && parsedWidth !== null && parsedHeight !== null) {
    viewBox.width = parsedWidth;
    viewBox.height = parsedHeight;
  }

  const paths: ParsedPath[] = [];
  const pathCounter = { count: 0 };
  const inherited = buildRootInheritedStyles(svg);

  collectPaths(svg, paths, null, inherited, pathCounter);

  return {
    viewBox,
    width: parsedWidth,
    height: parsedHeight,
    paths,
  };
}

/**
 * Detect if a string contains SVG content.
 */
export function isSvgContent(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return trimmed.startsWith("<svg") || trimmed.startsWith("<?xml");
}
