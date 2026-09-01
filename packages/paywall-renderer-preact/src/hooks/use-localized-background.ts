import type { BackgroundImageSnapshot, LocalizableImageData } from "@voidhash/mimic-schema";
import { resolveBackgroundImage } from "@voidhash/mimic-schema";
import * as Option from "effect/Option";

import { usePaywallContext } from "../context/paywall-context";

/**
 * Resolves a view/screen node's effective background image for the active
 * locale. Returns the node's base `style.backgroundImage` (same reference) when
 * no per-locale override applies, so callers substitute only on a real override
 * and keep default-locale output byte-identical to the unlocalized render.
 */
export function useLocalizedBackgroundImage(data: LocalizableImageData): BackgroundImageSnapshot {
  const { locale, defaultLocale } = usePaywallContext();
  return resolveBackgroundImage(data, Option.fromNullishOr(locale), defaultLocale);
}
