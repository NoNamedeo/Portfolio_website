import { BufferGeometry, Mesh, Texture, type Material, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLASS_CONFIG } from './glass-config';
import { inspectGlassModel } from './glass-model-diagnostics';

export interface LoadedGlassGeometry {
  readonly geometry: BufferGeometry;
  readonly sourceMeshName: string;
  readonly usedFallback: boolean;
}

const isMeshWithGeometry = (
  object: Object3D
): object is Mesh<BufferGeometry, Material | Material[]> =>
  object instanceof Mesh &&
  object.geometry instanceof BufferGeometry &&
  Boolean(object.geometry.getAttribute('position'));

const disposeTextureProperties = (material: Material, disposedTextures: Set<Texture>): void => {
  for (const value of Object.values(material)) {
    if (value instanceof Texture && !disposedTextures.has(value)) {
      disposedTextures.add(value);
      value.dispose();
    }
  }
  material.dispose();
};

const disposeImportedMaterials = (root: Object3D): void => {
  const disposed = new Set<Material>();
  const disposedTextures = new Set<Texture>();
  root.traverse((object) => {
    if (!isMeshWithGeometry(object)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (disposed.has(material)) continue;
      disposed.add(material);
      disposeTextureProperties(material, disposedTextures);
    }
  });
};

export const loadGlassPlateGeometry = async (): Promise<LoadedGlassGeometry> => {
  const gltf = await new GLTFLoader().loadAsync(GLASS_CONFIG.modelUrl);
  let exactMesh: Mesh<BufferGeometry, Material | Material[]> | undefined;
  let fallbackMesh: Mesh<BufferGeometry, Material | Material[]> | undefined;
  let meshCount = 0;

  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if (!isMeshWithGeometry(object)) return;
    meshCount += 1;
    fallbackMesh ??= object;
    if (object.name === GLASS_CONFIG.targetMeshName) exactMesh = object;
  });

  const selectedMesh = exactMesh ?? fallbackMesh;
  if (!selectedMesh) {
    disposeImportedMaterials(gltf.scene);
    throw new Error('Il modello della hero non contiene una mesh valida.');
  }

  const geometry = selectedMesh.geometry;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const usedFallback = exactMesh === undefined;
  const diagnostics = inspectGlassModel(selectedMesh, meshCount);

  if (import.meta.env.DEV) {
    if (usedFallback) {
      console.warn(
        `[Hero glass] Mesh "${GLASS_CONFIG.targetMeshName}" non trovata in ` +
          `${GLASS_CONFIG.modelUrl}; uso la prima mesh valida "${selectedMesh.name || '(senza nome)'}".`
      );
    }
    console.info('[Hero glass] Diagnostica GLB', diagnostics);
    if (diagnostics.physicalThickness <= 0.0001) {
      console.warn(
        '[Hero glass] La mesh non possiede uno spessore fisico utilizzabile; correggere il GLB.'
      );
    }
    if (
      !diagnostics.closedGeometry ||
      !diagnostics.outwardWinding ||
      diagnostics.duplicateTriangles > 0
    ) {
      console.warn(
        '[Hero glass] La topologia del vetro non è adatta a una rifrazione volumetrica affidabile.',
        diagnostics
      );
    }
  }

  disposeImportedMaterials(gltf.scene);
  gltf.scene.clear();

  return {
    geometry,
    sourceMeshName: selectedMesh.name,
    usedFallback
  };
};
