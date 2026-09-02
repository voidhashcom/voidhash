import type { Properties } from "csstype";

/** A single gradient color stop, decoded from the mimic CRDT array wrapper. */
interface GradientStop {
  readonly color: string;
  readonly position: number;
}

/**
 * A gradient stop as it can appear on a decoded style. The mimic CRDT array
 * decoder wraps each element as `{ id, pos, value: { color, position } }` (and
 * a decode failure leaves `value` `undefined`), but callers that build a style
 * from a non-CRDT source (the preview-tree wire shape, hand-written test input,
 * a compiled component) pass the logical `{ color, position }` directly. Both
 * are accepted so a stop can never silently collapse to transparent because the
 * caller used the "wrong" shape — see {@link normalizeStop}.
 */
type GradientStopEntry = GradientStop | { readonly value: GradientStop | undefined };

/**
 * Reads the logical `{ color, position }` from either stop shape. Returns
 * `undefined` when the value is missing (a failed decode) or does not carry a
 * usable `color`, so callers filter it out.
 */
function normalizeStop(entry: GradientStopEntry | undefined): GradientStop | undefined {
  if (entry === undefined || entry === null) {
    return undefined;
  }
  // CRDT-wrapped entry: `{ id, pos, value: { color, position } }`. The logical
  // shape has a string `color`, so an object `value` disambiguates the wrapper.
  const candidate =
    "value" in entry && typeof (entry as { value: unknown }).value === "object"
      ? (entry as { value: GradientStop | undefined }).value
      : (entry as GradientStop);
  if (candidate === undefined || candidate === null || typeof candidate.color !== "string") {
    return undefined;
  }
  return { color: candidate.color, position: candidate.position ?? 0 };
}

/**
 * The background-related subset of a node's decoded style. `stops` accept both
 * the mimic CRDT snapshot shape (`{ id, pos, value }` entries) and the logical
 * `{ color, position }` shape; {@link normalizeStop} reconciles them.
 */
export interface BackgroundStyleInput {
  readonly backgroundEnabled?: boolean;
  readonly backgroundColor?: string;
  readonly backgroundType?: "solid" | "gradient" | "image";
  readonly backgroundGradient?: {
    readonly kind: "linear" | "radial";
    readonly startX: number;
    readonly startY: number;
    readonly endX: number;
    readonly endY: number;
    readonly stops: ReadonlyArray<GradientStopEntry>;
  };
  readonly backgroundImage?: {
    readonly url: string;
    readonly resizeMode: "cover" | "contain" | "stretch" | "center";
  };
}

const RESIZE_MODE_TO_BACKGROUND_SIZE: Record<
  NonNullable<BackgroundStyleInput["backgroundImage"]>["resizeMode"],
  string
> = {
  center: "auto",
  contain: "contain",
  cover: "cover",
  stretch: "100% 100%",
};

/**
 * Builds an inline SVG whose gradient uses `objectBoundingBox` units, so the
 * two-point normalized geometry (`0..1` node space) maps exactly onto the
 * element regardless of its aspect ratio. `preserveAspectRatio="none"` lets the
 * 1×1 viewBox stretch to fill.
 */
/** The geometry (start/end + kind) a gradient SVG needs; stops are passed separately. */
interface GradientGeometry {
  readonly kind: "linear" | "radial";
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
}

function buildGradientSvg(gradient: GradientGeometry, stops: readonly GradientStop[]): string {
  const stopEls = stops
    .map((stop) => `<stop offset='${stop.position}' stop-color='${stop.color}'/>`)
    .join("");

  const def =
    gradient.kind === "radial"
      ? // Radius is the euclidean distance from start→end; cx/cy anchor at start.
        (() => {
          const r = Math.hypot(gradient.endX - gradient.startX, gradient.endY - gradient.startY);
          return `<radialGradient id='g' cx='${gradient.startX}' cy='${gradient.startY}' r='${r}'>${stopEls}</radialGradient>`;
        })()
      : `<linearGradient id='g' x1='${gradient.startX}' y1='${gradient.startY}' x2='${gradient.endX}' y2='${gradient.endY}'>${stopEls}</linearGradient>`;

  return `<svg xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none' viewBox='0 0 1 1'><defs>${def}</defs><rect width='1' height='1' fill='url(#g)'/></svg>`;
}

/**
 * Lowers a node's background style onto CSS. `backgroundEnabled` gates every
 * type; when disabled (or when a type resolves to nothing renderable) the node
 * is `transparent`.
 *
 * - `solid` → `backgroundColor` (legacy behavior).
 * - `gradient` → an SVG data-URI `backgroundImage`, so the two-point normalized
 *   geometry stays exact independent of element aspect ratio. Stops are sorted
 *   by position. A single stop degrades to that solid color; zero stops to
 *   `transparent`.
 * - `image` → `backgroundImage: url(...)` with the resize mode mapped to
 *   `backgroundSize`. An empty url resolves to `transparent`.
 *
 * The returned fragment always sets exactly one of `backgroundColor` or the
 * `backgroundImage`/`backgroundSize`/`backgroundRepeat`/`backgroundPosition`
 * quad, so callers can spread it over a base style without leftover keys from a
 * previous background type.
 */
export function buildBackgroundStyles(style: BackgroundStyleInput): Properties {
  if (!style.backgroundEnabled) {
    return { backgroundColor: "transparent" };
  }

  const type = style.backgroundType ?? "solid";

  if (type === "gradient") {
    const gradient = style.backgroundGradient;
    // Normalize each stop from either the CRDT-wrapped or logical shape, drop
    // undecodable entries, then sort by position along the start→end line.
    const stops = (gradient?.stops ?? [])
      .map(normalizeStop)
      .filter((stop): stop is GradientStop => stop !== undefined)
      .sort((a, b) => a.position - b.position);
    if (!gradient || stops.length === 0) {
      return { backgroundColor: "transparent" };
    }
    if (stops.length === 1) {
      return { backgroundColor: stops[0]!.color };
    }
    const svg = buildGradientSvg(gradient, stops);
    return {
      backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
    };
  }

  if (type === "image") {
    const url = style.backgroundImage?.url ?? "";
    if (url === "") {
      return { backgroundColor: "transparent" };
    }
    const resizeMode = style.backgroundImage?.resizeMode ?? "cover";
    // encodeURI leaves the double-quote untouched; escape it too so it cannot
    // break out of the quoted `url("…")` token.
    const safeUrl = encodeURI(url).replace(/"/g, "%22");
    return {
      backgroundImage: `url("${safeUrl}")`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: RESIZE_MODE_TO_BACKGROUND_SIZE[resizeMode],
    };
  }

  // solid
  return { backgroundColor: style.backgroundColor };
}

/**
 * The background subset of a §3 preview-tree node style. Unlike
 * {@link BackgroundStyleInput}, this is the OSS-built wire shape: `stops` are
 * plain `{ color, position }` objects (no CRDT `{ id, pos, value }` envelope),
 * and there is no `backgroundEnabled` gate — a non-`solid` `backgroundType`
 * already implies the background is enabled (the mimic→tree lowering only emits
 * a gradient/image type when it was enabled).
 */
export interface PreviewBackgroundStyleInput {
  readonly backgroundColor?: string | undefined;
  readonly backgroundType?: "solid" | "gradient" | "image" | undefined;
  readonly backgroundGradient?:
    | {
        readonly kind: "linear" | "radial";
        readonly startX: number;
        readonly startY: number;
        readonly endX: number;
        readonly endY: number;
        readonly stops: readonly GradientStop[];
      }
    | undefined;
  readonly backgroundImage?:
    | {
        readonly url: string;
        readonly resizeMode: "cover" | "contain" | "stretch" | "center";
      }
    | undefined;
}

/**
 * Lowers a preview-tree node's background style onto CSS. Byte-compatible with
 * {@link buildBackgroundStyles} for the `gradient`/`image`/`solid` cases, but
 * reads the plain (un-enveloped) preview-tree wire shape and treats a non-solid
 * `backgroundType` as enabled. Returns only the background CSS fragment so
 * callers spread it over a base style.
 */
export function buildPreviewBackgroundStyles(style: PreviewBackgroundStyleInput): Properties {
  const type = style.backgroundType ?? "solid";

  if (type === "gradient") {
    const gradient = style.backgroundGradient;
    // Normalize defensively: the preview wire shape is logical `{ color,
    // position }`, but accept a CRDT-wrapped stop too so a mislowered tree can
    // never silently collapse the gradient to transparent.
    const stops = (gradient?.stops ?? [])
      .map(normalizeStop)
      .filter((stop): stop is GradientStop => stop !== undefined)
      .sort((a, b) => a.position - b.position);
    if (!gradient || stops.length === 0) {
      return { backgroundColor: "transparent" };
    }
    if (stops.length === 1) {
      return { backgroundColor: stops[0]!.color };
    }
    const svg = buildGradientSvg(gradient, stops);
    return {
      backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
    };
  }

  if (type === "image") {
    const url = style.backgroundImage?.url ?? "";
    if (url === "") {
      return { backgroundColor: "transparent" };
    }
    const resizeMode = style.backgroundImage?.resizeMode ?? "cover";
    const safeUrl = encodeURI(url).replace(/"/g, "%22");
    return {
      backgroundImage: `url("${safeUrl}")`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: RESIZE_MODE_TO_BACKGROUND_SIZE[resizeMode],
    };
  }

  // solid
  return style.backgroundColor === undefined ? {} : { backgroundColor: style.backgroundColor };
}
