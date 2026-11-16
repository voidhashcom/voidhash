import type {
  TrackingDomainDnsRecordJsonEncoding,
  TrackingDomainJsonEncoding,
  TrackingDomainStatus,
} from "@voidhash/generated-clients";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { Argument, Command } from "effect/cli";

import { ApiClient, readAll } from "../../utils/api-client";
import { apiError } from "../../utils/error-formatter";
import { projectKind, resolveProject } from "../context";
import { confirmChange, requireItem, requireText } from "../input";
import {
  formatTable,
  formatTimeAgo,
  outputModeOf,
  printIds,
  printItem,
  printJson,
  printTable,
} from "../output";
import { outputOptions, projectOption, yesOption } from "../shared-options";
import { DOMAIN_STATUS_LABELS, trackingDomainKind } from "./workspace";

const domainArgument = Argument.String("domain").pipe(
  Argument.withDescription("The tracking domain's hostname or id"),
  Argument.optional,
);

const PURPOSES: Readonly<Record<TrackingDomainDnsRecordJsonEncoding["purpose"], string>> = {
  routing: "routes requests, and proves the domain is yours",
  ownership: "proves it is yours where the CNAME is flattened or proxied",
  certificate: "optional: speeds up its certificate",
};

/** The DNS records a domain needs, as a table with what each is for. */
const dnsRecordsTable = (domain: TrackingDomainJsonEncoding) =>
  formatTable(
    [
      { header: "TYPE", cell: (record: TrackingDomainDnsRecordJsonEncoding) => record.type },
      { header: "NAME", cell: (record) => record.name },
      { header: "VALUE", cell: (record) => record.value },
      { header: "PURPOSE", cell: (record) => PURPOSES[record.purpose] },
    ],
    domain.dnsRecords,
  );

/** What a domain in each status is waiting for, and what to do about it. */
const NEXT_STEPS: Readonly<
  Record<TrackingDomainStatus, (domain: TrackingDomainJsonEncoding) => string>
> = {
  active: (domain) =>
    `It serves your web SDK's requests. Point the SDK at https://${domain.hostname}.`,
  pending_dns: (domain) =>
    [
      "Create these records at your DNS provider; the CNAME is enough unless your provider flattens or proxies it:",
      dnsRecordsTable(domain),
      `Then run 'voidhash-cli domain verify ${domain.hostname}'. A domain whose DNS is not set up within seven days is removed.`,
    ].join("\n"),
  pending_certificate: (domain) =>
    `Its DNS is set up; its certificate is being issued, usually within minutes. Check again with 'voidhash-cli domain verify ${domain.hostname}'.`,
  failed: (domain) =>
    `${domain.failureReason ?? "It could not be set up."} Fix the DNS records ('voidhash-cli domain list' shows them), then run 'voidhash-cli domain verify ${domain.hostname}'.`,
};

const nextStep = (domain: TrackingDomainJsonEncoding) => NEXT_STEPS[domain.status](domain);

const DOMAIN_HINTS = {
  invalid_tracking_domain:
    "Use a subdomain of a domain you own, such as t.example.com, that the project does not have yet; a project has at most five ('voidhash-cli domain list').",
  tracking_domains_unavailable:
    "This Voidhash server does not host tracking domains; proxy the web SDK's requests through your own server instead.",
};

/** `voidhash-cli domain list` */
const domainListCommand = Command.make(
  "list",
  { project: projectOption, ...outputOptions },
  ({ json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const domains = yield* readAll((query) => api.trackingDomainsList(projectId, query));
      if (mode === "json") return yield* printJson(domains);
      if (mode === "quiet") return yield* printIds(domains);
      const now = yield* DateTime.now;
      yield* printTable(
        [
          { header: "HOSTNAME", cell: (domain) => domain.hostname },
          { header: "STATUS", cell: (domain) => DOMAIN_STATUS_LABELS[domain.status] },
          {
            header: "CHECKED",
            cell: (domain) =>
              domain.lastCheckedAt === null ? "-" : formatTimeAgo(domain.lastCheckedAt, now),
          },
          { header: "ID", cell: (domain) => domain.id },
        ],
        domains,
        "No tracking domains yet. Serve the web SDK from your own domain with 'voidhash-cli domain add t.example.com'.",
      );
      const waiting = domains.filter((domain) => domain.status !== "active");
      yield* Effect.forEach(
        waiting,
        (domain) => Console.error(`\n${domain.hostname}: ${nextStep(domain)}`),
        { concurrency: 1, discard: true },
      );
    }),
).pipe(
  Command.withDescription(
    "List the project's tracking domains, with what each still needs before it serves.",
  ),
);

/** `voidhash-cli domain add <hostname>` */
const domainAddCommand = Command.make(
  "add",
  {
    hostname: Argument.String("hostname").pipe(
      Argument.withDescription("A subdomain you own, such as t.example.com"),
      Argument.optional,
    ),
    project: projectOption,
    ...outputOptions,
  },
  ({ hostname, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const wanted = yield* requireText(hostname, {
        flag: "the hostname",
        message: "Hostname, such as t.example.com",
        usage: "voidhash-cli domain add <hostname>",
      });
      const created = yield* api
        .trackingDomainsCreate(projectId, { hostname: wanted })
        .pipe(Effect.mapError((error) => apiError(error, DOMAIN_HINTS)));
      yield* printItem(
        mode,
        created,
        [`Added ${created.hostname} (${created.id}).`, nextStep(created)].join("\n"),
      );
    }),
).pipe(
  Command.withDescription(
    "Serve the web SDK from your own subdomain: adds it and prints the DNS records to create.",
  ),
);

/** `voidhash-cli domain verify [domain]` */
const domainVerifyCommand = Command.make(
  "verify",
  { domain: domainArgument, project: projectOption, ...outputOptions },
  ({ domain, json, project, quiet }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const projectId = (yield* resolveProject(project)).project.id;
      const domains = yield* readAll((query) => api.trackingDomainsList(projectId, query));
      const found = yield* requireItem(
        trackingDomainKind,
        domains,
        domain,
        "voidhash-cli domain verify <domain>",
      );
      const checked = yield* api.trackingDomainsVerify(projectId, found.id);
      yield* printItem(
        mode,
        checked,
        [`${checked.hostname} is ${DOMAIN_STATUS_LABELS[checked.status]}.`, nextStep(checked)].join(
          "\n",
        ),
      );
    }),
).pipe(
  Command.withDescription(
    "Check a tracking domain's DNS and certificate now, and say what it still needs.",
  ),
);

/** `voidhash-cli domain remove [domain] [--yes]` */
const domainRemoveCommand = Command.make(
  "remove",
  { domain: domainArgument, project: projectOption, yes: yesOption, ...outputOptions },
  ({ domain, json, project, quiet, yes }) =>
    Effect.gen(function* () {
      const mode = yield* outputModeOf({ json, quiet });
      const api = yield* ApiClient;
      const context = yield* resolveProject(project);
      const projectId = context.project.id;
      const domains = yield* readAll((query) => api.trackingDomainsList(projectId, query));
      const found = yield* requireItem(
        trackingDomainKind,
        domains,
        domain,
        "voidhash-cli domain remove <domain> --yes",
      );
      yield* confirmChange({
        yes,
        message: `Remove ${found.hostname} from ${projectKind(context.session).label(context.project)}?${found.status === "active" ? " Web SDK requests sent through it stop arriving, so point the SDK elsewhere first." : ""}`,
      });
      yield* api.trackingDomainsDelete(projectId, found.id);
      yield* printItem(
        mode,
        found,
        `Removed ${found.hostname}. You can delete its DNS records now.`,
      );
    }),
).pipe(
  Command.withDescription(
    "Stop serving a tracking domain and remove it. Asks first; --yes skips that.",
  ),
);

/** `voidhash-cli domain …` */
export const domainCommand = Command.make("domain").pipe(
  Command.withAlias("domains"),
  Command.withDescription(
    "Tracking domains: serve the web SDK from your own subdomain. List, add, verify and remove them.",
  ),
  Command.withSubcommands([
    domainListCommand,
    domainAddCommand,
    domainVerifyCommand,
    domainRemoveCommand,
  ]),
);
