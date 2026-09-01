import * as Arr from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";

/** Timer seam so tests can drive the auth deadline deterministically. */
export interface SessionRegistryTimers {
  readonly now: () => number;
  /** Schedules `fn` after `ms` and returns a cancel thunk. */
  readonly schedule: (fn: () => void, ms: number) => () => void;
}

export interface SessionRegistryOptions<TSocket> {
  /** How long an upgraded socket may stay unauthenticated before being closed. */
  readonly authDeadlineMs: number;
  /** Belt-and-braces re-check applied when iterating authenticated sockets. */
  readonly isAuthenticated: (socket: TSocket) => boolean;
  /** Closes a socket that missed the auth deadline. */
  readonly close: (socket: TSocket) => void;
  readonly timers?: SessionRegistryTimers;
}

/**
 * Tracks the live WebSocket sessions of a document entity, split into
 * authenticated sessions (the only ones broadcasts may reach) and pending
 * pre-auth sockets, which are closed if they do not authenticate within the
 * deadline.
 */
export interface SessionRegistry<TSocket> {
  /** Tracks a freshly upgraded, not-yet-authenticated socket and arms its auth deadline. */
  trackPending(connectionId: string, socket: TSocket): void;
  /**
   * Re-registers a socket after host rehydration: authenticated sockets rejoin the
   * broadcast set; pending sockets get the remainder of their auth deadline
   * (and are closed immediately when it has already passed).
   */
  restore(
    connectionId: string,
    socket: TSocket,
    authenticated: boolean,
    connectedAt: Option.Option<number>,
  ): void;
  /** Moves a socket into the authenticated set and cancels its deadline. */
  promote(connectionId: string, socket: TSocket): void;
  /** Forgets a socket (close/error) and cancels any pending deadline. */
  remove(connectionId: string): void;
  /** The sockets broadcasts may reach. */
  authenticated(): readonly TSocket[];
}

const defaultTimers: SessionRegistryTimers = {
  now: () => Clock.Clock.defaultValue().currentTimeMillisUnsafe(),
  schedule: (fn, ms) => {
    const timeout = globalThis.setTimeout(fn, ms);
    return () => globalThis.clearTimeout(timeout);
  },
};

const elapsedSince = (timers: SessionRegistryTimers, connectedAt: Option.Option<number>): number =>
  Option.match(connectedAt, {
    onNone: () => 0,
    onSome: (connected) => timers.now() - connected,
  });

export const makeSessionRegistry = <TSocket>(
  options: SessionRegistryOptions<TSocket>,
): SessionRegistry<TSocket> => {
  const timers = options.timers ?? defaultTimers;
  let sessions = HashMap.empty<string, TSocket>();
  let pendingDeadlines = HashMap.empty<string, () => void>();

  const armDeadline = (connectionId: string, socket: TSocket, deadlineMs: number): void => {
    Option.getOrElse(HashMap.get(pendingDeadlines, connectionId), () => () => {})();
    pendingDeadlines = HashMap.set(
      pendingDeadlines,
      connectionId,
      timers.schedule(() => {
        pendingDeadlines = HashMap.remove(pendingDeadlines, connectionId);
        options.close(socket);
      }, deadlineMs),
    );
  };

  const trackPending = (connectionId: string, socket: TSocket): void => {
    armDeadline(connectionId, socket, options.authDeadlineMs);
  };

  return {
    trackPending,
    restore: (connectionId, socket, authenticated, connectedAt) => {
      if (authenticated) {
        sessions = HashMap.set(sessions, connectionId, socket);
        return;
      }
      const remaining = options.authDeadlineMs - elapsedSince(timers, connectedAt);
      if (remaining <= 0) {
        options.close(socket);
        return;
      }
      armDeadline(connectionId, socket, remaining);
    },
    promote: (connectionId, socket) => {
      Option.getOrElse(HashMap.get(pendingDeadlines, connectionId), () => () => {})();
      pendingDeadlines = HashMap.remove(pendingDeadlines, connectionId);
      sessions = HashMap.set(sessions, connectionId, socket);
    },
    remove: (connectionId) => {
      Option.getOrElse(HashMap.get(pendingDeadlines, connectionId), () => () => {})();
      pendingDeadlines = HashMap.remove(pendingDeadlines, connectionId);
      sessions = HashMap.remove(sessions, connectionId);
    },
    authenticated: () => Arr.filter(HashMap.values(sessions), options.isAuthenticated),
  };
};
import * as Clock from "effect/Clock";
