import {
  admitEvent,
  BUILTIN_EVENT_ADMISSION_LIST,
  builtinEntryForEventName,
  emptyEventAdmissionPolicy,
  type EventAdmissionPolicy,
  isBuiltinEventAdmissionKey,
  normalizeCustomEventName,
  resolveBuiltinEventAdmissionList,
  REVENUE_EVENT_ADMISSION_KEY,
} from "@voidhash/core/domain/analytics/EventAdmission";
import { describe, expect, it } from "vitest";

const policy = (overrides: Partial<EventAdmissionPolicy>): EventAdmissionPolicy => ({
  ...emptyEventAdmissionPolicy,
  ...overrides,
});

describe("built-in event registry", () => {
  it("exposes unique keys and maps every covered name back to its entry", () => {
    const keys = BUILTIN_EVENT_ADMISSION_LIST.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);

    for (const entry of BUILTIN_EVENT_ADMISSION_LIST) {
      expect(isBuiltinEventAdmissionKey(entry.key)).toBe(true);
      for (const eventName of entry.eventNames) {
        expect(builtinEntryForEventName(eventName)).toBe(entry);
      }
    }
  });

  it("groups all 19 revenue events under one toggle", () => {
    const revenue = BUILTIN_EVENT_ADMISSION_LIST.find(
      (entry) => entry.key === REVENUE_EVENT_ADMISSION_KEY,
    );
    expect(revenue?.eventNames).toHaveLength(19);
    expect(builtinEntryForEventName("$subscription.renewed")?.key).toBe(
      REVENUE_EVENT_ADMISSION_KEY,
    );
  });

  it("admits every built-in by default in the cloud", () => {
    for (const entry of BUILTIN_EVENT_ADMISSION_LIST) {
      expect(entry.defaultEnabled.cloud).toBe(true);
    }
  });
});

describe("admitEvent", () => {
  it("defaults self-hosted installs to revenue plus $app_installed only", () => {
    const admitted = BUILTIN_EVENT_ADMISSION_LIST.filter((entry) => entry.defaultEnabled.oss).map(
      (entry) => entry.key,
    );
    expect(admitted).toEqual(["$app_installed", REVENUE_EVENT_ADMISSION_KEY]);
    expect(
      admitEvent({ edition: "oss", eventName: "$app_opened", policy: emptyEventAdmissionPolicy }),
    ).toEqual({ admitted: false, reason: "builtin_disabled" });
    expect(
      admitEvent({
        edition: "cloud",
        eventName: "$app_opened",
        policy: emptyEventAdmissionPolicy,
      }),
    ).toEqual({ admitted: true });
  });

  it("lets a stored override win over the edition default in both directions", () => {
    expect(
      admitEvent({
        edition: "oss",
        eventName: "$app_opened",
        policy: policy({ builtinEventOverrides: { $app_opened: true } }),
      }),
    ).toEqual({ admitted: true });
    expect(
      admitEvent({
        edition: "cloud",
        eventName: "$sign_out",
        policy: policy({ builtinEventOverrides: { $sign_out: false } }),
      }),
    ).toEqual({ admitted: false, reason: "builtin_disabled" });
  });

  it("moves the whole revenue group with its single toggle", () => {
    const disabled = policy({ builtinEventOverrides: { [REVENUE_EVENT_ADMISSION_KEY]: false } });
    for (const eventName of ["$purchase.completed", "$subscription.canceled"]) {
      expect(admitEvent({ edition: "cloud", eventName, policy: disabled })).toEqual({
        admitted: false,
        reason: "builtin_disabled",
      });
    }
  });

  it("admits custom events unless they are blocklisted", () => {
    expect(
      admitEvent({
        edition: "oss",
        eventName: "checkout_started",
        policy: emptyEventAdmissionPolicy,
      }),
    ).toEqual({ admitted: true });
    expect(
      admitEvent({
        edition: "oss",
        eventName: "checkout_started",
        policy: policy({ customEventBlocklist: ["checkout_started"] }),
      }),
    ).toEqual({ admitted: false, reason: "custom_blocked" });
  });

  it("rejects unknown reserved names so a lookalike cannot pose as a custom event", () => {
    expect(
      admitEvent({
        edition: "cloud",
        eventName: "$app_opened_",
        policy: emptyEventAdmissionPolicy,
      }),
    ).toEqual({ admitted: false, reason: "unknown_reserved_event" });
    expect(
      admitEvent({
        edition: "cloud",
        eventName: "$future_sdk_event",
        policy: policy({ builtinEventOverrides: { $future_sdk_event: true } }),
      }),
    ).toEqual({ admitted: false, reason: "unknown_reserved_event" });
  });
});

describe("resolveBuiltinEventAdmissionList", () => {
  it("reports the default, the explicit override, and the effective state", () => {
    const resolved = resolveBuiltinEventAdmissionList({
      edition: "oss",
      policy: policy({ builtinEventOverrides: { $app_opened: true, stale_key: true } }),
    });

    expect(resolved).toHaveLength(BUILTIN_EVENT_ADMISSION_LIST.length);
    expect(resolved.find((entry) => entry.key === "$app_opened")).toMatchObject({
      defaultEnabled: false,
      enabled: true,
      override: true,
    });
    expect(resolved.find((entry) => entry.key === "$sign_out")).toMatchObject({
      defaultEnabled: false,
      enabled: false,
      override: null,
    });
    expect(resolved.some((entry) => entry.key === "stale_key")).toBe(false);
  });
});

describe("normalizeCustomEventName", () => {
  it("trims custom names and refuses blanks and reserved names", () => {
    expect(normalizeCustomEventName("  checkout_started  ")).toBe("checkout_started");
    expect(normalizeCustomEventName("   ")).toBeUndefined();
    expect(normalizeCustomEventName("$app_opened")).toBeUndefined();
  });
});
