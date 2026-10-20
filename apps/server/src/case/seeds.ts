/** Variety seeds so generated cases don't repeat (risk: repetitive cases). */

const MOTIVES = [
  "an inheritance about to be rewritten",
  "a blackmail letter",
  "a business partner about to be exposed for fraud",
  "a stolen invention or idea",
  "a secret affair about to come out",
  "a gambling debt",
  "a ruined career",
  "a forged document",
  "revenge for an old humiliation",
  "a hidden child or family secret",
  "an insurance policy",
  "a rigged competition",
  "a plagiarised thesis or song",
  "a sabotaged rival",
  "leaked confidential plans",
];

const CAUSES = [
  "poison in a drink",
  "a push down a staircase",
  "a blow from a heavy ornament",
  "a fall from a balcony",
  "a tampered medicine dose",
  "suffocation in a locked room (non-graphic)",
  "a rigged piece of equipment",
];

const NAME_STYLES = [
  "a mix of Indian names",
  "a mix of British names",
  "an international mix of names",
  "a mix of South Indian and North Indian names",
  "a mix of names from around the world",
];

function sample<T>(items: T[], n: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export function randomSeeds() {
  const suspectCount = Math.random() < 0.5 ? 4 : 5;
  return {
    suspectCount,
    killerId: `s${1 + Math.floor(Math.random() * suspectCount)}`,
    seeds: {
      motives: sample(MOTIVES, 3),
      cause: sample(CAUSES, 1)[0],
      nameStyle: sample(NAME_STYLES, 1)[0],
    },
  };
}
