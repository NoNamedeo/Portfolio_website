import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  type BufferGeometry
} from 'three';
import {
  applyGlassPlateLayout,
  createGlassPlateStates,
  updateGlassPlatePhysics,
  type GlassPlateState
} from './glass-composition';
import { GLASS_CONFIG, GLASS_DEBUG, selectGlassQuality, type GlassQuality } from './glass-config';
import { createGlassMaterialResources, type GlassMaterialResources } from './glass-material';
import { loadGlassPlateGeometry } from './glass-model-loader';
import { createRefractionBackdrop, type RefractionBackdrop } from './glass-refraction-backdrop';
import { createGlassRefractionDebug, type GlassRefractionDebug } from './glass-refraction-debug';
import { loadGlassSloganGeometries, type LoadedGlassSloganGeometries } from './glass-slogan-loader';
import { createGlassSlogans, type GlassSlogans } from './glass-slogans';

export type GlassRendererStatus = 'loading' | 'webgl' | 'fallback' | 'destroyed';

interface WebGLGlassRendererOptions {
  readonly stage: HTMLElement;
  readonly glass: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly reducedMotion: boolean;
  readonly onStatusChange: (status: GlassRendererStatus) => void;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const damp = (current: number, target: number, lambda: number, deltaSeconds: number): number =>
  target + (current - target) * Math.exp(-lambda * deltaSeconds);

export class WebGLGlassRenderer {
  private readonly stage: HTMLElement;
  private readonly glass: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly reducedMotion: boolean;
  private readonly onStatusChange: (status: GlassRendererStatus) => void;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(
    GLASS_CONFIG.camera.fov,
    1,
    GLASS_CONFIG.camera.near,
    GLASS_CONFIG.camera.far
  );
  private readonly targetPointer = new Vector2();
  private readonly currentPointer = new Vector2();

  private renderer?: WebGLRenderer;
  private sourceGeometry?: BufferGeometry;
  private materialResources?: GlassMaterialResources;
  private backdrop?: RefractionBackdrop;
  private debugScene?: GlassRefractionDebug;
  private slogans?: GlassSlogans;
  private plates: GlassPlateState[] = [];
  private listenerController?: AbortController;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private quality?: GlassQuality;
  private frameId?: number;
  private lastFrameTime = 0;
  private elapsedTime = 0;
  private targetScrollProgress = 0;
  private currentScrollProgress = 0;
  private halfWidth = 1;
  private halfHeight = 1;
  private playRequested = false;
  private visible = false;
  private initialized = false;
  private destroyed = false;
  private contextLost = false;
  private firstLayout = true;
  private pointerCapable = false;

  constructor(options: WebGLGlassRendererOptions) {
    this.stage = options.stage;
    this.glass = options.glass;
    this.canvas = options.canvas;
    this.reducedMotion = options.reducedMotion;
    this.onStatusChange = options.onStatusChange;
    this.camera.position.set(0, 0, GLASS_CONFIG.camera.positionZ);
    this.camera.lookAt(0, 0, 0);
  }

  async mount(): Promise<boolean> {
    if (this.initialized || this.destroyed) return this.initialized;
    this.onStatusChange('loading');
    const bounds = this.glass.getBoundingClientRect();
    this.quality = selectGlassQuality(bounds.width || window.innerWidth, this.reducedMotion);
    const context = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: this.quality.antialias,
      depth: true,
      failIfMajorPerformanceCaveat: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
      preserveDrawingBuffer: false
    });
    if (!context) {
      this.onStatusChange('fallback');
      return false;
    }

    try {
      const renderer = new WebGLRenderer({
        canvas: this.canvas,
        context,
        alpha: true,
        antialias: this.quality.antialias,
        powerPreference: 'high-performance',
        premultipliedAlpha: true
      });
      this.renderer = renderer;
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      renderer.setClearColor(new Color(0x000000), 0);
      renderer.shadowMap.enabled = false;
      const debugRendererInfo = context.getExtension('WEBGL_debug_renderer_info');
      const gpuName = String(
        debugRendererInfo
          ? context.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL)
          : (context.getParameter(context.RENDERER) ?? '')
      );
      if (/swiftshader|angle.*direct3d/i.test(gpuName)) {
        renderer.debug.checkShaderErrors = false;
      }
      renderer.transmissionResolutionScale = GLASS_DEBUG
        ? 1
        : this.quality.transmissionResolutionScale;

      const loadedModel = await loadGlassPlateGeometry();
      let loadedSlogans: LoadedGlassSloganGeometries;
      try {
        loadedSlogans = await loadGlassSloganGeometries();
      } catch (error) {
        loadedModel.geometry.dispose();
        throw error;
      }
      this.sourceGeometry = loadedModel.geometry;
      if (this.destroyed) {
        loadedSlogans.dispose();
        this.disposeGraphics();
        return false;
      }

      this.createScene(loadedSlogans);
      this.attachLifecycle();
      this.initialized = true;
      this.resize();
      renderer.compile(this.scene, this.camera);
      if (this.destroyed) return false;
      this.renderOnce();
      this.canvas.dataset.glassSourceMesh = loadedModel.sourceMeshName;
      this.canvas.dataset.glassMeshSelection = loadedModel.usedFallback ? 'fallback' : 'exact';
      this.canvas.dataset.glassMaterial = 'mesh-physical-transmission';
      this.canvas.dataset.glassRefractionBackdrop = 'procedural-scene';
      this.canvas.dataset.glassDebug = GLASS_DEBUG ? 'enabled' : 'off';
      this.canvas.dataset.glassThickness = String(this.materialResources?.tuning.thickness ?? '');
      this.canvas.dataset.glassIor = String(this.materialResources?.tuning.ior ?? '');
      this.canvas.dataset.glassEnvironment = 'room-environment-pmrem';
      this.canvas.dataset.glassPhysics = 'spring-damper';
      this.canvas.dataset.glassMotion = this.reducedMotion ? 'reduced' : 'active';
      this.canvas.dataset.glassBackSloganModel = GLASS_CONFIG.slogans.back.modelUrl;
      this.canvas.dataset.glassFrontSloganModel = GLASS_CONFIG.slogans.front.modelUrl;
      this.canvas.dataset.glassBackSloganMesh = this.slogans?.backSourceMeshName ?? '';
      this.canvas.dataset.glassFrontSloganMesh = this.slogans?.frontSourceMeshName ?? '';
      this.canvas.dataset.glassBackSloganLayer = 'behind-glass';
      this.canvas.dataset.glassFrontSloganLayer = 'foreground';
      this.onStatusChange('webgl');
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(
          `[Hero glass] Impossibile inizializzare ${GLASS_CONFIG.modelUrl}. ` +
            'Rimane attivo il fallback statico.',
          error
        );
      }
      this.disposeGraphics();
      this.onStatusChange('fallback');
      return false;
    }
  }

  play(): void {
    if (!this.initialized || this.destroyed || this.contextLost) return;
    this.playRequested = true;
    this.cancelFrame();
    if (this.reducedMotion) {
      this.renderOnce();
      return;
    }
    this.scheduleFrame();
  }

  pause(): void {
    this.playRequested = false;
    this.cancelFrame();
  }

  resize(): void {
    if (!this.initialized || !this.renderer) return;
    const bounds = this.glass.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    const nextQuality = selectGlassQuality(bounds.width, this.reducedMotion);
    const qualityChanged = this.quality?.name !== nextQuality.name;
    this.quality = nextQuality;
    this.renderer.transmissionResolutionScale = GLASS_DEBUG
      ? 1
      : nextQuality.transmissionResolutionScale;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, nextQuality.pixelRatioLimit)
    );
    this.renderer.setSize(bounds.width, bounds.height, false);
    this.camera.aspect = bounds.width / bounds.height;
    this.camera.updateProjectionMatrix();

    this.halfHeight = Math.tan((this.camera.fov * Math.PI) / 360) * GLASS_CONFIG.camera.positionZ;
    this.halfWidth = this.halfHeight * this.camera.aspect;
    this.backdrop?.resize(this.halfWidth, this.halfHeight, nextQuality.name === 'mobile');
    this.slogans?.resize(nextQuality.name, this.halfWidth, this.halfHeight);
    applyGlassPlateLayout(
      this.plates,
      nextQuality.name,
      this.halfWidth,
      this.halfHeight,
      this.firstLayout || this.reducedMotion
    );
    this.debugScene?.resize(this.halfWidth, nextQuality.name === 'mobile');
    this.firstLayout = false;
    this.canvas.dataset.glassQuality = nextQuality.name;
    this.canvas.dataset.glassPlateCount = String(GLASS_DEBUG ? 1 : nextQuality.plateCount);
    this.canvas.dataset.glassResponsiveLayout = qualityChanged ? 'updated' : 'stable';
    this.renderOnce();
  }

  setScrollProgress(progress: number): void {
    if (this.reducedMotion) return;
    this.targetScrollProgress = clamp(progress, 0, 1);
    this.canvas.dataset.glassScrollProgress = this.targetScrollProgress.toFixed(3);
    if (this.playRequested) this.scheduleFrame();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pause();
    this.listenerController?.abort();
    this.listenerController = undefined;
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    this.disposeGraphics();
    for (const attribute of [
      'data-glass-quality',
      'data-glass-plate-count',
      'data-glass-render-state',
      'data-glass-source-mesh',
      'data-glass-mesh-selection',
      'data-glass-material',
      'data-glass-refraction-backdrop',
      'data-glass-debug',
      'data-glass-thickness',
      'data-glass-ior',
      'data-glass-environment',
      'data-glass-physics',
      'data-glass-motion',
      'data-glass-pointer',
      'data-glass-pointer-x',
      'data-glass-pointer-y',
      'data-glass-scroll-progress',
      'data-glass-responsive-layout',
      'data-glass-back-slogan-model',
      'data-glass-front-slogan-model',
      'data-glass-back-slogan-mesh',
      'data-glass-front-slogan-mesh',
      'data-glass-back-slogan-layer',
      'data-glass-front-slogan-layer'
    ]) {
      this.canvas.removeAttribute(attribute);
    }
    this.onStatusChange('destroyed');
    this.initialized = false;
  }

  private createScene(sloganGeometries: LoadedGlassSloganGeometries): void {
    if (!this.renderer || !this.sourceGeometry) return;
    this.backdrop = createRefractionBackdrop();
    this.scene.add(this.backdrop.group);
    this.materialResources = createGlassMaterialResources(this.renderer, this.scene);
    this.plates = createGlassPlateStates(this.sourceGeometry, this.materialResources.material);
    for (const plate of this.plates) this.scene.add(plate.mesh);
    this.slogans = createGlassSlogans(sloganGeometries);
    this.scene.add(this.slogans.group);
    this.backdrop.group.visible = !GLASS_DEBUG;
    this.slogans.group.visible = !GLASS_DEBUG;
    if (GLASS_DEBUG) {
      this.debugScene = createGlassRefractionDebug(this.plates, this.materialResources.tuning);
      this.scene.add(this.debugScene.group);
    }

    const hemisphere = new HemisphereLight(
      0xeaf4ff,
      0x1b1713,
      GLASS_CONFIG.lighting.hemisphereIntensity
    );
    const key = new DirectionalLight(0xffe0cc, GLASS_CONFIG.lighting.keyIntensity);
    key.position.set(-4.5, 5.2, 7.4);
    const rim = new DirectionalLight(0x7192ff, GLASS_CONFIG.lighting.rimIntensity);
    rim.position.set(5.5, -2.6, 5.8);
    this.scene.add(hemisphere, key, rim);
  }

  private attachLifecycle(): void {
    this.listenerController = new AbortController();
    const listenerOptions = {
      passive: true,
      signal: this.listenerController.signal
    } as const;
    this.pointerCapable =
      !this.reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (this.pointerCapable) {
      this.stage.addEventListener('pointerenter', this.handlePointerMove, listenerOptions);
      this.stage.addEventListener('pointermove', this.handlePointerMove, listenerOptions);
      this.stage.addEventListener('pointerleave', this.handlePointerLeave, listenerOptions);
      this.canvas.dataset.glassPointer = 'neutral';
    } else {
      this.canvas.dataset.glassPointer = this.reducedMotion ? 'disabled' : 'ambient';
    }
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, {
      signal: this.listenerController.signal
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.glass);
    this.intersectionObserver = new IntersectionObserver(this.handleIntersection, {
      rootMargin: '12% 0px',
      threshold: 0.01
    });
    this.intersectionObserver.observe(this.stage);
    const bounds = this.stage.getBoundingClientRect();
    this.visible = bounds.bottom > 0 && bounds.top < window.innerHeight;
  }

  private readonly handleIntersection: IntersectionObserverCallback = (entries): void => {
    this.visible = Boolean(entries[0]?.isIntersecting);
    if (this.visible && this.playRequested) {
      this.cancelFrame();
      this.scheduleFrame();
    } else {
      this.cancelFrame();
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const bounds = this.stage.getBoundingClientRect();
    this.targetPointer.set(
      clamp(((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1, -1, 1),
      clamp(-(((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 - 1), -1, 1)
    );
    this.canvas.dataset.glassPointer = 'active';
    this.canvas.dataset.glassPointerX = this.targetPointer.x.toFixed(3);
    this.canvas.dataset.glassPointerY = this.targetPointer.y.toFixed(3);
    if (this.playRequested) this.scheduleFrame();
  };

  private readonly handlePointerLeave = (): void => {
    this.targetPointer.set(0, 0);
    this.canvas.dataset.glassPointer = 'neutral';
    this.canvas.dataset.glassPointerX = '0';
    this.canvas.dataset.glassPointerY = '0';
    if (this.playRequested) this.scheduleFrame();
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.destroyed) return;
    this.contextLost = true;
    this.pause();
    this.onStatusChange('fallback');
    if (import.meta.env.DEV) {
      console.warn('[Hero glass] Contesto WebGL perso; è stato attivato il fallback statico.');
    }
  };

  private readonly renderFrame = (timestamp: number): void => {
    this.frameId = undefined;
    if (
      !this.initialized ||
      this.destroyed ||
      this.contextLost ||
      !this.playRequested ||
      !this.visible
    ) {
      return;
    }
    this.render(timestamp);
    if (!this.reducedMotion) this.scheduleFrame();
  };

  private render(timestamp: number): void {
    if (!this.renderer || !this.quality) return;
    const deltaSeconds = this.lastFrameTime
      ? clamp(
          (timestamp - this.lastFrameTime) / 1000,
          1 / 120,
          GLASS_CONFIG.motion.maximumDeltaSeconds
        )
      : 1 / 60;
    this.lastFrameTime = timestamp;
    if (!this.reducedMotion) this.elapsedTime += deltaSeconds;

    const pointerBlend = 1 - Math.exp(-GLASS_CONFIG.motion.pointerDamping * deltaSeconds);
    this.currentPointer.x += (this.targetPointer.x - this.currentPointer.x) * pointerBlend;
    this.currentPointer.y += (this.targetPointer.y - this.currentPointer.y) * pointerBlend;
    this.currentScrollProgress = damp(
      this.currentScrollProgress,
      this.targetScrollProgress,
      GLASS_CONFIG.motion.scrollDamping,
      deltaSeconds
    );

    const ambientScale = this.reducedMotion ? 0 : this.quality.ambientMotionScale;
    if (GLASS_DEBUG) {
      this.debugScene?.update();
    } else {
      updateGlassPlatePhysics(
        this.plates,
        this.currentPointer.x,
        this.currentPointer.y,
        this.currentScrollProgress,
        this.elapsedTime,
        deltaSeconds,
        this.halfWidth,
        this.halfHeight,
        ambientScale
      );
      this.backdrop?.update(this.elapsedTime, ambientScale);
      this.slogans?.update(
        this.currentPointer.x,
        this.currentPointer.y,
        this.currentScrollProgress,
        this.elapsedTime,
        ambientScale
      );
    }
    this.renderer.render(this.scene, this.camera);
    this.canvas.dataset.glassRenderState = 'rendered';
  }

  private renderOnce(): void {
    if (!this.initialized || this.destroyed || this.contextLost) return;
    this.render(performance.now());
  }

  private scheduleFrame(): void {
    if (
      this.frameId !== undefined ||
      !this.initialized ||
      this.destroyed ||
      this.contextLost ||
      !this.playRequested ||
      !this.visible
    ) {
      return;
    }
    this.frameId = window.requestAnimationFrame(this.renderFrame);
  }

  private cancelFrame(): void {
    if (this.frameId !== undefined) window.cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
    this.lastFrameTime = 0;
  }

  private disposeGraphics(): void {
    this.scene.clear();
    this.debugScene?.dispose();
    this.debugScene = undefined;
    this.plates = [];
    this.backdrop?.dispose();
    this.backdrop = undefined;
    this.slogans?.dispose();
    this.slogans = undefined;
    this.materialResources?.dispose();
    this.materialResources = undefined;
    this.sourceGeometry?.dispose();
    this.sourceGeometry = undefined;
    if (this.renderer) {
      this.renderer.dispose();
    }
    this.renderer = undefined;
  }
}
