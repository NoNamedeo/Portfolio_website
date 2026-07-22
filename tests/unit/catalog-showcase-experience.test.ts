import { describe, expect, it } from 'vitest';
import { calculateMarqueeDuration } from '@experience/home/catalog-showcase-experience';

describe('CatalogShowcaseExperience', () => {
  it('mantiene un ciclo lento e proporzionato alla distanza', () => {
    expect(calculateMarqueeDuration(1500, 1440)).toBeCloseTo(44_117.65, 1);
    expect(calculateMarqueeDuration(1000, 390)).toBeCloseTo(41_666.67, 1);
  });

  it('limita la durata tra 25 e 50 secondi', () => {
    expect(calculateMarqueeDuration(100, 1440)).toBe(25_000);
    expect(calculateMarqueeDuration(10_000, 390)).toBe(50_000);
    expect(calculateMarqueeDuration(0, 390)).toBe(0);
  });
});
