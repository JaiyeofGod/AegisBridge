/**
 * AegisBridge internal inherent-risk methodology.
 * Likelihood (1–5) × Impact (1–5). Not a NIST formula.
 */

export const LIKELIHOOD_LABELS = [
  "Rare",
  "Unlikely",
  "Possible",
  "Likely",
  "Almost certain",
] as const;

export const IMPACT_LABELS = ["Insignificant", "Minor", "Moderate", "Major", "Severe"] as const;

export type Likelihood = 1 | 2 | 3 | 4 | 5;
export type Impact = 1 | 2 | 3 | 4 | 5;

export type RiskBandLabel = "Low" | "Medium" | "High" | "Critical";

export type RiskBand = {
  label: RiskBandLabel;
  tone: "success" | "warning" | "critical" | "accent";
};

/** Internal score = likelihood × impact (range 1–25). */
export function riskScore(likelihood: Likelihood, impact: Impact): number {
  return likelihood * impact;
}

/**
 * Text bands for the internal matrix:
 * 1–4 Low, 5–9 Medium, 10–15 High, 16–25 Critical.
 */
export function riskBand(score: number): RiskBand {
  if (score >= 16) return { label: "Critical", tone: "critical" };
  if (score >= 10) return { label: "High", tone: "warning" };
  if (score >= 5) return { label: "Medium", tone: "accent" };
  return { label: "Low", tone: "success" };
}

export function likelihoodLabel(value: number): string {
  return LIKELIHOOD_LABELS[value - 1] ?? "Not recorded";
}

export function impactLabel(value: number): string {
  return IMPACT_LABELS[value - 1] ?? "Not recorded";
}
