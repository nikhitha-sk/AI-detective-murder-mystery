"use client";

const ID_KEY = "ai-detective:playerId";
const NAME_KEY = "ai-detective:name";

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: identity just won't survive a reload */
  }
}

let memoryId: string | null = null;

/** Stable per-browser player id, so a refresh rejoins the same seat. */
export function getPlayerId(): string {
  const existing = safeGet(ID_KEY) ?? memoryId;
  if (existing) return existing;
  const id = crypto.randomUUID().replace(/-/g, "");
  memoryId = id;
  safeSet(ID_KEY, id);
  return id;
}

export function getSavedName(): string {
  return safeGet(NAME_KEY) ?? "";
}

export function saveName(name: string) {
  safeSet(NAME_KEY, name);
}
