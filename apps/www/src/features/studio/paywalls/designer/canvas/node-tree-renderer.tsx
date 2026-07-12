import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useCallback, useLayoutEffect, useRef } from "react";
import { useStore } from "zustand/react";

import { usePaywallDesignerStore } from "../state/designer-store";
import { selectRenderRoot } from "../state/utils/document-root";
import { useBoundingBoxManager } from "./bounding-box-manager";
import { ComponentNodeRenderer } from "./node-renderers/component-node-renderer";
import { ScrollViewNodeRenderer } from "./node-renderers/scrollview-node-renderer";
import { ViewNodeRenderer } from "./node-renderers/view-node-renderer";
import { PathNodeRenderer } from "./node-renderers/path-node-renderer";
import { ScreenNodeRenderer } from "./node-renderers/screen-node-renderer";
import { ShapeNodeRenderer } from "./node-renderers/shape-node-renderer";
import { TextNodeRenderer } from "./node-renderers/text-node-renderer";

export function NodeRenderer({ node }: { node: SnapshotNode }) {
  const children = node.children;
  const elementRef = useRef<HTMLDivElement>(null);
  const pathElementRef = useRef<SVGPathElement>(null);
  const { registerElement, unregisterElement } = useBoundingBoxManager();

  // Register element with the centralized bounding box manager. View/scrollView/
  // screen/shape/component/path nodes render a STABLE styled element, so a mount-time
  // effect reading the ref once suffices. Text is the exception: its styled
  // element is keyed on edit mode and remounts, so it registers via a callback
  // ref (`registerTextElementRef` below) that re-fires on every swap — this
  // effect deliberately skips text to avoid pinning the detached old element.
  useLayoutEffect(() => {
    if (node.type === "root" || node.type === "text") {
      return;
    }

    const element = node.type === "path" ? pathElementRef.current : elementRef.current;
    if (!element) {
      return;
    }

    registerElement(node.id, element);

    return () => {
      unregisterElement(node.id);
    };
  }, [node.id, node.type, registerElement, unregisterElement]);

  // Callback ref for the text node's remounting styled element: register the
  // fresh element on mount/remount and unregister on detach, so the manager
  // always measures the connected element (never the swapped-out one).
  const registerTextElementRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (element) {
        registerElement(node.id, element);
      } else {
        unregisterElement(node.id);
      }
    },
    [node.id, registerElement, unregisterElement],
  );

  if (node.type === "root") {
    return (
      <>
        {children.map((child) => (
          <NodeRenderer key={child.id} node={child} />
        ))}
      </>
    );
  }
  if (node.type === "screen") {
    return (
      <ScreenNodeRenderer node={node} ref={elementRef}>
        {children.map((child) => (
          <NodeRenderer key={child.id} node={child} />
        ))}
      </ScreenNodeRenderer>
    );
  }
  if (node.type === "text") {
    return <TextNodeRenderer node={node} ref={registerTextElementRef} />;
  }

  if (node.type === "view") {
    return (
      <ViewNodeRenderer node={node} ref={elementRef}>
        {children.map((child) => (
          <NodeRenderer key={child.id} node={child} />
        ))}
      </ViewNodeRenderer>
    );
  }

  if (node.type === "scrollView") {
    return (
      <ScrollViewNodeRenderer node={node} ref={elementRef}>
        {children.map((child) => (
          <NodeRenderer key={child.id} node={child} />
        ))}
      </ScrollViewNodeRenderer>
    );
  }

  if (node.type === "shape") {
    return (
      <ShapeNodeRenderer node={node} ref={elementRef}>
        {children.map((child) => (
          <NodeRenderer key={child.id} node={child} />
        ))}
      </ShapeNodeRenderer>
    );
  }

  if (node.type === "path") {
    return <PathNodeRenderer node={node} ref={pathElementRef} />;
  }

  if (node.type === "component") {
    return (
      <ComponentNodeRenderer node={node} ref={elementRef}>
        {children.map((child) => (
          <NodeRenderer key={child.id} node={child} />
        ))}
      </ComponentNodeRenderer>
    );
  }

  return null;
}

export function NodeTreeRenderer() {
  const store = usePaywallDesignerStore();
  const documentRoot = useStore(store, selectRenderRoot);

  return (
    <div className="relative">
      <NodeRenderer node={documentRoot} />
    </div>
  );
}
