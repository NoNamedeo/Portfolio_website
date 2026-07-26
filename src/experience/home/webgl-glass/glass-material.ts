import {
  CanvasTexture,
  Color,
  FrontSide,
  LinearFilter,
  MeshPhysicalMaterial,
  NoColorSpace,
  PMREMGenerator,
  RepeatWrapping,
  Vector2,
  type Scene,
  type Texture,
  type WebGLRenderer
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLASS_CONFIG, GLASS_DEBUG, GLASS_DEBUG_MATERIAL_OPTIONS } from './glass-config';

export interface GlassMaterialTuning {
  readonly thickness: number;
  readonly ior: number;
  readonly envMapIntensity: number;
}

export interface GlassMaterialResources {
  readonly material: MeshPhysicalMaterial;
  readonly environmentMap: Texture;
  readonly tuning: GlassMaterialTuning;
  dispose(): void;
}

const closestAllowedValue = (
  parameter: string,
  allowedValues: readonly number[],
  fallback: number
): number => {
  const requested = Number.parseFloat(
    new URLSearchParams(window.location.search).get(parameter) ?? ''
  );
  if (!Number.isFinite(requested)) return fallback;
  return allowedValues.reduce((closest, candidate) =>
    Math.abs(candidate - requested) < Math.abs(closest - requested) ? candidate : closest
  );
};

const resolveMaterialTuning = (): GlassMaterialTuning => {
  if (!GLASS_DEBUG) {
    return {
      thickness: GLASS_CONFIG.material.thickness,
      ior: GLASS_CONFIG.material.ior,
      envMapIntensity: GLASS_CONFIG.material.envMapIntensity
    };
  }
  return {
    thickness: closestAllowedValue(
      'glassThickness',
      GLASS_DEBUG_MATERIAL_OPTIONS.thickness,
      GLASS_DEBUG_MATERIAL_OPTIONS.defaultThickness
    ),
    ior: closestAllowedValue(
      'glassIor',
      GLASS_DEBUG_MATERIAL_OPTIONS.ior,
      GLASS_DEBUG_MATERIAL_OPTIONS.defaultIor
    ),
    envMapIntensity: 1.2
  };
};

const createSubtleNormalMap = (): CanvasTexture => {
  const canvas = document.createElement('canvas');
  const size = 128;
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Impossibile creare la normal map procedurale del vetro.');
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    const normalizedY = y / (size - 1);
    for (let x = 0; x < size; x += 1) {
      const normalizedX = x / (size - 1);
      const normalX =
        Math.sin(normalizedX * Math.PI * 2 + normalizedY * 0.9) * 0.24 +
        Math.sin((normalizedX + normalizedY) * Math.PI) * 0.08;
      const normalY =
        Math.cos(normalizedY * Math.PI * 2 - normalizedX * 0.7) * 0.2 +
        Math.cos((normalizedX - normalizedY) * Math.PI) * 0.07;
      const normalZ = Math.sqrt(Math.max(0, 1 - normalX * normalX - normalY * normalY));
      const offset = (y * size + x) * 4;
      image.data[offset] = Math.round((normalX * 0.5 + 0.5) * 255);
      image.data[offset + 1] = Math.round((normalY * 0.5 + 0.5) * 255);
      image.data[offset + 2] = Math.round(normalZ * 255);
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.name = 'HeroGlass_SubtleProceduralNormal';
  texture.colorSpace = NoColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1.15, 1);
  texture.generateMipmaps = false;
  return texture;
};

export const createGlassMaterialResources = (
  renderer: WebGLRenderer,
  scene: Scene
): GlassMaterialResources => {
  const pmremGenerator = new PMREMGenerator(renderer);
  const roomEnvironment = new RoomEnvironment();
  const environmentMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
  roomEnvironment.dispose();
  pmremGenerator.dispose();
  scene.environment = environmentMap;
  scene.environmentIntensity = 1;

  const tuning = resolveMaterialTuning();
  const normalMap = GLASS_DEBUG ? undefined : createSubtleNormalMap();
  const material = new MeshPhysicalMaterial({
    color: GLASS_CONFIG.material.color,
    metalness: 0,
    roughness: GLASS_DEBUG ? 0.04 : GLASS_CONFIG.material.roughness,
    transmission: 1,
    opacity: 1,
    transparent: false,
    ior: tuning.ior,
    thickness: tuning.thickness,
    clearcoat: GLASS_DEBUG ? 1 : GLASS_CONFIG.material.clearcoat,
    clearcoatRoughness: GLASS_DEBUG ? 0.03 : GLASS_CONFIG.material.clearcoatRoughness,
    envMapIntensity: tuning.envMapIntensity,
    specularIntensity: GLASS_DEBUG ? 1 : GLASS_CONFIG.material.specularIntensity,
    dispersion: GLASS_DEBUG ? 0 : GLASS_CONFIG.material.dispersion,
    attenuationColor: new Color(GLASS_DEBUG ? 0xffffff : GLASS_CONFIG.material.attenuationColor),
    attenuationDistance: GLASS_DEBUG
      ? Number.POSITIVE_INFINITY
      : GLASS_CONFIG.material.attenuationDistance,
    side: FrontSide,
    depthWrite: true,
    depthTest: true,
    normalMap,
    normalScale: normalMap
      ? new Vector2(GLASS_CONFIG.material.normalScale, GLASS_CONFIG.material.normalScale)
      : undefined
  });
  material.name = GLASS_DEBUG ? 'HeroGlass_DiagnosticPhysical' : 'HeroGlass_PremiumPhysical';
  material.needsUpdate = true;

  return {
    material,
    environmentMap,
    tuning,
    dispose: () => {
      scene.environment = null;
      normalMap?.dispose();
      material.dispose();
      environmentMap.dispose();
    }
  };
};
