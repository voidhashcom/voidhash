/**
 * {@link AuthorizedScope} — the single, server-derived source for the injected
 * `organization_id = {pOrg}` / `project_id IN {pPids}` bound literals (§10, §18
 * gap #12). It is *nominally branded* so it can only be minted by {@link makeAuthorizedScope},
 * which the service calls **after** `checkOrganizationPermission` succeeds — there
 * is no second tenant-setting mechanism to keep in sync, so the substitution is
 * derived from one value the user cannot influence.
 */
import { Brand } from "effect";

/** The structural payload an {@link AuthorizedScope} carries. */
export interface AuthorizedScopeFields {
  /** The single authorized organization id. */
  readonly organizationId: string;
  /** Exactly the projects the caller may read — the `project_id IN (…)` allow-set. */
  readonly availableProjectIds: readonly string[];
}

export type AuthorizedScope = Brand.Branded<AuthorizedScopeFields, "AuthorizedScope">;

const authorizedScope = Brand.nominal<AuthorizedScope>();

/**
 * Construct an {@link AuthorizedScope}. MUST only be called after an affirmative
 * `checkOrganizationPermission` against the *authorized* org (never the request
 * body) — enforced by convention in `VoidQlService.buildScope`.
 */
export const makeAuthorizedScope = (input: AuthorizedScopeFields): AuthorizedScope =>
  authorizedScope({
    organizationId: input.organizationId,
    availableProjectIds: input.availableProjectIds,
  });
