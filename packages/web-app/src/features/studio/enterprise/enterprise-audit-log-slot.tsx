interface EnterpriseAuditLogSlotProps {
  readonly entityId: string;
  readonly entityType: string;
  readonly projectId: string;
}

/** Community extension slot reserved for a host-provided audit-log panel. */
export function EnterpriseAuditLogSlot(_props: EnterpriseAuditLogSlotProps) {
  return null;
}
