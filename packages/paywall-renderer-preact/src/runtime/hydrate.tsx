import * as P from "effect/Predicate";
/**
 * Client-side entry point for paywall rendering.
 *
 * This file is bundled by esbuild into a self-contained IIFE that:
 * 1. Reads the serialized paywall data from the embedded script tag
 * 2. Renders interactive Preact components into the paywall root element
 *
 * The resulting bundle is inlined into the paywall HTML output.
 */

import * as Option from "effect/Option";
import { render } from "preact";

import { Paywall } from "../components/paywall";
import { resolveRuntimeLocale } from "./runtime-locale";

import type { ComponentArtifacts } from "../component-artifacts";
import type { SnapshotNode } from "@voidhash/paywall-renderer-web-core";
import * as Schema from "effect/Schema";

interface HydrationPayload {
  snapshot: SnapshotNode;
  componentArtifacts?: ComponentArtifacts;
  locale?: string;
}

function isSnapshotNode(value: object): value is SnapshotNode {
  return "type" in value;
}

function isHydrationPayload(value: object): value is HydrationPayload {
  return "snapshot" in value && P.isObject(value.snapshot) && isSnapshotNode(value.snapshot);
}

/**
 * Parses the embedded `__PAYWALL_DATA__` JSON. Artifact-carrying payloads
 * wrap the snapshot (`{ snapshot, componentArtifacts }`); bare payloads are
 * the single-root snapshot itself — detected by the top-level node `type`
 * discriminant, which the wrapper shape never carries. The discriminant works
 * for both the current nested node shape (`{type, data, children}`) and
 * legacy flat payloads, since `type` stays at the node's top level in both.
 */
function parsePaywallData(raw: string) {
  // Malformed paywall data falls through as `undefined` — leaving the SSR'd
  // HTML in place.
  const parsed = Option.getOrUndefined(
    Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(raw),
  );
  if (!P.isObject(parsed) || parsed === null) {
    return undefined;
  }
  if (isSnapshotNode(parsed)) {
    return { componentArtifacts: undefined, locale: undefined, snapshot: parsed };
  }
  if (isHydrationPayload(parsed)) {
    return {
      componentArtifacts: parsed.componentArtifacts,
      locale: parsed.locale,
      snapshot: parsed.snapshot,
    };
  }
  return undefined;
}

function mountPaywall() {
  const dataElement = document.getElementById("__PAYWALL_DATA__");
  if (!dataElement?.textContent) {
    return;
  }

  const root = document.getElementById("paywall-root");
  if (!root) {
    return;
  }

  const payload = parsePaywallData(dataElement.textContent);
  if (!payload) {
    return;
  }

  render(
    <Paywall
      componentArtifacts={payload.componentArtifacts}
      locale={resolveRuntimeLocale(payload.locale)}
      snapshot={payload.snapshot}
    />,
    root,
  );
}

// Run when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountPaywall);
} else {
  mountPaywall();
}
