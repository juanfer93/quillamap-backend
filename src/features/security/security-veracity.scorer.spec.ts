import {
  calculateSecurityIntensity,
  calculateVeracityScore,
  getEvidenceWeight,
  getKarmaWeight,
  getRoadContextWeight,
} from '@/features/security/security-veracity.scorer';
import {
  SECURITY_HEATMAP_EVIDENCE_WEIGHT,
  SECURITY_HEATMAP_MAIN_ROAD_PEAK_WEIGHT,
} from '@/features/security/security-heatmap.constants';

describe('security veracity scorer', () => {
  it('weights trusted users higher than new users', () => {
    expect(getKarmaWeight(20)).toBeGreaterThan(getKarmaWeight(0));
    expect(getKarmaWeight(5)).toBeGreaterThan(getKarmaWeight(4));
  });

  it('increases veracity when multimedia evidence is verified', () => {
    expect(getEvidenceWeight(true)).toBe(SECURITY_HEATMAP_EVIDENCE_WEIGHT);
    expect(getEvidenceWeight(false)).toBe(1);
  });

  it('applies the 45.8 percent primary-street peak-hours boost', () => {
    expect(getRoadContextWeight(true, true)).toBe(
      SECURITY_HEATMAP_MAIN_ROAD_PEAK_WEIGHT,
    );
    expect(getRoadContextWeight(true, false)).toBe(1);
  });

  it('caps veracity and derives intensity from danger level', () => {
    const factors = {
      dangerLevel: 3,
      hasVerifiedEvidence: true,
      isPeakHour: true,
      isPrimaryStreet: true,
      karmaScore: 30,
    };

    expect(calculateVeracityScore(factors)).toBe(1);
    expect(calculateSecurityIntensity(factors)).toBe(0.6);
  });
});
