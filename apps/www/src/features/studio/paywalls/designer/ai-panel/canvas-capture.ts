const NODE_SELECTOR = "[data-paywall-node-id]";

/** Raster output captured from one live designer canvas node. */
export interface DesignerNodeScreenshot {
  dataBase64: string;
  width: number;
  height: number;
  scale: 1 | 2;
}

/** Exact rendered measurements returned to the design agent. */
export interface RenderedNodeLayout {
  nodeId: string;
  bounds: { x: number; y: number; width: number; height: number };
  scroll: { width: number; height: number };
  overflow: { x: string; y: string };
  typography: {
    fontFamily: string;
    fontSize: string;
    fontWeight: string;
    letterSpacing: string;
    lineHeight: string;
    color: string;
  };
  clipped: { x: boolean; y: boolean };
}

/** Find the rendered element carrying a document node's stable id. */
export function findDesignerNodeElement(nodeId: string): HTMLElement | SVGElement | null {
  for (const element of document.querySelectorAll<HTMLElement | SVGElement>(NODE_SELECTOR)) {
    if (element.getAttribute("data-paywall-node-id") === nodeId) {
      return element;
    }
  }
  return null;
}

const blobAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image asset"));
    reader.readAsDataURL(blob);
  });

async function assetAsDataUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:")) {
    return url;
  }
  try {
    const response = await fetch(url, { credentials: "include" });
    if (!response.ok) {
      return null;
    }
    return await blobAsDataUrl(await response.blob());
  } catch {
    return null;
  }
}

async function inlineBackgroundImages(value: string): Promise<string> {
  const matches = [...value.matchAll(/url\(["']?([^"')]+)["']?\)/g)];
  let result = value;
  for (const match of matches) {
    const source = match[1];
    if (!source) continue;
    const dataUrl = await assetAsDataUrl(source);
    result = result.replace(match[0], dataUrl === null ? "none" : `url("${dataUrl}")`);
  }
  return result;
}

async function copyRenderedTree(sourceRoot: Element, cloneRoot: Element): Promise<void> {
  const sources = [sourceRoot, ...sourceRoot.querySelectorAll("*")];
  const clones = [cloneRoot, ...cloneRoot.querySelectorAll("*")];

  await Promise.all(
    sources.map(async (source, index) => {
      const clone = clones[index];
      if (!(clone instanceof HTMLElement || clone instanceof SVGElement)) return;

      const computed = window.getComputedStyle(source);
      for (const property of computed) {
        clone.style.setProperty(
          property,
          computed.getPropertyValue(property),
          computed.getPropertyPriority(property),
        );
      }
      if (computed.backgroundImage !== "none") {
        clone.style.backgroundImage = await inlineBackgroundImages(computed.backgroundImage);
      }

      if (source instanceof HTMLImageElement && clone instanceof HTMLImageElement) {
        const dataUrl = await assetAsDataUrl(source.currentSrc || source.src);
        if (dataUrl === null) {
          clone.removeAttribute("src");
        } else {
          clone.src = dataUrl;
          clone.removeAttribute("srcset");
        }
      } else if (source instanceof HTMLInputElement && clone instanceof HTMLInputElement) {
        clone.setAttribute("value", source.value);
      } else if (source instanceof HTMLTextAreaElement && clone instanceof HTMLTextAreaElement) {
        clone.textContent = source.value;
      } else if (source instanceof HTMLCanvasElement && clone instanceof HTMLCanvasElement) {
        const image = document.createElement("img");
        image.src = source.toDataURL("image/png");
        image.style.cssText = clone.style.cssText;
        clone.replaceWith(image);
      }
    }),
  );
}

const loadSvgImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The browser could not rasterize the canvas node"));
    image.src = url;
  });

/**
 * Capture one currently rendered designer node as PNG using an SVG
 * `foreignObject`. Computed styles and fetchable image assets are inlined first,
 * so the result reflects the live canvas rather than a stale server thumbnail.
 */
export async function captureDesignerNodeScreenshot(
  nodeId: string,
  scale: 1 | 2,
): Promise<DesignerNodeScreenshot> {
  const source = findDesignerNodeElement(nodeId);
  if (source === null) {
    throw new Error(
      `Node "${nodeId}" is not mounted on the design canvas. Open Design mode and try again.`,
    );
  }

  const computed = window.getComputedStyle(source);
  const width = Math.max(
    1,
    Math.round(
      source.clientWidth ||
        Number.parseFloat(computed.width) ||
        source.getBoundingClientRect().width,
    ),
  );
  const height = Math.max(
    1,
    Math.round(
      source.clientHeight ||
        Number.parseFloat(computed.height) ||
        source.getBoundingClientRect().height,
    ),
  );
  const clone = source.cloneNode(true) as Element;
  await copyRenderedTree(source, clone);

  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;overflow:hidden">${serialized}</div></foreignObject></svg>`;
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));

  try {
    const image = await loadSvgImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (context === null) {
      throw new Error("Canvas 2D rendering is unavailable");
    }
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/png");
    return {
      dataBase64: dataUrl.slice(dataUrl.indexOf(",") + 1),
      height: canvas.height,
      scale,
      width: canvas.width,
    };
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

/** Measure actual browser layout for the requested rendered document nodes. */
export function inspectRenderedNodeLayouts(
  nodeIds: readonly string[],
  screenId: string,
  canvasScale: number,
): RenderedNodeLayout[] {
  const screen = findDesignerNodeElement(screenId);
  if (screen === null) {
    throw new Error("The paywall screen is not mounted on the design canvas.");
  }
  const screenRect = screen.getBoundingClientRect();
  const scale = canvasScale > 0 ? canvasScale : 1;

  return nodeIds.flatMap((nodeId) => {
    const element = findDesignerNodeElement(nodeId);
    if (element === null) return [];
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const clippedX = element.scrollWidth > element.clientWidth + 1 && style.overflowX === "hidden";
    const clippedY =
      element.scrollHeight > element.clientHeight + 1 && style.overflowY === "hidden";
    return [
      {
        nodeId,
        bounds: {
          x: (rect.left - screenRect.left) / scale,
          y: (rect.top - screenRect.top) / scale,
          width: rect.width / scale,
          height: rect.height / scale,
        },
        scroll: { width: element.scrollWidth, height: element.scrollHeight },
        overflow: { x: style.overflowX, y: style.overflowY },
        typography: {
          color: style.color,
          fontFamily: style.fontFamily,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          letterSpacing: style.letterSpacing,
          lineHeight: style.lineHeight,
        },
        clipped: { x: clippedX, y: clippedY },
      },
    ];
  });
}
