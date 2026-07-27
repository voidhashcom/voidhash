import { signUpCtaLabel } from "@/lib/waitlist";

import {
  EVENTS_METER,
  formatRate,
  formatUsd,
  GROW_BASE_PRICE,
  TRACKED_REVENUE_METER,
} from "./pricing-model";

export type PlanId = "free" | "grow" | "enterprise";

export type Plan = {
  readonly id: PlanId;
  readonly name: string;
  /** Headline figure, already formatted — `$0`, `$29.99`, `Custom`. */
  readonly price: string;
  /** Qualifier printed next to the figure, e.g. `/ month`. */
  readonly priceSuffix?: string;
  /** Small line above the figure that sets expectations before the number lands. */
  readonly priceNote: string;
  readonly description: string;
  readonly cta: { readonly label: string; readonly href: string };
  readonly highlights: readonly string[];
};

export const PLANS: readonly Plan[] = [
  {
    cta: { href: "/auth/sign-up", label: signUpCtaLabel("Start for free") },
    description:
      "Everything in the platform, metered small. Enough to ship a paywall and watch it convert.",
    highlights: [
      `${TRACKED_REVENUE_METER.formatVolume(TRACKED_REVENUE_METER.freeAllowance)} tracked revenue per month`,
      `${EVENTS_METER.formatVolume(EVENTS_METER.freeAllowance)} events per month`,
      "Unlimited paywalls, flags and experiments",
      "Unlimited team members and API calls",
      "Community support on Discord",
    ],
    id: "free",
    name: "Free",
    price: "$0",
    priceNote: "No credit card, ever",
    priceSuffix: "/ month",
  },
  {
    cta: { href: "/auth/sign-up", label: signUpCtaLabel("Start with Grow") },
    description:
      "For apps with real revenue. A generous allowance, then you only pay for what you use.",
    highlights: [
      `${TRACKED_REVENUE_METER.formatVolume(TRACKED_REVENUE_METER.growAllowance)} tracked revenue included, then ${formatRate(TRACKED_REVENUE_METER.rate)} per ${TRACKED_REVENUE_METER.unitLabel}`,
      `${EVENTS_METER.formatVolume(EVENTS_METER.growAllowance)} events included, then ${formatRate(EVENTS_METER.rate)} per ${EVENTS_METER.unitLabel}`,
      "One flat rate per meter — no tiers to work out",
      "5+ years of data retention",
      "Email support with a 1 business day reply",
    ],
    id: "grow",
    name: "Grow",
    price: formatUsd(GROW_BASE_PRICE),
    priceNote: "Starting from",
    priceSuffix: "/ month",
  },
  {
    cta: { href: "mailto:sales@voidhash.com?subject=Voidhash%20Enterprise", label: "Talk to us" },
    description:
      "For teams that need volume pricing, a contract, and someone to call when it matters.",
    highlights: [
      "Committed-use discounts on both meters",
      "SSO/SAML, SCIM and audit logs",
      "Supported self-hosting and BYOC deployments",
      "99.9% uptime SLA and priority routing",
      "Shared Slack channel and migration help",
    ],
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    priceNote: "Annual contract",
  },
];

/** A matrix cell: `true`/`false` render as a mark, a string renders verbatim. */
export type MatrixValue = boolean | string;

export type MatrixRow = {
  readonly label: string;
  /** Optional clarifier shown under the label for rows whose wording is load-bearing. */
  readonly detail?: string;
  /**
   * Keeps a row out of the rendered matrix without deleting it.
   *
   * Used for capabilities that are planned but not shipped — drop the flag to publish the row
   * once the feature is real.
   */
  readonly hidden?: boolean;
  readonly free: MatrixValue;
  readonly grow: MatrixValue;
  readonly enterprise: MatrixValue;
};

export type MatrixGroup = {
  readonly title: string;
  readonly rows: readonly MatrixRow[];
};

export const MATRIX: readonly MatrixGroup[] = [
  {
    rows: [
      {
        detail: "Revenue Voidhash validates and attributes for you.",
        enterprise: "Custom",
        free: "$1,000 / month",
        grow: "$10,000 / month, then $8 per $1,000",
        label: "Tracked revenue",
      },
      {
        detail: "Screen views, impressions, purchases — anything the SDK sends.",
        enterprise: "Custom",
        free: "50K / month",
        grow: "1M / month, then $6 per 100K",
        label: "Events",
      },
      { enterprise: "Unlimited", free: "Unlimited", grow: "Unlimited", label: "Active persons" },
      {
        enterprise: "Unlimited",
        free: "Unlimited",
        grow: "Unlimited",
        label: "Paywall conversions",
      },
      { enterprise: "Unlimited", free: "Unlimited", grow: "Unlimited", label: "API calls" },
      {
        detail: "Tool calls made by AI agents through the Voidhash MCP server.",
        enterprise: "Custom",
        free: "400 / month",
        grow: "8M / month",
        label: "MCP tool calls",
      },
      { enterprise: "Unlimited", free: "Unlimited", grow: "Unlimited", label: "Apps and projects" },
      { enterprise: "Unlimited", free: "Unlimited", grow: "Unlimited", label: "Team members" },
      { enterprise: "Custom", free: "3 years", grow: "5+ years", label: "Data retention" },
    ],
    title: "Usage",
  },
  {
    rows: [
      { enterprise: true, free: true, grow: true, label: "No-code paywall designer" },
      { enterprise: true, free: true, grow: true, label: "AI paywall generation" },
      {
        detail: "Publish a new paywall without shipping a build.",
        enterprise: true,
        free: true,
        grow: true,
        label: "Remote updates",
      },
      { enterprise: true, free: true, grow: true, label: "Templates and component library" },
      { enterprise: true, free: true, grow: true, label: "Custom fonts and image assets" },
      { enterprise: true, free: true, grow: true, label: "Localization" },
      { enterprise: true, free: true, grow: true, label: "Placements and targeting" },
    ],
    title: "Paywalls",
  },
  {
    rows: [
      { enterprise: true, free: true, grow: true, label: "Revenue, trial and churn dashboards" },
      { enterprise: true, free: true, grow: true, label: "Funnels, cohorts and retention" },
      { enterprise: true, free: true, grow: true, label: "Store and network attribution" },
      { enterprise: true, free: false, grow: true, label: "SQL access to your raw events" },
    ],
    title: "Analytics",
  },
  {
    rows: [
      { enterprise: true, free: true, grow: true, label: "Feature flags" },
      { enterprise: true, free: true, grow: true, label: "Paywall and price A/B tests" },
      { enterprise: true, free: true, grow: true, label: "Audience targeting and rollouts" },
      {
        enterprise: true,
        free: false,
        grow: true,
        hidden: true,
        label: "Statistical significance reporting",
      },
    ],
    title: "Experimentation",
  },
  {
    rows: [
      { enterprise: true, free: true, grow: true, label: "Unified person profiles" },
      { enterprise: true, free: true, grow: true, label: "Cross-device identity resolution" },
      { enterprise: true, free: true, grow: true, label: "Segments and saved views" },
      { enterprise: true, free: true, grow: true, label: "Webhooks" },
    ],
    title: "CRM",
  },
  {
    rows: [
      { enterprise: true, free: true, grow: true, label: "React Native, iOS and Android SDKs" },
      { enterprise: true, free: true, grow: true, label: "REST API, CLI and MCP server" },
      { enterprise: true, free: true, grow: true, label: "Self-hosting (open source)" },
      { enterprise: true, free: false, grow: false, label: "SSO/SAML, SCIM and audit log" },
      { enterprise: "99.9% SLA", free: false, grow: false, label: "Uptime SLA" },
      { enterprise: "Shared Slack", free: "Community", grow: "Email", label: "Support" },
    ],
    title: "Platform",
  },
];

export const FAQ: readonly { readonly question: string; readonly answer: string }[] = [
  {
    answer:
      "No. The Free plan needs no card and never converts into a paid one on its own. If you outgrow the included allowance we pause ingestion until the next month rather than billing you by surprise.",
    question: "Do I need a credit card to start?",
  },
  {
    answer:
      "Tracked revenue is the subscription and one-off revenue Voidhash validates, attributes and reports on in a given month — not your app's total revenue. Purchases that never touch Voidhash are never metered.",
    question: "What counts as tracked revenue?",
  },
  {
    answer:
      "One flat rate per meter, charged only on what you use past the allowance included in your plan. There are no tiers, no bands and no minimums to work out — $8 per $1,000 of tracked revenue and $6 per 100,000 events, whatever your scale.",
    question: "How does the usage pricing work?",
  },
  {
    answer:
      "Your allowance resets on the first of each month and unused volume does not roll over. Usage is billed in arrears, so the invoice at the end of a month reflects exactly what you sent.",
    question: "When does my allowance reset?",
  },
  {
    answer:
      "Yes. Voidhash is open source and you can run the whole platform yourself — no meters, no invoices. Enterprise adds support, migration help and an SLA on top of a self-hosted deployment.",
    question: "Can I self-host instead?",
  },
  {
    answer:
      "Set a spend cap in the billing settings and we will alert you as you approach it, then stop ingesting once it is reached. You will never receive an invoice larger than the cap you set.",
    question: "Can I cap my spend?",
  },
];
