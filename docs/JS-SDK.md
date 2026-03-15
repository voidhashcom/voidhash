# Voidhash Web JS SDK Implementation Plan

## Summary

This document outlines the plan for a new browser-first Voidhash JavaScript SDK.

The implementation should be heavily inspired by the existing React Native SDK, especially around:

- client creation and initialization
- identity management
- cache management
- event bus usage
- feature flag fetching ergonomics
- React provider and hooks
- error handling and runtime guards

Version 1 of the web SDK should focus on **analytics** and **feature flags**.

The following areas are explicitly out of scope for the initial release:

- paywalls
- payments
- purchase flows
- native/mobile-only platform features

## Recommended Package Shape

Create the SDK as a new library:

- path: `libraries/web`
- package name: `@voidhash/web`

This keeps the SDK family consistent with the existing React Native package:

- `libraries/react-native`
- `@voidhash/react-native`

The web package should expose:

- a framework-agnostic browser client
- a React integration layer via subpath exports such as `@voidhash/web/react`

## Goals

- Ship a browser SDK that feels structurally similar to the React Native SDK.
- Reuse existing shared packages where possible, especially `@voidhash/api-spec` and `@voidhash/shared`.
- Make feature flags production-ready first, because the backend contract already exists.
- Design analytics as a first-class SDK capability for web, even though the current React Native SDK does not yet implement an analytics transport.
- Support anonymous and identified users.
- Provide a React API that mirrors the ergonomics of the React Native hooks where practical.
- Keep the SDK SSR-safe and browser-safe.
- Keep the public surface area small and predictable for the initial release.

## Non-Goals

- Paywall rendering
- Payment collection
- Web purchase flows
- Session replay
- Full autocapture analytics
- Framework-specific adapters beyond React
- Multi-platform abstractions that weaken the browser-first design

## React Native Concepts To Reuse

The React Native SDK already gives us the right architectural direction. The web SDK should intentionally mirror the same internal module boundaries where they still make sense.

| React Native concept | Web plan |
| --- | --- |
| `createVoidhashClient` entrypoint | Keep a similar factory as the main way to construct the SDK. |
| Initialization guards in `client.tsx` | Public methods should reject or no-op consistently until initialization completes. |
| `client-effect.ts` runtime orchestration | Keep a dedicated internal runtime layer for networking, caching, identity, and feature flags. |
| `IdentityManager` | Reuse the same anonymous-to-identified user model, adapted to browser storage. |
| `CacheManager` with TTL support | Keep the same cache semantics, backed by memory plus optional persistent browser storage. |
| Event bus | Reuse an internal event bus so hooks and client subscribers share the same update path. |
| `useFeatureFlags` hook | Preserve the same basic return shape and behavior in React. |
| Shared SDK headers | Reuse the existing header model and fill the browser-compatible subset. |

One important difference: analytics for web will need new implementation work and likely some API-spec additions, because the current React Native SDK does not yet appear to ship an analytics transport.

## Proposed Directory Layout

```text
libraries/web/
  package.json
  tsconfig.json
  src/
    index.ts
    client.ts
    client-effect.ts
    types.ts
    errors.ts
    core/
      event-bus.ts
      http/
        fetch-client.ts
      identity/
        identity-manager.ts
      caching/
        cache-manager.ts
        adapters/
          memory-cache.ts
          local-storage-cache.ts
      platform/
        browser-platform-provider.ts
      feature-flags/
        feature-flag-service.ts
      analytics/
        analytics-queue.ts
        analytics-dispatcher.ts
        analytics-context.ts
    react/
      index.ts
      provider.tsx
      hooks/
        use-voidhash.ts
        use-feature-flags.ts
        use-analytics.ts
```

This layout deliberately mirrors the React Native SDK structure so code can be compared across platforms without unnecessary translation.

## Public API Proposal

The initial API should stay compact and map cleanly to the core use cases.

```ts
import { createVoidhashClient } from "@voidhash/web";

const voidhash = createVoidhashClient({
  publishableKey: "pk_live_xxx",
  baseUrl: "https://api.voidhash.com",
  observerMode: false,
  featureFlags: {
    bootstrap: false,
  },
  analytics: {
    enabled: true,
    autoPageViews: true,
  },
});

await voidhash.initialize();

await voidhash.identify("user_123", {
  plan: "pro",
  companyId: "acme",
});

await voidhash.track("checkout_started", {
  source: "pricing_page",
});

const flags = await voidhash.getFeatureFlags(["new-checkout", "new-nav"]);
const enabled = voidhash.isFeatureEnabled("new-checkout");
```

### Core Client Methods

- `initialize()`
- `identify(externalUserId, attributes?)`
- `reset()`
- `getFeatureFlags(keys?)`
- `refreshFeatureFlags(keys?)`
- `isFeatureEnabled(key)`
- `getFeatureVariant(key)`
- `track(eventName, properties?, options?)`
- `page(pageName?, properties?)`
- `flushAnalytics()`
- `on(eventName, handler)`
- `off(eventName, handler)`
- `destroy()`

### React Surface

```ts
import {
  VoidhashProvider,
  useFeatureFlags,
  useVoidhash,
} from "@voidhash/web/react";
```

The React hooks should mirror the React Native ergonomics as closely as possible:

- `useVoidhash()`
- `useFeatureFlags(keys?)`
- `useAnalytics()` or direct access through `useVoidhash()`

## Initialization Lifecycle

Initialization should follow the same disciplined flow as the React Native SDK:

1. Validate configuration.
2. Create the browser platform provider.
3. Resolve cache adapters.
4. Resolve or create an anonymous `distinctId`.
5. Build common headers and auth headers.
6. Create the internal runtime services.
7. Mark the client as initialized.
8. Optionally warm feature flag state.

Important constraints:

- No browser globals should be touched at module import time.
- `window`, `document`, `navigator`, and `localStorage` access must happen behind runtime guards.
- Public methods should fail with clear SDK errors if called before initialization.
- React components should be able to mount safely in SSR environments without crashing.

## Identity Model

The web SDK should preserve the same identity concepts as React Native:

- anonymous users get an SDK-managed generated `distinctId`
- identified users can replace the anonymous user via `identify`
- user attributes should be synchronized in a predictable order
- resetting identity should rotate back to a new anonymous user

### Identity Requirements

- Persist the current `distinctId` in browser storage.
- Keep an in-memory copy for fast request construction.
- Treat identity changes as cache boundaries.
- Clear or segregate user-scoped caches when the identity changes.
- Re-fetch feature flags after `identify` and `reset`.
- Emit an identity-changed event so React hooks and host apps can respond.

## Feature Flags Plan

Feature flags are the most straightforward capability to implement first because the backend contract already exists.

### Behavior To Preserve From React Native

- Fetch from the existing server-side flag evaluation endpoint.
- Cache responses by sorted key list.
- Use a 5-minute TTL by default.
- Emit a `feature-flags-fetched` event when fresh data arrives.
- Expose a React hook with:
  - `data`
  - `isEnabled`
  - `getVariant`
  - `isLoading`
  - `error`
  - `refetch`

### Web-Specific Enhancements

- Support bootstrapped flags from server-rendered HTML when available.
- Refresh on `visibilitychange` when the tab becomes active again.
- Refresh on `online` when the browser regains connectivity.
- Keep an in-memory cache for fast repeated lookups.
- Optionally persist the latest flag payloads in `localStorage`.

### Feature Flag Response Shape

The SDK should preserve the same conceptual shape used today:

```ts
type FeatureFlagEntry = {
  key: string;
  enabled: boolean;
  variantKey?: string | null;
  payload?: unknown;
};
```

### Initial Scope

- Remote evaluation only
- No local rule engine
- No streaming updates
- No paywall-targeting behavior

## Analytics Plan

Analytics is a first-class goal of the web SDK, but it needs a clearer contract than feature flags currently do.

### Prerequisite: API Contract Alignment

Before analytics implementation begins, the repo should define or confirm the following in `@voidhash/api-spec`:

- the analytics ingestion endpoint path
- the request payload shape
- supported batching behavior
- size limits and flush limits
- success and partial-failure semantics
- retryable vs non-retryable errors
- expected headers for browser SDK clients

This should be treated as a required upstream step. The web SDK should not invent a private analytics contract inside `libraries/web`.

### Analytics V1 Scope

- Manual `track` calls
- Manual `page` calls
- Optional automatic initial page-view capture
- Anonymous and identified user support
- Browser context enrichment
- Batched delivery
- Reliable flush on page hide / unload where possible

### Recommended Event Payload Shape

The final schema should come from `@voidhash/api-spec`, but the SDK should plan around this structure:

```ts
type AnalyticsEvent = {
  event: string;
  properties?: Record<string, unknown>;
  timestamp: string;
  distinctId: string;
  anonymousId?: string;
  context: {
    url?: string;
    path?: string;
    referrer?: string;
    locale?: string;
    userAgent?: string;
    screen?: {
      width: number;
      height: number;
    };
  };
};
```

### Delivery Strategy

- Queue events in memory for low-latency writes.
- Persist a bounded retry queue in browser storage.
- Batch events on a short interval and when the queue reaches a threshold.
- Use `navigator.sendBeacon` when supported for page-exit flushes.
- Fall back to `fetch` with `keepalive` when necessary.
- Apply exponential backoff for retryable failures.
- Drop or quarantine malformed events rather than poisoning the queue.

### Analytics V1 Non-Goals

- Click autocapture
- DOM event autocapture
- Session replay
- Heatmaps
- Cross-tab event coordination
- Marketing attribution enrichment beyond basic browser context

## Headers, Transport, and Platform Data

The web SDK should reuse the existing SDK header model instead of creating a parallel convention.

### Header Strategy

- Reuse publishable-key auth headers.
- Reuse the browser-compatible subset of common SDK headers.
- Set web-specific platform values consistently.
- Continue sending a nonce and SDK version metadata.
- Preserve observer-mode support if it is already part of the shared contract.

### Browser Platform Mapping

The browser platform provider should be responsible for gathering:

- locale information
- user agent information when permitted
- current URL context
- timezone
- screen dimensions
- debug/dev mode hints when available

Any native-only header fields should either:

- be omitted when optional, or
- be set through explicit shared defaults rather than ad hoc web-only behavior

## Storage and Caching Strategy

Use a layered cache model:

1. In-memory cache for hot reads
2. `localStorage` adapter for persistence
3. Graceful fallback to memory-only mode when storage is unavailable

### What Should Be Cached

- feature flag responses
- current identity
- pending analytics queue
- last successful analytics flush metadata if useful for debugging

### Cache Rules

- Keep the 5-minute feature flag TTL from React Native by default.
- Namespace cache keys by environment and `distinctId`.
- Keep cache clearing explicit and testable.
- Bound the analytics queue so storage growth is controlled.

## Error Handling

The public client should keep the same pattern as React Native:

- internal errors stay implementation-specific
- public methods translate them into stable SDK errors
- hooks expose user-actionable errors without leaking internal details

The web SDK should define clear error categories for:

- initialization failures
- configuration errors
- analytics dispatch failures
- feature flag fetch failures
- storage access failures
- identity errors

## React Integration

The React layer should be a thin wrapper over the core client, not a second implementation.

### Provider Behavior

- `VoidhashProvider` accepts an already-created client or client config.
- It initializes the client once on mount.
- It exposes SDK state through context.
- It subscribes to SDK events and updates hooks from the shared event bus.

### Hook Design

`useFeatureFlags(keys?)` should preserve the React Native mental model:

- fetch only when initialized
- reuse cached data when available
- subscribe to `feature-flags-fetched`
- avoid unnecessary rerenders
- expose helpers for `isEnabled` and `getVariant`

An analytics hook can stay simple in V1:

- expose `track`
- expose `page`
- expose `flushAnalytics`
- expose analytics enabled/disabled state

## Build and Publishing Requirements

- Publish TypeScript types.
- Publish ESM output.
- Publish CJS output only if the repo still requires it.
- Keep the package tree-shakeable.
- Avoid Node-only dependencies.
- Ensure the browser build does not accidentally pull in React unless the React subpath is imported.

## Testing Plan

### Unit Tests

- config validation
- initialization guards
- identity creation and reset
- cache TTL behavior
- feature flag response caching
- analytics queue enqueue/dequeue behavior
- analytics retry rules
- header construction

### Browser Integration Tests

- `localStorage` unavailable
- `sendBeacon` available vs unavailable
- `visibilitychange` refresh behavior
- `online` refresh behavior
- multiple tabs with distinct identities
- SSR-safe import and mount behavior

### Contract Tests

- feature flag request/response compatibility with `@voidhash/api-spec`
- analytics contract compatibility once defined upstream

## Example Apps and Documentation

The SDK should ship with examples in `examples/`:

- a vanilla JavaScript example
- a React example

Documentation should cover:

- installation
- initialization
- identify vs anonymous behavior
- tracking events
- fetching feature flags
- React hooks
- SSR caveats
- storage and privacy behavior

## Phased Delivery Plan

| Phase | Scope | Output |
| --- | --- | --- |
| 0 | API and package alignment | Confirm `libraries/web`, confirm `@voidhash/web`, finalize analytics API contract in `@voidhash/api-spec`. |
| 1 | Core runtime | Create client factory, runtime layer, event bus, identity manager, cache manager, browser platform provider, fetch transport. |
| 2 | Feature flags | Implement `getFeatureFlags`, caching, refetch behavior, React hook parity, tests. |
| 3 | Analytics | Implement `track`, `page`, queueing, batching, retrying, page-exit flush, tests. |
| 4 | React layer and examples | Add provider, hooks, example apps, usage docs. |
| 5 | Hardening and release | Add observability, edge-case fixes, publishing config, release docs. |

## Decisions To Lock Early

- Use `libraries/web` and `@voidhash/web`.
- Ship a core browser SDK first, with React support as a thin wrapper.
- Keep feature flags server-evaluated in V1.
- Keep analytics manual-first in V1.
- Exclude paywalls and payments completely from the initial implementation.
- Upstream any shared contract changes into `@voidhash/api-spec` before depending on them in the SDK.

## Open Questions

- What is the final public analytics ingestion contract?
- Should automatic page-view tracking be enabled by default or opt-in?
- Should bootstrapped feature flags be part of the initial release or a follow-up?
- Do we want a separate package for React helpers later, or is a `/react` subpath enough?
- What observer-mode semantics should the web SDK expose at launch?
- How much user-agent and browser-context enrichment should happen by default from a privacy standpoint?

## Recommended First Implementation Sequence

1. Create `libraries/web` with package scaffolding and shared exports.
2. Port the React Native identity, cache, and event bus concepts into browser-safe modules.
3. Implement feature flags first using the existing API contract and 5-minute TTL parity.
4. Add the React provider and `useFeatureFlags` hook.
5. Finalize the analytics API contract in `@voidhash/api-spec`.
6. Implement analytics queueing, batching, and flush behavior.
7. Add examples, tests, and publishable package metadata.

## Success Criteria For V1

- A browser app can initialize the SDK with a publishable key.
- The SDK can manage anonymous and identified users safely.
- Feature flags can be fetched, cached, and consumed from React hooks.
- Analytics events can be queued and delivered reliably from the browser.
- The SDK remains fully independent of paywall and payment code.
- The package fits the existing monorepo and naming conventions cleanly.
