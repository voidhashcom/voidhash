# Nimbus — website

The reference browser integration for [`@voidhash/web`](../../libraries/web).

Nimbus is the notes app every example in this folder implements. This one is
its marketing site: a home page and a pricing page with an upgrade button. It
is small on purpose, to show what the browser SDK does on a landing page.

## What it demonstrates

- **Page views without analytics code.** The site routes with
  `history.pushState`; the SDK records a `$pageview` for every path change.
- **Campaign attribution.** Open the site with campaign parameters, for example
  `/?utm_source=facebook&utm_medium=paid_social&utm_campaign=launch&campaign_id=1&adset_id=2&ad_id=3`.
  The SDK writes the first and latest campaign to the visitor's profile as
  `$initial_*` and `$latest_*` traits.
- **Consent first.** The client starts with consent `pending`, so nothing is
  recorded or sent until the visitor accepts. A campaign from the landing URL
  waits in `sessionStorage` and is sent once they accept, even after they
  navigated to another page; declining discards it.
- **First-party collection.** The SDK sends to `/vh` on the site's own origin,
  and the dev server forwards it to Voidhash (`vite.config.ts`), the way a
  production site's reverse proxy would, so ad blockers do not drop it.
- **Sign-up and sign-out.** Creating an account identifies the visitor with
  the new user id, linking their campaign to the user; signing out starts a
  new anonymous visitor.
- **Attributing Stripe payments.** The upgrade button shows the visitor's
  Voidhash id from `getDistinctId()`, which your server puts on the Stripe
  Checkout Session as `metadata.voidhash_distinct_id`, and on the
  subscription with `subscription_data.metadata`.
- **Checkout through a payment source.** **Buy with Nimbus Pay** sends
  `getDistinctId()` to the site's own backend, which creates the checkout at
  its provider and returns where to send the browser. The dev server forwards
  `/backend` to the [Node backend example](../backend-node#payment-source)
  (`NIMBUS_BACKEND_URL`, `http://localhost:8080` by default). Map
  `pri_pro_monthly` to a product of the `nimbus-pay` payment source, and the
  stand-in provider's checkout page pays at once and comes back here. The
  backend reports the payment with the visitor's distinct id. A failure is
  shown on the page.

## Run it

```sh
cp .env.example .env    # then set VITE_VOIDHASH_PUBLISHABLE_KEY (the test vh_pk_test_… key when testing)
pnpm --filter @voidhash/web build
pnpm --filter @voidhash/example-app-web dev
```

Open the printed URL with the campaign parameters above, accept the banner, and
the visit appears in your project with its campaign.
