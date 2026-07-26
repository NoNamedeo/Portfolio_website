import { Color, Group, Mesh, MeshStandardMaterial, Vector3, type BufferGeometry } from 'three';
import type { GlassQualityName } from './glass-config';
import type { LoadedGlassSloganGeometries } from './glass-slogan-loader';

export interface SloganLayout {
  readonly backPosition: readonly [number, number, number];
  readonly frontPosition: readonly [number, number, number];
  readonly backScale: number;
  readonly frontScale: number;
  readonly backRotationZ: number;
  readonly frontRotationZ: number;
}

export interface GlassSlogans {
  readonly group: Group;
  readonly backSourceMeshName: string;
  readonly frontSourceMeshName: string;
  resize(quality: GlassQualityName, halfWidth: number, halfHeight: number): void;
  update(
    pointerX: number,
    pointerY: number,
    scrollProgress: number,
    elapsedSeconds: number,
    motionScale: number
  ): void;
  dispose(): void;
}

const degrees = (value: number): number => (value * Math.PI) / 180;

export const GLASS_SLOGAN_LAYOUTS: Readonly<Record<GlassQualityName, SloganLayout>> = {
  high: {
    backPosition: [-0.39, 0.36, 2.28],
    frontPosition: [0.18, -0.1, 6.3],
    backScale: 1.08,
    frontScale: 0.9,
    backRotationZ: degrees(10),
    frontRotationZ: degrees(-2)
  },
  balanced: {
    backPosition: [-0.35, 0.35, 2.08],
    frontPosition: [0.16, -0.1, 5.9],
    backScale: 0.94,
    frontScale: 0.82,
    backRotationZ: degrees(9),
    frontRotationZ: degrees(-2)
  },
  mobile: {
    backPosition: [-0.16, 0.39, 2.12],
    frontPosition: [0.02, -0.26, 5.25],
    backScale: 0.68,
    frontScale: 0.52,
    backRotationZ: degrees(8),
    frontRotationZ: degrees(-1)
  }
};

export const createGlassSlogans = (resources: LoadedGlassSloganGeometries): GlassSlogans => {
  const group = new Group();
  group.name = 'HeroGlassSlogans';

  const backMaterial = new MeshStandardMaterial({
    color: new Color(0xf6f1e7),
    emissive: new Color(0x27241f),
    emissiveIntensity: 0.18,
    metalness: 0.04,
    roughness: 0.32
  });
  const frontMaterial = new MeshStandardMaterial({
    color: new Color(0xfffaf0),
    emissive: new Color(0x3d332b),
    emissiveIntensity: 0.24,
    metalness: 0.03,
    roughness: 0.28
  });
  const back = new Mesh<BufferGeometry, MeshStandardMaterial>(
    resources.back.geometry,
    backMaterial
  );
  back.name = 'HeroSlogan_CompetenzeInVetrina_BehindGlass';
  back.renderOrder = 8;
  const front = new Mesh<BufferGeometry, MeshStandardMaterial>(
    resources.front.geometry,
    frontMaterial
  );
  front.name = 'HeroSlogan_IdeeInMovimento_Foreground';
  front.renderOrder = 100;
  group.add(back, front);

  const backBasePosition = new Vector3();
  const frontBasePosition = new Vector3();
  let backBaseRotationZ = 0;
  let frontBaseRotationZ = 0;
  let currentHalfWidth = 1;
  let currentHalfHeight = 1;

  return {
    group,
    backSourceMeshName: resources.back.sourceMeshName,
    frontSourceMeshName: resources.front.sourceMeshName,
    resize: (quality, halfWidth, halfHeight) => {
      const layout = GLASS_SLOGAN_LAYOUTS[quality];
      currentHalfWidth = halfWidth;
      currentHalfHeight = halfHeight;
      backBasePosition.set(
        layout.backPosition[0] * halfWidth,
        layout.backPosition[1] * halfHeight,
        layout.backPosition[2]
      );
      frontBasePosition.set(
        layout.frontPosition[0] * halfWidth,
        layout.frontPosition[1] * halfHeight,
        layout.frontPosition[2]
      );
      backBaseRotationZ = layout.backRotationZ;
      frontBaseRotationZ = layout.frontRotationZ;
      back.scale.setScalar(layout.backScale);
      front.scale.setScalar(layout.frontScale);
      back.position.copy(backBasePosition);
      front.position.copy(frontBasePosition);
      back.rotation.set(0, 0, backBaseRotationZ);
      front.rotation.set(0, 0, frontBaseRotationZ);
    },
    update: (pointerX, pointerY, scrollProgress, elapsedSeconds, motionScale) => {
      const ambient = Math.sin(elapsedSeconds * 0.14 + 0.8) * motionScale;
      back.position.set(
        backBasePosition.x +
          pointerX * currentHalfWidth * 0.009 -
          scrollProgress * currentHalfWidth * 0.26,
        backBasePosition.y - pointerY * currentHalfHeight * 0.007 + ambient * 0.015,
        backBasePosition.z
      );
      front.position.set(
        frontBasePosition.x +
          pointerX * currentHalfWidth * 0.018 +
          scrollProgress * currentHalfWidth * 0.58,
        frontBasePosition.y -
          pointerY * currentHalfHeight * 0.014 -
          scrollProgress * currentHalfHeight * 0.025 +
          ambient * 0.022,
        frontBasePosition.z
      );
      back.rotation.z = backBaseRotationZ - scrollProgress * degrees(5);
      front.rotation.z = frontBaseRotationZ - scrollProgress * degrees(2);
    },
    dispose: () => {
      backMaterial.dispose();
      frontMaterial.dispose();
      resources.dispose();
      group.clear();
    }
  };
};
