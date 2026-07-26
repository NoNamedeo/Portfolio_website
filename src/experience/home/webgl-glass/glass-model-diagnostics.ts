import {
  Box3,
  MeshPhysicalMaterial,
  Vector3,
  type BufferGeometry,
  type Material,
  type Mesh
} from 'three';

export interface GlassModelDiagnostics {
  readonly meshName: string;
  readonly meshCount: number;
  readonly localSize: readonly [number, number, number];
  readonly localScale: readonly [number, number, number];
  readonly worldScale: readonly [number, number, number];
  readonly effectiveWorldSize: readonly [number, number, number];
  readonly approximateRotationDegrees: readonly [number, number, number];
  readonly thicknessAxis: 'x' | 'y' | 'z';
  readonly physicalThickness: number;
  readonly closedGeometry: boolean;
  readonly outwardWinding: boolean;
  readonly boundaryEdges: number;
  readonly nonManifoldEdges: number;
  readonly duplicateTriangles: number;
  readonly importedMaterials: readonly Record<string, unknown>[];
}

const toTuple = (vector: Vector3): [number, number, number] => [
  Number(vector.x.toFixed(5)),
  Number(vector.y.toFixed(5)),
  Number(vector.z.toFixed(5))
];

const inspectTopology = (
  geometry: BufferGeometry
): Pick<
  GlassModelDiagnostics,
  'closedGeometry' | 'outwardWinding' | 'boundaryEdges' | 'nonManifoldEdges' | 'duplicateTriangles'
> => {
  const positions = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const triangleCount = Math.floor((index?.count ?? positions.count) / 3);
  const weldedVertices = new Map<string, number>();
  const weldedIds = new Array<number>(positions.count);
  for (let vertex = 0; vertex < positions.count; vertex += 1) {
    const key =
      `${positions.getX(vertex).toFixed(6)}|` +
      `${positions.getY(vertex).toFixed(6)}|` +
      positions.getZ(vertex).toFixed(6);
    let weldedId = weldedVertices.get(key);
    if (weldedId === undefined) {
      weldedId = weldedVertices.size;
      weldedVertices.set(key, weldedId);
    }
    weldedIds[vertex] = weldedId;
  }

  const edgeCounts = new Map<string, number>();
  const triangleKeys = new Set<string>();
  const pointA = new Vector3();
  const pointB = new Vector3();
  const pointC = new Vector3();
  const cross = new Vector3();
  let duplicateTriangles = 0;
  let signedVolumeTimesSix = 0;
  const countEdge = (first: number, second: number): void => {
    const edgeKey = first < second ? `${first}:${second}` : `${second}:${first}`;
    edgeCounts.set(edgeKey, (edgeCounts.get(edgeKey) ?? 0) + 1);
  };

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const rawA = index?.getX(triangle * 3) ?? triangle * 3;
    const rawB = index?.getX(triangle * 3 + 1) ?? triangle * 3 + 1;
    const rawC = index?.getX(triangle * 3 + 2) ?? triangle * 3 + 2;
    const weldedA = weldedIds[rawA] ?? rawA;
    const weldedB = weldedIds[rawB] ?? rawB;
    const weldedC = weldedIds[rawC] ?? rawC;
    countEdge(weldedA, weldedB);
    countEdge(weldedB, weldedC);
    countEdge(weldedC, weldedA);

    const triangleKey = [weldedA, weldedB, weldedC].sort((left, right) => left - right).join(':');
    if (triangleKeys.has(triangleKey)) duplicateTriangles += 1;
    triangleKeys.add(triangleKey);

    pointA.fromBufferAttribute(positions, rawA);
    pointB.fromBufferAttribute(positions, rawB);
    pointC.fromBufferAttribute(positions, rawC);
    signedVolumeTimesSix += pointA.dot(cross.crossVectors(pointB, pointC));
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;
  for (const count of edgeCounts.values()) {
    if (count === 1) boundaryEdges += 1;
    if (count !== 2) nonManifoldEdges += 1;
  }
  return {
    closedGeometry: boundaryEdges === 0 && nonManifoldEdges === 0,
    outwardWinding: signedVolumeTimesSix > 0,
    boundaryEdges,
    nonManifoldEdges,
    duplicateTriangles
  };
};

const inspectMaterial = (material: Material): Record<string, unknown> => {
  if (!(material instanceof MeshPhysicalMaterial)) {
    return {
      name: material.name,
      type: material.type,
      physical: false,
      transparent: material.transparent,
      opacity: material.opacity,
      side: material.side
    };
  }
  return {
    name: material.name,
    type: material.type,
    physical: true,
    transmission: material.transmission,
    thickness: material.thickness,
    ior: material.ior,
    roughness: material.roughness,
    metalness: material.metalness,
    attenuationDistance: material.attenuationDistance,
    attenuationColor: `#${material.attenuationColor.getHexString()}`,
    side: material.side,
    transparent: material.transparent,
    opacity: material.opacity
  };
};

export const inspectGlassModel = (
  mesh: Mesh<BufferGeometry, Material | Material[]>,
  meshCount: number
): GlassModelDiagnostics => {
  mesh.geometry.computeBoundingBox();
  const localSize = mesh.geometry.boundingBox?.getSize(new Vector3()) ?? new Vector3();
  const worldSize = new Box3().setFromObject(mesh).getSize(new Vector3());
  const worldScale = mesh.getWorldScale(new Vector3());
  const sizes = [localSize.x, localSize.y, localSize.z] as const;
  const minimumSize = Math.min(...sizes);
  const thicknessAxis = (['x', 'y', 'z'] as const)[sizes.indexOf(minimumSize)] ?? 'z';
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const radiansToDegrees = 180 / Math.PI;

  return {
    meshName: mesh.name,
    meshCount,
    localSize: toTuple(localSize),
    localScale: toTuple(mesh.scale),
    worldScale: toTuple(worldScale),
    effectiveWorldSize: toTuple(worldSize),
    approximateRotationDegrees: [
      Number((mesh.rotation.x * radiansToDegrees).toFixed(2)),
      Number((mesh.rotation.y * radiansToDegrees).toFixed(2)),
      Number((mesh.rotation.z * radiansToDegrees).toFixed(2))
    ],
    thicknessAxis,
    physicalThickness: Number(minimumSize.toFixed(5)),
    ...inspectTopology(mesh.geometry),
    importedMaterials: materials.map(inspectMaterial)
  };
};
