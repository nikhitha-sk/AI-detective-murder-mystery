"use client";

import { CustomThemeSchema, THEMES, type Theme } from "@mystery/shared";
import { create } from "zustand";
import { useGame } from "@/store/game";

/**
 * Settings the AI generated for this player, newest first. Kept in this
 * browser only (a per-player convenience): rooms carry their own setting, so
 * nothing breaks if this is empty.
 */

const STORAGE_KEY = "mystery:generated-themes";
const MAX_KEPT = 30;

function load(): Theme[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(raw) ? raw.flatMap((t) => (CustomThemeSchema.safeParse(t).success ? [t as Theme] : [])) : [];
  } catch {
    return [];
  }
}

function save(themes: Theme[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
  } catch {
    // Private mode or blocked storage: the list just won't survive a reload.
  }
}

interface ThemeLibrary {
  generated: Theme[];
  loaded: boolean;
  generating: boolean;
  load(): void;
  /** Ask the AI for fresh settings; returns the new ones (also added to the library). */
  generate(): Promise<Theme[]>;
}

export const useThemeLibrary = create<ThemeLibrary>()((set, get) => ({
  generated: [],
  loaded: false,
  generating: false,

  load() {
    if (!get().loaded) set({ generated: load(), loaded: true });
  },

  async generate() {
    if (get().generating) return [];
    set({ generating: true });
    try {
      const avoid = get().generated.map((t) => t.label).slice(0, 40);
      const fresh = await useGame.getState().generateThemes(avoid);
      const generated = [...fresh, ...get().generated].slice(0, MAX_KEPT);
      save(generated);
      set({ generated });
      return fresh;
    } finally {
      set({ generating: false });
    }
  },
}));

/** Every setting to offer: built-ins, then generated ones, plus `current` if it isn't in either (a friend's generated setting). */
export function allThemes(generated: Theme[], current?: Theme | null): Theme[] {
  const list: Theme[] = [...THEMES, ...generated];
  if (current && !list.some((t) => t.id === current.id)) list.push(current);
  return list;
}
