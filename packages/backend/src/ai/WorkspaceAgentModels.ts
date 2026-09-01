import { getCatalogModel, type Model } from "@voidhash/agent";
import * as Effect from "effect/Effect";
import { runSync } from "../runtime-boundary.ts";
import * as Option from "effect/Option";
import { runtimeError } from "../runtime-boundary.ts";

const requiredModel = (provider: string, modelId: string): Model<string> => {
  const model = getCatalogModel(provider, modelId);
  if (Option.isNone(model)) {
    return runSync(Effect.die(runtimeError(`Missing workspace model: ${provider}/${modelId}`)));
  }
  return model.value;
};

/** Default production model for text-only workspace turns. */
export const workspaceTextModel = requiredModel(
  "cloudflare-workers-ai",
  "@cf/moonshotai/kimi-k2.7-code",
);

/** Production vision model selected only when the current user turn has images. */
export const workspaceVisionModel = requiredModel(
  "cloudflare-workers-ai",
  "@cf/meta/llama-4-scout-17b-16e-instruct",
);
