import { Color, MeshPhysicalMaterial } from 'three';

export const GLASS_VISUAL_CONFIG = {
  pixelRatio: {
    mobile: 1,
    balanced: 1.25,
    high: 1.5
  },
  conceptFramesPerSecond: 50,
  conceptBalancedFramesPerSecond: 42,
  conceptMobileFramesPerSecond: 34,
  catalogFramesPerSecond: 42,
  conceptPointerDamping: 6.4,
  conceptDragDamping: 9.5,
  cubeHoverDamping: 9,
  cubeIdleRotationSpeed: 0.22,
  transmission: 1,
  roughness: 0.075,
  thickness: 0.82,
  ior: 1.46,
  dispersion: 0,
  clearcoat: 1,
  clearcoatRoughness: 0.08
} as const;

export const selectGlassPixelRatio = (viewportWidth: number): number => {
  const maximum =
    viewportWidth <= 736
      ? GLASS_VISUAL_CONFIG.pixelRatio.mobile
      : viewportWidth <= 1180
        ? GLASS_VISUAL_CONFIG.pixelRatio.balanced
        : GLASS_VISUAL_CONFIG.pixelRatio.high;
  return Math.min(window.devicePixelRatio || 1, maximum);
};

export const createPremiumGlassMaterial = (color: string | number): MeshPhysicalMaterial =>
  new MeshPhysicalMaterial({
    color: new Color(color),
    transmission: GLASS_VISUAL_CONFIG.transmission,
    transparent: false,
    opacity: 1,
    roughness: GLASS_VISUAL_CONFIG.roughness,
    metalness: 0,
    thickness: GLASS_VISUAL_CONFIG.thickness,
    ior: GLASS_VISUAL_CONFIG.ior,
    dispersion: GLASS_VISUAL_CONFIG.dispersion,
    clearcoat: GLASS_VISUAL_CONFIG.clearcoat,
    clearcoatRoughness: GLASS_VISUAL_CONFIG.clearcoatRoughness,
    attenuationColor: new Color(color),
    attenuationDistance: 3.4,
    envMapIntensity: 1.6,
    emissive: new Color(color).multiplyScalar(0.035),
    emissiveIntensity: 0.32,
    depthWrite: true
  });
