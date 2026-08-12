import { constant } from "@voidhash/lib/lang";

export const SMOKE_RUN_ID_HEADER = "x-voidhash-rpc-smoke-run-id";
export const SMOKE_ROLE_HEADER = "x-voidhash-rpc-smoke-role";

const normalizeRunId = (runId: string): string => {
  const normalized = runId
    .toLowerCase()
    .replaceAll(/[^a-z0-9]/g, "")
    .slice(0, 10);

  if (normalized.length > 0) return normalized;
  return "default";
};

/**
 * The fixture identifiers a smoke run addresses. Fields are plain strings on
 * purpose: the deployed-stage smoke tier substitutes the real organization and
 * project ids the stage minted for its run, which no template-literal type
 * derived from the run id could describe.
 */
export interface SmokeIds {
  readonly adminEmail: string;
  readonly adminMemberId: string;
  readonly adminUserId: string;
  readonly apiKeyId: string;
  readonly invitedEmail: string;
  readonly invitedUserId: string;
  readonly normalEmail: string;
  readonly normalMemberId: string;
  readonly normalUserId: string;
  readonly organizationId: string;
  readonly organizationSlug: string;
  readonly projectId: string;
  readonly projectSlug: string;
  readonly workosAdminMembershipId: string;
  readonly workosAdminUserId: string;
  readonly workosInvitedUserId: string;
  readonly workosNormalMembershipId: string;
  readonly workosNormalUserId: string;
  readonly workosOrganizationId: string;
}

export const makeSmokeIds = (runId: string): SmokeIds => {
  const suffix = normalizeRunId(runId);

  return constant({
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
  });
};

export const smokeIdsFromEmail = (email: string): SmokeIds | undefined => {
  const match = /^smoke-(?:admin|user|invite)-([a-z0-9]+)@example\.test$/.exec(email);
  if (match === null) return undefined;
  return makeSmokeIds(match[1]);
};
