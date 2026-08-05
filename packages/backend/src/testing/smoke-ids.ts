export const SMOKE_RUN_ID_HEADER = "x-voidhash-rpc-smoke-run-id";
export const SMOKE_ROLE_HEADER = "x-voidhash-rpc-smoke-role";

const normalizeRunId = (runId: string): string => {
  const normalized = runId
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, "")
    .slice(0, 10);

  return normalized.length > 0 ? normalized : "default";
};

export const makeSmokeIds = (runId: string) => {
  const suffix = normalizeRunId(runId);

  return {
    adminEmail: `smoke-admin-${suffix}@example.test`,
    adminMemberId: `smk_mem_admin_${suffix}`,
    adminUserId: `smk_admin_${suffix}`,
    apiKeyId: `smk_api_key_${suffix}`,
    invitedEmail: `smoke-invite-${suffix}@example.test`,
    invitedUserId: `smk_invite_${suffix}`,
    normalEmail: `smoke-user-${suffix}@example.test`,
    normalMemberId: `smk_mem_user_${suffix}`,
    normalUserId: `smk_user_${suffix}`,
    organizationId: `smk_org_${suffix}`,
    organizationSlug: `smoke-org-${suffix}`,
    projectId: `smk_project_${suffix}`,
    projectSlug: `smoke-project-${suffix}`,
    workosAdminMembershipId: `workos_mem_admin_${suffix}`,
    // WorkOS user ids are the local id prefixed with `user_`, matching the
    // synthetic users `TestRealWorkosLive` (TestLayers.ts) derives from a WorkOS id.
    workosAdminUserId: `user_smk_admin_${suffix}`,
    workosInvitedUserId: `user_smk_invite_${suffix}`,
    workosNormalMembershipId: `workos_mem_user_${suffix}`,
    workosNormalUserId: `user_smk_user_${suffix}`,
    workosOrganizationId: `workos_org_${suffix}`,
  } as const;
};

export type SmokeIds = ReturnType<typeof makeSmokeIds>;

export const smokeIdsFromEmail = (email: string): SmokeIds | undefined => {
  const match = /^smoke-(?:admin|user|invite)-([a-z0-9]+)@example\.test$/.exec(email);
  return match ? makeSmokeIds(match[1]) : undefined;
};
