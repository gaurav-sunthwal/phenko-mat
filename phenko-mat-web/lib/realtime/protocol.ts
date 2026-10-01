/*
 * Wire protocol between browsers, the realtime gateway and the API. Imported by all three,
 * so it must stay free of server-only / browser-only imports.
 */

export interface WireMessage {
  id: number;
  connectionId: string;
  senderId: string;
  clientId: string | null;
  body: string;
  createdAt: string;
}

/** Gateway → browser. */
export type ServerEvent =
  | { type: "ready"; userId: string }
  | { type: "message.new"; message: WireMessage }
  | { type: "connection.new"; connectionId: string }
  | { type: "connection.read"; connectionId: string; readerId: string; readAt: string }
  /** The chat was deleted by `removedBy`; both parties drop it and anyone viewing it is sent back. */
  | { type: "connection.removed"; connectionId: string; removedBy: string }
  | { type: "typing"; connectionId: string; userId: string };

/** Browser → gateway. Everything else (sending messages etc.) goes through the HTTP API. */
export type ClientEvent = { type: "typing"; connectionId: string };

/** API → gateway (internal HTTP). */
export interface PublishRequest {
  userIds: string[];
  event: ServerEvent;
}

export const CLOSE = {
  /** Server restarting — reconnect right away. */
  RESTART: 1012,
  /** Protocol/policy violation (bad ticket, flooding) — don't hammer reconnects. */
  POLICY: 1008,
  UNAUTHORIZED: 4401,
} as const;
