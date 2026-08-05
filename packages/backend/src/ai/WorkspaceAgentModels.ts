import { getCatalogModel, type Model } from "@voidhash/agent";

const requiredModel = (provider: string, modelId: string): Model<string> => {
  const model = getCatalogModel(provider, modelId);
  if (model === undefined) throw new Error(`Missing workspace model: ${provider}/${modelId}`);
  return model;
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
