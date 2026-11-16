import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as R from "effect/Record";
import { Argument, Command, Flag } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { openInBrowser } from "../../utils/browser";
import { userError } from "../../utils/error-formatter";
import { dashboardUrl, readCliConfig, resolveProject } from "../context";
import { isInteractive, requireItem } from "../input";
import { projectOption } from "../shared-options";
import { productKind } from "./catalog";
import { locationPagePath, paywallPagePath } from "./paywalls";
import { experimentPagePath } from "./experiment";
import { flagPagePath } from "./flag";
import { personPagePath } from "./person";
import { providerPagePath } from "./providers";
import { webhookPagePath } from "./webhook";

/**
 * The project's dashboard pages, by the name `voidhash-cli open` takes, with
 * their path under the project. A page of one item (`product <product>`) is
 * resolved in the handler; add a command group's own pages here.
 */
const PAGES = {
  overview: "",
  products: "products",
  product: "products",
  perks: "settings/perks",
  persons: "persons",
  person: "persons",
  flags: "flags",
  flag: "flags",
  experiments: "experiments",
  experiment: "experiments",
  paywalls: "paywalls",
  paywall: "paywalls",
  locations: "settings/paywall-locations",
  location: "settings/paywall-locations",
  components: "components",
  events: "activity/events",
  "event-settings": "settings/events",
  analytics: "analytics/revenue",
  ads: "ads",
  "ad-accounts": "settings/ad-accounts",
  campaigns: "ads/campaigns",
  creatives: "ads/creatives",
  cohorts: "ads/cohorts",
  webhooks: "settings/webhooks",
  webhook: "settings/webhooks",
  providers: "settings/payment-providers",
  provider: "settings/payment-providers",
  keys: "settings/api-keys",
  notifications: "settings/notifications",
  settings: "settings",
  domains: "settings",
  sandbox: "settings",
  push: "activity/sent-notifications",
} as const;
type Page = keyof typeof PAGES;

const PAGE_NAMES = R.keys(PAGES);

/** `voidhash-cli open [page] [item] [--no-browser]` */
export const openCommand = Command.make(
  "open",
  {
    page: Argument.Literals("page", PAGE_NAMES).pipe(
      Argument.withDescription("The dashboard page to open (default: the project's overview)"),
      Argument.optional,
    ),
    item: Argument.String("item").pipe(
      Argument.withDescription(
        "For product: the product's slug, name or id; for person: their email, distinct id or id; for webhook: the webhook's name, URL or id; for paywall or location: its slug, name or id; for provider: app-store, google-play, stripe or a payment source's slug",
      ),
      Argument.optional,
    ),
    browser: Flag.Boolean("browser").pipe(
      Flag.withDescription("Open the page in your browser; --no-browser only prints its address"),
      Flag.withDefault(true),
    ),
    project: projectOption,
  },
  ({ browser, item, page, project }) =>
    Effect.gen(function* () {
      const context = yield* resolveProject(project);
      const chosen = Option.getOrElse(page, (): Page => "overview");
      const path =
        chosen === "product"
          ? yield* Effect.gen(function* () {
              const api = yield* ApiClient;
              const products = yield* readAll((query) =>
                api.productsList(context.project.id, query),
              );
              const product = yield* requireItem(
                productKind,
                products,
                item,
                "voidhash-cli open product <product>",
              );
              return `products/${product.id}`;
            })
          : chosen === "webhook"
            ? yield* webhookPagePath(context.project.id, item)
            : chosen === "person"
              ? yield* personPagePath(context.project.id, item)
              : chosen === "paywall"
                ? yield* paywallPagePath(context.project.id, item)
                : chosen === "location"
                  ? yield* locationPagePath(context.project.id, item)
                  : chosen === "flag"
                    ? yield* flagPagePath(context.project.id, item)
                    : chosen === "experiment"
                      ? yield* experimentPagePath(context.project.id, item)
                      : chosen === "provider"
                        ? yield* providerPagePath(context.project.id, item)
                        : PAGES[chosen];
      const { web_url } = yield* readCliConfig;
      const url = yield* Effect.fromOption(dashboardUrl(web_url, context, path)).pipe(
        Effect.mapError(() =>
          userError(
            "The dashboard address needs the project's organization, which this key does not show.",
            {
              hint: "Sign in as yourself with 'voidhash-cli auth login'.",
            },
          ),
        ),
      );
      yield* Console.log(url);
      if (browser && (yield* isInteractive)) yield* openInBrowser(url);
    }),
).pipe(
  Command.withDescription(
    "Open a page of the project's dashboard in your browser, such as 'open products' or 'open product pro-monthly'.",
  ),
);
