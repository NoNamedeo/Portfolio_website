export type GlassQualityName = 'mobile' | 'balanced' | 'high';

export const GLASS_PANE_LIMIT = 7;

export interface GlassQuality {
  readonly name: GlassQualityName;
  readonly pixelRatioLimit: number;
  readonly renderScale: number;
  readonly widthSegments: number;
  readonly heightSegments: number;
  readonly antialias: boolean;
}

export const GLASS_CONFIG = {
  refractionStrength: 0.0085,
  chromaticAberration: 0.00115,
  hoverRadius: 0.19,
  glowIntensity: 0.58,
  trailLength: 6,
  rippleStrength: 0.24,
  roughness: 0.14,
  thickness: 0.026,
  edgeBrightness: 0.56,
  pointerDamping: 11,
  hoverDamping: 8,
  velocityDamping: 7,
  trailDamping: 13,
  idleWaveStrength: 0.0018,
  mobileWaveStrength: 0.0011,
  maximumPointerSpeed: 1.4
} as const;

const readDeviceMemory = (): number => {
  const navigatorWithMemory = navigator as Navigator & { readonly deviceMemory?: number };
  return navigatorWithMemory.deviceMemory ?? 8;
};

export const selectGlassQuality = (viewportWidth: number, reducedMotion: boolean): GlassQuality => {
  const memory = readDeviceMemory();
  if (viewportWidth <= 736 || memory <= 4) {
    return {
      name: 'mobile',
      pixelRatioLimit: 1.15,
      renderScale: reducedMotion ? 0.55 : 0.68,
      widthSegments: 32,
      heightSegments: 20,
      antialias: false
    };
  }
  if (viewportWidth <= 1180 || memory <= 6) {
    return {
      name: 'balanced',
      pixelRatioLimit: 1.4,
      renderScale: reducedMotion ? 0.65 : 0.82,
      widthSegments: 48,
      heightSegments: 30,
      antialias: true
    };
  }
  return {
    name: 'high',
    pixelRatioLimit: 1.75,
    renderScale: reducedMotion ? 0.72 : 1,
    widthSegments: 72,
    heightSegments: 44,
    antialias: true
  };
};
