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
    connectedAt: number | undefined,
  ): void;
  /** Moves a socket into the authenticated set and cancels its deadline. */
  promote(connectionId: string, socket: TSocket): void;
  /** Forgets a socket (close/error) and cancels any pending deadline. */
  remove(connectionId: string): void;
  /** The sockets broadcasts may reach. */
  authenticated(): readonly TSocket[];
}

const defaultTimers: SessionRegistryTimers = {
  now: () => Date.now(),
  schedule: (fn, ms) => {
    const handle = setTimeout(fn, ms);
    return () => clearTimeout(handle);
  },
};

export const makeSessionRegistry = <TSocket>(
  options: SessionRegistryOptions<TSocket>,
): SessionRegistry<TSocket> => {
  const timers = options.timers ?? defaultTimers;
  const sessions = new Map<string, TSocket>();
  const pendingDeadlines = new Map<string, () => void>();

  const armDeadline = (connectionId: string, socket: TSocket, deadlineMs: number): void => {
    pendingDeadlines.get(connectionId)?.();
    pendingDeadlines.set(
      connectionId,
      timers.schedule(() => {
        pendingDeadlines.delete(connectionId);
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
        sessions.set(connectionId, socket);
        return;
      }
      const elapsed = connectedAt === undefined ? 0 : timers.now() - connectedAt;
      const remaining = options.authDeadlineMs - elapsed;
      if (remaining <= 0) {
        options.close(socket);
        return;
      }
      armDeadline(connectionId, socket, remaining);
    },
    promote: (connectionId, socket) => {
      pendingDeadlines.get(connectionId)?.();
      pendingDeadlines.delete(connectionId);
      sessions.set(connectionId, socket);
    },
    remove: (connectionId) => {
      pendingDeadlines.get(connectionId)?.();
      pendingDeadlines.delete(connectionId);
      sessions.delete(connectionId);
    },
    authenticated: () => [...sessions.values()].filter(options.isAuthenticated),
  };
};
