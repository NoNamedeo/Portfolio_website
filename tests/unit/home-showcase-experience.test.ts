import { describe, expect, it } from 'vitest';
import { calculateShowcaseScrollProgress } from '@experience/home/home-showcase-experience';
import { calculateSpringAcceleration } from '@experience/home/webgl-glass/glass-composition';
import {
  GLASS_CONFIG,
  GLASS_DEBUG,
  GLASS_DEBUG_MATERIAL_OPTIONS,
  GLASS_LAYOUTS
} from '@experience/home/webgl-glass/glass-config';
import { GLASS_SLOGAN_LAYOUTS } from '@experience/home/webgl-glass/glass-slogans';

describe('HomeShowcaseExperience', () => {
  it('applica una forza elastica verso il target e la riduce con la massa', () => {
    const light = calculateSpringAcceleration(0, 2, 0, 1, 18, 8);
    const heavy = calculateSpringAcceleration(0, 2, 0, 2, 18, 8);
    expect(light).toBeGreaterThan(0);
    expect(heavy).toBeCloseTo(light / 2);
  });

  it('il damping contrasta la velocità senza introdurre energia', () => {
    expect(calculateSpringAcceleration(1, 1, 2, 1, 18, 8)).toBeLessThan(0);
    expect(calculateSpringAcceleration(1, 1, -2, 1, 18, 8)).toBeGreaterThan(0);
  });

  it('normalizza la dispersione lungo la corsa sticky della scena', () => {
    expect(calculateShowcaseScrollProgress(120, 2100, 900)).toBe(0);
    expect(calculateShowcaseScrollProgress(-600, 2100, 900)).toBeCloseTo(0.5);
    expect(calculateShowcaseScrollProgress(-1800, 2100, 900)).toBe(1);
  });

  it('disabilita la progressione quando la scena non supera la viewport', () => {
    expect(calculateShowcaseScrollProgress(-200, 900, 900)).toBe(0);
    expect(calculateShowcaseScrollProgress(-200, 700, 900)).toBe(0);
  });
});

describe('GLASS_LAYOUTS', () => {
  it('mantiene corsie di profondità separate durante il movimento', () => {
    for (const layout of Object.values(GLASS_LAYOUTS)) {
      const sortedDepths = layout.map((plate) => plate.position[2]).sort((a, b) => b - a);
      const minimumGap = sortedDepths
        .slice(1)
        .reduce(
          (gap, depth, index) => Math.min(gap, sortedDepths[index]! - depth),
          Number.POSITIVE_INFINITY
        );

      expect(minimumGap).toBeGreaterThanOrEqual(0.59);
      expect(layout.every((plate) => plate.maxTranslation[2] <= 0.04)).toBe(true);
      expect(
        layout.every(
          (plate) =>
            Math.abs(plate.maxRotation[0]) <= (2 * Math.PI) / 180 &&
            Math.abs(plate.maxRotation[1]) <= (2.2 * Math.PI) / 180
        )
      ).toBe(true);
    }
  });

  it('colloca il primo slogan dietro una lastra e il secondo davanti a tutte', () => {
    for (const quality of ['high', 'balanced', 'mobile'] as const) {
      const layout = GLASS_LAYOUTS[quality];
      const sloganLayout = GLASS_SLOGAN_LAYOUTS[quality];
      const coveringPlate = layout.find((plate) => plate.id === 'north-west');
      const foremostGlassDepth = Math.max(
        ...layout.map((plate) => plate.position[2] + plate.maxTranslation[2])
      );

      expect(coveringPlate).toBeDefined();
      expect(sloganLayout.backPosition[2]).toBeLessThan(
        coveringPlate!.position[2] - coveringPlate!.maxTranslation[2]
      );
      expect(sloganLayout.frontPosition[2]).toBeGreaterThan(foremostGlassDepth + 0.5);
    }
  });

  it('mantiene disattivata la diagnostica e usa la calibrazione verificata', () => {
    expect(GLASS_DEBUG).toBe(false);
    expect(GLASS_DEBUG_MATERIAL_OPTIONS.thickness).toEqual([0.05, 0.15, 0.3, 0.6]);
    expect(GLASS_DEBUG_MATERIAL_OPTIONS.ior).toEqual([1.3, 1.5, 1.8]);
    expect(GLASS_CONFIG.material).toMatchObject({
      transmission: 1,
      opacity: 1,
      thickness: 0.3,
      ior: 1.5,
      envMapIntensity: 1.1
    });
  });
});
