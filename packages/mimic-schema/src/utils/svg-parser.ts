import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
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
  transform: Option.Option<string>;
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
  width: Option.Option<number>;
  height: Option.Option<number>;
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

type SvgElement = Element;
type SvgParserConstructor = new () => DOMParser;

const attribute = (element: SvgElement, name: string): Option.Option<string> =>
  Option.fromNullOr(element.getAttribute(name));

function parseColorToRgba(colorOption: Option.Option<string>): string {
  if (Option.isNone(colorOption)) {
    return FALLBACK_COLOR;
  }
  const color = colorOption.value;
  if (color === "none" || color === "transparent") return FALLBACK_COLOR;

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

function parseStyleAttribute(
  styleAttribute: Option.Option<string>,
): Readonly<Record<string, string>> {
  if (Option.isNone(styleAttribute)) return {};
  return Arr.reduce(styleAttribute.value.split(";"), {}, (styles, declaration) => {
    const [rawProperty, rawValue] = declaration.split(":");
    const property = rawProperty?.trim();
    const value = rawValue?.trim();
    return property && value ? { ...styles, [property]: value } : styles;
  });
}

function resolveStyleProperty(
  element: SvgElement,
  property: string,
  inherited: Record<string, string>,
): Option.Option<string> {
  const attributeValue = attribute(element, property);
  if (Option.exists(attributeValue, (value) => value !== "inherit")) {
    return attributeValue;
  }

  const styleValue = parseStyleAttribute(attribute(element, "style"))[property];
  if (styleValue !== undefined && styleValue !== "inherit") {
    return Option.some(styleValue);
  }

  return Option.fromUndefinedOr(inherited[property]);
}

function buildInheritedStyles(
  element: SvgElement,
  inherited: Record<string, string>,
): Record<string, string> {
  return Arr.reduce(INHERITABLE_STYLE_PROPERTIES, { ...inherited }, (nextInherited, property) => {
    const value = resolveStyleProperty(element, property, inherited);
    return Option.match(value, {
      onNone: () => nextInherited,
      onSome: (resolved) =>
        resolved === "inherit" ? nextInherited : { ...nextInherited, [property]: resolved },
    });
  });
}

function combineTransforms(
  parentTransform: Option.Option<string>,
  childTransform: Option.Option<string>,
): Option.Option<string> {
  if (Option.isNone(parentTransform)) return childTransform;
  if (Option.isNone(childTransform)) return parentTransform;
  return Option.some(`${parentTransform.value} ${childTransform.value}`);
}

function parseNumber(value: Option.Option<string>, fallback: number): number {
  if (Option.isNone(value)) return fallback;
  const parsed = Number.parseFloat(value.value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

/** Maps a resolved `fill-rule` value onto the two rules the path node supports. */
function toFillRule(value: Option.Option<string>): "nonzero" | "evenodd" {
  if (Option.contains(value, "evenodd")) {
    return "evenodd";
  }
  return "nonzero";
}

/** Maps a resolved `stroke-linecap` value onto the supported cap union. */
function toStrokeLinecap(value: Option.Option<string>): "butt" | "round" | "square" {
  if (Option.contains(value, "round")) {
    return "round";
  }
  if (Option.contains(value, "square")) {
    return "square";
  }
  return "butt";
}

/** Maps a resolved `stroke-linejoin` value onto the supported join union. */
function toStrokeLinejoin(value: Option.Option<string>): "miter" | "round" | "bevel" {
  if (Option.contains(value, "round")) {
    return "round";
  }
  if (Option.contains(value, "bevel")) {
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
    !options?.disableFill &&
    Option.exists(fill, (value) => value !== "none" && value !== "transparent");
  const strokeEnabled = Option.exists(
    stroke,
    (value) => value !== "none" && value !== "transparent",
  );

  return {
    fillColor: parseColorToRgba(pick(fillEnabled, fill, Option.some("black"))),
    fillEnabled,
    fillRule: toFillRule(fillRule),
    fillOpacity: parseNumber(fillOpacity, 1),
    strokeColor: parseColorToRgba(pick(strokeEnabled, stroke, Option.some("black"))),
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
  id: Option.Option<string>,
): string {
  pathCounter.count += 1;
  return Option.getOrElse(id, () => `${fallbackPrefix} ${pathCounter.count}`);
}

function pushPath(paths: ParsedPath[], path: ParsedPath): void {
  paths.push(path);
}

function rectToPath(element: SvgElement): string {
  const x = parseNumber(attribute(element, "x"), 0);
  const y = parseNumber(attribute(element, "y"), 0);
  const width = parseNumber(attribute(element, "width"), 0);
  const height = parseNumber(attribute(element, "height"), 0);
  const rx = parseNumber(attribute(element, "rx"), 0);
  const ry = parseNumber(attribute(element, "ry"), rx);

  if (rx === 0 && ry === 0) {
    return `M${x},${y} h${width} v${height} h${-width} Z`;
  }

  return `M${x + rx},${y} h${width - 2 * rx} a${rx},${ry} 0 0 1 ${rx},${ry} v${height - 2 * ry} a${rx},${ry} 0 0 1 ${-rx},${ry} h${-(width - 2 * rx)} a${rx},${ry} 0 0 1 ${-rx},${-ry} v${-(height - 2 * ry)} a${rx},${ry} 0 0 1 ${rx},${-ry} Z`;
}

function circleToPath(element: SvgElement): string {
  const cx = parseNumber(attribute(element, "cx"), 0);
  const cy = parseNumber(attribute(element, "cy"), 0);
  const radius = parseNumber(attribute(element, "r"), 0);

  return `M${cx - radius},${cy} a${radius},${radius} 0 1 0 ${2 * radius},0 a${radius},${radius} 0 1 0 ${-2 * radius},0`;
}

function ellipseToPath(element: SvgElement): string {
  const cx = parseNumber(attribute(element, "cx"), 0);
  const cy = parseNumber(attribute(element, "cy"), 0);
  const rx = parseNumber(attribute(element, "rx"), 0);
  const ry = parseNumber(attribute(element, "ry"), 0);

  return `M${cx - rx},${cy} a${rx},${ry} 0 1 0 ${2 * rx},0 a${rx},${ry} 0 1 0 ${-2 * rx},0`;
}

function lineToPath(element: SvgElement): string {
  const x1 = parseNumber(attribute(element, "x1"), 0);
  const y1 = parseNumber(attribute(element, "y1"), 0);
  const x2 = parseNumber(attribute(element, "x2"), 0);
  const y2 = parseNumber(attribute(element, "y2"), 0);

  return `M${x1},${y1} L${x2},${y2}`;
}

function pointsToPath(points: string, closePath: boolean): Option.Option<string> {
  const coordinates = points
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (coordinates.length < 4) {
    return Option.none();
  }

  const path = Arr.reduce(
    Arr.range(1, Math.floor(coordinates.length / 2) - 1),
    `M${coordinates[0]},${coordinates[1]}`,
    (result, index) => `${result} L${coordinates[index * 2]},${coordinates[index * 2 + 1]}`,
  );
  return Option.some(closePath ? `${path} Z` : path);
}

function parseViewBox(viewBoxString: Option.Option<string>): ViewBox {
  if (Option.isNone(viewBoxString)) {
    return { ...FALLBACK_VIEWBOX };
  }

  const parts = viewBoxString.value
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
  parentTransform: Option.Option<string>,
  inherited: Record<string, string>,
  pathCounter: { count: number },
): void {
  const inheritedForChildren = buildInheritedStyles(element, inherited);
  const elementTransform = attribute(element, "transform");
  const combinedTransform = combineTransforms(parentTransform, elementTransform);

  Arr.forEach(Arr.fromIterable(element.children), (child) => {
    const tagName = child.tagName.toLowerCase();

    if (tagName === "g" || tagName === "svg") {
      collectPaths(child, paths, combinedTransform, inheritedForChildren, pathCounter);
      return;
    }

    const childTransform = combineTransforms(combinedTransform, attribute(child, "transform"));

    if (tagName === "path") {
      const d = attribute(child, "d");
      if (Option.isNone(d)) return;

      pushPath(paths, {
        ...resolvePathStyle(child, inheritedForChildren),
        d: d.value,
        name: nextPathName(pathCounter, "Path", attribute(child, "id")),
        transform: childTransform,
      });
      return;
    }

    if (tagName === "rect") {
      pushPath(paths, {
        ...resolvePathStyle(child, inheritedForChildren),
        d: rectToPath(child),
        name: nextPathName(pathCounter, "Rect", attribute(child, "id")),
        transform: childTransform,
      });
      return;
    }

    if (tagName === "circle") {
      pushPath(paths, {
        ...resolvePathStyle(child, inheritedForChildren),
        d: circleToPath(child),
        name: nextPathName(pathCounter, "Circle", attribute(child, "id")),
        transform: childTransform,
      });
      return;
    }

    if (tagName === "ellipse") {
      pushPath(paths, {
        ...resolvePathStyle(child, inheritedForChildren),
        d: ellipseToPath(child),
        name: nextPathName(pathCounter, "Ellipse", attribute(child, "id")),
        transform: childTransform,
      });
      return;
    }

    if (tagName === "line") {
      pushPath(paths, {
        ...resolvePathStyle(child, inheritedForChildren, { disableFill: true }),
        d: lineToPath(child),
        name: nextPathName(pathCounter, "Line", attribute(child, "id")),
        transform: childTransform,
      });
      return;
    }

    if (tagName === "polygon" || tagName === "polyline") {
      const points = attribute(child, "points");
      if (Option.isNone(points)) return;

      const d = pointsToPath(points.value, tagName === "polygon");
      if (Option.isNone(d)) return;

      pushPath(paths, {
        ...resolvePathStyle(child, inheritedForChildren, {
          disableFill: tagName === "polyline",
        }),
        d: d.value,
        name: nextPathName(
          pathCounter,
          pick(tagName === "polygon", "Polygon", "Polyline"),
          attribute(child, "id"),
        ),
        transform: childTransform,
      });
    }
  });
}

function buildRootInheritedStyles(svg: SvgElement): Record<string, string> {
  return Arr.reduce(INHERITABLE_STYLE_PROPERTIES, {}, (inherited, property) => {
    const value = resolveStyleProperty(svg, property, inherited);
    return Option.match(value, {
      onNone: () => inherited,
      onSome: (resolved) =>
        resolved === "inherit" ? inherited : { ...inherited, [property]: resolved },
    });
  });
}

/** Narrows the ambient `DOMParser` global, absent outside the browser. */
function isSvgParserConstructor(value: unknown): value is SvgParserConstructor {
  return P.isFunction(value);
}

/** `None` for a `NaN` measurement, so absent dimensions stay absent. */
function optionIfNaN(value: number): Option.Option<number> {
  if (Number.isNaN(value)) {
    return Option.none();
  }
  return Option.some(value);
}

/**
 * Parse an SVG string into shape + paths data.
 */
export function parseSvg(svgString: string): ParsedSvg {
  const domParserConstructor: unknown = Reflect.get(globalThis, "DOMParser");
  if (!isSvgParserConstructor(domParserConstructor)) {
    return {
      viewBox: { ...FALLBACK_VIEWBOX },
      width: Option.none(),
      height: Option.none(),
      paths: [],
    };
  }

  const parser = new domParserConstructor();
  const document = parser.parseFromString(svgString, "image/svg+xml");
  const parserError = Option.fromNullOr(document.querySelector("parsererror"));
  const svg = Option.fromNullOr(document.querySelector("svg"));

  if (Option.isNone(svg) || Option.isSome(parserError)) {
    return {
      viewBox: { ...FALLBACK_VIEWBOX },
      width: Option.none(),
      height: Option.none(),
      paths: [],
    };
  }

  const viewBoxAttribute = attribute(svg.value, "viewBox");
  const viewBox = parseViewBox(viewBoxAttribute);

  const width = parseNumber(attribute(svg.value, "width"), Number.NaN);
  const height = parseNumber(attribute(svg.value, "height"), Number.NaN);

  const parsedWidth = optionIfNaN(width);
  const parsedHeight = optionIfNaN(height);

  if (
    Option.isNone(viewBoxAttribute) &&
    Option.isSome(parsedWidth) &&
    Option.isSome(parsedHeight)
  ) {
    viewBox.width = parsedWidth.value;
    viewBox.height = parsedHeight.value;
  }

  const paths: ParsedPath[] = [];
  const pathCounter = { count: 0 };
  const inherited = buildRootInheritedStyles(svg.value);

  collectPaths(svg.value, paths, Option.none(), inherited, pathCounter);

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
