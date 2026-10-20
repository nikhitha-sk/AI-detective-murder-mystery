"use client";

import type { Ack, ClientToServerEvents, ServerToClientEvents } from "@mystery/shared";
import { io, type Socket } from "socket.io-client";
import { getPlayerId } from "./identity";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4300";

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      auth: { playerId: getPlayerId() },
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}

type AckResult = Parameters<Ack<unknown>>[0];

/** Emit an event that takes an ack callback, as a promise that rejects with the server's message. */
export function request<T = void>(event: keyof ClientToServerEvents, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const s = getSocket() as unknown as { timeout(ms: number): { emit(e: string, ...a: unknown[]): void } };
    s.timeout(20_000).emit(event, ...args, (err: Error | null, res: AckResult) => {
      if (err) return reject(new Error("The server didn't respond. Is it running?"));
      if (res.ok) resolve(res.data as T);
      else reject(new Error(res.error));
    });
  });
}
