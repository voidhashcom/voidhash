/**
 * {@link AuthorizedScope} — the single, server-derived source for the injected
 * `organization_id = {pOrg}` / `project_id IN {pPids}` bound literals. It is
 * nominally branded so it can only be minted by {@link makeAuthorizedScope}
 * after authorization succeeds.
 */
import * as Brand from "effect/Brand";

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
 * Construct an {@link AuthorizedScope} from authorization-derived values.
 */
export const makeAuthorizedScope = (input: AuthorizedScopeFields): AuthorizedScope =>
  authorizedScope({
    organizationId: input.organizationId,
    availableProjectIds: input.availableProjectIds,
  });
