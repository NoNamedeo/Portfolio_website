import type { Experience, ExperienceContext } from '@experience/core/experience';
import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  type Material
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  acquireGlassCubeModels,
  GLASS_CUBE_MODEL_URL,
  type GlassCubeModelLease
} from './glass-cube-model-loader';
import {
  createPremiumGlassMaterial,
  GLASS_VISUAL_CONFIG,
  selectGlassPixelRatio
} from './glass-visual-config';

type GlassCubeQuality = 'mobile' | 'balanced' | 'high';

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const damp = (current: number, target: number, lambda: number, deltaSeconds: number): number =>
  target + (current - target) * Math.exp(-lambda * deltaSeconds);

const qualityForViewport = (viewportWidth: number): GlassCubeQuality =>
  viewportWidth <= 736 ? 'mobile' : viewportWidth <= 1180 ? 'balanced' : 'high';

const frameRateForQuality = (quality: GlassCubeQuality): number =>
  quality === 'mobile'
    ? GLASS_VISUAL_CONFIG.conceptMobileFramesPerSecond
    : quality === 'balanced'
      ? GLASS_VISUAL_CONFIG.conceptBalancedFramesPerSecond
      : GLASS_VISUAL_CONFIG.conceptFramesPerSecond;

export class GlassCubeConceptExperience implements Experience {
  private root?: HTMLElement;
  private stage?: HTMLElement;
  private canvas?: HTMLCanvasElement;
  private renderer?: WebGLRenderer;
  private camera?: PerspectiveCamera;
  private scene?: Scene;
  private cubePivot?: Group;
  private modelLease?: GlassCubeModelLease;
  private environmentTexture?: ReturnType<PMREMGenerator['fromScene']>['texture'];
  private edgeGeometry?: EdgesGeometry;
  private readonly ownedMaterials: Material[] = [];
  private listenerController?: AbortController;
  private intersectionObserver?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;
  private frameId?: number;
  private lastFrameTime = 0;
  private lastRenderedTime = 0;
  private elapsedTime = 0;
  private quality: GlassCubeQuality = 'high';
  private readonly targetPointer = new Vector2();
  private readonly currentPointer = new Vector2();
  private readonly targetDragRotation = new Vector2();
  private readonly currentDragRotation = new Vector2();
  private readonly angularVelocity = new Vector2();
  private dragPointerId?: number;
  private dragLastX = 0;
  private dragLastY = 0;
  private dragLastTime = 0;
  private playRequested = false;
  private visible = false;
  private reducedMotion = false;
  private mounted = false;
  private destroyed = false;

  async mount(context: ExperienceContext): Promise<void> {
    if (this.mounted || this.destroyed) return;
    const stage = context.root.querySelector<HTMLElement>('[data-glass-cube-stage]');
    const canvas = context.root.querySelector<HTMLCanvasElement>('[data-glass-cube-canvas]');
    if (!stage || !canvas) throw new Error('La scena del cubo di vetro è incompleta.');

    this.root = context.root;
    this.stage = stage;
    this.canvas = canvas;
    this.reducedMotion = context.reducedMotion;
    this.quality = qualityForViewport(window.innerWidth);
    this.listenerController = new AbortController();

    const webglContext = canvas.getContext('webgl2', {
      alpha: true,
      antialias: window.innerWidth > 736,
      depth: true,
      failIfMajorPerformanceCaveat: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: true
    });
    if (!webglContext) {
      context.root.dataset.glassCubeRenderer = 'fallback';
      this.mounted = true;
      return;
    }

    context.root.dataset.glassCubeRenderer = 'loading';
    try {
      this.renderer = new WebGLRenderer({
        canvas,
        context: webglContext,
        alpha: true,
        antialias: window.innerWidth > 736,
        powerPreference: 'high-performance',
        premultipliedAlpha: true
      });
      this.renderer.outputColorSpace = SRGBColorSpace;
      this.renderer.toneMapping = ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.setClearColor(0x000000, 0);
      this.camera = new PerspectiveCamera(31, 1, 0.1, 50);
      this.camera.position.set(0, 0.04, 8.8);
      this.scene = new Scene();
      this.createEnvironment();
      this.modelLease = await acquireGlassCubeModels();
      if (this.destroyed) {
        this.disposeGraphics();
        return;
      }
      this.createCube();
      this.createLights();
      this.attachLifecycle();
      this.mounted = true;
      this.resize();
      this.updateCube(0);
      this.render();
      context.root.dataset.glassCubeRenderer = 'webgl';
      context.root.dataset.glassCubeModel = GLASS_CUBE_MODEL_URL;
      context.root.dataset.glassCubeSourceMesh =
        this.modelLease.models[0]?.meshName ?? 'first-valid-mesh';
      canvas.dataset.glassCubeState = 'rendered';
      canvas.dataset.glassCubeInteraction = this.reducedMotion ? 'reduced' : 'idle';
      canvas.dataset.glassCubeAnimation = this.reducedMotion ? 'static' : 'running';
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[glass-cube-concept] Impossibile inizializzare il cubo GLB.', error);
      }
      this.disposeGraphics();
      context.root.dataset.glassCubeRenderer = 'fallback';
      this.mounted = true;
    }
  }

  play(): void {
    this.playRequested = true;
    if (!this.renderer || !this.mounted || this.destroyed) return;
    this.cancelFrame();
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
    if (!this.renderer || !this.camera || !this.stage || !this.cubePivot || !this.canvas) return;
    const bounds = this.stage.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    this.quality = qualityForViewport(window.innerWidth);
    this.renderer.setPixelRatio(selectGlassPixelRatio(window.innerWidth));
    this.renderer.transmissionResolutionScale =
      this.quality === 'mobile' ? 0.48 : this.quality === 'balanced' ? 0.7 : 0.92;
    this.renderer.setSize(bounds.width, bounds.height, false);
    this.camera.aspect = bounds.width / bounds.height;
    this.camera.position.z =
      this.quality === 'mobile' ? 9.7 : this.quality === 'balanced' ? 9.2 : 8.8;
    this.camera.updateProjectionMatrix();
    this.cubePivot.scale.setScalar(
      this.quality === 'mobile' ? 0.84 : this.quality === 'balanced' ? 0.93 : 1
    );
    this.canvas.dataset.glassCubeQuality = this.quality;
    this.render();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pause();
    if (this.dragPointerId !== undefined && this.stage?.hasPointerCapture(this.dragPointerId)) {
      this.stage.releasePointerCapture(this.dragPointerId);
    }
    this.listenerController?.abort();
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();
    this.disposeGraphics();
    if (this.root) this.root.dataset.glassCubeRenderer = 'destroyed';
    this.mounted = false;
  }

  private createEnvironment(): void {
    if (!this.renderer || !this.scene) return;
    const generator = new PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment();
    const target = generator.fromScene(environment, 0.035);
    this.environmentTexture = target.texture;
    this.scene.environment = target.texture;
    environment.dispose();
    generator.dispose();
  }

  private createCube(): void {
    const source = this.modelLease?.models[0];
    if (!this.scene || !source)
      throw new Error('Il modello principale del cubo non è disponibile.');
    this.cubePivot = new Group();
    this.cubePivot.position.set(0, 0.04, 0.25);
    this.cubePivot.rotation.set(-0.18, 0.48, 0.035);
    this.scene.add(this.cubePivot);

    const glassMaterial = createPremiumGlassMaterial('#79ddff');
    glassMaterial.color.lerp(new Color('#ffffff'), 0.72);
    glassMaterial.attenuationColor.set('#79ddff');
    glassMaterial.thickness = 0.46;
    glassMaterial.roughness = 0.038;
    glassMaterial.ior = 1.5;
    glassMaterial.clearcoat = 0.42;
    glassMaterial.clearcoatRoughness = 0.045;
    glassMaterial.attenuationDistance = 8;
    glassMaterial.envMapIntensity = 0.92;
    glassMaterial.emissive.set('#79ddff');
    glassMaterial.emissiveIntensity = 0.018;
    glassMaterial.transparent = true;
    glassMaterial.opacity = 0.72;
    glassMaterial.depthWrite = false;
    this.ownedMaterials.push(glassMaterial);

    const cube = new Mesh(source.geometry, glassMaterial);
    cube.scale.setScalar(3.18);
    cube.renderOrder = 2;

    this.edgeGeometry = new EdgesGeometry(source.geometry, 10);
    const edgeMaterial = new LineBasicMaterial({
      color: '#79ddff',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      toneMapped: false
    });
    this.ownedMaterials.push(edgeMaterial);
    const edges = new LineSegments(this.edgeGeometry, edgeMaterial);
    edges.scale.setScalar(3.205);
    edges.renderOrder = 5;
    this.cubePivot.add(cube, edges);
  }

  private createLights(): void {
    if (!this.scene) return;
    this.scene.add(new AmbientLight(0xc9e2ff, 0.55));
    const keyLight = new DirectionalLight(0xffead7, 2.8);
    keyLight.position.set(4.5, 6, 7);
    const rimLight = new DirectionalLight(0x6f91ff, 3.1);
    rimLight.position.set(-5, 1.8, 4.5);
    this.scene.add(keyLight, rimLight);
  }

  private attachLifecycle(): void {
    if (!this.stage || !this.root || !this.canvas || !this.listenerController) return;
    const signal = this.listenerController.signal;
    if (!this.reducedMotion) {
      this.stage.addEventListener('pointermove', this.handlePointerMove, { signal });
      this.stage.addEventListener('pointerleave', this.handlePointerLeave, { signal });
      this.stage.addEventListener('pointerdown', this.handlePointerDown, { signal });
      this.stage.addEventListener('pointerup', this.handlePointerUp, { signal });
      this.stage.addEventListener('pointercancel', this.handlePointerUp, { signal });
    }
    document.addEventListener('visibilitychange', this.handleVisibilityChange, { signal });
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, { signal });
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
    if (this.dragPointerId === event.pointerId) {
      const now = performance.now();
      const deltaTime = Math.max(now - this.dragLastTime, 8);
      const deltaX = event.clientX - this.dragLastX;
      const deltaY = event.clientY - this.dragLastY;
      this.targetDragRotation.y += deltaX * 0.008;
      this.targetDragRotation.x = clamp(this.targetDragRotation.x + deltaY * 0.006, -0.8, 0.8);
      this.angularVelocity.set((deltaY * 0.006) / deltaTime, (deltaX * 0.008) / deltaTime);
      this.dragLastX = event.clientX;
      this.dragLastY = event.clientY;
      this.dragLastTime = now;
      return;
    }
    const bounds = this.stage.getBoundingClientRect();
    this.targetPointer.set(
      clamp(((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2, -1, 1),
      clamp(-((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 2, -1, 1)
    );
  };

  private readonly handlePointerLeave = (): void => {
    if (this.dragPointerId === undefined) this.targetPointer.set(0, 0);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.stage || event.button !== 0) return;
    this.dragPointerId = event.pointerId;
    this.dragLastX = event.clientX;
    this.dragLastY = event.clientY;
    this.dragLastTime = performance.now();
    this.stage.setPointerCapture(event.pointerId);
    this.root?.setAttribute('data-glass-cube-dragging', '');
    if (this.canvas) this.canvas.dataset.glassCubeInteraction = 'dragging';
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.stage || this.dragPointerId !== event.pointerId) return;
    if (this.stage.hasPointerCapture(event.pointerId))
      this.stage.releasePointerCapture(event.pointerId);
    this.dragPointerId = undefined;
    this.root?.removeAttribute('data-glass-cube-dragging');
    if (this.canvas) this.canvas.dataset.glassCubeInteraction = 'idle';
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) this.cancelFrame();
    else if (this.visible && this.playRequested) {
      this.cancelFrame();
      this.scheduleFrame();
    }
  };

  private readonly handleIntersection: IntersectionObserverCallback = (entries): void => {
    this.visible = Boolean(entries[0]?.isIntersecting);
    if (this.visible && this.playRequested) {
      if (this.reducedMotion) this.render();
      else {
        this.cancelFrame();
        this.scheduleFrame();
      }
    } else {
      this.cancelFrame();
    }
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.cancelFrame();
    if (this.root) this.root.dataset.glassCubeRenderer = 'fallback';
  };

  private readonly renderFrame = (timestamp: number): void => {
    this.frameId = undefined;
    if (!this.renderer || !this.scene || !this.camera || !this.visible || !this.playRequested)
      return;
    const minimumFrameDuration = 1000 / frameRateForQuality(this.quality);
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
    this.updateCube(deltaSeconds);
    this.render();
    this.scheduleFrame();
  };

  private updateCube(deltaSeconds: number): void {
    if (!this.cubePivot) return;
    const dampingSeconds = deltaSeconds || 1 / 60;
    this.currentPointer.x = damp(
      this.currentPointer.x,
      this.targetPointer.x,
      GLASS_VISUAL_CONFIG.conceptPointerDamping,
      dampingSeconds
    );
    this.currentPointer.y = damp(
      this.currentPointer.y,
      this.targetPointer.y,
      GLASS_VISUAL_CONFIG.conceptPointerDamping,
      dampingSeconds
    );
    this.currentDragRotation.x = damp(
      this.currentDragRotation.x,
      this.targetDragRotation.x,
      GLASS_VISUAL_CONFIG.conceptDragDamping,
      dampingSeconds
    );
    this.currentDragRotation.y = damp(
      this.currentDragRotation.y,
      this.targetDragRotation.y,
      GLASS_VISUAL_CONFIG.conceptDragDamping,
      dampingSeconds
    );
    if (this.dragPointerId === undefined) {
      this.targetDragRotation.x += this.angularVelocity.x * 6;
      this.targetDragRotation.y += this.angularVelocity.y * 6;
      this.angularVelocity.multiplyScalar(Math.exp(-5.6 * dampingSeconds));
    }
    const idleY = this.elapsedTime * 0.12;
    const idleX = Math.sin(this.elapsedTime * 0.42) * 0.035;
    this.cubePivot.rotation.x =
      -0.18 + idleX + this.currentPointer.y * 0.1 + this.currentDragRotation.x;
    this.cubePivot.rotation.y =
      0.48 + idleY + this.currentPointer.x * 0.13 + this.currentDragRotation.y;
    this.cubePivot.rotation.z = 0.035 + Math.sin(this.elapsedTime * 0.28) * 0.018;
  }

  private render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.renderer.render(this.scene, this.camera);
    if (this.canvas) this.canvas.dataset.glassCubeState = 'rendered';
  }

  private scheduleFrame(): void {
    if (
      this.frameId !== undefined ||
      !this.renderer ||
      !this.playRequested ||
      !this.visible ||
      this.reducedMotion ||
      this.destroyed
    ) {
      return;
    }
    this.frameId = window.requestAnimationFrame(this.renderFrame);
  }

  private cancelFrame(): void {
    if (this.frameId !== undefined) window.cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
    this.lastFrameTime = 0;
    this.lastRenderedTime = 0;
  }

  private disposeGraphics(): void {
    this.ownedMaterials.forEach((material) => material.dispose());
    this.ownedMaterials.length = 0;
    this.edgeGeometry?.dispose();
    this.edgeGeometry = undefined;
    this.environmentTexture?.dispose();
    this.environmentTexture = undefined;
    this.modelLease?.release();
    this.modelLease = undefined;
    this.scene?.clear();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.renderer = undefined;
    this.scene = undefined;
    this.camera = undefined;
    this.cubePivot = undefined;
  }
}
