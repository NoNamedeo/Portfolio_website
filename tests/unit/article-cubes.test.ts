import { describe, expect, it } from 'vitest';
import {
  ARTICLE_GLASS_CUBE_VISUALS,
  DEFAULT_ARTICLE_GLASS_CUBE_ID,
  getArticleGlassCubeVisual
} from '@experience/home/glass-ideas/article-cube-config';
import { GLASS_VISUAL_CONFIG } from '@experience/home/glass-ideas/glass-visual-config';

describe('ARTICLE_GLASS_CUBE_VISUALS', () => {
  it('mappa i quattro articoli sui quattro modelli cubes_design', () => {
    expect(ARTICLE_GLASS_CUBE_VISUALS).toHaveLength(4);
    expect(ARTICLE_GLASS_CUBE_VISUALS[0]?.id).toBe(DEFAULT_ARTICLE_GLASS_CUBE_ID);
    expect(ARTICLE_GLASS_CUBE_VISUALS.map((visual) => visual.id)).toEqual([
      'signal-archive',
      'civic-loop',
      'open-lab',
      'product-prototype-sprint'
    ]);
    expect(ARTICLE_GLASS_CUBE_VISUALS.map((visual) => visual.modelIndex)).toEqual([0, 1, 2, 3]);
    expect(ARTICLE_GLASS_CUBE_VISUALS.map((visual) => visual.modelUrl)).toEqual([
      '/3D_models/glass_cubes_design_zeros_and_ones.glb',
      '/3D_models/glass_cubes_design_circuit.glb',
      '/3D_models/glass_cubes_design_plasma.glb',
      '/3D_models/glass_cubes_design_S.glb'
    ]);
    expect(ARTICLE_GLASS_CUBE_VISUALS.map((visual) => visual.motif)).toEqual([
      'binary',
      'circuit',
      'plasma',
      'network'
    ]);
  });

  it('mantiene accenti univoci e risolve sempre un modello sicuro', () => {
    for (const visual of ARTICLE_GLASS_CUBE_VISUALS) {
      expect(visual.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(visual.secondaryAccent).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(new Set(ARTICLE_GLASS_CUBE_VISUALS.map((visual) => visual.accent)).size).toBe(4);
    expect(new Set(ARTICLE_GLASS_CUBE_VISUALS.map((visual) => visual.modelUrl)).size).toBe(4);
    expect(getArticleGlassCubeVisual('civic-loop').modelIndex).toBe(1);
    expect(getArticleGlassCubeVisual(3).id).toBe('product-prototype-sprint');
    expect(getArticleGlassCubeVisual('sconosciuto').id).toBe(DEFAULT_ARTICLE_GLASS_CUBE_ID);
  });

  it('riduce frequenza e pixel ratio sui dispositivi meno potenti', () => {
    expect(GLASS_VISUAL_CONFIG.conceptMobileFramesPerSecond).toBeLessThan(
      GLASS_VISUAL_CONFIG.conceptBalancedFramesPerSecond
    );
    expect(GLASS_VISUAL_CONFIG.conceptBalancedFramesPerSecond).toBeLessThan(
      GLASS_VISUAL_CONFIG.conceptFramesPerSecond
    );
    expect(GLASS_VISUAL_CONFIG.pixelRatio.mobile).toBeLessThan(GLASS_VISUAL_CONFIG.pixelRatio.high);
  });
});
