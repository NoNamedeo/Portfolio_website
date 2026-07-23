import { describe, expect, it } from 'vitest';
import { nextCycleIndex, splitTitleGraphemes } from '@experience/catalog/catalog-index-experience';

describe('CatalogIndexExperience', () => {
  it('avanza ciclicamente senza uscire dai valori disponibili', () => {
    expect(nextCycleIndex(0, 4)).toBe(1);
    expect(nextCycleIndex(3, 4)).toBe(0);
    expect(nextCycleIndex(0, 0)).toBe(0);
  });

  it('divide i titoli in grafemi senza spezzare caratteri composti', () => {
    const title = 'Idee 👩‍💻';
    const graphemes = splitTitleGraphemes(title);
    expect(graphemes.join('')).toBe(title);
    expect(graphemes).toContain('👩‍💻');
  });
});
