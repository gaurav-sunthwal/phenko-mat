import type { ServerEvent } from "../lib/realtime/protocol";

/**
 * Routes events to users, wherever their sockets are.
 *
 * - LocalBroker (now): one gateway instance; delivery = local sockets.
 * - RedisBroker (later): publish to `u:{userId}` channels; every instance subscribes to channels of
 *   users connected to it. Swap the implementation in server.ts; nothing else changes.
 */
export interface Broker {
  publish(userIds: string[], event: ServerEvent): Promise<void>;
  /** Called when a user's first socket connects to this instance. */
  onUserOnline(userId: string): Promise<void>;
  /** Called when a user's last socket on this instance disconnects. */
  onUserOffline(userId: string): Promise<void>;
  close(): Promise<void>;
}

export class LocalBroker implements Broker {
  constructor(private readonly deliver: (userId: string, event: ServerEvent) => void) {}

  async publish(userIds: string[], event: ServerEvent) {
    for (const id of new Set(userIds)) this.deliver(id, event);
  }

  async onUserOnline() {}
  async onUserOffline() {}
  async close() {}
}
