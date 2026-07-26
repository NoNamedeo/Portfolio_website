import {
  CanvasTexture,
  Color,
  Group,
  IcosahedronGeometry,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TorusGeometry
} from 'three';

export interface RefractionBackdrop {
  readonly group: Group;
  resize(halfWidth: number, halfHeight: number, compact: boolean): void;
  update(elapsedSeconds: number, motionScale: number): void;
  dispose(): void;
}

const createBackdropTexture = (): CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Impossibile creare lo sfondo procedurale della hero.');

  const base = context.createLinearGradient(0, 0, 512, 512);
  base.addColorStop(0, '#10120f');
  base.addColorStop(0.5, '#1c201e');
  base.addColorStop(1, '#0b0d0c');
  context.fillStyle = base;
  context.fillRect(0, 0, 512, 512);

  const warm = context.createRadialGradient(112, 94, 0, 112, 94, 220);
  warm.addColorStop(0, 'rgb(255 101 71 / 0.7)');
  warm.addColorStop(0.42, 'rgb(255 80 50 / 0.2)');
  warm.addColorStop(1, 'rgb(255 80 50 / 0)');
  context.fillStyle = warm;
  context.fillRect(0, 0, 512, 512);

  const cool = context.createRadialGradient(425, 392, 0, 425, 392, 230);
  cool.addColorStop(0, 'rgb(74 116 255 / 0.64)');
  cool.addColorStop(0.45, 'rgb(62 91 225 / 0.18)');
  cool.addColorStop(1, 'rgb(62 91 225 / 0)');
  context.fillStyle = cool;
  context.fillRect(0, 0, 512, 512);

  context.strokeStyle = 'rgb(255 255 255 / 0.035)';
  context.lineWidth = 1;
  for (let coordinate = -512; coordinate <= 1024; coordinate += 48) {
    context.beginPath();
    context.moveTo(coordinate, 0);
    context.lineTo(coordinate - 512, 512);
    context.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

export const createRefractionBackdrop = (): RefractionBackdrop => {
  const group = new Group();
  group.name = 'HeroRefractionBackdrop';

  const texture = createBackdropTexture();
  const planeGeometry = new PlaneGeometry(30, 20);
  const planeMaterial = new MeshBasicMaterial({ map: texture });
  const plane = new Mesh(planeGeometry, planeMaterial);
  plane.name = 'ProceduralGradientPlane';
  plane.position.z = -6;
  group.add(plane);

  const torusGeometry = new TorusGeometry(1.22, 0.075, 10, 64);
  const torusMaterial = new MeshStandardMaterial({
    color: new Color(0x9b3b2a),
    emissive: new Color(0x7d1f12),
    emissiveIntensity: 0.72,
    metalness: 0.04,
    roughness: 0.34
  });
  const warmTorus = new Mesh(torusGeometry, torusMaterial);
  warmTorus.name = 'WarmSignalRing';
  warmTorus.position.set(-3.05, -0.08, 4.25);
  warmTorus.rotation.set(0.32, 0.55, -0.28);
  group.add(warmTorus);

  const sphereGeometry = new IcosahedronGeometry(0.82, 2);
  const coolMaterial = new MeshStandardMaterial({
    color: new Color(0x35549f),
    emissive: new Color(0x172d72),
    emissiveIntensity: 0.68,
    metalness: 0.03,
    roughness: 0.2
  });
  const coolForm = new Mesh(sphereGeometry, coolMaterial);
  coolForm.name = 'CoolSignalForm';
  coolForm.position.set(1.8, 0.2, 4.15);
  coolForm.scale.set(0.88, 0.4, 0.6);
  coolForm.rotation.set(0.18, -0.42, 0.35);
  group.add(coolForm);

  const smallGeometry = new IcosahedronGeometry(0.28, 1);
  const pearlMaterial = new MeshStandardMaterial({
    color: new Color(0xdce7f6),
    emissive: new Color(0x27354c),
    emissiveIntensity: 0.35,
    metalness: 0,
    roughness: 0.16
  });
  const pearl = new Mesh(smallGeometry, pearlMaterial);
  pearl.name = 'PearlSignal';
  pearl.position.set(0.55, 2.15, 3.95);
  group.add(pearl);

  return {
    group,
    resize: (halfWidth, halfHeight, compact) => {
      const compactScale = compact ? 0.58 : 1;
      warmTorus.position.x = -halfWidth * (compact ? 0.22 : 0.12);
      warmTorus.position.y = -halfHeight * 0.08;
      warmTorus.scale.setScalar(compactScale);
      coolForm.position.x = halfWidth * (compact ? 0.1 : 0.24);
      coolForm.position.y = halfHeight * (compact ? -0.02 : 0.07);
      coolForm.scale.set(0.88 * compactScale, 0.4 * compactScale, 0.6 * compactScale);
      pearl.position.x = halfWidth * (compact ? 0.48 : 0.4);
      pearl.position.y = halfHeight * 0.58;
      pearl.scale.setScalar(compact ? 0.72 : 1);
    },
    update: (elapsedSeconds, motionScale) => {
      if (motionScale <= 0) return;
      warmTorus.rotation.z = -0.28 + Math.sin(elapsedSeconds * 0.085) * 0.045 * motionScale;
      warmTorus.rotation.y = 0.55 + Math.cos(elapsedSeconds * 0.073) * 0.035 * motionScale;
      coolForm.rotation.y = -0.42 + Math.sin(elapsedSeconds * 0.067 + 1.4) * 0.05 * motionScale;
      coolForm.rotation.z = 0.35 + Math.sin(elapsedSeconds * 0.11 + 0.8) * 0.035 * motionScale;
      pearl.rotation.y = Math.sin(elapsedSeconds * 0.094 + 2.3) * 0.16 * motionScale;
    },
    dispose: () => {
      texture.dispose();
      planeGeometry.dispose();
      planeMaterial.dispose();
      torusGeometry.dispose();
      torusMaterial.dispose();
      sphereGeometry.dispose();
      coolMaterial.dispose();
      smallGeometry.dispose();
      pearlMaterial.dispose();
      group.clear();
    }
  };
};
