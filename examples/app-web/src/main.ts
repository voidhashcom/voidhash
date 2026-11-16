import { createVoidhashClient, type AnalyticsConsent } from "@voidhash/web";

const publishableKey = import.meta.env.VITE_VOIDHASH_PUBLISHABLE_KEY;
if (!publishableKey) {
  throw new Error("Set VITE_VOIDHASH_PUBLISHABLE_KEY in .env (see .env.example).");
}

// Nothing is recorded or sent until the visitor answers the consent banner.
// A campaign they arrived from is held for the browser session meanwhile.
// Where nothing may be stored on the device before consent, as in the EU, add
// `storeBeforeConsent: false`. Requests go to `/vh` on this site, which the
// dev server forwards to Voidhash (see vite.config.ts), so ad blockers do not
// drop them.
const voidhash = createVoidhashClient({
  analyticsConsent: "pending",
  baseUrl: import.meta.env.VITE_VOIDHASH_BASE_URL || `${window.location.origin}/vh`,
  onDiagnostic: (diagnostic) => console.debug("[voidhash]", diagnostic),
  publishableKey,
});

const pages: Record<string, () => string> = {
  "/": () => `
    <h1>Nimbus</h1>
    <p>Notes that keep up with you. Free for three notes, unlimited with Pro.</p>`,
  "/pricing": () => `
    <h1>Pricing</h1>
    <p>Pro is unlimited notes and export.</p>
    <form id="sign-up">
      <input name="email" type="email" placeholder="you@example.com" required />
      <button type="submit">Create account</button>
    </form>
    <button type="button" id="sign-out">Sign out</button>
    <button type="button" id="upgrade">Upgrade to Pro</button>
    <button type="button" id="buy-with-nimbus-pay">Buy with Nimbus Pay</button>
    <p id="checkout"></p>`,
};

const render = () => {
  const page = pages[window.location.pathname] ?? pages["/"];
  const main = document.querySelector("#page");
  if (main) main.innerHTML = page?.() ?? "";
  document.querySelector("#upgrade")?.addEventListener("click", startCheckout);
  document
    .querySelector("#buy-with-nimbus-pay")
    ?.addEventListener("click", () => void buyWithPaymentSource());
  document.querySelector<HTMLFormElement>("#sign-up")?.addEventListener("submit", signUp);
  document.querySelector("#sign-out")?.addEventListener("click", signOut);
};

// A minimal client-side router. The SDK records a page view for every
// `pushState` that changes the path, so routing needs no analytics code.
document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest("a[data-link]") : null;
  if (!(link instanceof HTMLAnchorElement)) return;
  event.preventDefault();
  window.history.pushState(null, "", link.pathname);
  render();
});
window.addEventListener("popstate", render);

const showConsentBanner = (consent: AnalyticsConsent) => {
  const banner = document.querySelector<HTMLElement>("#consent");
  if (banner) banner.hidden = consent !== "pending";
};
// Also follows an answer given in another tab of the site.
voidhash.on("analytics-consent-changed", ({ consent }) => showConsentBanner(consent));
document.querySelectorAll<HTMLButtonElement>("[data-consent]").forEach((button) => {
  button.addEventListener("click", () => {
    void voidhash.setAnalyticsConsent(button.dataset.consent === "granted" ? "granted" : "denied");
  });
});

/**
 * Your backend creates the account and owns its id. Identifying with it joins
 * this visitor, and the campaign that brought them, to the user; your app
 * identifies with the same id, so web and app are one person.
 */
function signUp(event: SubmitEvent) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!(form instanceof HTMLFormElement)) return;
  const email = new FormData(form).get("email");
  const userId = crypto.randomUUID();
  void voidhash.identify(userId, typeof email === "string" ? { email } : undefined);
}

function signOut() {
  void voidhash.signOut();
}

/**
 * Your server creates the Stripe Checkout Session and puts the visitor's
 * Voidhash id in `metadata.voidhash_distinct_id`, and in
 * `subscription_data.metadata` so renewals carry it. That attributes the
 * payment, its renewals and refunds to the campaign that brought them.
 */
function startCheckout() {
  const distinctId = voidhash.getDistinctId();
  void voidhash.track("checkout_started", { plan: "pro" });
  const message = document.querySelector("#checkout");
  if (message) {
    message.textContent = `Checkout Session metadata.voidhash_distinct_id: ${distinctId ?? "(not initialized)"}.`;
  }
}

/**
 * Pro through a payment source: this site's backend (the Node backend
 * example, behind the dev server's `/backend` proxy) creates the checkout at
 * its provider with the visitor's distinct id and returns where to send them.
 * The backend reports the payment with that id, so it lands on the same
 * person, with the campaign that brought them.
 */
async function buyWithPaymentSource() {
  const message = document.querySelector("#checkout");
  const distinctId = voidhash.getDistinctId();
  if (!distinctId) {
    if (message) message.textContent = "Checkout could not start: the SDK has not started yet.";
    return;
  }
  void voidhash.track("checkout_started", { plan: "pro", source: "nimbus-pay" });
  try {
    const response = await fetch("/backend/v1/checkout", {
      body: JSON.stringify({
        cancelUrl: `${window.location.origin}/pricing`,
        distinctId,
        priceId: "pri_pro_monthly",
        successUrl: `${window.location.origin}/?checkout=success`,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) throw new Error(`the backend answered ${response.status}`);
    const checkout: unknown = await response.json();
    if (typeof checkout !== "object" || checkout === null || !("url" in checkout)) {
      throw new Error("the backend answered without a checkout URL");
    }
    window.location.assign(String(checkout.url));
  } catch (error) {
    if (message) {
      message.textContent = `Checkout could not start: ${error instanceof Error ? error.message : "unknown error"}.`;
    }
  }
}

render();
voidhash.initialize().then(
  () => showConsentBanner(voidhash.getAnalyticsConsent()),
  // The site works without analytics; the banner stays hidden and the reason is logged.
  (error: unknown) => console.error("[voidhash] could not start", error),
);
