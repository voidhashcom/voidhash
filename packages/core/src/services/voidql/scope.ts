/**
 * {@link AuthorizedScope} — the single, server-derived source for the injected
 * `organization_id = {pOrg}` / `project_id IN {pPids}` bound literals (§10, §18
 * gap #12). It is *nominally branded* so it can only be minted by {@link makeAuthorizedScope},
 * which the service calls **after** `checkOrganizationPermission` succeeds — there
 * is no second tenant-setting mechanism to keep in sync, so the substitution is
 * derived from one value the user cannot influence.
 */
declare const AuthorizedScopeBrand: unique symbol;

export interface AuthorizedScope {
  readonly [AuthorizedScopeBrand]: true;
  /** The single authorized organization id. */
  readonly organizationId: string;
  /** Exactly the projects the caller may read — the `project_id IN (…)` allow-set. */
  readonly availableProjectIds: readonly string[];
}

/**
 * Construct an {@link AuthorizedScope}. MUST only be called after an affirmative
 * `checkOrganizationPermission` against the *authorized* org (never the request
 * body) — enforced by convention in `VoidQlService.buildScope`.
 */
export const makeAuthorizedScope = (input: {
  readonly organizationId: string;
  readonly availableProjectIds: readonly string[];
}): AuthorizedScope =>
  ({
    organizationId: input.organizationId,
    availableProjectIds: input.availableProjectIds,
  }) as AuthorizedScope;
