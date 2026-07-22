import { describe, expect, it } from 'vitest';
import {
  calculatePointerAttraction,
  normalizePointerSpeed
} from '@experience/home/home-showcase-experience';

describe('HomeShowcaseExperience', () => {
  it('normalizza la velocità senza propagare valori instabili', () => {
    expect(normalizePointerSpeed(0, 16)).toBe(0);
    expect(normalizePointerSpeed(12, 16)).toBeCloseTo(0.5);
    expect(normalizePointerSpeed(1000, 16)).toBe(1);
    expect(normalizePointerSpeed(10, 0)).toBe(0);
  });

  it('non attrae il testo fuori dal raggio di influenza', () => {
    expect(calculatePointerAttraction({ x: 0, y: 0 }, { x: 301, y: 0 }, 300, 24)).toEqual({
      x: 0,
      y: 0
    });
  });

  it('attrae verso il puntatore senza superare lo spostamento massimo', () => {
    const attraction = calculatePointerAttraction({ x: 100, y: 100 }, { x: 150, y: 125 }, 300, 24);
    expect(attraction.x).toBeGreaterThan(0);
    expect(attraction.y).toBeGreaterThan(0);
    expect(Math.hypot(attraction.x, attraction.y)).toBeLessThanOrEqual(24);
  });

  it('torna neutra quando il puntatore coincide con il centro del testo', () => {
    expect(calculatePointerAttraction({ x: 20, y: 20 }, { x: 20, y: 20 }, 300, 24)).toEqual({
      x: 0,
      y: 0
    });
  });
});
