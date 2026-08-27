# `@voidhash/core-v2`

`@voidhash/core-v2` is the unified successor to `@voidhash/core` and
`@voidhash/backend`. Features move here as complete vertical slices.

Analytics is the first complete feature slice and no longer has a parallel
legacy implementation. Its public API is exported from
the package root; storage clients, authorization, counters, and identity remain
ports supplied by the application composition root.

## Structure

New code should be grouped by product capability:

```text
src/
  analytics/
    domain/
      AnalyticsEvent.ts
      InternalAnalyticsEvents.ts
    application/
      ports.ts
      ports/
        AnalyticsAuthorization.ts
        AnalyticsDelivery.ts
        AnalyticsIdentity.ts
        AnalyticsPortError.ts
        AnalyticsProcessing.ts
        AnalyticsStore.ts
        CapturePolicy.ts
    ingest/
      application/
      domain/
      adapters/
        delivery/{inline,queue}.ts
        postgres/
        clickhouse/
      transport/{http,queue}/
    query/
      application/
        voidql/
      domain/
      adapters/clickhouse/
    runtime/
    AnalyticsFeature.ts
  index.ts
```

- `analytics/domain` and `analytics/application` contain contracts shared by
  ingest and query.
- `analytics/ingest` owns capture, processing, delivery, and storage writes.
- `analytics/query` owns event browsing, built-in/custom insights, and VoidQL.
- `analytics/runtime` composes the feature with infrastructure at the
  application edge without owning product behavior.
- `index.ts` is the curated package API; feature internals remain private unless
  a concrete consumer needs them.

Keep code local to a feature until at least two features need the same concept.
Shared code should express a stable capability rather than serve as a generic
utilities folder.

## Analytics pipeline

Every accepted event follows one application path:

```text
capture or trusted dispatch
  -> AnalyticsDelivery
  -> AnalyticsProcessor
  -> AnalyticsStore
```

`AnalyticsDelivery` selects inline or queued processing. `AnalyticsStore`
selects PostgreSQL or ClickHouse. Each deployment composes those services once
at its application root, while admission, validation, identity, dead-letter,
and canonical-event behavior remain shared.

PostgreSQL provides the portable event log, event browsing, pagination, and
built-in insights. ClickHouse provides the same contract plus the OSS schema,
identity projections, and the VoidQL executor. Custom insight validation and
result shaping live in `query/application` rather than in a deployment package.

Contract suites under `test/contract` assert delivery-path and storage-adapter
parity. The migrated domain, ingest, custom-insight, and VoidQL suites preserve
the existing behavior coverage.

## Migration rules

1. Do not import from `@voidhash/core` or `@voidhash/backend`. Port the required
   behavior so the new package remains independently removable and deployable.
2. Migrate one complete feature path at a time, including its domain behavior,
   transport adapters, composition, and tests.
3. Remove the superseded implementation after every consumer has switched at
   its composition root.
4. Preserve externally observable behavior during a port unless the change is
   intentional and covered by an updated contract.
