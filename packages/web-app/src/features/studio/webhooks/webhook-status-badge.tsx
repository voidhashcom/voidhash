import { Badge } from "@voidhash/ui";

type EndpointStatus = "active" | "disabled" | "failed";
type DeliveryStatus = "pending" | "in_progress" | "succeeded" | "failed" | "exhausted";

interface WebhookStatusBadgeProps {
  status: EndpointStatus | DeliveryStatus;
  className?: string;
}

const statusConfig: Record<
  EndpointStatus | DeliveryStatus,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  active: { label: "Active", variant: "default" },
  disabled: { label: "Disabled", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
  pending: { label: "Pending", variant: "secondary" },
  in_progress: { label: "In Progress", variant: "default" },
  succeeded: { label: "Succeeded", variant: "default" },
  exhausted: { label: "Exhausted", variant: "destructive" },
};

export function WebhookStatusBadge({ status, className }: WebhookStatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge className={className} variant={config.variant}>
      {config.label}
    </Badge>
  );
}
