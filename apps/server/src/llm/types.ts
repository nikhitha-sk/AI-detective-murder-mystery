import type { SuspectSlice, Visibility } from "@mystery/shared";

export interface Usage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/** One thing a suspect has said, kept in their private memory. */
export interface Statement {
  askerName: string;
  visibility: Visibility;
  kind: "question" | "present";
  question: string;
  clueId: string | null;
  reply: string;
  round: number;
}

export interface SuspectDirectives {
  /** The server has decided this reply is the killer's confession. */
  mustConfess: boolean;
  /** High stress: let a small true detail slip (never a confession). */
  slipping: boolean;
}

/**
 * Everything a suspect agent receives for one turn. Note there is no case file
 * here: a suspect only ever gets its own slice plus its own memory.
 */
export interface SuspectTurn {
  slice: SuspectSlice;
  memory: {
    summary: string;
    statements: Statement[];
    evidenceSeen: { id: string; text: string }[];
    stress: number;
  };
  asker: { name: string; visibility: Visibility };
  question: string;
  presentedClue: { id: string; text: string } | null;
  directives: SuspectDirectives;
  /** Set when the guard rejected a previous draft of this same reply. */
  guardFeedback?: string;
}

export type ViolationType = "leak" | "confession" | "contradiction" | "character";

export interface GuardVerdict {
  ok: boolean;
  violations: { type: ViolationType; detail: string }[];
}

export interface GuardInput {
  slice: SuspectSlice;
  priorStatements: Statement[];
  question: string;
  draft: string;
  confessionAllowed: boolean;
}

export interface SolverInput {
  setting: string;
  victim: { name: string; cause: string; timeOfDeath: string; scene: string };
  suspects: { id: string; name: string; role: string; relationshipToVictim: string; bio: string; alibi: string }[];
  clues: { id: string; text: string }[];
}

export interface SolverResult {
  suspectId: string;
  confidence: number;
  reasoning: string;
}

export interface CaseRequest {
  theme: string;
  themeLabel: string;
  themeBlurb: string;
  suspectCount: number;
  killerId: string;
  seeds: { motives: string[]; cause: string; nameStyle: string };
  /** Problems found in the previous attempt, fed back on a retry. */
  feedback: string[];
}

/** Raw setting ideas from the model; case/themes.ts validates them and assigns ids. */
export interface ThemeIdea {
  label: string;
  blurb: string;
  scene: string;
}

/** Every model the provider could use is rate limited for longer than the caller is willing to wait. */
export class RateLimitError extends Error {
  constructor(
    message: string,
    readonly retryAfterS: number,
  ) {
    super(message);
  }
}

export interface LlmProvider {
  readonly mode: "groq" | "anthropic" | "mock";
  /** Returns raw JSON; the caller validates it with Zod and the rule checks. */
  generateCase(req: CaseRequest): Promise<{ raw: unknown; usage: Usage[] }>;
  solve(input: SolverInput): Promise<{ result: SolverResult; usage: Usage[] }>;
  suspectReply(turn: SuspectTurn): Promise<{ text: string; refused: boolean; usage: Usage[] }>;
  guard(input: GuardInput): Promise<{ verdict: GuardVerdict; usage: Usage[] }>;
  summarize(name: string, statements: Statement[], previous: string): Promise<{ summary: string; usage: Usage[] }>;
  /** Fresh settings for the setting picker, avoiding the labels given. */
  generateThemes(avoid: string[], count: number): Promise<{ ideas: ThemeIdea[]; usage: Usage[] }>;
}
