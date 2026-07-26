import {
  BoxHelper,
  CanvasTexture,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace
} from 'three';
import type { GlassPlateState } from './glass-composition';
import { GLASS_CONFIG } from './glass-config';
import type { GlassMaterialTuning } from './glass-material';

export interface GlassRefractionDebug {
  readonly group: Group;
  resize(halfWidth: number, compact: boolean): void;
  update(): void;
  dispose(): void;
}

const degrees = (value: number): number => (value * Math.PI) / 180;

const createDiagnosticPattern = (): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Impossibile creare il pattern diagnostico del vetro.');

  context.fillStyle = '#f7f3e8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  const stripeWidth = 32;
  for (let x = 0; x < canvas.width; x += stripeWidth) {
    context.fillStyle = Math.floor(x / stripeWidth) % 2 === 0 ? '#11120f' : '#ff4f35';
    context.fillRect(x, 0, stripeWidth, canvas.height);
  }
  context.globalAlpha = 0.36;
  for (let y = 0; y < canvas.height; y += 40) {
    context.fillStyle = Math.floor(y / 40) % 2 === 0 ? '#315cff' : '#fff7e8';
    context.fillRect(0, y, canvas.width, 20);
  }
  context.globalAlpha = 1;

  const texture = new CanvasTexture(canvas);
  texture.name = 'HeroGlass_DiagnosticStripePattern';
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

export const createGlassRefractionDebug = (
  plates: readonly GlassPlateState[],
  tuning: GlassMaterialTuning
): GlassRefractionDebug => {
  const mainPlate = plates.find((plate) => plate.mesh.userData.glassPlateId === 'main');
  if (!mainPlate) throw new Error('Lastra principale non disponibile per la diagnostica.');
  for (const plate of plates) plate.mesh.visible = plate === mainPlate;

  const group = new Group();
  group.name = 'HeroGlassRefractionDebug';
  const texture = createDiagnosticPattern();
  const patternGeometry = new PlaneGeometry(3.35, 2.08);
  const patternMaterial = new MeshBasicMaterial({
    map: texture,
    transparent: false,
    opacity: 1,
    depthWrite: true,
    depthTest: true,
    toneMapped: false
  });
  const coveredPattern = new Mesh(patternGeometry, patternMaterial);
  coveredPattern.name = 'DiagnosticPattern_BehindGlass';
  const referencePattern = new Mesh(patternGeometry, patternMaterial);
  referencePattern.name = 'DiagnosticPattern_UncoveredReference';
  const boundingBox = new BoxHelper(mainPlate.mesh, 0x35ff8a);
  boundingBox.name = 'DiagnosticGlassBoundingBox';
  group.add(coveredPattern, referencePattern, boundingBox);
  let logged = false;

  return {
    group,
    resize: (halfWidth, compact) => {
      const plateX = -halfWidth * (compact ? 0.12 : 0.27);
      const plateScale = compact ? 0.7 : 0.92;
      const plateZ = 5.25;
      const patternZ = 4.35;
      const referenceX = halfWidth * (compact ? 0.48 : 0.5);
      for (const plate of plates) plate.mesh.visible = plate === mainPlate;
      mainPlate.basePosition.set(plateX, 0, plateZ);
      mainPlate.currentPosition.copy(mainPlate.basePosition);
      mainPlate.targetPosition.copy(mainPlate.basePosition);
      mainPlate.velocity.set(0, 0, 0);
      mainPlate.baseRotation.set(degrees(8), degrees(-12), degrees(-4));
      mainPlate.currentRotation.copy(mainPlate.baseRotation);
      mainPlate.targetRotation.copy(mainPlate.baseRotation);
      mainPlate.angularVelocity.set(0, 0, 0);
      mainPlate.mesh.position.copy(mainPlate.basePosition);
      mainPlate.mesh.rotation.set(
        mainPlate.baseRotation.x,
        mainPlate.baseRotation.y,
        mainPlate.baseRotation.z
      );
      mainPlate.mesh.scale.setScalar(plateScale);

      coveredPattern.position.set(plateX, 0, patternZ);
      referencePattern.position.set(referenceX, 0, patternZ);
      const patternScale = compact ? 0.66 : 1;
      coveredPattern.scale.setScalar(patternScale);
      referencePattern.scale.setScalar(patternScale);
      boundingBox.update();

      if (!logged && import.meta.env.DEV) {
        logged = true;
        console.info('[Hero glass debug] Ordine mondo verificato', {
          cameraZ: GLASS_CONFIG.camera.positionZ,
          platePosition: mainPlate.mesh.position.toArray(),
          coveredPatternPosition: coveredPattern.position.toArray(),
          platePatternDistance: plateZ - patternZ,
          tuning,
          order: 'camera → lastra → pattern'
        });
      }
    },
    update: () => boundingBox.update(),
    dispose: () => {
      texture.dispose();
      patternGeometry.dispose();
      patternMaterial.dispose();
      boundingBox.dispose();
      group.clear();
    }
  };
};
