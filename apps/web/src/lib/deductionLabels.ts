import type { DeductionType } from "@/api/client";

export const DEDUCTION_LABELS: Record<DeductionType, string> = {
  athlete_fall: "Athlete Fall",
  major_athlete_fall: "Major Athlete Fall",
  building_bobble: "Building Bobble",
  building_fall: "Building Fall",
  major_building_fall: "Major Building Fall",
  legality_infractions: "Legality Infractions",
  skill_out_of_level: "Skill Performed Out of Level",
  time_limit_violations: "Time Limit Violations",
  boundary_violations: "Boundary Violations",
};
