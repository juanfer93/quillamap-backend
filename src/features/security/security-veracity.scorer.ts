import {
  SECURITY_HEATMAP_EVIDENCE_WEIGHT,
  SECURITY_HEATMAP_MAIN_ROAD_PEAK_WEIGHT,
  SECURITY_HEATMAP_MIN_SCORE,
  SECURITY_HEATMAP_RANDOM_FOREST_PRECISION,
} from '@/features/security/security-heatmap.constants';

export interface SecurityVeracityFactors {
  dangerLevel: number;
  hasVerifiedEvidence: boolean;
  isPeakHour: boolean;
  isPrimaryStreet: boolean;
  karmaScore: number;
}

const clampScore = (value: number): number =>
  Math.min(1, Math.max(SECURITY_HEATMAP_MIN_SCORE, value));

export const getKarmaWeight = (karmaScore: number): number => {
  if (karmaScore >= 20) {
    return 1.1;
  }

  return karmaScore >= 5 ? 1 : 0.85;
};

export const getEvidenceWeight = (hasVerifiedEvidence: boolean): number =>
  hasVerifiedEvidence ? SECURITY_HEATMAP_EVIDENCE_WEIGHT : 1;

export const getRoadContextWeight = (
  isPrimaryStreet: boolean,
  isPeakHour: boolean,
): number =>
  isPrimaryStreet && isPeakHour ? SECURITY_HEATMAP_MAIN_ROAD_PEAK_WEIGHT : 1;

export const calculateVeracityScore = (
  factors: SecurityVeracityFactors,
): number =>
  clampScore(
    SECURITY_HEATMAP_RANDOM_FOREST_PRECISION *
      getKarmaWeight(factors.karmaScore) *
      getEvidenceWeight(factors.hasVerifiedEvidence) *
      getRoadContextWeight(factors.isPrimaryStreet, factors.isPeakHour),
  );

export const calculateSecurityIntensity = (
  factors: SecurityVeracityFactors,
): number =>
  clampScore((factors.dangerLevel / 5) * calculateVeracityScore(factors));
