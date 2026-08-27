# Analytics

Analytics has one Effect application pipeline and two storage adapters. The
self-hosted backend uses PostgreSQL by default, so local development needs no
additional database. An operator can switch the same routes and services to an
existing ClickHouse database through configuration.

## Ingest call stack

An SDK capture follows this call stack:

```text
POST /i/v1/capture or /i/v1/batch
  EventCaptureGroupLive
    AnalyticsCapture.capture
      CaptureCredentialRepository.resolve
      admitEvent
      PolicyCounter.checkRequest / checkEvent
      AnalyticsDelivery.deliver
        inline: AnalyticsProcessor.process
        queued: AnalyticsQueueProducer.publish -> queue consumer -> AnalyticsProcessor.process
          ProcessorProjectRepository.resolve
          AnalyticsIdentityResolver.resolve
          AnalyticsStore.insert
            PostgreSQL: analytics_event
            ClickHouse: events_v2 + identity projection tables
```

The corresponding files are:

- HTTP boundary: [`packages/backend/src/routes/event-capture.ts`](../packages/backend/src/routes/event-capture.ts)
- Capture service: [`packages/core-v2/src/analytics/ingest/application/Capture.ts`](../packages/core-v2/src/analytics/ingest/application/Capture.ts)
- Delivery adapters: [`packages/core-v2/src/analytics/ingest/adapters/delivery`](../packages/core-v2/src/analytics/ingest/adapters/delivery)
- Processor: [`packages/core-v2/src/analytics/ingest/application/Processor.ts`](../packages/core-v2/src/analytics/ingest/application/Processor.ts)
- PostgreSQL adapter: [`packages/backend/src/analytics/AnalyticsLive.ts`](../packages/backend/src/analytics/AnalyticsLive.ts)
- ClickHouse adapter and schema: [`packages/core-v2/src/analytics/ingest/adapters/clickhouse`](../packages/core-v2/src/analytics/ingest/adapters/clickhouse)
- Self-hosted composition: [`apps/backend/workers/BackendWorker.ts`](../apps/backend/workers/BackendWorker.ts)

Server-trusted revenue and experiment events enter after validation through
`dispatchInternalAnalyticsEvent(s)`, then use the configured
`AnalyticsDelivery` and the same processor and store:
[`packages/core-v2/src/analytics/runtime/AnalyticsRuntime.ts`](../packages/core-v2/src/analytics/runtime/AnalyticsRuntime.ts).

## Query call stack

```text
HTTP or RPC analytics handler
  AnalyticsQuery
    AnalyticsAuthorizer
    AnalyticsStore.list / listPage
    portable series resolver
```

Start with
[`packages/core-v2/src/analytics/query/application/AnalyticsQuery.ts`](../packages/core-v2/src/analytics/query/application/AnalyticsQuery.ts).
Authorization and storage are Effect services supplied once by the application
layer, so handlers do not construct or thread their own dependencies.

## Storage selection

PostgreSQL is the default:

```dotenv
ANALYTICS_STORAGE=postgres
```

To use an operator-managed ClickHouse database:

```dotenv
ANALYTICS_STORAGE=clickhouse
ANALYTICS_CLICKHOUSE_URL=https://clickhouse.example.com:8443
ANALYTICS_CLICKHOUSE_DATABASE=default
ANALYTICS_CLICKHOUSE_USERNAME=default
ANALYTICS_CLICKHOUSE_PASSWORD=replace-me
```

When ClickHouse is selected, the backend applies the idempotent analytics table
definitions during startup. The cluster itself remains operator-managed.
Capture, queries, admission policy, identity resolution, and API contracts are
unchanged by the storage choice.
