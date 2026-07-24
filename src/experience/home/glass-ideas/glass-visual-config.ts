import { Color, MeshPhysicalMaterial } from 'three';

export const GLASS_VISUAL_CONFIG = {
  pixelRatio: {
    mobile: 1,
    balanced: 1.25,
    high: 1.5
  },
  humanFramesPerSecond: 50,
  catalogFramesPerSecond: 42,
  humanCycleSeconds: 10.5,
  humanPointerDamping: 5.5,
  cubeHoverDamping: 9,
  cubeIdleRotationSpeed: 0.22,
  transmission: 1,
  roughness: 0.075,
  thickness: 0.82,
  ior: 1.46,
  dispersion: 0.055,
  clearcoat: 1,
  clearcoatRoughness: 0.08
} as const;

export const GLASS_IDEA_PALETTE = [
  '#72d8ff',
  '#ff735f',
  '#ffd166',
  '#b899ff',
  '#70e1a5',
  '#ff98c8'
] as const;

export const selectGlassPixelRatio = (viewportWidth: number): number => {
  const maximum =
    viewportWidth <= 736
      ? GLASS_VISUAL_CONFIG.pixelRatio.mobile
      : viewportWidth <= 1180
        ? GLASS_VISUAL_CONFIG.pixelRatio.balanced
        : GLASS_VISUAL_CONFIG.pixelRatio.high;
  return Math.min(window.devicePixelRatio || 1, maximum);
};

export const createPremiumGlassMaterial = (
  color: string | number,
  opacity = 0.82
): MeshPhysicalMaterial =>
  new MeshPhysicalMaterial({
    color: new Color(color),
    transmission: GLASS_VISUAL_CONFIG.transmission,
    transparent: true,
    opacity,
    roughness: GLASS_VISUAL_CONFIG.roughness,
    metalness: 0,
    thickness: GLASS_VISUAL_CONFIG.thickness,
    ior: GLASS_VISUAL_CONFIG.ior,
    dispersion: GLASS_VISUAL_CONFIG.dispersion,
    clearcoat: GLASS_VISUAL_CONFIG.clearcoat,
    clearcoatRoughness: GLASS_VISUAL_CONFIG.clearcoatRoughness,
    attenuationColor: new Color(color),
    attenuationDistance: 2.8,
    envMapIntensity: 1.45,
    emissive: new Color(color).multiplyScalar(0.035),
    emissiveIntensity: 0.45,
    depthWrite: false
  });
