import { CaseFileSchema, themeLabel, type CaseFile } from "@mystery/shared";
import type { LlmProvider } from "../llm/types";
import type { SolverResult, Usage } from "../llm/types";
import { checkCaseRules } from "./rules";
import { randomSeeds } from "./seeds";
import { solverInput } from "./slices";

export interface GeneratedCase {
  caseFile: CaseFile;
  attempts: number;
  solver: SolverResult;
  usage: Usage[];
}

export class CaseGenerationError extends Error {
  constructor(
    message: string,
    readonly attempts: number,
    readonly usage: Usage[],
  ) {
    super(message);
  }
}

export type ProgressFn = (p: { attempt: number; step: "generating" | "checking" | "solving"; message: string }) => void;

/**
 * Game setup, steps 2-5: generate the ground truth, validate it with Zod,
 * run the rule checks, then let an independent solver try to name the killer
 * from the clues alone. Any failure regenerates, up to `maxAttempts`.
 */
export async function generateCase(
  llm: LlmProvider,
  theme: string,
  opts: { rounds: number; maxAttempts: number; onProgress?: ProgressFn },
): Promise<GeneratedCase> {
  const usage: Usage[] = [];
  let feedback: string[] = [];
  let lastProblem = "unknown error";

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    const progress = (step: "generating" | "checking" | "solving", message: string) =>
      opts.onProgress?.({ attempt, step, message });
    try {
      progress("generating", "Writing the case file...");
      const { raw, usage: u1 } = await llm.generateCase({
        theme,
        themeLabel: themeLabel(theme),
        ...randomSeeds(),
        feedback,
      });
      usage.push(...u1);

      progress("checking", "Checking the timeline and clues...");
      const parsed = CaseFileSchema.safeParse(raw);
      if (!parsed.success) {
        feedback = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".")}: ${i.message}`);
        lastProblem = `schema validation failed (${feedback[0]})`;
        continue;
      }
      const caseFile: CaseFile = { ...parsed.data, theme };
      const problems = checkCaseRules(caseFile, { rounds: opts.rounds });
      if (problems.length) {
        feedback = problems;
        lastProblem = `rule check failed (${problems[0]})`;
        continue;
      }

      progress("solving", "An independent detective is testing whether it can be solved...");
      const { result, usage: u2 } = await llm.solve(solverInput(caseFile));
      usage.push(...u2);
      if (result.suspectId !== caseFile.killerId) {
        const named = caseFile.suspects.find((s) => s.id === result.suspectId)?.name ?? result.suspectId;
        feedback = [
          `An independent solver reading only the clues and alibis accused ${named} instead of the real killer. ` +
            `Make the clues against the killer clearer and the red herrings weaker. Solver's reasoning: ${result.reasoning}`,
        ];
        lastProblem = "the solver could not identify the killer from the clues";
        continue;
      }
      return { caseFile, attempts: attempt, solver: result, usage };
    } catch (err) {
      lastProblem = err instanceof Error ? err.message : String(err);
      feedback = [`The previous attempt failed: ${lastProblem}`];
    }
  }
  throw new CaseGenerationError(
    `Could not produce a fair case after ${opts.maxAttempts} attempts: ${lastProblem}`,
    opts.maxAttempts,
    usage,
  );
}
