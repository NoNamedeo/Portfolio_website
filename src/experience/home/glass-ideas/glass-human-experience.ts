import type { Experience, ExperienceContext } from '@experience/core/experience';
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  DirectionalLight,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createPremiumGlassMaterial,
  GLASS_VISUAL_CONFIG,
  selectGlassPixelRatio
} from './glass-visual-config';

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const damp = (current: number, target: number, lambda: number, deltaSeconds: number): number =>
  target + (current - target) * Math.exp(-lambda * deltaSeconds);

const smoothRange = (value: number, start: number, end: number): number => {
  const normalized = clamp((value - start) / Math.max(end - start, 0.0001), 0, 1);
  return normalized * normalized * (3 - 2 * normalized);
};

const createBodyPositions = (): Vector3[] => {
  const positions: Vector3[] = [];
  for (let depth = 0; depth < 2; depth += 1) {
    for (let y = 0; y < 3; y += 1) {
      for (let x = -1; x <= 1; x += 1) {
        positions.push(new Vector3(x * 0.36, 2.22 + y * 0.36, (depth - 0.5) * 0.3));
      }
    }
  }
  for (let row = 0; row < 5; row += 1) {
    const halfWidth = row >= 3 ? 2 : row === 2 ? 2 : 1;
    for (let x = -halfWidth; x <= halfWidth; x += 1) {
      if (row === 2 && x === 0) continue;
      positions.push(new Vector3(x * 0.37, 0.45 + row * 0.37, 0));
    }
  }
  for (let x = -1; x <= 1; x += 1) {
    positions.push(new Vector3(x * 0.39, 0.05, 0));
  }
  for (const side of [-1, 1]) {
    for (let row = 0; row < 7; row += 1) {
      positions.push(new Vector3(side * 0.48, -0.38 - row * 0.38, row > 5 ? 0.16 : 0));
    }
  }
  return positions;
};

export class GlassHumanExperience implements Experience {
  private root?: HTMLElement;
  private stage?: HTMLElement;
  private canvas?: HTMLCanvasElement;
  private renderer?: WebGLRenderer;
  private camera?: PerspectiveCamera;
  private scene?: Scene;
  private figure?: Group;
  private staticCubes?: InstancedMesh;
  private staticWire?: InstancedMesh;
  private leftArm: Mesh[] = [];
  private rightArm: Mesh[] = [];
  private ideaGroup?: Group;
  private ideaCube?: Mesh;
  private ideaHalo?: Mesh;
  private particles?: Points;
  private chestEcho?: Mesh;
  private bodyGeometry?: BoxGeometry;
  private ideaGeometry?: BoxGeometry;
  private haloGeometry?: SphereGeometry;
  private bodyMaterial?: ReturnType<typeof createPremiumGlassMaterial>;
  private bodyWireMaterial?: MeshBasicMaterial;
  private ideaMaterial?: ReturnType<typeof createPremiumGlassMaterial>;
  private glowMaterial?: MeshBasicMaterial;
  private particleMaterial?: PointsMaterial;
  private environmentTexture?: ReturnType<PMREMGenerator['fromScene']>['texture'];
  private listenerController?: AbortController;
  private intersectionObserver?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;
  private frameId?: number;
  private lastFrameTime = 0;
  private lastRenderedTime = 0;
  private elapsedTime = 0;
  private targetPointer = new Vector2();
  private currentPointer = new Vector2();
  private playRequested = false;
  private visible = false;
  private reducedMotion = false;
  private mounted = false;
  private destroyed = false;
  private readonly temporaryMatrix = new Matrix4();
  private readonly temporaryVector = new Vector3();
  private readonly shoulderLeft = new Vector3(-1.05, 1.63, 0);
  private readonly shoulderRight = new Vector3(1.05, 1.63, 0);

  mount(context: ExperienceContext): void {
    if (this.mounted) return;
    const stage = context.root.querySelector<HTMLElement>('[data-glass-human-stage]');
    const canvas = context.root.querySelector<HTMLCanvasElement>('[data-glass-human-canvas]');
    if (!stage || !canvas) throw new Error('La scena della figura di vetro è incompleta.');

    this.root = context.root;
    this.stage = stage;
    this.canvas = canvas;
    this.reducedMotion = context.reducedMotion;
    this.elapsedTime = context.reducedMotion ? 5.65 : 0;
    this.listenerController = new AbortController();

    const contextWebGL = canvas.getContext('webgl2', {
      alpha: true,
      antialias: window.innerWidth > 736,
      depth: true,
      failIfMajorPerformanceCaveat: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: true
    });
    if (!contextWebGL) {
      context.root.dataset.glassHumanRenderer = 'fallback';
      this.mounted = true;
      return;
    }

    try {
      this.renderer = new WebGLRenderer({
        canvas,
        context: contextWebGL,
        alpha: true,
        antialias: window.innerWidth > 736,
        powerPreference: 'high-performance',
        premultipliedAlpha: true
      });
      this.renderer.outputColorSpace = SRGBColorSpace;
      this.renderer.toneMapping = ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.setClearColor(0x000000, 0);
      this.camera = new PerspectiveCamera(32, 1, 0.1, 50);
      this.camera.position.set(0, 0.2, 8.7);
      this.scene = new Scene();
      this.createEnvironment();
      this.createFigure();
      this.attachLifecycle();
      this.mounted = true;
      this.resize();
      this.updateFigure(0);
      this.render();
      context.root.dataset.glassHumanRenderer = 'webgl';
      canvas.dataset.glassHumanState = 'rendered';
    } catch {
      this.disposeGraphics();
      context.root.dataset.glassHumanRenderer = 'fallback';
      this.mounted = true;
    }
  }

  play(): void {
    this.playRequested = true;
    if (!this.renderer || !this.mounted || this.destroyed) return;
    if (this.reducedMotion) {
      this.render();
      return;
    }
    this.scheduleFrame();
  }

  pause(): void {
    this.playRequested = false;
    this.cancelFrame();
  }

  resize(): void {
    if (!this.renderer || !this.camera || !this.stage) return;
    const bounds = this.stage.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    this.renderer.setPixelRatio(selectGlassPixelRatio(window.innerWidth));
    this.renderer.setSize(bounds.width, bounds.height, false);
    this.camera.aspect = bounds.width / bounds.height;
    this.camera.position.z = bounds.width <= 520 ? 9.8 : bounds.width <= 900 ? 9.2 : 8.7;
    this.camera.updateProjectionMatrix();
    if (this.figure) {
      const scale = bounds.width <= 520 ? 0.84 : bounds.width <= 900 ? 0.93 : 1;
      this.figure.scale.setScalar(scale);
    }
    this.canvas!.dataset.glassHumanQuality =
      window.innerWidth <= 736 ? 'mobile' : window.innerWidth <= 1180 ? 'balanced' : 'high';
    this.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pause();
    this.listenerController?.abort();
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();
    this.disposeGraphics();
    if (this.root) {
      this.root.dataset.glassHumanRenderer = 'destroyed';
    }
    this.mounted = false;
  }

  private createEnvironment(): void {
    if (!this.renderer || !this.scene) return;
    const generator = new PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment();
    const target = generator.fromScene(environment, 0.04);
    this.environmentTexture = target.texture;
    this.scene.environment = target.texture;
    environment.dispose();
    generator.dispose();
  }

  private createFigure(): void {
    if (!this.scene) return;
    this.figure = new Group();
    this.figure.position.y = -0.18;
    this.scene.add(this.figure);

    this.bodyGeometry = new BoxGeometry(0.32, 0.32, 0.32, 2, 2, 2);
    this.ideaGeometry = new BoxGeometry(0.52, 0.52, 0.52, 3, 3, 3);
    this.haloGeometry = new SphereGeometry(0.52, 20, 14);
    this.bodyMaterial = createPremiumGlassMaterial('#9ddfff', 0.66);
    this.bodyWireMaterial = new MeshBasicMaterial({
      color: 0xcceeff,
      wireframe: true,
      transparent: true,
      opacity: 0.095,
      depthWrite: false
    });
    this.ideaMaterial = createPremiumGlassMaterial('#ffd27a', 0.94);
    this.ideaMaterial.emissive = new Color('#ff9f43');
    this.ideaMaterial.emissiveIntensity = 1.4;
    this.glowMaterial = new MeshBasicMaterial({
      color: 0xffb45f,
      transparent: true,
      opacity: 0.16,
      blending: AdditiveBlending,
      depthWrite: false
    });

    const positions = createBodyPositions();
    this.staticCubes = new InstancedMesh(this.bodyGeometry, this.bodyMaterial, positions.length);
    this.staticWire = new InstancedMesh(this.bodyGeometry, this.bodyWireMaterial, positions.length);
    this.staticCubes.instanceMatrix.setUsage(DynamicDrawUsage);
    for (let index = 0; index < positions.length; index += 1) {
      const position = positions[index];
      if (!position) continue;
      const scale = 0.94 + ((index * 17) % 7) * 0.012;
      this.temporaryMatrix.compose(
        position,
        this.figure.quaternion,
        new Vector3(scale, scale, scale)
      );
      this.staticCubes.setMatrixAt(index, this.temporaryMatrix);
      this.temporaryMatrix.compose(
        position,
        this.figure.quaternion,
        new Vector3(scale * 1.018, scale * 1.018, scale * 1.018)
      );
      this.staticWire.setMatrixAt(index, this.temporaryMatrix);
    }
    this.staticCubes.instanceMatrix.needsUpdate = true;
    this.staticWire.instanceMatrix.needsUpdate = true;
    this.figure.add(this.staticCubes, this.staticWire);

    for (let index = 0; index < 8; index += 1) {
      const left = new Mesh(this.bodyGeometry, this.bodyMaterial);
      const right = new Mesh(this.bodyGeometry, this.bodyMaterial);
      this.leftArm.push(left);
      this.rightArm.push(right);
      this.figure.add(left, right);
    }

    this.ideaGroup = new Group();
    this.ideaCube = new Mesh(this.ideaGeometry, this.ideaMaterial);
    this.ideaHalo = new Mesh(this.haloGeometry, this.glowMaterial);
    this.ideaGroup.add(this.ideaHalo, this.ideaCube);
    this.figure.add(this.ideaGroup);

    const echoMaterial = new MeshBasicMaterial({
      color: 0xffbc63,
      transparent: true,
      opacity: 0.1,
      blending: AdditiveBlending,
      depthWrite: false
    });
    this.chestEcho = new Mesh(new BoxGeometry(0.42, 0.42, 0.42), echoMaterial);
    this.chestEcho.position.set(0, 1.18, 0.16);
    this.figure.add(this.chestEcho);

    const particlePositions: number[] = [];
    const particleCount = window.innerWidth <= 736 ? 14 : 28;
    for (let index = 0; index < particleCount; index += 1) {
      const angle = (index / particleCount) * Math.PI * 2;
      const radius = 0.62 + (index % 4) * 0.07;
      particlePositions.push(
        Math.cos(angle) * radius,
        Math.sin(angle * 1.7) * radius * 0.48,
        Math.sin(angle) * radius
      );
    }
    const particleGeometry = new BufferGeometry();
    particleGeometry.setAttribute('position', new Float32BufferAttribute(particlePositions, 3));
    this.particleMaterial = new PointsMaterial({
      color: 0xffd28a,
      size: 0.038,
      transparent: true,
      opacity: 0.56,
      blending: AdditiveBlending,
      depthWrite: false
    });
    this.particles = new Points(particleGeometry, this.particleMaterial);
    this.ideaGroup.add(this.particles);

    this.scene.add(new AmbientLight(0xbdd8ff, 1.45));
    const keyLight = new DirectionalLight(0xffe4cc, 5.6);
    keyLight.position.set(4, 6, 7);
    const rimLight = new DirectionalLight(0x648cff, 5.2);
    rimLight.position.set(-5, 2, 4);
    const lowerLight = new DirectionalLight(0xff745f, 2.6);
    lowerLight.position.set(1, -5, 3);
    this.scene.add(keyLight, rimLight, lowerLight);
  }

  private attachLifecycle(): void {
    if (!this.stage || !this.root) return;
    const signal = this.listenerController!.signal;
    if (!this.reducedMotion) {
      this.stage.addEventListener('pointermove', this.handlePointerMove, { passive: true, signal });
      this.stage.addEventListener('pointerleave', this.handlePointerLeave, {
        passive: true,
        signal
      });
    }
    this.canvas?.addEventListener('webglcontextlost', this.handleContextLost, { signal });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.stage);
    this.intersectionObserver = new IntersectionObserver(this.handleIntersection, {
      rootMargin: '18% 0px',
      threshold: 0.02
    });
    this.intersectionObserver.observe(this.root);
    const bounds = this.root.getBoundingClientRect();
    this.visible = bounds.bottom > 0 && bounds.top < window.innerHeight;
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.stage) return;
    const bounds = this.stage.getBoundingClientRect();
    this.targetPointer.set(
      clamp(((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2, -1, 1),
      clamp(((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 2, -1, 1)
    );
  };

  private readonly handlePointerLeave = (): void => {
    this.targetPointer.set(0, 0);
  };

  private readonly handleIntersection: IntersectionObserverCallback = (entries): void => {
    this.visible = Boolean(entries[0]?.isIntersecting);
    if (this.visible && this.playRequested) this.scheduleFrame();
    else this.cancelFrame();
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.cancelFrame();
    if (this.root) this.root.dataset.glassHumanRenderer = 'fallback';
  };

  private readonly renderFrame = (timestamp: number): void => {
    this.frameId = undefined;
    if (!this.playRequested || !this.visible || !this.renderer || this.destroyed) return;
    const minimumFrameDuration = 1000 / GLASS_VISUAL_CONFIG.humanFramesPerSecond;
    if (this.lastRenderedTime && timestamp - this.lastRenderedTime < minimumFrameDuration) {
      this.scheduleFrame();
      return;
    }
    const deltaSeconds = this.lastFrameTime
      ? clamp((timestamp - this.lastFrameTime) / 1000, 1 / 120, 0.05)
      : 1 / 60;
    this.lastRenderedTime = timestamp;
    this.lastFrameTime = timestamp;
    this.elapsedTime += deltaSeconds;
    this.updateFigure(deltaSeconds);
    this.render();
    this.scheduleFrame();
  };

  private updateFigure(deltaSeconds: number): void {
    if (!this.figure || !this.ideaGroup) return;
    const cycle = this.elapsedTime % GLASS_VISUAL_CONFIG.humanCycleSeconds;
    const reach = smoothRange(cycle, 1.1, 3.05);
    const extract = smoothRange(cycle, 3.0, 5.35);
    const returnProgress = smoothRange(cycle, 7.35, 10.2);
    const gesture = reach * (1 - returnProgress);
    const offer = extract * (1 - returnProgress);
    if (this.canvas) {
      this.canvas.dataset.glassHumanGesture =
        returnProgress > 0.04
          ? 'returning'
          : offer > 0.72
            ? 'offering'
            : reach > 0.04
              ? 'reaching'
              : 'idle';
    }

    const idleLeftElbow = new Vector3(-1.42, 0.62, 0.04);
    const idleRightElbow = new Vector3(1.42, 0.62, 0.04);
    const idleLeftHand = new Vector3(-1.32, -0.12, 0.08);
    const idleRightHand = new Vector3(1.32, -0.12, 0.08);
    const reachLeftElbow = new Vector3(-0.92, 1.04, 0.42);
    const reachRightElbow = new Vector3(0.92, 1.04, 0.42);
    const reachLeftHand = new Vector3(-0.34, 1.15, 0.62 + offer * 1.45);
    const reachRightHand = new Vector3(0.34, 1.15, 0.62 + offer * 1.45);
    const leftElbow = idleLeftElbow.lerp(reachLeftElbow, gesture);
    const rightElbow = idleRightElbow.lerp(reachRightElbow, gesture);
    const leftHand = idleLeftHand.lerp(reachLeftHand, gesture);
    const rightHand = idleRightHand.lerp(reachRightHand, gesture);
    this.placeArm(this.leftArm, this.shoulderLeft, leftElbow, leftHand);
    this.placeArm(this.rightArm, this.shoulderRight, rightElbow, rightHand);

    this.ideaGroup.position.set(0, 1.18 - offer * 0.08, 0.36 + offer * 1.72);
    this.ideaGroup.rotation.x = 0.18 + Math.sin(this.elapsedTime * 0.72) * 0.08;
    this.ideaGroup.rotation.y = this.elapsedTime * 0.34;
    const pulse = 1 + Math.sin(this.elapsedTime * 2.2) * 0.035 + offer * 0.1;
    this.ideaGroup.scale.setScalar(pulse);
    if (this.ideaHalo && this.glowMaterial) {
      this.ideaHalo.scale.setScalar(1.05 + offer * 0.45);
      this.glowMaterial.opacity = 0.13 + offer * 0.15 + Math.sin(this.elapsedTime * 2.2) * 0.025;
    }
    if (this.particles) {
      this.particles.rotation.y = -this.elapsedTime * 0.22;
      this.particles.rotation.z = this.elapsedTime * 0.08;
    }
    if (this.chestEcho) {
      const echoMaterial = this.chestEcho.material as MeshBasicMaterial;
      echoMaterial.opacity = 0.11 * offer;
      this.chestEcho.scale.setScalar(0.85 + offer * 0.35);
    }

    this.currentPointer.x = damp(
      this.currentPointer.x,
      this.targetPointer.x,
      GLASS_VISUAL_CONFIG.humanPointerDamping,
      deltaSeconds || 1 / 60
    );
    this.currentPointer.y = damp(
      this.currentPointer.y,
      this.targetPointer.y,
      GLASS_VISUAL_CONFIG.humanPointerDamping,
      deltaSeconds || 1 / 60
    );
    this.figure.rotation.y = this.currentPointer.x * 0.085;
    this.figure.rotation.x = this.currentPointer.y * 0.035;
    this.figure.position.y = -0.18 + Math.sin(this.elapsedTime * 0.48) * 0.025;
  }

  private placeArm(cubes: Mesh[], shoulder: Vector3, elbow: Vector3, hand: Vector3): void {
    for (let index = 0; index < cubes.length; index += 1) {
      const cube = cubes[index];
      if (!cube) continue;
      const firstSegment = index < 4;
      const segmentIndex = firstSegment ? index : index - 4;
      const start = firstSegment ? shoulder : elbow;
      const end = firstSegment ? elbow : hand;
      this.temporaryVector.lerpVectors(start, end, (segmentIndex + 0.55) / 4);
      cube.position.copy(this.temporaryVector);
      cube.scale.setScalar(index === cubes.length - 1 ? 0.92 : 0.84);
    }
  }

  private render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
    if (this.canvas) this.canvas.dataset.glassHumanState = 'rendered';
  }

  private scheduleFrame(): void {
    if (
      this.frameId !== undefined ||
      !this.playRequested ||
      !this.visible ||
      !this.renderer ||
      this.reducedMotion ||
      this.destroyed
    ) {
      return;
    }
    this.frameId = window.requestAnimationFrame(this.renderFrame);
  }

  private cancelFrame(): void {
    if (this.frameId === undefined) return;
    window.cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
    this.lastFrameTime = 0;
    this.lastRenderedTime = 0;
  }

  private disposeGraphics(): void {
    this.bodyGeometry?.dispose();
    this.ideaGeometry?.dispose();
    this.haloGeometry?.dispose();
    this.bodyMaterial?.dispose();
    this.bodyWireMaterial?.dispose();
    this.ideaMaterial?.dispose();
    this.glowMaterial?.dispose();
    this.particleMaterial?.dispose();
    this.particles?.geometry.dispose();
    this.chestEcho?.geometry.dispose();
    (this.chestEcho?.material as MeshBasicMaterial | undefined)?.dispose();
    this.environmentTexture?.dispose();
    this.scene?.clear();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.renderer = undefined;
    this.scene = undefined;
    this.camera = undefined;
    this.figure = undefined;
  }
}
