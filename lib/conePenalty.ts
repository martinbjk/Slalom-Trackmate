import type { SlalomDiscipline } from "./types";

// World Skate Slalom Skateboarding Rules, section 5.4 "Cone Displacements":
// 0.1s for Slalom races (TS, SPS, HS, SS), 0.2s for GS, 0.3s for Super-GS and Banked Slalom.
export const DEFAULT_CONE_PENALTY_MS: Record<SlalomDiscipline, number> = {
  TS: 100,
  SPS: 100,
  HS: 100,
  GS: 200,
  SGS: 300,
  Banked: 300,
  Custom: 100,
};

export const DISCIPLINE_LABELS: Record<SlalomDiscipline, string> = {
  TS: "Tight Slalom (TS)",
  SPS: "Straight Slalom (SPS)",
  HS: "Hybrid Slalom (HS)",
  GS: "Giant Slalom (GS)",
  SGS: "Super-GS (SGS)",
  Banked: "Banked Slalom",
  Custom: "Anpassad",
};

/** The final ranked time: raw elapsed time plus cone penalty, per rules section 6.1 (RT = ET + Cones × Penalty). */
export function computeResultantTimeMs(timeMs: number, conesDisplaced: number, conePenaltyMs: number): number {
  return timeMs + conesDisplaced * conePenaltyMs;
}
