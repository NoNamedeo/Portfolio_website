import { Mesh, Vector3, type BufferGeometry, type MeshPhysicalMaterial } from 'three';
import {
  GLASS_CONFIG,
  GLASS_LAYOUTS,
  type GlassPlateDefinition,
  type GlassQualityName
} from './glass-config';

export interface GlassPlateState {
  readonly mesh: Mesh<BufferGeometry, MeshPhysicalMaterial>;
  readonly basePosition: Vector3;
  readonly baseRotation: Vector3;
  readonly currentPosition: Vector3;
  readonly currentRotation: Vector3;
  readonly targetPosition: Vector3;
  readonly targetRotation: Vector3;
  readonly velocity: Vector3;
  readonly angularVelocity: Vector3;
  definition: GlassPlateDefinition;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const smoothstep = (value: number): number => value * value * (3 - 2 * value);

export const calculateSpringAcceleration = (
  current: number,
  target: number,
  velocity: number,
  mass: number,
  stiffness: number,
  damping: number
): number => (stiffness * (target - current) - damping * velocity) / Math.max(mass, 0.001);

export const createGlassPlateStates = (
  geometry: BufferGeometry,
  material: MeshPhysicalMaterial
): GlassPlateState[] =>
  GLASS_LAYOUTS.high.map((definition, index) => {
    const mesh = new Mesh(geometry, material);
    mesh.name = `HeroGlassPlate_${definition.id}`;
    mesh.renderOrder = 10 + index;
    mesh.userData.glassPlateId = definition.id;
    mesh.userData.glassPlateRole = definition.role;
    return {
      mesh,
      basePosition: new Vector3(),
      baseRotation: new Vector3(),
      currentPosition: new Vector3(),
      currentRotation: new Vector3(),
      targetPosition: new Vector3(),
      targetRotation: new Vector3(),
      velocity: new Vector3(),
      angularVelocity: new Vector3(),
      definition
    };
  });

export const applyGlassPlateLayout = (
  states: readonly GlassPlateState[],
  qualityName: GlassQualityName,
  halfWidth: number,
  halfHeight: number,
  snapToLayout: boolean
): void => {
  const layout = GLASS_LAYOUTS[qualityName];
  for (const state of states) {
    const definition = layout.find(
      (candidate) => candidate.id === state.mesh.userData.glassPlateId
    );
    if (!definition) {
      state.mesh.visible = false;
      continue;
    }

    const wasVisible = state.mesh.visible;
    state.mesh.visible = true;
    state.definition = definition;
    state.basePosition.set(
      definition.position[0] * halfWidth,
      definition.position[1] * halfHeight,
      definition.position[2]
    );
    state.baseRotation.set(...definition.rotation);
    state.targetPosition.copy(state.basePosition);
    state.targetRotation.copy(state.baseRotation);
    state.mesh.scale.setScalar(definition.scale);

    if (snapToLayout || !wasVisible) {
      state.currentPosition.copy(state.basePosition);
      state.currentRotation.copy(state.baseRotation);
      state.velocity.set(0, 0, 0);
      state.angularVelocity.set(0, 0, 0);
      state.mesh.position.copy(state.currentPosition);
      state.mesh.rotation.set(
        state.currentRotation.x,
        state.currentRotation.y,
        state.currentRotation.z
      );
    }
  }
};

const integrateVector = (
  current: Vector3,
  target: Vector3,
  velocity: Vector3,
  mass: number,
  stiffness: number,
  damping: number,
  deltaSeconds: number
): void => {
  const velocityX =
    velocity.x +
    calculateSpringAcceleration(current.x, target.x, velocity.x, mass, stiffness, damping) *
      deltaSeconds;
  const velocityY =
    velocity.y +
    calculateSpringAcceleration(current.y, target.y, velocity.y, mass, stiffness, damping) *
      deltaSeconds;
  const velocityZ =
    velocity.z +
    calculateSpringAcceleration(current.z, target.z, velocity.z, mass, stiffness, damping) *
      deltaSeconds;
  current.set(
    current.x + velocityX * deltaSeconds,
    current.y + velocityY * deltaSeconds,
    current.z + velocityZ * deltaSeconds
  );
  velocity.set(velocityX, velocityY, velocityZ);
};

export const updateGlassPlatePhysics = (
  states: readonly GlassPlateState[],
  pointerX: number,
  pointerY: number,
  scrollProgress: number,
  elapsedSeconds: number,
  deltaSeconds: number,
  halfWidth: number,
  halfHeight: number,
  ambientMotionScale: number
): void => {
  const scroll = smoothstep(clamp(scrollProgress, 0, 1));
  const pointerTranslation = GLASS_CONFIG.motion.pointerTranslation;

  for (const state of states) {
    if (!state.mesh.visible) continue;
    const definition = state.definition;
    const ambient =
      ambientMotionScale *
      Math.sin(elapsedSeconds * definition.ambientFrequency + definition.phase);
    const ambientSecondary =
      ambientMotionScale *
      Math.sin(elapsedSeconds * definition.ambientFrequency * 0.73 + definition.phase * 1.71 + 0.8);

    const offsetX =
      pointerX * pointerTranslation * definition.parallax * halfWidth +
      ambientSecondary * definition.ambientAmplitude[0] * halfWidth +
      definition.scrollOffset[0] * halfWidth * scroll;
    const offsetY =
      -pointerY * pointerTranslation * definition.parallax * halfHeight +
      ambient * definition.ambientAmplitude[1] * halfHeight +
      definition.scrollOffset[1] * halfHeight * scroll;
    const offsetZ =
      (pointerX - pointerY) * GLASS_CONFIG.motion.pointerDepth * definition.parallax * 0.5 +
      definition.scrollOffset[2] * scroll;

    state.targetPosition.set(
      state.basePosition.x +
        clamp(
          offsetX,
          -definition.maxTranslation[0] * halfWidth,
          definition.maxTranslation[0] * halfWidth
        ),
      state.basePosition.y +
        clamp(
          offsetY,
          -definition.maxTranslation[1] * halfHeight,
          definition.maxTranslation[1] * halfHeight
        ),
      state.basePosition.z +
        clamp(offsetZ, -definition.maxTranslation[2], definition.maxTranslation[2])
    );

    const rotationX =
      -pointerY * definition.maxRotation[0] * definition.parallax * 0.62 +
      ambientSecondary * definition.ambientAmplitude[2] * 0.68 +
      definition.scrollRotation[0] * scroll;
    const rotationY =
      pointerX * definition.maxRotation[1] * definition.parallax * 0.62 +
      ambient * definition.ambientAmplitude[2] * 0.78 +
      definition.scrollRotation[1] * scroll;
    const rotationZ =
      (pointerX - pointerY) * definition.maxRotation[2] * definition.parallax * 0.18 +
      ambient * definition.ambientAmplitude[2] +
      definition.scrollRotation[2] * scroll;

    state.targetRotation.set(
      state.baseRotation.x +
        clamp(rotationX, -definition.maxRotation[0], definition.maxRotation[0]),
      state.baseRotation.y +
        clamp(rotationY, -definition.maxRotation[1], definition.maxRotation[1]),
      state.baseRotation.z + clamp(rotationZ, -definition.maxRotation[2], definition.maxRotation[2])
    );

    integrateVector(
      state.currentPosition,
      state.targetPosition,
      state.velocity,
      definition.mass,
      definition.stiffness,
      definition.damping,
      deltaSeconds
    );
    integrateVector(
      state.currentRotation,
      state.targetRotation,
      state.angularVelocity,
      definition.mass * 0.92,
      definition.stiffness * 0.84,
      definition.damping * 1.06,
      deltaSeconds
    );

    state.mesh.position.copy(state.currentPosition);
    state.mesh.rotation.set(
      state.currentRotation.x,
      state.currentRotation.y,
      state.currentRotation.z
    );
  }
};
