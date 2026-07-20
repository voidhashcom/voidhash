import { describe, expect, it, vi } from "vitest";

import {
  MeasurementCapabilityUnavailable,
  MeasurementConfigurationError,
  MeasurementInputError,
  MeasurementPolicyBlocked,
  STANDARD_EVENTS,
  UnifiedMeasurementRuntime,
  type MeasurementEnvelopeV1,
  type MeasurementRuntimeAdapter,
} from "../../src/core/measurement";

const makeHarness = (overrides: {
  adapter?: MeasurementRuntimeAdapter;
  links?: ConstructorParameters<typeof UnifiedMeasurementRuntime>[0]["links"];
  measurement?: ConstructorParameters<typeof UnifiedMeasurementRuntime>[0]["measurement"];
  consent?: ConstructorParameters<typeof UnifiedMeasurementRuntime>[0]["consent"];
  trustedConfigKeys?: ConstructorParameters<typeof UnifiedMeasurementRuntime>[0]["trustedConfigKeys"];
  configurationProjectId?: string;
} = {}) => {
  let now = Date.parse("2026-01-01T00:00:00.000Z");
  let id = 0;
  const baseAdapter: MeasurementRuntimeAdapter = {
    makeId: (prefix) => `${prefix}_${++id}`,
    now: () => new Date(now),
    monotonicNowMs: () => now,
  };
  const runtime = new UnifiedMeasurementRuntime({
    adapter: { ...baseAdapter, ...overrides.adapter },
    appBuild: "100",
    appVersion: "1.0.0",
    baseUrl: "https://api.voidhash.test",
    bundleId: "com.voidhash.test",
    consent: overrides.consent,
    links: overrides.links,
    measurement: overrides.measurement,
    platform: "ios",
    publishableKey: "pk_test",
    trustedConfigKeys: overrides.trustedConfigKeys,
    configurationProjectId: overrides.configurationProjectId,
  });
  return {
    advance: (milliseconds: number) => {
      now += milliseconds;
    },
    runtime,
  };
};

const byType = (
  records: ReadonlyArray<MeasurementEnvelopeV1<string, unknown>>,
  type: string,
) => records.filter((record) => record.type === type);

describe("UnifiedMeasurementRuntime", () => {
  it("hydrates native installation state and forwards stable envelope IDs to the durable bridge", async () => {
    const commands: Array<{ commandId: string; recordType: string }> = [];
    const { runtime } = makeHarness({
      adapter: {
        initializeMeasurement: async () => ({
          installationId: "install_native",
          firstOpenedAt: "2025-01-01T00:00:00.000Z",
          installationSequence: 40,
        }),
        enqueueMeasurement: async (command) => {
          commands.push({ commandId: command.commandId, recordType: command.recordType });
        },
      },
    });

    await runtime.initialize();
    await Promise.resolve();

    const records = runtime.inspectOutbox();
    expect(await runtime.measurement.getInstallationId()).toBe("install_native");
    expect((await runtime.measurement.getState()).installation.firstOpenedAt).toBe(
      "2025-01-01T00:00:00.000Z",
    );
    expect(records.map((record) => record.installationSequence)).toEqual([41, 42]);
    expect(commands).toEqual(
      records.map((record) => ({ commandId: record.recordId, recordType: record.type })),
    );
  });

  it("creates install evidence first and starts only one automatic session", async () => {
    const { runtime } = makeHarness();
    const sessions: string[] = [];
    runtime.measurement.on("session", (session) => sessions.push(session.id));

    await runtime.initialize();
    const second = await runtime.measurement.start();

    const records = runtime.inspectOutbox();
    expect(records.map((record) => record.type).slice(0, 2)).toEqual([
      "installation.created.v1",
      "session.started.v1",
    ]);
    expect(sessions).toHaveLength(1);
    expect(second.id).toBe(sessions[0]);
    expect(records.map((record) => record.installationSequence)).toEqual([1, 2]);
  });

  it("persists signed configuration, reapplies storage limits, and rejects downgrade after restart", async () => {
    const keys = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    const publicKey = await crypto.subtle.exportKey("spki", keys.publicKey);
    const encode = (value: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(value)));
    const payload = {
      collectors: { appleAttributionEnabled: true, linkAllowedDomains: [] },
      conversionRules: [],
      schemaVersion: 1 as const,
      storage: {
        maxOutboxBytes: 1_000_000,
        maxOutboxRecords: 500,
        maxProtectedBytes: 2_000_000,
      },
    };
    const canonicalize = (value: unknown): string => {
      if (value === null || typeof value !== "object") return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
      return `{${Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => `${JSON.stringify(key)}:${canonicalize(nested)}`)
        .join(",")}}`;
    };
    const signedResponse = async (version: number) => {
      const unsigned = {
        expiresAt: "2099-08-01T00:00:00.000Z",
        keyId: "key-1",
        payload,
        projectId: "project-1",
        version,
      };
      const signature = encode(
        await crypto.subtle.sign(
          "Ed25519",
          keys.privateKey,
          new TextEncoder().encode(canonicalize(unsigned)),
        ),
      );
      return { ...unsigned, signature };
    };
    let persisted: { version: number; payload: Uint8Array } | undefined;
    const applied = vi.fn();
    const initialFetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(JSON.stringify(await signedResponse(2)), { status: 200 }),
    );
    const adapter: MeasurementRuntimeAdapter = {
      applyMeasurementStorageLimits: applied,
      fetch: initialFetch,
      getMeasurementConfigurationState: async () => persisted ?? { version: 0 },
      persistMeasurementConfigurationState: async (version, storedPayload) => {
        if (version <= (persisted?.version ?? 0)) return false;
        persisted = { payload: storedPayload, version };
        return true;
      },
    };
    const trustedConfigKeys = [{ keyId: "key-1", publicKeySpki: encode(publicKey) }];
    const first = makeHarness({
      adapter,
      configurationProjectId: "project-1",
      trustedConfigKeys,
    }).runtime;
    await first.initialize();
    expect((await first.measurement.getState()).configuration.signed).toEqual({
      keyId: "key-1",
      source: "network",
      version: 2,
    });
    expect(persisted?.version).toBe(2);

    const restarted = makeHarness({
      adapter: {
        ...adapter,
        fetch: vi.fn<typeof globalThis.fetch>(async () =>
          new Response(JSON.stringify(await signedResponse(1)), { status: 200 }),
        ),
      },
      configurationProjectId: "project-1",
      trustedConfigKeys,
    }).runtime;
    await restarted.initialize();
    const restartedState = await restarted.measurement.getState();
    expect(restartedState.configuration.signed).toEqual({
      keyId: "key-1",
      source: "persisted",
      version: 2,
    });
    expect(restartedState.configuration.lastSignedConfigurationRejection).toBe("version-replay");
    expect(applied).toHaveBeenLastCalledWith(payload.storage);
  });

  it("preserves consent tri-state values and snapshots revisions at capture time", async () => {
    const { runtime } = makeHarness({ measurement: { startMode: "manual" } });
    await runtime.initialize();
    await runtime.consent.set({
      decidedAt: "2026-01-01T00:00:01.000Z",
      revision: 1,
      source: "application",
      dataUsage: true,
    });
    runtime.capture("first");
    await runtime.consent.set({
      decidedAt: "2026-01-01T00:00:02.000Z",
      revision: 2,
      source: "application",
      dataUsage: false,
    });
    runtime.capture("second");

    const analytics = byType(runtime.inspectOutbox(), "analytics.capture.v1");
    expect(analytics.map((record) => record.consent.revision)).toEqual([1, 2]);
    const consent = await runtime.consent.get();
    expect(consent.snapshot.dataUsage).toBe(false);
    expect("gdprApplies" in consent.snapshot).toBe(false);
  });

  it("captures identity and configuration per item instead of reading globals at flush", async () => {
    const { runtime } = makeHarness({ measurement: { startMode: "manual" } });
    await runtime.initialize();
    await runtime.measurement.configure({ context: { cohort: "a" }, defaultCurrency: "usd" });
    runtime.setIdentity("person-a");
    runtime.capture("first", { value: 1 });
    await runtime.measurement.configure({ context: { cohort: "b" } });
    runtime.setIdentity("person-b");
    runtime.capture("second", { value: 2 });

    const analytics = byType(runtime.inspectOutbox(), "analytics.capture.v1");
    expect(analytics.map((record) => record.identity.distinctId)).toEqual(["person-a", "person-b"]);
    expect(analytics.map((record) => (record.publicPayload as { measurementContext: unknown }).measurementContext)).toEqual([
      { cohort: "a" },
      { cohort: "b" },
    ]);
    expect((analytics[0]?.publicPayload as { currency: string }).currency).toBe("USD");
  });

  it("rejects unknown configuration, invalid currency, and protected context", async () => {
    const { runtime } = makeHarness();
    await expect(
      runtime.measurement.configure({ unknown: true } as never),
    ).rejects.toBeInstanceOf(MeasurementConfigurationError);
    await expect(runtime.measurement.configure({ defaultCurrency: "NOT" })).rejects.toBeInstanceOf(
      MeasurementInputError,
    );
    await expect(
      runtime.measurement.configure({ context: { callbackUrl: "https://secret.test" } }),
    ).rejects.toBeInstanceOf(MeasurementInputError);
  });

  it("prevents raw URLs, tokens, receipts, identifiers, email, and phone from public properties", () => {
    const { runtime } = makeHarness();
    const cases = [
      { value: "https://private.test/path" },
      { pushToken: "secret" },
      { receipt: "secret" },
      { gaid: "secret" },
      { contact: "person@example.test" },
      { phone: "+420123456789" },
    ];
    for (const properties of cases) {
      expect(() => runtime.capture("unsafe", properties)).toThrow(MeasurementInputError);
    }
  });

  it("normalizes allowlisted links, projects routes, emits once, and dedupes", async () => {
    const { runtime } = makeHarness({
      links: {
        allowedDomains: ["links.example"],
        allowedSchemes: ["https"],
        dedupeWindowMs: 10_000,
      },
    });
    const received = vi.fn();
    runtime.links.on("deepLink", received);
    const url = "https://links.example/open?deep_link_value=checkout&deep_link_sub1=annual&campaign=winter&pid=owned&link_id=l_1";

    const first = await runtime.links.handle({ source: "universalLink", url });
    const duplicate = await runtime.links.handle({ source: "manual", url });

    expect(first).toMatchObject({
      campaign: { campaign: "winter", mediaSource: "owned" },
      direct: true,
      linkId: "l_1",
      route: { subvalues: { 1: "annual" }, value: "checkout" },
      status: "found",
    });
    expect(duplicate).toEqual(first);
    expect(received).toHaveBeenCalledTimes(1);
    expect(byType(runtime.inspectOutbox(), "link.resolved.v1")).toHaveLength(1);
    expect(JSON.stringify(runtime.inspectOutbox())).not.toContain(url);
  });

  it("drains native inbox links after initialization without duplicating protected evidence", async () => {
    let inboxListener: Parameters<NonNullable<MeasurementRuntimeAdapter["subscribeNativeInbox"]>>[0] | undefined;
    const putProtectedEvidence = vi.fn(async ({ blobId }: { blobId: string }) => blobId);
    const { runtime } = makeHarness({
      adapter: {
        putProtectedEvidence,
        subscribeNativeInbox: (listener) => {
          inboxListener = listener;
          return () => undefined;
        },
      },
      links: { allowedDomains: ["links.example"], allowedSchemes: ["https"] },
    });
    const observed = vi.fn();
    runtime.links.on("deepLink", observed);
    await runtime.initialize();

    await inboxListener?.({
      appState: "cold",
      id: "inbox-1",
      kind: "link",
      protectedEvidenceRef: "protected-native-link",
      receivedAt: "2026-01-01T00:00:00.000Z",
      source: "universalLink",
      value: "https://links.example/open?deep_link_value=native",
    });

    expect(observed).toHaveBeenCalledWith(expect.objectContaining({
      route: { subvalues: {}, value: "native" },
      status: "found",
    }));
    expect(putProtectedEvidence).not.toHaveBeenCalled();
    expect(byType(runtime.inspectOutbox(), "link.received.v1")[0]?.protectedPayloadRef).toBe(
      "protected-native-link",
    );
  });

  it.each([
    ["javascript:alert(1)", "error"],
    ["https://evil.example/open?deep_link_value=x", "notFound"],
    ["https://links.example/%E0%A4%A", "error"],
    ["https://links.example/a/../..?deep_link_value=x", "error"],
    ["https://links.example/open?deep_link_value=x&deep_link_value=y", "error"],
  ])("rejects unsafe link %s deterministically", async (url, status) => {
    const { runtime } = makeHarness({
      links: { allowedDomains: ["links.example"], allowedSchemes: ["https"] },
    });
    expect(await runtime.links.handle({ source: "manual", url })).toMatchObject({ status });
  });

  it("resolves wrapped links with bounded redirects and domain-scoped headers", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        new Response(undefined, {
          headers: { location: "https://links.example/open?deep_link_value=checkout" },
          status: 302,
        }),
      )
      .mockResolvedValueOnce(new Response(undefined, { status: 200 }));
    const headerProvider = vi.fn(async () => ({ authorization: "Bearer secret" }));
    const { runtime } = makeHarness({
      adapter: { fetch },
      links: {
        allowedDomains: ["links.example"],
        allowedSchemes: ["https"],
        resolveWrappedDomains: ["wrap.example"],
        wrappedDomainHeaderProvider: headerProvider,
      },
    });

    await expect(
      runtime.links.handle({ source: "esp", url: "https://wrap.example/click?opaque=private" }),
    ).resolves.toMatchObject({ route: { value: "checkout" }, status: "found" });
    expect(headerProvider).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((fetch.mock.calls[0]?.[1]?.headers as Headers).get("authorization")).toBe("Bearer secret");
    expect((fetch.mock.calls[1]?.[1]?.headers as Headers).get("authorization")).toBeNull();
    const serialized = JSON.stringify(runtime.inspectOutbox());
    expect(serialized).not.toContain("Bearer secret");
    expect(serialized).not.toContain("opaque=private");
  });

  it.each([
    {
      name: "normalized redirect loop",
      responses: [new Response(undefined, { headers: { location: "https://WRAP.example.:443/click?a=1&b=2" }, status: 302 })],
      start: "https://wrap.example/click?b=2&a=1",
      expectedCode: "transport",
    },
    {
      name: "insecure redirect",
      responses: [new Response(undefined, { headers: { location: "http://links.example/open?deep_link_value=x" }, status: 302 })],
      start: "https://wrap.example/click",
      expectedCode: "transport",
    },
  ])("terminates a wrapped $name without exposing the chain", async ({ responses, start, expectedCode }) => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    for (const response of responses) fetch.mockResolvedValueOnce(response);
    const { runtime } = makeHarness({
      adapter: { fetch },
      links: {
        allowedDomains: ["links.example"],
        allowedSchemes: ["https"],
        resolveWrappedDomains: ["wrap.example"],
      },
    });
    const result = await runtime.links.handle({ source: "esp", url: start });
    expect(result).toMatchObject({ error: { code: expectedCode }, status: "error" });
    expect(JSON.stringify(runtime.inspectOutbox())).not.toContain(start);
  });

  it("times out stalled wrapped-link resolution within the configured bound", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>((_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    );
    const { runtime } = makeHarness({
      adapter: { fetch },
      links: {
        allowedDomains: ["links.example"],
        allowedSchemes: ["https"],
        resolutionTimeoutMs: 5,
        resolveWrappedDomains: ["wrap.example"],
      },
    });
    await expect(
      runtime.links.handle({ source: "esp", url: "https://wrap.example/stalled" }),
    ).resolves.toMatchObject({ error: { code: "timeout" }, status: "error" });
  });

  it("terminates a wrapped chain at the configured redirect bound", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(undefined, {
        headers: { location: "https://wrap.example/two" }, status: 302,
      }))
      .mockResolvedValueOnce(new Response(undefined, {
        headers: { location: "https://wrap.example/three" }, status: 302,
      }));
    const { runtime } = makeHarness({
      adapter: { fetch },
      links: {
        allowedDomains: ["links.example"],
        maxRedirects: 1,
        resolveWrappedDomains: ["wrap.example"],
      },
    });
    await expect(runtime.links.handle({ source: "esp", url: "https://wrap.example/one" }))
      .resolves.toMatchObject({ error: { code: "transport" }, status: "error" });
    expect(fetch).toHaveBeenCalledTimes(2);
    const evidence = byType(runtime.inspectOutbox(), "link.redirect_evidence.v1");
    expect(evidence[0]?.publicPayload).toMatchObject({ outcome: "redirectLimit" });
  });

  it("retries an offline wrapped link and emits only the eventual result", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValueOnce(new Response(undefined, {
        headers: { location: "https://links.example/open?deep_link_value=recovered" }, status: 302,
      }))
      .mockResolvedValueOnce(new Response(undefined, { status: 200 }));
    const received = vi.fn();
    const { runtime } = makeHarness({
      adapter: { fetch },
      links: {
        allowedDomains: ["links.example"],
        allowedSchemes: ["https"],
        resolveWrappedDomains: ["wrap.example"],
        wrappedRetryDelayMs: 1,
      },
    });
    runtime.links.on("deepLink", received);
    await expect(runtime.links.handle({ source: "esp", url: "https://wrap.example/offline" }))
      .resolves.toMatchObject({ route: { value: "recovered" }, status: "found" });
    expect(received).toHaveBeenCalledTimes(1);
    expect(byType(runtime.inspectOutbox(), "link.resolved.v1")).toHaveLength(1);
  });

  it("resumes within the timeout and rotates after it using monotonic time", async () => {
    const { runtime, advance } = makeHarness({ measurement: { sessionTimeoutMs: 1_000 } });
    await runtime.initialize();
    const first = await runtime.measurement.start();
    runtime.background();
    advance(999);
    expect((await runtime.foreground())?.id).toBe(first.id);
    runtime.background();
    advance(1_001);
    expect((await runtime.foreground())?.id).not.toBe(first.id);
    expect(byType(runtime.inspectOutbox(), "session.ended.v1")).toHaveLength(1);
  });

  it("validates decimal ad revenue and dedupes by impression ID", async () => {
    const { runtime } = makeHarness();
    const valid = {
      currency: "eur",
      impressionId: "imp-1",
      mediationNetwork: "google_admob" as const,
      monetizationNetwork: "network",
      revenue: "0.12345678",
    };
    await runtime.measurement.trackAdRevenue(valid);
    await runtime.measurement.trackAdRevenue(valid);
    expect(byType(runtime.inspectOutbox(), "revenue.ad_impression.v1")).toHaveLength(1);
    await expect(runtime.measurement.trackAdRevenue({ ...valid, revenue: "NaN" })).rejects.toBeInstanceOf(
      MeasurementInputError,
    );
    await expect(runtime.measurement.trackAdRevenue({ ...valid, impressionId: "imp-2", revenue: "1.123456789" })).rejects.toBeInstanceOf(
      MeasurementInputError,
    );
  });

  it("creates signed invite links through the generated contract and captures typed shares", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_input, init) =>
      new Response(JSON.stringify({
        expiresAt: "2026-02-01T00:00:00.000Z",
        linkId: "link_server_1",
        url: "https://links.example/l/link_server_1?sig=signed",
      }), { headers: { "content-type": "application/json" }, status: 201 }),
    );
    const { runtime } = makeHarness({
      adapter: { fetch },
      links: {
        allowedCustomParameters: ["coupon"],
        templateId: "invite-template",
      },
    });
    await runtime.initialize();
    const link = await runtime.measurement.createInviteLink({
      appleAppId: "123456789",
      campaign: "winter",
      channel: "share",
      customParameters: { coupon: "WELCOME" },
      deepLinkSubvalues: { 1: "annual" },
      deepLinkValue: "checkout",
      referrerCustomerId: "customer-1",
      referrerImageUrl: "https://images.example/avatar.png",
      referrerName: "Referrer",
      referrerUid: "uid-1",
    });
    expect(link.linkId).toBe("link_server_1");
    expect(String(fetch.mock.calls[0]?.[0])).toBe("https://api.voidhash.test/l/v1/links");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      campaign: { campaign: "winter", channel: "share" },
      customParameters: { coupon: "WELCOME" },
      destination: {
        appleAppId: "123456789",
        deepLinkValue: "checkout",
        subvalues: { 1: "annual" },
      },
      referrerCustomerId: "customer-1",
      referrerImageUrl: "https://images.example/avatar.png",
      referrerName: "Referrer",
      referrerUid: "uid-1",
      templateId: "invite-template",
      token: "pk_test",
    });
    await runtime.measurement.trackInviteShare({ channel: "messages", linkId: link.linkId });
    const invite = byType(runtime.inspectOutbox(), "analytics.capture.v1").find(
      (record) => (record.publicPayload as { eventName?: string }).eventName === STANDARD_EVENTS.INVITE_SHARED,
    );
    expect(invite?.publicPayload).toMatchObject({
      properties: { channel: "messages", link_id: "link_server_1" },
    });
  });

  it("does not open cross-promotion until signed-link creation succeeds", async () => {
    const order: string[] = [];
    const { runtime } = makeHarness({
      adapter: {
        fetch: vi.fn<typeof globalThis.fetch>(async () => {
          order.push("signed");
          return new Response(JSON.stringify({
            expiresAt: "2026-02-01T00:00:00.000Z",
            linkId: "link-cross",
            url: "https://links.example/l/link-cross?sig=signed",
          }), { status: 201 });
        }),
        openUrl: async () => {
          order.push("opened");
          return true;
        },
      },
    });
    await runtime.initialize();
    await expect(runtime.measurement.trackCrossPromotion({
      action: "openStore",
      promotedAppId: "app.example",
    })).resolves.toMatchObject({ opened: true, link: { linkId: "link-cross" } });
    expect(order).toEqual(["signed", "opened"]);
  });

  it("applies the manual-only location policy without owning location permissions", async () => {
    const denied = makeHarness();
    await expect(
      denied.runtime.measurement.handle({ latitude: 1, longitude: 2, type: "location" }),
    ).rejects.toBeInstanceOf(MeasurementPolicyBlocked);

    const allowed = makeHarness({ measurement: { collection: { location: "manual-only" } } });
    await expect(
      allowed.runtime.measurement.handle({ latitude: 1, longitude: 2, type: "location" }),
    ).resolves.toMatchObject({ accepted: true });
  });

  it("registers push without retaining the platform token and routes first-party opens", async () => {
    const { runtime } = makeHarness({
      adapter: {
        fetch: vi.fn<typeof globalThis.fetch>(async (input, init) => {
          expect(String(input)).toBe("https://api.voidhash.test/api/v1/sdk/push-devices/register");
          expect(JSON.parse(String(init?.body))).toMatchObject({
            platformToken: "raw-platform-token",
            provider: "apns",
          });
          return new Response(JSON.stringify({ pushDeviceTokenId: "push_tok_server_1" }), {
            headers: { "content-type": "application/json" },
            status: 200,
          });
        }),
        getPermissionStatus: async () => "authorized",
        getPushToken: async () => ({
          environment: "development",
          provider: "apns",
          token: "raw-platform-token",
        }),
        requestPermission: async () => "authorized",
        setBadgeCount: async () => undefined,
      },
      links: { allowedDomains: ["links.example"], allowedSchemes: ["https"] },
    });
    const opened = vi.fn();
    runtime.notifications.on("opened", opened);
    const registration = await runtime.notifications.register();
    const incoming = runtime.internalReceiveNotification({
      pushNotificationSendId: "push_send_1",
      rawPayload: { secret: "payload" },
    });
    await runtime.internalOpenNotification(
      incoming,
      "https://links.example/open?deep_link_value=inbox",
    );

    expect(registration.pushDeviceTokenId).toBe("push_tok_server_1");
    expect(opened).toHaveBeenCalledTimes(1);
    const serialized = JSON.stringify(runtime.inspectOutbox());
    expect(serialized).not.toContain("raw-platform-token");
    expect(serialized).not.toContain('"secret":"payload"');
    expect(
      byType(runtime.inspectOutbox(), "analytics.capture.v1").some(
        (record) => (record.publicPayload as { eventName: string }).eventName === STANDARD_EVENTS.OPENED_FROM_PUSH_NOTIFICATION,
      ),
    ).toBe(true);
  });

  it("rejects notification capabilities when native hooks are absent", async () => {
    const { runtime } = makeHarness();
    await expect(runtime.notifications.requestPermission()).rejects.toBeInstanceOf(
      MeasurementCapabilityUnavailable,
    );
    await expect(runtime.notifications.register()).rejects.toBeInstanceOf(
      MeasurementCapabilityUnavailable,
    );
    await expect(runtime.notifications.setBadgeCount(1)).rejects.toBeInstanceOf(
      MeasurementCapabilityUnavailable,
    );
  });

  it("re-links push registration after identity changes and unregisters the opaque ID", async () => {
    const requests: Array<{ path: string; body: Record<string, unknown>; distinctId: string | null }> = [];
    let registration = 0;
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      const path = new URL(String(input)).pathname;
      requests.push({
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        distinctId: new Headers(init?.headers).get("x-distinct-id"),
        path,
      });
      if (path.endsWith("/register")) {
        registration += 1;
        return new Response(JSON.stringify({ pushDeviceTokenId: `push_tok_${registration}` }), {
          headers: { "content-type": "application/json" }, status: 200,
        });
      }
      return new Response(undefined, { status: 204 });
    });
    const { runtime } = makeHarness({
      adapter: {
        fetch,
        getPushToken: async () => ({
          environment: "production", provider: "fcm", token: "raw-fcm-token",
        }),
      },
    });
    expect((await runtime.notifications.register()).pushDeviceTokenId).toBe("push_tok_1");
    runtime.setIdentity("person-new");
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toMatchObject({
      body: { previousPushDeviceTokenId: "push_tok_1" },
      distinctId: "person-new",
      path: "/api/v1/sdk/push-devices/register",
    });
    expect((await runtime.notifications.getRegistration())?.pushDeviceTokenId).toBe("push_tok_2");
    await runtime.notifications.unregister();
    expect(requests[2]).toMatchObject({
      body: { pushDeviceTokenId: "push_tok_2" },
      path: "/api/v1/sdk/push-devices/unregister",
    });
    expect(await runtime.notifications.getRegistration()).toBeUndefined();
    expect(JSON.stringify(runtime.inspectOutbox())).not.toContain("raw-fcm-token");
  });

  it("hydrates opaque push registration and refreshes it on a native token rotation", async () => {
    let nativeListener: Parameters<NonNullable<MeasurementRuntimeAdapter["subscribeNotificationEvents"]>>[0] | undefined;
    const persistedRegistration = {
      environment: "production" as const,
      provider: "fcm" as const,
      pushDeviceTokenId: "push_tok_persisted",
      registeredAt: "2026-01-01T00:00:00.000Z",
    };
    const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
      expect(String(input)).toContain("/push-devices/refresh");
      expect(JSON.parse(String(init?.body))).toEqual({
        platformToken: "rotated-fcm-token",
        pushDeviceTokenId: "push_tok_persisted",
      });
      return new Response(undefined, { status: 204 });
    });
    const { runtime } = makeHarness({
      adapter: {
        fetch,
        getPushRegistrationState: async () => new TextEncoder().encode(JSON.stringify(persistedRegistration)),
        getPushToken: async () => ({
          environment: "production", provider: "fcm", token: "rotated-fcm-token",
        }),
        persistPushRegistrationState: async () => true,
        subscribeNotificationEvents: (listener) => {
          nativeListener = listener;
          return () => undefined;
        },
      },
    });
    await runtime.initialize();
    expect(await runtime.notifications.getRegistration()).toEqual(persistedRegistration);
    nativeListener?.({
      id: "notification-token",
      kind: "tokenChanged",
      occurredAt: "2026-01-01T00:00:01.000Z",
    });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(byType(runtime.inspectOutbox(), "push.token.v1").at(-1)?.publicPayload).toMatchObject({
      pushDeviceTokenId: "push_tok_persisted",
      reason: "tokenRotated",
    });
    expect(JSON.stringify(runtime.inspectOutbox())).not.toContain("rotated-fcm-token");
  });

  it("emits unsubscribe-safe delivery diagnostics and reports redacted state", async () => {
    const { runtime } = makeHarness({ measurement: { startMode: "manual" } });
    const diagnostics = vi.fn();
    const unsubscribe = runtime.measurement.on("delivery", diagnostics);
    await runtime.initialize();
    runtime.capture("safe", { ordinary: "value" });
    const before = await runtime.measurement.getState();
    expect(before.collectors).toEqual(
      expect.objectContaining({ links: "notConfigured", push: "notConfigured", purchases: "notConfigured" }),
    );
    await runtime.flush();
    unsubscribe();
    runtime.capture("second");
    await runtime.flush();
    expect(diagnostics).toHaveBeenCalledTimes(before.outbox.total);
    expect(JSON.stringify(await runtime.measurement.getState())).not.toContain("ordinary");
  });

  it("persists test-device mode across a cold runtime", async () => {
    let persisted = false;
    const adapter: MeasurementRuntimeAdapter = {
      getTestDeviceState: async () => persisted,
      persistTestDeviceState: async (enabled) => {
        persisted = enabled;
        return true;
      },
    };
    const { runtime } = makeHarness({ adapter });
    await runtime.initialize();
    await runtime.measurement.setTestDevice(true);
    expect((await runtime.measurement.getState()).testDevice).toBe(true);
    const { runtime: coldRuntime } = makeHarness({ adapter });
    await coldRuntime.initialize();
    expect((await coldRuntime.measurement.getState()).testDevice).toBe(true);
  });

  it("distinguishes upload pause from deletion and keeps the installation identity", async () => {
    const { runtime } = makeHarness();
    await runtime.initialize();
    const installationId = await runtime.measurement.getInstallationId();
    await runtime.measurement.stop({ upload: true });
    runtime.capture("retained");
    expect(await runtime.flush()).toMatchObject({ accepted: 0, policyBlocked: expect.any(Number) });
    expect((await runtime.measurement.getState()).deletion.completed).toBe(false);

    await runtime.measurement.deleteData();
    expect((await runtime.measurement.getState()).deletion.completed).toBe(true);
    expect(await runtime.measurement.getInstallationId()).toBe(installationId);
  });

  it("durably enqueues deletion before atomically purging protected data", async () => {
    let deletionPersisted = false;
    const calls: string[] = [];
    const { runtime } = makeHarness({
      adapter: {
        deleteProtectedData: async (requestId) => {
          expect(deletionPersisted).toBe(true);
          calls.push(`purge:${requestId}`);
          return true;
        },
        enqueueMeasurement: async (command) => {
          if (command.recordType === "measurement.deletion_requested.v1") {
            deletionPersisted = true;
            calls.push(`enqueue:${command.commandId}`);
          }
        },
        waitForPendingWrites: async () => {
          expect(deletionPersisted).toBe(true);
          calls.push("barrier");
        },
      },
    });
    await runtime.initialize();
    const result = await runtime.measurement.deleteData();
    expect(calls.map((call) => call.split(":")[0])).toEqual(["enqueue", "barrier", "purge"]);
    expect(result.status).toBe("accepted");
  });

  it("rejects legacy purchase validation fields at runtime and correlates each result", async () => {
    const { runtime } = makeHarness();
    await expect(
      runtime.measurement.validatePurchase({
        androidPublicKey: "forbidden",
        platform: "android",
        protectedEvidenceId: "protected_1",
        transactionId: "tx-1",
      } as never),
    ).rejects.toBeInstanceOf(MeasurementInputError);

    const [first, second] = await Promise.all([
      runtime.measurement.validatePurchase({ platform: "ios", protectedEvidenceId: "protected_1", transactionId: "tx-1" }),
      runtime.measurement.validatePurchase({ platform: "android", protectedEvidenceId: "protected_2", transactionId: "tx-2" }),
    ]);
    expect(first.requestId).not.toBe(second.requestId);
    expect([first.transactionId, second.transactionId]).toEqual(["tx-1", "tx-2"]);
    const { runtime: releaseRuntime } = makeHarness({ adapter: { isReleaseBuild: true } });
    await expect(releaseRuntime.measurement.validatePurchase({
      environment: "sandbox",
      platform: "ios",
      protectedEvidenceId: "protected_3",
      transactionId: "tx-3",
    })).rejects.toBeInstanceOf(MeasurementConfigurationError);
  });

  it("records purchase observation once with receipt material only in protected evidence", async () => {
    const protectedWrites: Array<{ purpose: string; value: string }> = [];
    const dedupe = new Set<string>();
    const enrichment = { source: "first" };
    const { runtime } = makeHarness({
      measurement: { purchases: { enabled: true, enrichment: { android: { inApp: () => enrichment } } } },
      adapter: {
        hasDedupe: async (namespace, key) => dedupe.has(`${namespace}:${key}`),
        checkAndSetDedupe: async (namespace, key) => {
          const value = `${namespace}:${key}`;
          if (dedupe.has(value)) return false;
          dedupe.add(value);
          return true;
        },
        putProtectedEvidence: async (input) => {
          protectedWrites.push({ purpose: input.purpose, value: new TextDecoder().decode(input.value) });
          return input.blobId;
        },
      },
    });
    const transaction = {
      appAccountToken: "account-secret",
      isAcknowledged: false,
      platform: "android" as const,
      productId: "annual",
      purchaseDate: 123,
      purchaseState: "purchased" as const,
      purchaseToken: "purchase-secret",
      quantity: 1,
      receipt: "receipt-secret",
      transactionId: "tx-1",
    };
    await runtime.recordObservedPurchase(transaction);
    enrichment.source = "mutated";
    await runtime.recordObservedPurchase(transaction);
    const observed = byType(runtime.inspectOutbox(), "purchase.observed.v1");
    expect(observed).toHaveLength(1);
    expect(observed[0]?.publicPayload).toMatchObject({
      enrichment: { source: "first" },
      enrichmentOutcome: "collected",
      productId: "annual",
      transactionId: "tx-1",
    });
    expect(JSON.stringify(observed)).not.toMatch(/purchase-secret|receipt-secret|account-secret/);
    expect(protectedWrites).toEqual([{
      purpose: "purchase-receipt",
      value: JSON.stringify({ appAccountToken: "account-secret", purchaseToken: "purchase-secret", receipt: "receipt-secret" }),
    }]);
  });

  it("keeps store-invalid validation distinct from transport failure and correlates concurrent responses", async () => {
    const { runtime } = makeHarness({
      adapter: {
        validatePurchase: async (input) => {
          if (input.transactionId === "invalid") {
            await Promise.resolve();
            return { outcome: "invalid", storeState: { state: "cancelled" } };
          }
          throw Object.assign(new Error("offline"), { kind: "network" });
        },
      },
    });
    const [invalid, offline] = await Promise.all([
      runtime.measurement.validatePurchase({ platform: "ios", protectedEvidenceId: "p1", transactionId: "invalid" }),
      runtime.measurement.validatePurchase({ platform: "android", protectedEvidenceId: "p2", transactionId: "offline" }),
    ]);
    expect(invalid).toMatchObject({ outcome: "invalid", transactionId: "invalid", storeState: { state: "cancelled" } });
    expect(invalid.failure).toBeUndefined();
    expect(offline).toMatchObject({ outcome: "indeterminate", transactionId: "offline", failure: { kind: "network" } });
    expect(invalid.requestId).not.toBe(offline.requestId);
  });

  it("classifies configuration, store, and server purchase validation failures", async () => {
    const { runtime: unconfigured } = makeHarness();
    await expect(unconfigured.measurement.validatePurchase({
      platform: "ios",
      protectedEvidenceId: "p-configuration",
      transactionId: "configuration",
    })).resolves.toMatchObject({ outcome: "indeterminate", failure: { kind: "configuration" } });

    const { runtime } = makeHarness({
      adapter: {
        validatePurchase: async ({ transactionId }) => {
          if (transactionId === "store") throw Object.assign(new Error("store unavailable"), { kind: "store" });
          throw new Error("invalid server response");
        },
      },
    });
    const [store, server] = await Promise.all([
      runtime.measurement.validatePurchase({ platform: "ios", protectedEvidenceId: "p-store", transactionId: "store" }),
      runtime.measurement.validatePurchase({ platform: "android", protectedEvidenceId: "p-server", transactionId: "server" }),
    ]);
    expect(store).toMatchObject({ outcome: "indeterminate", failure: { kind: "store" } });
    expect(server).toMatchObject({ outcome: "indeterminate", failure: { kind: "server" } });
  });

  it("round-trips rich normalized subscription state and rejects unknown shapes", async () => {
    const richState = {
      cancellation: { at: "2026-01-01T00:00:00.000Z", reason: "price-change" as const },
      lineItems: [{ productId: "annual", quantity: 1 }],
      offer: { id: "intro", type: "introductory" as const },
      pause: { startsAt: "2026-02-01T00:00:00.000Z", resumesAt: "2026-03-01T00:00:00.000Z" },
      prepaid: { expiresAt: "2026-04-01T00:00:00.000Z", topUpEligible: true },
      priceChange: { currency: "USD", price: "19.99", state: "pending" as const },
      productId: "annual",
      replacement: { mode: "deferred" as const, replacedProductId: "monthly" },
      state: "paused" as const,
      subscriptionState: "billing-retry",
      test: true,
    };
    const { runtime } = makeHarness({ adapter: { validatePurchase: async () => ({ outcome: "valid", storeState: richState }) } });
    await expect(runtime.measurement.validatePurchase({
      platform: "android",
      protectedEvidenceId: "p-rich",
      transactionId: "rich",
    })).resolves.toMatchObject({ outcome: "valid", storeState: richState });

    const { runtime: invalid } = makeHarness({ adapter: { validatePurchase: async () => ({
      outcome: "valid",
      storeState: { state: "future-state" },
    } as never) } });
    await expect(invalid.measurement.validatePurchase({
      platform: "ios",
      protectedEvidenceId: "p-invalid",
      transactionId: "invalid-shape",
    })).resolves.toMatchObject({ outcome: "indeterminate", failure: { kind: "server" } });
  });

  it("vaults partner context and exposes only partner IDs and revision publicly", async () => {
    const writes: string[] = [];
    const { runtime } = makeHarness({ adapter: {
      putProtectedEvidence: async (input) => {
        writes.push(new TextDecoder().decode(input.value));
        expect(input.purpose).toBe("partner-context");
        return input.blobId;
      },
    } });
    await runtime.measurement.configure({
      partnerData: { ads: { account: "partner-secret", callback: "https://partner.example/private" } },
    });
    expect(writes).toEqual([JSON.stringify({ ads: { account: "partner-secret", callback: "https://partner.example/private" } })]);
    const record = byType(runtime.inspectOutbox(), "partner.context_changed.v1")[0];
    expect(record?.publicPayload).toMatchObject({ partners: ["ads"] });
    expect(JSON.stringify(runtime.inspectOutbox())).not.toMatch(/partner-secret|partner\.example/);
    expect(JSON.stringify(await runtime.measurement.getState())).not.toMatch(/partner-secret|partner\.example/);
  });

  it("applies typed URL rules before wrapped resolution and enforces required pid", async () => {
    const fetch = vi.fn(async (..._args: Parameters<typeof globalThis.fetch>) => new Response(null, { status: 200 }));
    const { runtime } = makeHarness({
      adapter: { fetch },
      links: {
        allowedDomains: ["wrapped.example"],
        parameterRules: [{
          id: "owned-media",
          match: { domains: ["wrapped.example"] },
          parameters: { deep_link_value: "checkout" },
          reengagement: true,
          requiredPid: "flag",
        }],
        resolveWrappedDomains: ["wrapped.example"],
      },
    });
    const result = await runtime.links.handle({ source: "manual", url: "https://wrapped.example/open" });
    expect(result).toMatchObject({ status: "found", route: { value: "checkout" } });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("deep_link_value=checkout"),
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(fetch.mock.calls[0]?.[0]).toContain("is_retargeting=true");
    expect(byType(runtime.inspectOutbox(), "link.resolved.v1")[0]?.publicPayload).toMatchObject({
      ruleApplications: [{ appended: ["deep_link_value", "is_retargeting"], id: "owned-media", missingPid: true }],
    });

    const { runtime: rejecting } = makeHarness({
      links: {
        allowedDomains: ["links.example"],
        parameterRules: [{ id: "pid", match: { domains: ["links.example"] }, requiredPid: "reject" }],
      },
    });
    await expect(rejecting.links.handle({ source: "manual", url: "https://links.example/open" })).resolves.toMatchObject({
      reason: "requiredPidMissing",
      status: "notFound",
    });
  });

  it("never reads or exposes a manually supplied identifier unless policy permits it", async () => {
    const writes: string[] = [];
    const { runtime: denied } = makeHarness();
    await expect(denied.measurement.handle({ type: "identifier", kind: "oaid", value: "oaid-secret" }))
      .rejects.toBeInstanceOf(MeasurementPolicyBlocked);

    const { runtime } = makeHarness({
      consent: { revision: 1, decidedAt: "2026-01-01T00:00:00.000Z", source: "application", adStorage: true },
      adapter: { putProtectedEvidence: async (input) => {
        writes.push(new TextDecoder().decode(input.value));
        return input.blobId;
      } },
    });
    await runtime.measurement.handle({ type: "identifier", kind: "oaid", value: "oaid-secret" });
    expect(writes).toEqual(["oaid-secret"]);
    expect(JSON.stringify(byType(runtime.inspectOutbox(), "identifier.observed.v1"))).not.toContain("oaid-secret");
  });

  it("deduplicates application and system observations of the same ATT transition", async () => {
    const { runtime } = makeHarness();
    const application = await runtime.measurement.handle({
      source: "application",
      status: "authorized",
      type: "attStatus",
    });
    const system = await runtime.measurement.handle({
      source: "system",
      status: "authorized",
      type: "attStatus",
    });

    expect(system.recordId).toBe(application.recordId);
    expect(byType(runtime.inspectOutbox(), "ios.att.changed.v1")).toHaveLength(1);
  });
});
