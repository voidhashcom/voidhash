import { describe, expect, it } from "vitest";

import { partnerPostbackRetryDelay, planPartnerPostback, type PartnerCatalogEntry } from "../../../src/domain/measurement/PartnerPostback";

const catalog: PartnerCatalogEntry = {
  endpoint: "https://partner.example/postback",
  fieldMapping: {
    campaign: "campaign",
    distinctId: "distinctId",
    email: "email",
    ignored: "notMappedByConsumer",
    "partnerData.account": "account",
  },
  partner: "partner-a",
  requiredFields: ["campaign"],
};

const policy = {
  anonymize: false,
  consentRevision: 3,
  deleted: false,
  partnerSharing: true,
} as const;

describe("partner postback planning", () => {
  it("maps only catalog fields and filters protected values", () => {
    const plan = planPartnerPostback(catalog, "decision-1", {
      campaign: "summer",
      distinctId: "person-1",
      email: "person@example.test",
      rawUrl: "https://private.example",
      surprise: "must-not-leak",
    }, { account: "owned" }, policy);
    expect(plan.request?.payload).toEqual({
      account: "owned",
      campaign: "summer",
      distinctId: "person-1",
    });
    expect(JSON.stringify(plan.request)).not.toContain("person@example.test");
    expect(JSON.stringify(plan.request)).not.toContain("must-not-leak");
    expect(plan.audit.filteredFields).toContain("email");
  });

  it.each([
    [{ ...policy, partnerSharing: false }, "partner-sharing-opt-out"],
    [{ ...policy, excludedPartners: ["partner-a"] }, "partner-excluded"],
    [{ ...policy, deleted: true }, "subject-deleted"],
  ])("suppresses before constructing a request", (current, reason) => {
    const plan = planPartnerPostback(catalog, "decision-1", { campaign: "summer" }, {}, current);
    expect(plan.request).toBeUndefined();
    expect(plan.audit).toMatchObject({ consentRevision: 3, reason, result: "suppressed" });
  });

  it("evaluates policy at send time and anonymizes identity", () => {
    const captured = { campaign: "summer", distinctId: "person-1" };
    expect(planPartnerPostback(catalog, "decision-1", captured, {}, policy).request).toBeDefined();
    const later = planPartnerPostback(catalog, "decision-1", captured, {}, { ...policy, anonymize: true, consentRevision: 4 });
    expect(later.request?.payload.distinctId).toBe("anonymous:partner-a:decision-1");
    expect(later.audit.consentRevision).toBe(4);
  });

  it("uses stable idempotency and bounded Retry-After-aware backoff", () => {
    const first = planPartnerPostback(catalog, "decision-1", { campaign: "summer" }, {}, policy);
    const replay = planPartnerPostback(catalog, "decision-1", { campaign: "summer" }, {}, policy);
    expect(first.idempotencyKey).toBe(replay.idempotencyKey);
    expect(partnerPostbackRetryDelay(2, 10_000)).toBe(10_000);
    expect(partnerPostbackRetryDelay(8, undefined)).toBeUndefined();
  });
});
