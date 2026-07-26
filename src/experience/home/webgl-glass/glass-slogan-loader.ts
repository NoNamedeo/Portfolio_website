import { BufferGeometry, Mesh, Texture, Vector3, type Material, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLASS_CONFIG } from './glass-config';

interface LoadedSloganGeometry {
  readonly geometry: BufferGeometry;
  readonly sourceMeshName: string;
}

export interface LoadedGlassSloganGeometries {
  readonly back: LoadedSloganGeometry;
  readonly front: LoadedSloganGeometry;
  dispose(): void;
}

const isMeshWithGeometry = (
  object: Object3D
): object is Mesh<BufferGeometry, Material | Material[]> =>
  object instanceof Mesh &&
  object.geometry instanceof BufferGeometry &&
  Boolean(object.geometry.getAttribute('position'));

const disposeImportedScene = (root: Object3D): void => {
  const disposedGeometries = new Set<BufferGeometry>();
  const disposedMaterials = new Set<Material>();
  const disposedTextures = new Set<Texture>();
  root.traverse((object) => {
    if (!isMeshWithGeometry(object)) return;
    if (!disposedGeometries.has(object.geometry)) {
      disposedGeometries.add(object.geometry);
      object.geometry.dispose();
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (disposedMaterials.has(material)) continue;
      disposedMaterials.add(material);
      for (const value of Object.values(material)) {
        if (value instanceof Texture && !disposedTextures.has(value)) {
          disposedTextures.add(value);
          value.dispose();
        }
      }
      material.dispose();
    }
  });
  root.clear();
};

const loadCenteredSloganGeometry = async (
  modelUrl: string,
  targetMeshName: string
): Promise<LoadedSloganGeometry> => {
  const gltf = await new GLTFLoader().loadAsync(modelUrl);
  let exactMesh: Mesh<BufferGeometry, Material | Material[]> | undefined;
  let fallbackMesh: Mesh<BufferGeometry, Material | Material[]> | undefined;

  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if (!isMeshWithGeometry(object)) return;
    fallbackMesh ??= object;
    if (object.name === targetMeshName) exactMesh = object;
  });

  const selectedMesh = exactMesh ?? fallbackMesh;
  if (!selectedMesh) {
    disposeImportedScene(gltf.scene);
    throw new Error(`Il modello ${modelUrl} non contiene una mesh valida.`);
  }
  if (!exactMesh && import.meta.env.DEV) {
    console.warn(
      `[Hero slogans] Mesh "${targetMeshName}" non trovata in ${modelUrl}; ` +
        `uso "${selectedMesh.name || '(senza nome)'}".`
    );
  }

  const geometry = selectedMesh.geometry.clone();
  geometry.applyMatrix4(selectedMesh.matrixWorld);
  geometry.computeBoundingBox();
  const center = geometry.boundingBox?.getCenter(new Vector3()) ?? new Vector3();
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const sourceMeshName = selectedMesh.name;
  disposeImportedScene(gltf.scene);

  return { geometry, sourceMeshName };
};

export const loadGlassSloganGeometries = async (): Promise<LoadedGlassSloganGeometries> => {
  const results = await Promise.allSettled([
    loadCenteredSloganGeometry(
      GLASS_CONFIG.slogans.back.modelUrl,
      GLASS_CONFIG.slogans.back.targetMeshName
    ),
    loadCenteredSloganGeometry(
      GLASS_CONFIG.slogans.front.modelUrl,
      GLASS_CONFIG.slogans.front.targetMeshName
    )
  ]);
  const [backResult, frontResult] = results;
  if (backResult.status === 'rejected') {
    if (frontResult.status === 'fulfilled') frontResult.value.geometry.dispose();
    throw backResult.reason;
  }
  if (frontResult.status === 'rejected') {
    backResult.value.geometry.dispose();
    throw frontResult.reason;
  }

  const back = backResult.value;
  const front = frontResult.value;
  return {
    back,
    front,
    dispose: () => {
      back.geometry.dispose();
      front.geometry.dispose();
    }
  };
};
