import {
  Box3,
  Group,
  Mesh,
  Texture,
  Vector3,
  type AnimationClip,
  type BufferGeometry,
  type Material,
  type Object3D
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ARTICLE_GLASS_CUBE_VISUALS, type ArticleGlassCubeId } from './article-cube-config';

export const GLASS_CUBE_MODEL_URL = '/3D_models/glass_cubes_collection_1.glb';
export const ARTICLE_GLASS_CUBE_SOURCE_URL = '/3D_models/glass_cubes_design_plasma.glb';

export const HERO_GLASS_CUBE_MESH_NAME = 'GlassCube_01_XL';

export interface GlassCubeModel {
  readonly geometry: BufferGeometry;
  readonly meshName: string;
}

export interface GlassCubeModelLease {
  readonly models: readonly GlassCubeModel[];
  release(): void;
}

interface GlassCubeModelCache {
  readonly models: readonly GlassCubeModel[];
  references: number;
}

export interface ArticleGlassCubeModel {
  readonly id: ArticleGlassCubeId;
  readonly modelUrl: string;
  readonly scene: Object3D;
  readonly animations: readonly AnimationClip[];
}

export interface ArticleGlassCubeModelLease {
  readonly models: readonly ArticleGlassCubeModel[];
  release(): void;
}

interface ArticleGlassCubeCache {
  readonly models: readonly ArticleGlassCubeModel[];
  readonly disposalRoot: Group;
  references: number;
}

let cachedModels: GlassCubeModelCache | undefined;
let pendingLoad: Promise<GlassCubeModelCache> | undefined;
let articleModelCache: ArticleGlassCubeCache | undefined;
let pendingArticleLoad: Promise<ArticleGlassCubeCache> | undefined;

const warnInDevelopment = (message: string): void => {
  if (import.meta.env.DEV) console.warn(`[glass-cubes] ${message}`);
};

const disposeMaterial = (material: Material): void => {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) value.dispose();
  }
  material.dispose();
};

const disposeImportedScene = (root: Object3D): void => {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  root.traverse((object: unknown) => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    meshMaterials.forEach((material) => materials.add(material));
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach(disposeMaterial);
};

const createNormalizedGeometry = (mesh: Mesh): BufferGeometry => {
  const geometry = mesh.geometry.clone();
  geometry.applyMatrix4(mesh.matrixWorld);
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) throw new Error(`Impossibile calcolare i limiti della mesh "${mesh.name}".`);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const maximumDimension = Math.max(size.x, size.y, size.z, 0.0001);
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(1 / maximumDimension, 1 / maximumDimension, 1 / maximumDimension);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.computeVertexNormals();
  return geometry;
};

const loadGlassCubeModels = async (): Promise<GlassCubeModelCache> => {
  const gltf = await new GLTFLoader().loadAsync(GLASS_CUBE_MODEL_URL);
  gltf.scene.updateMatrixWorld(true);
  const validMeshes: Mesh[] = [];
  gltf.scene.traverse((object) => {
    if (object instanceof Mesh && object.geometry?.getAttribute('position'))
      validMeshes.push(object);
  });

  const firstValidMesh = validMeshes[0];
  if (!firstValidMesh) {
    disposeImportedScene(gltf.scene);
    throw new Error(`Nessuna mesh valida trovata in ${GLASS_CUBE_MODEL_URL}.`);
  }

  const exactMesh = validMeshes.find((mesh) => mesh.name === HERO_GLASS_CUBE_MESH_NAME);
  const sourceMesh = exactMesh ?? firstValidMesh;
  if (!exactMesh) {
    warnInDevelopment(
      `Mesh "${HERO_GLASS_CUBE_MESH_NAME}" non trovata in ${GLASS_CUBE_MODEL_URL}; uso "${sourceMesh.name || 'prima mesh valida'}".`
    );
  }
  const models: readonly GlassCubeModel[] = [
    {
      geometry: createNormalizedGeometry(sourceMesh),
      meshName: exactMesh?.name || sourceMesh.name || 'unnamed-mesh'
    }
  ];

  disposeImportedScene(gltf.scene);
  return { models, references: 0 };
};

export const acquireGlassCubeModels = async (): Promise<GlassCubeModelLease> => {
  const cache =
    cachedModels ??
    (await (pendingLoad ??= loadGlassCubeModels()
      .then((loaded) => {
        cachedModels = loaded;
        pendingLoad = undefined;
        return loaded;
      })
      .catch((error: unknown) => {
        pendingLoad = undefined;
        throw error;
      })));
  cache.references += 1;
  let released = false;

  return {
    models: cache.models,
    release(): void {
      if (released) return;
      released = true;
      cache.references = Math.max(0, cache.references - 1);
      if (cache.references > 0 || cachedModels !== cache) return;
      cache.models.forEach((model) => model.geometry.dispose());
      cachedModels = undefined;
    }
  };
};

const createNormalizedArticleScene = (source: Object3D, id: ArticleGlassCubeId): Group => {
  const normalizedScene = new Group();
  normalizedScene.name = `ArticleGlassCube_${id}`;
  normalizedScene.add(source.clone(true));
  normalizedScene.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(normalizedScene);
  const size = bounds.getSize(new Vector3());
  const center = bounds.getCenter(new Vector3());
  const maximumDimension = Math.max(size.x, size.y, size.z, 0.0001);
  normalizedScene.scale.setScalar(1 / maximumDimension);
  normalizedScene.position.set(
    -center.x / maximumDimension,
    -center.y / maximumDimension,
    -center.z / maximumDimension
  );
  normalizedScene.updateMatrixWorld(true);
  return normalizedScene;
};

const loadArticleGlassCubeModels = async (): Promise<ArticleGlassCubeCache> => {
  const gltf = await new GLTFLoader().loadAsync(ARTICLE_GLASS_CUBE_SOURCE_URL);
  const exportStage =
    gltf.scenes.find((scene) => scene.name === 'SCENE_GLASS_CUBES_EXPORT_STAGE') ?? gltf.scene;
  exportStage.updateMatrixWorld(true);
  const disposalRoot = new Group();
  disposalRoot.name = 'ArticleGlassCubeTemplates';
  const models = ARTICLE_GLASS_CUBE_VISUALS.map((visual): ArticleGlassCubeModel => {
    const source = exportStage.getObjectByName(visual.sourceNode);
    if (!source) {
      throw new Error(
        `Nodo "${visual.sourceNode}" non trovato in ${ARTICLE_GLASS_CUBE_SOURCE_URL}.`
      );
    }
    const scene = createNormalizedArticleScene(source, visual.id);
    disposalRoot.add(scene);
    return {
      id: visual.id,
      modelUrl: visual.modelUrl,
      scene,
      animations: gltf.animations
    };
  });
  return {
    models,
    disposalRoot,
    references: 0
  };
};

const acquireArticleGlassCubeCache = async (): Promise<ArticleGlassCubeCache> => {
  const cache =
    articleModelCache ??
    (await (pendingArticleLoad ??= loadArticleGlassCubeModels()
      .then((loaded) => {
        articleModelCache = loaded;
        pendingArticleLoad = undefined;
        return loaded;
      })
      .catch((error: unknown) => {
        pendingArticleLoad = undefined;
        throw error;
      })));
  cache.references += 1;
  return cache;
};

export const acquireArticleGlassCubeModels = async (
  ids: readonly ArticleGlassCubeId[] = ARTICLE_GLASS_CUBE_VISUALS.map((visual) => visual.id)
): Promise<ArticleGlassCubeModelLease> => {
  const cache = await acquireArticleGlassCubeCache();
  const uniqueIds = [...new Set(ids)];
  const models = uniqueIds.map((id) => {
    const model = cache.models.find((candidate) => candidate.id === id);
    if (!model) throw new Error(`Modello del cubo "${id}" non trovato nella cache condivisa.`);
    return model;
  });
  let released = false;
  return {
    models,
    release(): void {
      if (released) return;
      released = true;
      cache.references = Math.max(0, cache.references - 1);
      if (cache.references > 0 || articleModelCache !== cache) return;
      disposeImportedScene(cache.disposalRoot);
      cache.disposalRoot.clear();
      articleModelCache = undefined;
    }
  };
};
