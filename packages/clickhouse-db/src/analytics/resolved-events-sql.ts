import {
  CLICKHOUSE_EVENTS_TABLE,
  CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE,
} from "./schema.ts";

export interface ResolvedEventsSqlParts {
  readonly effectivePersonIdExpression: string;
  readonly effectiveDistinctIdExpression: string;
  readonly fromClause: string;
  readonly leftJoinClause: string;
}

export interface BuildResolvedEventsSqlOptions {
  readonly eventsAlias?: string;
  readonly overridesAlias?: string;
}

const buildLatestPendingOverridesSubquery = (overridesAlias: string) =>
  `
(
	SELECT
		project_id,
		source_distinct_id,
		target_distinct_id,
		person_id
	FROM (
		SELECT
			project_id,
			source_distinct_id,
			target_distinct_id,
			person_id,
			is_deleted,
			version,
			changed_at
		FROM ${CLICKHOUSE_PERSON_IDENTITY_PENDING_OVERRIDES_V2_TABLE}
		WHERE version > 0
		ORDER BY
			project_id ASC,
			source_distinct_id ASC,
			version DESC,
			changed_at DESC
		LIMIT 1 BY project_id, source_distinct_id
	)
	WHERE is_deleted = 0
) AS ${overridesAlias}`.trim();

export const buildResolvedEventsSql = (
  options: BuildResolvedEventsSqlOptions = {},
): ResolvedEventsSqlParts => {
  const eventsAlias = options.eventsAlias ?? "events";
  const overridesAlias = options.overridesAlias ?? "pending_overrides";

  return {
    effectivePersonIdExpression: `coalesce(${overridesAlias}.person_id, ${eventsAlias}.person_id)`,
    effectiveDistinctIdExpression: `coalesce(${overridesAlias}.target_distinct_id, ${eventsAlias}.distinct_id)`,
    fromClause: `FROM ${CLICKHOUSE_EVENTS_TABLE} AS ${eventsAlias}`,
    leftJoinClause: `LEFT JOIN ${buildLatestPendingOverridesSubquery(overridesAlias)}
ON ${overridesAlias}.project_id = ${eventsAlias}.project_id
AND ${overridesAlias}.source_distinct_id = ${eventsAlias}.distinct_id`,
  };
};
