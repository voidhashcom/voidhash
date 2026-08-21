import { Deferred, Effect } from "effect";
import { vi } from "vitest";

import type { VoidhashClient } from "../../src/client";
import { createVoidhashClientLifecycle } from "../../src/react/internal/client-lifecycle";
import { describe, expect, it } from "../helpers/effect-vitest";

function createClientMock() {
  return {
    end: vi.fn().mockResolvedValue(undefined),
    init: vi.fn().mockResolvedValue(undefined),
    isEnabled: true,
    isInitialized: false,
  };
}

/**
 * Only `init`/`end`/`isEnabled` participate in the lifecycle, so the mock stays
 * a plain bag of `vi.fn()`s and is widened at the call boundary.
 */
const asClient = (mock: ReturnType<typeof createClientMock>) => mock as unknown as VoidhashClient;

describe("voidhash client lifecycle", () => {
  it("settles in the ready status after a successful init", async () => {
    const client = createClientMock();
    const lifecycle = createVoidhashClientLifecycle(asClient(client));

    expect(lifecycle.getState()).toEqual({ initError: null, status: "initializing" });

    const unmount = lifecycle.mount();
    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("ready"));

    expect(client.init).toHaveBeenCalledTimes(1);
    expect(lifecycle.getState().initError).toBeNull();

    unmount();
  });

  it("settles in the failed status without an unhandled rejection when init rejects", async () => {
    const unhandledRejection = vi.fn();
    process.on("unhandledRejection", unhandledRejection);

    const client = createClientMock();
    const initError = new Error("failed to fetch schema");
    client.init.mockRejectedValue(initError);

    const lifecycle = createVoidhashClientLifecycle(asClient(client));
    const unmount = lifecycle.mount();

    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("failed"));
    expect(lifecycle.getState().initError).toBe(initError);

    await Effect.runPromise(Effect.sleep(10));
    expect(unhandledRejection).not.toHaveBeenCalled();
    process.off("unhandledRejection", unhandledRejection);

    unmount();
    await Effect.runPromise(Effect.sleep(10));
    // `end()` dies on an uninitialized client, so a failed init has nothing to
    // tear down.
    expect(client.end).not.toHaveBeenCalled();
  });

  it("ends a client that a rejecting init left partially initialized", async () => {
    const client = createClientMock();
    // `VoidhashClient.init()` flips its own flag before its last steps, so a
    // late rejection leaves native listeners and timers running.
    client.init.mockImplementation(() => {
      client.isInitialized = true;
      // oxlint-disable-next-line effect/noNewPromise -- the fixture has to be a rejecting promise *and* flip the flag first, which neither `mockRejectedValue` nor an `async` body (its `throw` is banned too) can express; `init()` is a promise-returning client method, so this is the promise boundary itself.
      return Promise.reject(new Error("failed to wire automatic lifecycle events"));
    });
    client.end.mockImplementation(async () => {
      client.isInitialized = false;
    });

    const lifecycle = createVoidhashClientLifecycle(asClient(client));
    const unmount = lifecycle.mount();
    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("failed"));

    unmount();
    await vi.waitFor(() => expect(client.end).toHaveBeenCalledTimes(1));
  });

  it("normalizes a non-Error init rejection", async () => {
    const client = createClientMock();
    client.init.mockRejectedValue("native adapter exploded");

    const lifecycle = createVoidhashClientLifecycle(asClient(client));
    const unmount = lifecycle.mount();

    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("failed"));
    expect(lifecycle.getState().initError).toBeInstanceOf(Error);
    expect(lifecycle.getState().initError?.message).toBe("native adapter exploded");

    unmount();
  });

  it("ends the client on unmount after a successful init", async () => {
    const client = createClientMock();
    const lifecycle = createVoidhashClientLifecycle(asClient(client));

    const unmount = lifecycle.mount();
    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("ready"));

    unmount();
    await vi.waitFor(() => expect(client.end).toHaveBeenCalledTimes(1));
    expect(lifecycle.getState()).toEqual({ initError: null, status: "initializing" });
  });

  it("skips the state update but still ends the client when unmounted mid-init", async () => {
    const client = createClientMock();
    const initGate = Deferred.makeUnsafe<void>();
    client.init.mockImplementation(() => Effect.runPromise(Deferred.await(initGate)));

    const lifecycle = createVoidhashClientLifecycle(asClient(client));
    const listener = vi.fn();
    const unsubscribe = lifecycle.subscribe(listener);

    const unmount = lifecycle.mount();
    unmount();
    listener.mockClear();

    Deferred.doneUnsafe(initGate, Effect.void);
    await vi.waitFor(() => expect(client.end).toHaveBeenCalledTimes(1));

    expect(lifecycle.getState()).toEqual({ initError: null, status: "initializing" });
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("re-initializes the client on remount", async () => {
    const client = createClientMock();
    const lifecycle = createVoidhashClientLifecycle(asClient(client));

    const unmount = lifecycle.mount();
    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("ready"));
    unmount();
    await vi.waitFor(() => expect(client.end).toHaveBeenCalledTimes(1));

    const unmountRemount = lifecycle.mount();
    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("ready"));

    expect(client.init).toHaveBeenCalledTimes(2);
    unmountRemount();
  });

  it("re-attempts init when retryInit runs after a failure", async () => {
    const client = createClientMock();
    client.init.mockRejectedValueOnce(new Error("device is offline"));

    const lifecycle = createVoidhashClientLifecycle(asClient(client));
    const unmount = lifecycle.mount();
    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("failed"));

    lifecycle.retryInit();
    expect(lifecycle.getState()).toEqual({ initError: null, status: "initializing" });

    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("ready"));
    expect(client.init).toHaveBeenCalledTimes(2);

    unmount();
  });

  it("ends a partially initialized client before retryInit re-runs init", async () => {
    const calls: string[] = [];
    const client = createClientMock();
    client.init.mockImplementation(async () => {
      calls.push("init");
    });
    // The first attempt reaches the point where the client is usable — its
    // observer and AppState subscription are live — and only then rejects.
    client.init.mockImplementationOnce(() => {
      calls.push("init");
      client.isInitialized = true;
      // oxlint-disable-next-line effect/noNewPromise -- the fixture has to be a rejecting promise *and* flip the flag first, which neither `mockRejectedValue` nor an `async` body (its `throw` is banned too) can express; `init()` is a promise-returning client method, so this is the promise boundary itself.
      return Promise.reject(new Error("failed to wire automatic lifecycle events"));
    });
    client.end.mockImplementation(async () => {
      calls.push("end");
      client.isInitialized = false;
    });

    const lifecycle = createVoidhashClientLifecycle(asClient(client));
    const unmount = lifecycle.mount();
    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("failed"));

    lifecycle.retryInit();
    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("ready"));

    expect(calls).toEqual(["init", "end", "init"]);
    expect(client.init).toHaveBeenCalledTimes(2);

    unmount();
    await vi.waitFor(() => expect(client.end).toHaveBeenCalledTimes(2));
  });

  it("ignores retryInit while initializing or ready", async () => {
    const client = createClientMock();
    const lifecycle = createVoidhashClientLifecycle(asClient(client));

    const unmount = lifecycle.mount();
    lifecycle.retryInit();

    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("ready"));
    lifecycle.retryInit();
    await Effect.runPromise(Effect.sleep(10));

    expect(client.init).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("parks a disabled client in the disabled status without initializing it", async () => {
    const client = createClientMock();
    client.isEnabled = false;

    const lifecycle = createVoidhashClientLifecycle(asClient(client));
    expect(lifecycle.getState()).toEqual({ initError: null, status: "disabled" });

    const listener = vi.fn();
    const unsubscribe = lifecycle.subscribe(listener);
    const unmount = lifecycle.mount();
    await Effect.runPromise(Effect.sleep(10));

    expect(client.init).not.toHaveBeenCalled();
    expect(lifecycle.getState()).toEqual({ initError: null, status: "disabled" });

    lifecycle.retryInit();
    unmount();
    await Effect.runPromise(Effect.sleep(10));

    expect(client.init).not.toHaveBeenCalled();
    expect(client.end).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(lifecycle.getState()).toEqual({ initError: null, status: "disabled" });
    unsubscribe();
  });

  it("warns and swallows a failing end on unmount", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = createClientMock();
    client.end.mockRejectedValue(new Error("native adapter is gone"));

    const lifecycle = createVoidhashClientLifecycle(asClient(client));
    const unmount = lifecycle.mount();
    await vi.waitFor(() => expect(lifecycle.getState().status).toBe("ready"));

    unmount();
    await vi.waitFor(() => expect(warnSpy).toHaveBeenCalled());
    expect(String(warnSpy.mock.calls[0][0])).toContain("[voidhash]");

    warnSpy.mockRestore();
  });
});
