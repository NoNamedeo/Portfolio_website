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

  it('mantiene un’attrazione quasi impercettibile anche a grande distanza', () => {
    const attraction = calculatePointerAttraction({ x: 0, y: 0 }, { x: 1200, y: 0 }, 420, 16);
    expect(attraction.x).toBeGreaterThan(0);
    expect(attraction.x).toBeLessThan(1);
    expect(attraction.y).toBe(0);
  });

  it('aumenta gradualmente avvicinandosi senza superare il limite', () => {
    const far = calculatePointerAttraction({ x: 0, y: 0 }, { x: 1200, y: 0 }, 420, 16);
    const medium = calculatePointerAttraction({ x: 0, y: 0 }, { x: 420, y: 0 }, 420, 16);
    const near = calculatePointerAttraction({ x: 0, y: 0 }, { x: 80, y: 0 }, 420, 16);
    expect(near.x).toBeGreaterThan(medium.x);
    expect(medium.x).toBeGreaterThan(far.x);
    expect(Math.hypot(near.x, near.y)).toBeLessThanOrEqual(16);
  });

  it('non introduce una soglia netta alla vecchia distanza di influenza', () => {
    const before = calculatePointerAttraction({ x: 0, y: 0 }, { x: 419, y: 0 }, 420, 16);
    const after = calculatePointerAttraction({ x: 0, y: 0 }, { x: 421, y: 0 }, 420, 16);
    expect(Math.abs(before.x - after.x)).toBeLessThan(0.1);
  });

  it('torna neutra quando il puntatore coincide con il centro del testo', () => {
    expect(calculatePointerAttraction({ x: 20, y: 20 }, { x: 20, y: 20 }, 420, 16)).toEqual({
      x: 0,
      y: 0
    });
  });
});
