export const WEBHOOK_EVENT_OPTIONS = [
  { label: "Person Created", value: "person.created" },
  { label: "Person Updated", value: "person.updated" },
  { label: "Person Deleted", value: "person.deleted" },
  { label: "Subscription Created", value: "subscription.created" },
  { label: "Subscription Renewed", value: "subscription.renewed" },
  { label: "Subscription Cancelled", value: "subscription.cancelled" },
  { label: "Subscription Expired", value: "subscription.expired" },
  { label: "Purchase Completed", value: "purchase.completed" },
  { label: "Purchase Refunded", value: "purchase.refunded" },
] as const;

export type WebhookEventValue = (typeof WEBHOOK_EVENT_OPTIONS)[number]["value"];

export const getEventLabel = (value: string): string => {
  const option = WEBHOOK_EVENT_OPTIONS.find((opt) => opt.value === value);
  return option?.label ?? value;
};
