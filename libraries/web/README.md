# Voidhash Web SDK

Browser SDK for feature flags, identity, and product analytics.

Full documentation: <https://voidhash.com/docs/web>. This file covers the offline and outage
behavior most often asked about while integrating.

## Install

```sh
npm install @voidhash/web effect
```

## Create the client

```ts
import { createVoidhashClient } from "@voidhash/web";

const voidhash = createVoidhashClient({
  publishableKey: "pk_live_…",
  onDiagnostic: (diagnostic) => console.debug("[voidhash]", diagnostic),
});

await voidhash.initialize();
```

## Offline and outage behavior

If Voidhash is unreachable, slow, or returning 5xx, the worst outcome for your app is delayed
analytics. No SDK call fails, throws, or blocks startup because of the network.

- `initialize()` resolves once local state is loaded. Refreshes happen in the background.
- Reads are cache-first. `getFeatureFlags()` returns the cached value immediately when it is fresh,
  and when it is stale it waits at most 500 ms for the in-flight refresh before returning the cached
  value with `isStale: true`. Flags never expire on their own, so an offline read is always answered
  from the last evaluation; an entry that does carry a hard TTL is still served after it, with
  `isExpired: true`, after waiting up to the request timeout for fresh data.
- `track()` never rejects. Events are queued in `localStorage` (1000 events, oldest evicted first)
  and retried with jittered exponential backoff for as long as it takes. Only the queue cap or a
  non-retryable server verdict (400, 404, 409, 422, and a single event over the size limit) drops an
  event. A write that `localStorage` refuses is reported as `CACHE_WRITE_FAILED`, and the queue is
  kept in memory for the rest of the page.
- Every request is bounded by a 10 s timeout. `Retry-After` is honored on 429 and 503, header first
  and body `retry_after_ms` second.
- A circuit breaker per origin and traffic plane (api and ingest fail independently) opens after
  five consecutive transport failures and probes again after 30 s, doubling up to 5 minutes. It half-opens as soon as the browser reports `online` or the page
  becomes visible. Authentication failures and other 4xx never open it.
- On 401/403 the SDK pauses all outbound traffic — analytics and flags alike — keeps the queue on
  disk, and reports one `auth` diagnostic. The pause is lifted by `initialize()`, by `identify()` /
  `reset()`, and by a single probe once the page is foregrounded a minute later.
- Coming back online, or the page becoming visible, clears the retry backoff, flushes the queue, and
  refreshes tracked flags (at most once per minute).
- Each tab owns its own queue segment, so two tabs appending at the same time never overwrite each
  other and a batch is sent exactly once. A segment left behind by a closed tab is adopted by a
  surviving tab within about 15 s, under a cross-tab lease (Web Locks where available).
- The `pagehide` flush is capped at the 64 KB `keepalive` body limit, measured on the whole
  serialized request. Whatever does not fit — including a single event above the limit — is sent on
  the next page load.

## Diagnostics

```ts
const voidhash = createVoidhashClient({
  publishableKey: "pk_live_…",
  onDiagnostic: ({ kind, code, operation, retryable, httpStatus, message }) => {
    if (kind === "auth") {
      reportToMonitoring(code, message);
    }
  },
});
```

`kind` is one of `transport`, `eviction`, `breaker`, `auth`, `cache`. The same payload is emitted on
the event bus as `diagnostic`, and exceptions thrown by the handler are swallowed.

## Migration notes

Upgrading from `0.0.1-alpha.1`:

- `flushAnalytics()` now resolves with `{ flushed, pending, lastError? }` instead of an
  `Option<{ accepted, rejected }>`. It no longer rejects on transport failures, but still rejects
  when called before `initialize()` or after `destroy()`. The per-batch
  `accepted`/`rejected` counts are still emitted as `analytics-flushed` events.
- `FeatureFlagsResult` gained `isStale` and `isExpired`. `useFeatureFlags` exposes them alongside
  `data`, and transport failures no longer populate `error` when a cached value can be served.
- Cache entries moved to a versioned key namespace. The previous namespace is read once on a miss,
  so queued events, the distinct id, and cached flags survive the upgrade; nothing needs migrating
  by hand.
- Expired cache entries are served instead of dropped, so a cold start with an old cache now returns
  data with `isExpired: true` rather than nothing. Cached flags no longer expire at all; they go
  stale after the configured TTL and are refreshed in the background.
- New option `onDiagnostic`. Nothing else in the options shape changed.
- Call `identify` as early as you know the user: the SDK invalidates and refetches per-person state
  for you.
