import { resolveText } from "@voidhash/mimic-schema";
import type { TextSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { buildTextStyles } from "@voidhash/paywall-renderer-web-core";
import { h } from "preact";
import * as Option from "effect/Option";

import { usePaywallContext } from "../context/paywall-context";
import { useResolvedStyle } from "../hooks/use-resolved-style";

interface TextProps {
  node: TextSnapshotNode;
}

export function Text({ node }: TextProps) {
  const style = useResolvedStyle(node.id, node.data.style, node.data.states);
  const styles = buildTextStyles(style);
  const { locale, defaultLocale } = usePaywallContext();
  return h(
    "span",
    { "data-node-id": node.id, style: styles },
    resolveText(node.data, Option.fromNullishOr(locale), defaultLocale),
  );
}
