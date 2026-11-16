# Voidhash Web SDK

Browser SDK for feature flags, identity, and product analytics.

Full documentation: <https://voidhash.com/docs/sdks/web>. This file covers the offline and outage
behavior most often asked about while integrating.

## Install

```sh
npm install @voidhash/web effect@^4.0.3
```

`effect` is a peer dependency: the SDK needs 4.0.3 or a later 4.x release. If your app already uses
`effect` 4, keep the version you have.

The package is ES modules only. A site without a bundler loads the script-tag build, which
includes `effect`, from `https://cdn.voidhash.com/web/latest/voidhash.global.js` instead; see
<https://voidhash.com/docs/sdks/web/script-tag>.

## Create the client

Create one client for the app, in a module of its own, and import it wherever you record events or
read flags:

```ts
// voidhash.ts
import { createVoidhashClient } from "@voidhash/web";

export const voidhash = createVoidhashClient({
  publishableKey: "vh_pk_…",
  onDiagnostic: (diagnostic) => console.debug("[voidhash]", diagnostic),
});
```

Start it once in the browser, with `voidhash.initialize()` or by rendering `VoidhashProvider` (see
[React](#react)). Creating the client touches nothing in the browser, so the module can also be
imported in code rendered on a server.

You don't need to wait for the client to start before using it. In a browser, `capture()`,
`page()`, `identify()`, `signOut()`, `reset()`, `setPersonAttributes()`, `setAdDataSharing()`,
`group()`, `setGroups()` and `resetGroups()` called before `initialize()` wait for it, then run in
the order they were called. Events keep the time they were captured at. Up to 1000 calls wait;
past that they are refused with `VoidhashNotInitializedError` until the client starts. If
`initialize()` fails, the calls waiting for it fail with its error, and `destroy()` before it makes
them fail with `VoidhashDestroyedError`. On a server, where the client cannot start, these calls
fail at once with `VoidhashNotInitializedError` instead of waiting. Reads such as
`getFeatureFlags()` and `flushAnalytics()` still need a started client.

Use the test `vh_pk_test_…` key on staging websites and the production `vh_pk_…` key in
production; see [API keys](https://voidhash.com/docs/concepts/api-keys). The key decides
the environment every event is recorded in: a test key records test events, which stay out of
production analytics. See
[Analytics events](https://voidhash.com/docs/concepts/projects-and-environments).

An environment without a project can leave the key out: `publishableKey` may be `undefined`, `null`
or blank, as an unset environment variable is. The client is then inert. It sends nothing, stores
nothing and listens to nothing; `initialize()` resolves, also on a server; every other method
resolves with an empty value instead of failing; flags read as their `featureFlags.defaults`;
`getDistinctId()` is `undefined`, and analytics consent reads `denied`. `VoidhashProvider` reports it
ready, so the app needs no code around the SDK. A secret `vh_sk_` key is still refused.

## Events

```ts
voidhash.capture("checkout_started", { plan: "pro-monthly" });
```

`capture(name, properties?)` records an event and returns at once. It never throws and never
waits for the network: the event is queued, then sent, retried and kept offline in the background.
A blank name is ignored and reported as the `ANALYTICS_EVENT_INVALID` diagnostic. An event that
cannot be recorded, as on a server or after `destroy()`, is reported as an `error` event
(`voidhash.on("error", …)`). `await voidhash.flushAnalytics()` sends the events captured so far.

An event always comes after the `identify()`, `signOut()`, `reset()`, group and consent calls made
before it, whether or not you awaited them, so it is recorded for the person your app switched to:

```ts
voidhash.identify(user.id); // not awaited
voidhash.capture("signed_in"); // recorded for user.id
```

An event never delays an `identify()` made after it. `signOut()` and `reset()` hold the events
after them for at most 2 seconds, and only with `grantConsentOnIdentify`. Without analytics
consent, `group()` and `setGroups()` hold them until their request is answered, at most 10 seconds.

`track()` is the previous name of `capture()` and is deprecated. It returns a promise that rejects
for a blank name, on a server and after `destroy()`.

## Page views, sessions and campaign attribution

- A `$pageview` is recorded on load and after every History API navigation that changes the path.
  Turn it off with `analytics: { capturePageViews: false }` and call `page()` yourself.
- `page()` sends the same `$pageview`. If your app calls `page()` on every route change, set
  `capturePageViews: false` so navigations are not counted twice.
- A `$pageleave` is recorded once per page view: on a client-side navigation, before the next
  `$pageview`, and as the page closes. It carries `url_path`, `url_origin`, `duration_ms` (visible
  time only), `max_scroll_percent`, and `lcp_ms`, `inp_ms`, and `cls` where the browser measures
  them. A hide the visitor returns from does not end it. Turn it off with
  `analytics: { capturePageLeaves: false }`; it defaults to `capturePageViews`.
- An `$outbound_click` is recorded when a link to another origin is clicked, with `target_origin`,
  never its path or query. Turn it off with `analytics: { captureOutboundClicks: false }`.
- Self-hosted projects store `$pageview`, `$pageleave`, `$outbound_click`, and `$sign_out` only after
  they are turned on in the project's event settings.
- Every event carries a session id; a session ends after 30 minutes without events.
- A visit whose URL carries `utm_*`, an ad platform's click id (`fbclid`, `gclid`, `gbraid`, `wbraid`,
  `gad_source`, `gad_campaignid`, `dclid`, `ttclid`, `msclkid`, `twclid`, `li_fat_id`, `ScCid`,
  `rdt_cid`, `epik`), `campaign_id`, `adset_id` or `ad_id` is a campaign touch. It is written to the
  person as `$initial_*` (first touch, `$set_once`) and `$latest_*` (every new touch, `$set`) traits,
  with `$fbc` and `$fbp` from Meta's cookies, and sent with that page view as `$`-prefixed properties.
- A touch has an `ad_network` from a click id, a paid `utm_medium`, an ad id, or a `utm_source` naming
  an ad platform without a medium; otherwise it is organic.
- `playStoreUrl(packageName)` builds a Google Play link whose `referrer` carries the latest touch's
  campaign values and the time of the click as `touch_at`, never an identity. It is the plain link
  without consent or without a touch.
- `crossSubdomainIdentity: true` shares the anonymous id across your subdomains with a first-party
  cookie on your registrable domain, read and written only while consent is granted. Turn it on only
  when every subdomain is trusted: each can read and set the cookie, and the id gives access to that
  person's subscriptions and perks. A device with a recorded campaign keeps its id and leaves another
  id in the cookie alone, as does one whose id the app read with `getDistinctId()`, which may be on a
  payment, and a device writes its own id only if it never used the cookie. Identifying
  a visitor rewrites the cookie with a fresh id and a digest of the id they had, and a device holding
  that id then gives it up, campaign included.

See <https://voidhash.com/docs/sdks/web/page-views-and-attribution>.

## Identity and sessions

- `identify(userId, traits?)` switches to your user id at once and links the anonymous visitor in
  the background. The link is stored in `localStorage` and retried until Voidhash confirms it, so
  `identify()` never waits for or fails on the network. Call the same id in your iOS, Android or
  React Native app and both become one person.
- From one user to another, nothing is merged: the new user is linked from a fresh anonymous alias,
  as in the native SDKs, and gets the email, name, and traits. While offline, a user's queued link
  takes the newest values; the outbox keeps at most 20 links.
- Call `identify()` wherever your app learns who the user is, as often as it does. The same id with
  the same traits as the last call sends nothing and refreshes no flags, on this page and on later
  ones: the device keeps a digest of the last profile, never the profile. Changed traits are sent.
- Other open tabs follow an identify, sign-out, or reset through the `storage` event.
- `signOut()` records `$sign_out` for the user, then starts a new anonymous identity and session.
  It does nothing when nobody is signed in: the visitor keeps their anonymous id and groups.
  Events keep the id they were recorded with.
- `reset()` differs from `signOut()` only when nobody is signed in: it then starts a fresh visitor,
  with a new anonymous id, no groups and a new session, and records no event. For a signed-in user
  it is `signOut()`, `$sign_out` included. Use it for a shared device or a guest who starts over.
- `identify`, `reset`, `signOut`, `group`, `setGroups`, `resetGroups` and `setAnalyticsConsent` take
  effect in the order you call them, whether or not you await each one. Events captured after them
  come after them too.
- `getDistinctId()` and `getSessionId()` return the current ids, or `undefined`. An anonymous
  visitor's id has the form `vh_anon_<uuid>`, made only of letters, digits, `_` and `-`, so it fits
  in any payment provider's fields.

## Groups

`group(groupType, groupKey, properties?)` puts the user in a group, such as their company:
`await voidhash.group("company", "acme", { name: "Acme", plan: "pro" })`. Every later event
carries it in `$groups`, where a group the event names itself wins for its type. The user belongs
to one group per type; the groups are stored with the distinct id, other tabs follow a change, and
`resetGroups()`, `reset()` and `signOut()` clear them. `group()` sends a `$groupidentify` with the
properties when you pass some or when the user's group of that type changed. `getGroups()` returns
the current groups by type.

`setGroups(groups)` replaces all of them in one call, for an app that knows the user's groups as a
whole:

```ts
await voidhash.setGroups({
  company: { id: "acme", name: "Acme", plan: "pro" }, // the id, with the group's properties
  team: 42, // an id alone
});
```

A type you leave out, or set to `null` or `undefined`, is dropped without an event, and `{}` is
`resetGroups()`. Call it as often as you like: a `$groupidentify` is sent only for a group whose id
changed or whose properties differ from the ones last sent, so the same call again sends nothing.
A group cannot have a property called `id`.

Groups are what your app says about the user, so `group()` and `setGroups()` send them whatever the
analytics consent. Without consent the `$groupidentify` is sent at once, in a request of its own that
says consent is missing, with the group's type, key and properties and nothing about the page, the
session or the device. It is not stored or retried then: one that did not reach Voidhash is sent by
the next `setGroups()` call.

## Feature flags

```ts
if (voidhash.isFeatureEnabled("new-checkout")) {
  // …
}

const paywall = voidhash.getVariantValue("paywall-layout"); // "annual-first", or null
```

- `isFeatureEnabled(key)` reads a flag's last evaluation, or its `featureFlags.defaults` entry
  until it has one.
- `getVariantValue(key)` returns the value of the variant a flag assigned, as you set it in
  Voidhash, when the flag is enabled and the value is text. It is `null` when the flag is off,
  unknown or not evaluated yet, when the value is not text, before `initialize()` resolves, and
  after `destroy()`. It never throws.
- `getFeatureVariant(key)` returns the whole evaluation: `enabled`, `variantKey` and `payload`, the
  variant's value as JSON.
- `getFeatureFlags(keys?)` evaluates flags and resolves with them; see
  [Offline and outage behavior](#offline-and-outage-behavior) for how long it waits.

### Typed flag keys and values

`npx voidhash-cli types generate`, run next to the `package.json` that lists `@voidhash/web` and a
`voidhash.config.ts` naming your project, writes `voidhash.gen.d.ts`, which teaches the SDK your
project's flags. Include it in your TypeScript project. `isFeatureEnabled`, `getFeatureVariant`,
`getVariantValue`, `getFeatureFlags`, `refreshFeatureFlags` and the React hook's `useFeatureFlags`,
`isEnabled`, `getVariant` and `getVariantValue` then take only the project's flag keys (archived
ones left out), and `getVariantValue` returns the text values of the flag's variants:

```ts
const layout = voidhash.getVariantValue("onboarding-first-day");
// "control" | "first_day" | "first_day_paywall" | null
```

The exported `FeatureFlagKey` and `FeatureFlagValue<K>` types name them. A flag or variant added
after you generated the file is not in those types until you generate it again (with `--watch`, it
regenerates while you work), and a value outside them can still arrive from Voidhash, so keep a
fallback branch rather than treating the union as exhaustive. Without the file, keys and values
are plain strings.

## Web purchases

Your app and your payment provider run the checkout: your server chooses the price, creates the
checkout and sends the buyer to it. Voidhash learns what was sold afterwards, from Stripe's events
or your payment source's reports. Put the buyer's distinct id on the payment so it is credited to
them and the campaign that brought them:

```ts
const response = await fetch("/api/checkout", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ distinctId: voidhash.getDistinctId(), plan: "pro-monthly" }),
});
window.location.assign((await response.json()).url);
```

- **Stripe:** set `metadata.voidhash_distinct_id` on the Checkout Session, and
  `subscription_data.metadata.voidhash_distinct_id` for a subscription, or set it on the Stripe
  Customer's metadata. See <https://voidhash.com/docs/sdks/web/stripe-revenue>.
- **Payment sources:** store the distinct id with your order and report it as the payment's
  `distinctId`. See <https://voidhash.com/docs/stores/payment-sources#sell-on-your-website>.

## First-party collection

`baseUrl` can point at a reverse proxy on your own domain, including one mounted under a path such
as `https://www.example.com/vh`. API and analytics requests keep the path. Event batches are sent
as JSON with `Content-Type: text/plain` and no custom headers, so a cross-origin batch needs no CORS
preflight; the proxy must forward the body and its content type unchanged. See
<https://voidhash.com/docs/sdks/web/first-party-proxy>.

## React

```tsx
import { VoidhashProvider, useAnalytics, useFeatureFlags } from "@voidhash/web/react";
import { voidhash } from "./voidhash";

export const App = ({ children }: { children: React.ReactNode }) => (
  <VoidhashProvider client={voidhash}>{children}</VoidhashProvider>
);

const Paywall = () => {
  const { capture } = useAnalytics();
  const { getVariantValue, isLoading } = useFeatureFlags(["paywall-layout"]);
  const layout = getVariantValue("paywall-layout");
  if (isLoading) return null;
  return <PaywallView layout={layout ?? "default"} onOpen={() => capture("paywall_opened")} />;
};
```

`VoidhashProvider` initializes the client when it mounts, which also runs the calls made before it,
such as a `capture()` from code outside React; `useVoidhash()` reports `status`
(`initializing`, `ready`, or `failed`), `initError`, and `retryInit()`. Given `config`, it creates the client and
destroys it on unmount; a remount in the same commit, as React Strict Mode does, keeps it. Given
`client`, the caller owns it and unmounting leaves it running. In the Next.js App Router, render the
provider from a `"use client"` module of your own when you pass function options; the
`@voidhash/web/react` entry point is marked `"use client"` itself. `initialize()` rejects on a
server with an error that says it needs a browser.

- `useAnalytics()` returns `capture`, `page`, `flushAnalytics`, and the consent helpers; `track` is
  deprecated, as on the client.
- `useFeatureFlags(keys?)` returns `isEnabled`, `getVariant`, `getVariantValue`, `isLoading`,
  `error` and `refetch`. `getVariantValue(key)` is `null` while `isLoading`: `null` with `isLoading`
  means the flags are still loading, and `null` without it that the flag is off, unknown, or its
  variant's value is not text.

## Offline and outage behavior

If Voidhash is unreachable, slow, or returning errors, your app keeps working. No SDK call throws
or blocks startup because of the network, and every call your app waits for has a short bound.
What an outage can cost is delayed analytics, flags answered from the cache or from their
defaults, and, after an outage long enough to fill the queue, its oldest events. Only a call that
writes to Voidhash directly and needs its answer rejects when it cannot be reached:
`setPersonAttributesSync()`.

- `initialize()` resolves once local state is loaded. Refreshes happen in the background.
- Reads are cache-first. `getFeatureFlags()` returns the cached value immediately when it is fresh,
  and when it is stale it waits at most 500 ms for the in-flight refresh before returning the cached
  value with `isStale: true`. Flags never expire on their own, so an offline read is always answered
  from the last evaluation. Only with nothing cached does a read wait for the network, at most
  `featureFlags.maxWaitMs` (2 s); without an answer by then it resolves with no flags and
  `isExpired: true` rather than rejecting, and the evaluation carries on in the background: its
  answer is cached and announced with `feature-flags-updated`.
- `isFeatureEnabled()` reads a flag without an evaluated value as its `featureFlags.defaults` entry,
  or `false`. When an anonymous visitor signs in, the visitor's flags answer for the user until the
  user's own evaluation arrives; a sign-out or a switch to another user drops them.
- `capture()` never waits for the network, and `track()` never rejects because of it; a full batch
  is sent in the background. Events are queued in `localStorage` (1000 events, oldest evicted first)
  and retried with jittered exponential backoff, at most 37.5 s apart, for as long as it takes.
  Only the queue cap, withdrawn analytics consent, a refusal of the request itself, or the storage
  budget below drops an event. A refusal is a 4xx carrying Voidhash's own error (`_tag` from the
  API, `code` from event capture), apart from 401, 403, 408, 425 and 429, or a single event over
  the size limit. A 4xx without one, as a misconfigured proxy answers, is retried like an outage.
- The queue takes at most about a million characters of the site's `localStorage`. A tab may use
  what the other tabs running the SDK leave of it, and at least an equal share next to those that
  hold a backlog (counted through Web Locks, or the markers tabs leave while they run); a tab over
  that gives back the rest when another stores its queue. That leaves most of the browser's five
  million for your app's own data during a long outage (Safari charges text the engine holds in
  two-byte form double, so there it may take up to two). The newest events that fit are stored;
  the oldest past that stay in memory for the page, and leave with it if it closes or the client
  is destroyed before they are sent, which is reported as `ANALYTICS_EVENT_DROPPED`; a page the
  browser keeps in its back/forward cache and discards later cannot report it. A page takes
  over all that a closed one left and stores it as it stores its own. A queue of one batch or less,
  as while delivery works, is stored whole. While the queue is backed up
  new events are stored at most once a second, and when the page is hidden. A write that
  `localStorage` refuses is reported once as `CACHE_WRITE_FAILED`. What the queue stored before
  stays for the next page, the rest waits in memory, and a backed-up queue tries storing again with
  its first write after a minute, and once more as the page goes away; a small one tries again with
  the next event.
- `flushAnalytics()` and `destroy()` wait at most 2 s for delivery; what is not delivered by then
  stays queued, apart from events kept in memory past the storage budget, which `destroy()`
  reports as dropped.
- Every request is bounded by a 10 s timeout. 408, 425, 429 and every 5xx answer are retried,
  including the 520–530 a CDN answers for an unreachable origin; their `Retry-After` is honored,
  header first and body `retry_after_ms` second, up to 30 s.
- A circuit breaker per origin and traffic plane (api and ingest fail independently) opens after
  five consecutive failures (no answer, a timeout, or a 408, 425 or 5xx answer, or a 4xx without
  Voidhash's error, as a proxy in front of an unreachable Voidhash answers) and probes again after
  30 s plus up to a quarter of that at random, doubling up to 5 minutes. Requests that fail while
  the browser reports being offline do not count. An open circuit is stored, so pages loaded later
  do not spend five requests each to find Voidhash down: one opened by Voidhash's failing answers
  stays open for them until its cooldown ends, then they send one probe; one opened by requests
  that got no answer lets them send one probe at once, as the visitor's connection may be back.
  It half-opens as soon as the browser reports `online` or the page becomes visible.
  Authentication failures, rate limiting, and 4xx answers carrying Voidhash's error never open it.
  While it is open, `setPersonAttributesSync()` rejects at once.
- A flush, `flushAnalytics()` included, sends at most 10 batches, so after an outage a backlog
  drains over a few flush intervals rather than all clients sending all of it the moment Voidhash
  is back.
- On 401/403 the SDK pauses all outbound traffic — analytics and flags alike — keeps the queue on
  disk, and reports one `auth` diagnostic. The pause is lifted by `initialize()`, `identify()`,
  `signOut()`, or `reset()`; otherwise a single request tries the key again once a minute.
- Coming back online, or the page becoming visible, clears the retry backoff, flushes the queue and
  queued identity links, and
  refreshes tracked flags (at most once per minute).
- Each tab owns its own queue segment, so two tabs appending at the same time never overwrite each
  other and a batch is sent exactly once. A segment left behind by a closed tab is adopted by a
  surviving tab with its next flush, every 5 s by default, under a cross-tab lock (Web Locks where
  available).
- The `pagehide` flush is capped at the 64 KB `keepalive` body limit, measured on the whole
  serialized request. Whatever does not fit — including a single event above the limit — is sent on
  the next page load.
- Events the `pagehide` flush sends are marked in the queue before the request starts. The page that
  adopts the queue does not send them again, because the page that sent them is gone and can never
  see the answer: they are delivered at most once, and lost if that request fails. They are sent
  again after a failure the sending page saw. They are not marked when the request may well not
  arrive: offline, in a browser without `keepalive` support, while the ingest circuit has failures,
  or for events already backing off. Events a regular flush is sending at that moment are left out.
  A page restored from the back-forward cache holds marked events until the answer arrives.

## Analytics consent

Usage analytics can be turned off for an end user, for example when they decline consent. Identity
and feature flags keep working.

```ts
const voidhash = createVoidhashClient({
  analyticsConsent: "pending", // "granted" (default), "denied", or "pending"
  publishableKey: "vh_pk_...",
  storeBeforeConsent: false, // keep state off the device until consent is granted
});

await voidhash.setAnalyticsConsent("granted");
voidhash.getAnalyticsConsent(); // "granted"
voidhash.on("analytics-consent-changed", ({ consent }) => {});
```

- Consent is about what the SDK records of what a person does. While it is `denied` or `pending`,
  page views, page leaves, outbound clicks, `capture`, `track` and `page` record, store, and send
  nothing, and
  a single `ANALYTICS_CONSENT_DENIED` diagnostic is reported.
- What your app says about the person is sent whatever the consent, as flags and cohorts depend on
  it: `identify` links the user, with the traits passed to it; `setPersonAttributes` and
  `setPersonAttributesSync` write their attributes; `group` and `setGroups` send groups and their
  properties. Flags are still evaluated. Those requests tell Voidhash that consent is missing, and it
  leaves what the SDK knows about the device out of the person. Without consent,
  `setPersonAttributes` sends a request of its own instead of a `$set` event, stored and retried
  like an `identify` link.
- By default, a campaign touch seen while consent is `pending` waits in `sessionStorage` and is
  sent if consent is granted in the same browser session; `denied` discards it.
- `storeBeforeConsent: false` keeps everything but the consent choice off the device while consent
  is not granted: the anonymous id, cached flags, `identify` links, and a campaign touch live in
  memory for the page. The touch survives client-side navigations and is recorded with the time of the
  click on a grant, a denial drops it, and a full page load loses it. Granting consent stores the page's
  state; revoking it removes it from the device again.
- Revoking consent discards queued events and aborts a batch that is being sent, in every open tab.
  Granting it again does not replay anything. Attributes of `setPersonAttributes` still in the queue
  are not discarded: they are sent as person writes.
- The choice is stored on the device, takes precedence over the `analyticsConsent` option on later
  visits, and is kept by `reset()`.
- `analyticsWhilePending: "buffer"` holds what happens while consent is `pending` instead of dropping
  it: up to 100 events, the oldest giving way, in memory only, each with its time and its page.
  `granted` records them in order, before anything else, under the identity, groups and session of
  that moment; `denied`, or leaving the page, discards them. Person attributes and groups are never
  held, as they are sent anyway, and a held event reports no `ANALYTICS_CONSENT_DENIED`. The default is `"drop"`.
- `grantConsentOnIdentify: true` is for an app whose terms cover analytics for signed-in users:
  `identify()` grants a consent that is still `pending`, so what was held is recorded for the
  visitor the user is then linked to. It never changes `denied`. The grant is remembered as implied,
  also on later pages: `signOut()` sends what was recorded, waiting at most 2 seconds, and returns
  consent to `pending`, and so does `reset()`. Any `setAnalyticsConsent()` call makes the
  choice the end user's own, which signing out then leaves alone.
- With a consent tool such as Cookiebot or OneTrust, set `analyticsConsentSource: "app"`: every page
  starts from the `analyticsConsent` option (`pending` by default) whatever an earlier visit stored,
  and `pending` waits for the tool's answer without discarding what earlier pages queued. Pass each
  answer the tool reports to `setAnalyticsConsent()`.
- `analytics: { enabled: false }` behaves like `denied` without storing a choice.
- `setAdDataSharing(granted)` records the end user's agreement to sharing purchases with ad
  platforms, as the person trait `$ad_data_sharing`. `true` needs analytics consent. `false` is a
  revocation: analytics consent neither blocks nor discards it, it is stored and retried until Voidhash
  has written it, or for 48 hours while Voidhash has no such person, and it records no analytics. It
  also reaches anonymous ids this browser gave up for the shared one. When someone rejects everything,
  call both it and `setAnalyticsConsent("denied")`.
- `useAnalytics()` exposes `consent`, `enabled`, `setAnalyticsConsent`, and `setAdDataSharing`.

What the SDK stores in the browser, and how to wire a consent tool: see
<https://voidhash.com/docs/sdks/web/privacy>.

## Private pages and event hooks

```ts
const voidhash = createVoidhashClient({
  publishableKey: "vh_pk_…",
  analytics: {
    // Return the address to record, or `null` to keep the page out.
    sanitizeUrl: (url) => (url.pathname.startsWith("/app/") ? null : url),
    // Return the event, changed or not, or `null` to drop it.
    beforeSend: (event) => (event.event === "internal_debug" ? null : event),
  },
});

voidhash.pauseAnalytics(); // records nothing until resumeAnalytics()
```

- `sanitizeUrl` runs on the page's address and the referrer's before anything is recorded. A page it
  returns `null` for gets no page view, page leave, outbound click, or campaign touch, and events
  recorded there carry no URL or title. A rewritten address is used everywhere the real one would be, campaign landing paths
  included.
- `beforeSend` (a function or a list) sees every event, `$pageview`, `$pageleave`, `$set` and
  `$sign_out` included, with its final `properties` and page `context`, before it is queued or stored. A
  function that throws, or returns something else than an event or `null`, drops the event and
  reports `BEFORE_SEND_FAILED`.
- `pauseAnalytics()` and `resumeAnalytics()` take effect at once and are not stored: consent does
  not change, and queued events stay queued and are still sent. A page view is recorded just after
  a navigation, so keep the pause on while the visitor is on a page it must keep out.
- `destroy()` while `initialize()` runs makes it resolve without recording the page.
- The SDK's requests send at most the page's origin as `Referer`.

See <https://voidhash.com/docs/sdks/web/privacy#keep-private-pages-out-of-analytics>.

## Diagnostics

```ts
const voidhash = createVoidhashClient({
  publishableKey: "vh_pk_…",
  onDiagnostic: ({ kind, code, operation, retryable, httpStatus, message }) => {
    if (kind === "auth") {
      reportToMonitoring(code, message);
    }
  },
});
```

`kind` is one of `transport`, `eviction`, `breaker`, `auth`, `cache`, `consent`. The same payload is emitted on
the event bus as `diagnostic`, and exceptions thrown by the handler are swallowed.

## Bundle size

What a page downloads for the SDK, with the parts of `effect` it uses, minified, measured with
esbuild (1 kB = 1,000 bytes):

| Entry                                                 | Minified | Gzip    | Brotli  |
| ----------------------------------------------------- | -------- | ------- | ------- |
| `@voidhash/web`: `createVoidhashClient` and `capture` | 126 kB   | 43.1 kB | 39.0 kB |
| With `@voidhash/web/react`: provider and hooks        | 131 kB   | 44.8 kB | 40.3 kB |

About 28 kB of the gzipped size is the SDK's own code; an app that already uses `effect` shares
the rest. The SDK uses no Effect Schema, HTTP client or hash collections at runtime, which would
more than double it.
