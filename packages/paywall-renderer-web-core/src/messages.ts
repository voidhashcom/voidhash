export type PaywallMessage =
  | { type: "paywall:close" }
  | { type: "paywall:purchase"; productId: string };

export function isPaywallMessage(data: unknown): data is PaywallMessage {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const msg = data as Record<string, unknown>;
  return msg.type === "paywall:close" || msg.type === "paywall:purchase";
}
