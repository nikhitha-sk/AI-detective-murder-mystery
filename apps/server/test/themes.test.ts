import { CustomThemeSchema, THEMES, ThemeInputSchema, resolveTheme, sceneOf, themeById } from "@mystery/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCase } from "../src/case/generator";
import { generateThemes } from "../src/case/themes";
import { GameEngine } from "../src/game/engine";
import { GroqProvider } from "../src/llm/groq";
import { MockProvider } from "../src/llm/mock";
import { RateLimitError } from "../src/llm/types";
import { MemoryStore } from "../src/store";
import type { GameRules } from "../src/config";

describe("settings", () => {
  it("has six built-in settings, each with a backdrop", () => {
    expect(THEMES).toHaveLength(6);
    for (const t of THEMES) expect(sceneOf(t.id)).toBe(t.scene);
  });

  it("accepts built-in ids and well-formed generated settings only", () => {
    expect(resolveTheme(ThemeInputSchema.parse("newsroom")).label).toBe("Election Night Newsroom");
    const custom = { id: "gen-fest-garba-night-ab12", label: "Garba Night", blurb: "Dance.", scene: "fest" };
    expect(resolveTheme(ThemeInputSchema.parse(custom))).toEqual(custom);
    expect(ThemeInputSchema.safeParse("no-such-theme").success).toBe(false);
    expect(ThemeInputSchema.safeParse({ ...custom, scene: "manor" }).success).toBe(false);
    expect(ThemeInputSchema.safeParse({ ...custom, id: "fest-garba" }).success).toBe(false);
  });

  it("generates new, valid, distinct settings that avoid the given ones", async () => {
    const avoid = ["Snowbound Ski Lodge", "Garba Night"];
    const { themes } = await generateThemes(new MockProvider(), avoid);
    expect(themes).toHaveLength(3);
    for (const t of themes) {
      expect(CustomThemeSchema.safeParse(t).success).toBe(true);
      expect(sceneOf(t.id)).toBe(t.scene);
      expect(avoid).not.toContain(t.label);
    }
    expect(new Set(themes.map((t) => t.label)).size).toBe(3);
  });

  it("drops duplicate and built-in labels the model repeats", async () => {
    const llm = new MockProvider();
    llm.generateThemes = async () => ({
      ideas: [
        { label: "1920s Manor", blurb: "again", scene: "manor" },
        { label: "Tea Estate", blurb: "Mist.", scene: "manor" },
        { label: "tea estate", blurb: "dupe", scene: "manor" },
        { label: "Arcade", blurb: "Neon.", scene: "nowhere" },
      ],
      usage: [],
    });
    const { themes } = await generateThemes(llm, []);
    expect(themes.map((t) => t.label)).toEqual(["Tea Estate", "Arcade"]);
    expect(themes[1].scene).toBe("manor");
  });

  it("plays a full setup on a generated setting", async () => {
    const rules = { rounds: 3, briefingSeconds: 60, roundSeconds: 240, discussionSeconds: 120, voteSeconds: 60, questionsPerRound: 6, roomTokenBudget: 600_000, maxPlayers: 6, maxCaseAttempts: 3, askCooldownSeconds: 0, confessionStress: 80, roomTtlSeconds: 3600 } satisfies GameRules;
    const states: { phase: string; themeInfo: { id: string } }[] = [];
    const engine = new GameEngine({
      store: new MemoryStore(),
      llm: new MockProvider(),
      db: { enabled: false, saveCase() {}, createGame() {}, saveMessage() {}, finishGame() {}, async close() {} },
      rules,
      typewriterMs: 0,
      out: { room: (_c, event, ...args) => event === "room:state" && states.push(args[0] as never), player: () => {} },
    });
    const [theme] = await engine.generateThemes([]);
    const code = await engine.createRoom("dana-00001", "Dana", theme, true);
    await engine.start(code, "dana-00001");
    for (let i = 0; i < 200 && (await engine.getRoom(code))?.machine.value !== "briefing"; i++) await new Promise((r) => setTimeout(r, 10));
    expect((await engine.getRoom(code))?.machine.value).toBe("briefing");
    const view = await engine.view((await engine.getRoom(code))!);
    expect(view.themeInfo).toEqual(theme);
    expect(view.case?.theme).toBe(theme.id);
  });
});

describe("rate limits", () => {
  afterEach(() => vi.unstubAllGlobals());

  const ok = (content: string) =>
    new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200 });
  const limited = (s: number) => new Response('{"error":"rate_limit_exceeded"}', { status: 429, headers: { "retry-after": String(s) } });

  it("Groq falls back to another model instead of failing, and remembers the cooldown", async () => {
    const calls: string[] = [];
    const groq = new GroqProvider("key", { main: "main", solver: "solver", suspect: "suspect", guard: "guard" });
    const input = { setting: "", victim: { name: "", cause: "", timeOfDeath: "", scene: "" }, suspects: [], clues: [] };
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      const model = JSON.parse(init.body).model as string;
      calls.push(model);
      return model === "solver" ? limited(30) : ok('{"suspectId":"s1","confidence":0.9,"reasoning":"r"}');
    });
    const first = await groq.solve(input);
    expect(first.result.suspectId).toBe("s1");
    expect(calls).toEqual(["solver", "guard"]);
    // The solver model is still cooling down, so the next call goes straight to the fallback.
    await groq.solve(input);
    expect(calls).toEqual(["solver", "guard", "guard"]);
  });

  it("Groq reports a RateLimitError when every model is exhausted for too long", async () => {
    vi.stubGlobal("fetch", async () => limited(120));
    const groq = new GroqProvider("key", { main: "a", solver: "b", suspect: "c", guard: "d" });
    await expect(groq.summarize("X", [], "")).rejects.toBeInstanceOf(RateLimitError);
  });

  it("case setup waits out a rate limit without using up an attempt", async () => {
    const llm = new MockProvider();
    const real = llm.generateCase.bind(llm);
    let calls = 0;
    llm.generateCase = async (req) => {
      calls++;
      if (calls === 1) throw new RateLimitError("busy", 0);
      return real(req);
    };
    const progress: string[] = [];
    const g = await generateCase(llm, themeById("manor-1920s"), { rounds: 3, maxAttempts: 1, onProgress: (p) => progress.push(p.message) });
    expect(g.attempts).toBe(1);
    expect(progress.some((m) => m.includes("rate limit"))).toBe(true);
  });
});
