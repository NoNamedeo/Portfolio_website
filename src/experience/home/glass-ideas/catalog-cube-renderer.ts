import {
  ACESFilmicToneMapping,
  AmbientLight,
  AnimationMixer,
  DirectionalLight,
  Group,
  OrthographicCamera,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
  type Object3D
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  acquireArticleGlassCubeModels,
  ARTICLE_GLASS_CUBE_SOURCE_URL,
  type ArticleGlassCubeModel,
  type ArticleGlassCubeModelLease
} from './glass-cube-model-loader';
import {
  getArticleGlassCubeVisual,
  type ArticleGlassCubeId,
  type ArticleGlassCubeVisual
} from './article-cube-config';
import { GLASS_VISUAL_CONFIG, selectGlassPixelRatio } from './glass-visual-config';

interface CubeVisual {
  readonly slot: HTMLElement;
  readonly card: HTMLElement;
  readonly group: Group;
  readonly modelRoot: Object3D;
  readonly mixer?: AnimationMixer;
  readonly config: ArticleGlassCubeVisual;
  currentTiltX: number;
  currentTiltY: number;
  targetTiltX: number;
  targetTiltY: number;
  currentLift: number;
  targetLift: number;
  currentEnergy: number;
  targetEnergy: number;
  impulse: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const damp = (current: number, target: number, lambda: number, deltaSeconds: number): number =>
  target + (current - target) * Math.exp(-lambda * deltaSeconds);

const isArticleGlassCubeId = (value: string): value is ArticleGlassCubeId =>
  getArticleGlassCubeVisual(value).id === value;

const animationClipsForRoot = (model: ArticleGlassCubeModel, root: Object3D, maximum: number) => {
  const nodeNames = new Set<string>();
  root.traverse((node) => {
    if (node.name) nodeNames.add(node.name);
  });
  return model.animations
    .filter((clip) =>
      clip.tracks.some((track) => {
        const separatorIndex = track.name.indexOf('.');
        const nodeName = separatorIndex >= 0 ? track.name.slice(0, separatorIndex) : track.name;
        return nodeNames.has(nodeName);
      })
    )
    .slice(0, maximum);
};

export class CatalogCubeRenderer {
  private readonly root: HTMLElement;
  private readonly viewport: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly reducedMotion: boolean;
  private renderer?: WebGLRenderer;
  private scene?: Scene;
  private camera?: OrthographicCamera;
  private environmentTexture?: ReturnType<PMREMGenerator['fromScene']>['texture'];
  private modelLease?: ArticleGlassCubeModelLease;
  private visuals: CubeVisual[] = [];
  private listenerController?: AbortController;
  private intersectionObserver?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;
  private frameId?: number;
  private lastFrameTime = 0;
  private lastRenderedTime = 0;
  private frameCount = 0;
  private elapsedTime = 0;
  private playRequested = false;
  private visible = false;
  private mounted = false;
  private destroyed = false;
  private activeCard?: HTMLElement;

  constructor(options: {
    root: HTMLElement;
    viewport: HTMLElement;
    canvas: HTMLCanvasElement;
    reducedMotion: boolean;
  }) {
    this.root = options.root;
    this.viewport = options.viewport;
    this.canvas = options.canvas;
    this.reducedMotion = options.reducedMotion;
  }

  async mount(): Promise<boolean> {
    if (this.mounted || this.destroyed) return this.mounted;
    const slots = this.readSlots();
    if (slots.length === 0) return false;
    const context = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: window.innerWidth > 736,
      depth: true,
      failIfMajorPerformanceCaveat: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: true
    });
    if (!context) {
      this.root.dataset.catalogCubeRenderer = 'fallback';
      return false;
    }

    this.root.dataset.catalogCubeRenderer = 'loading';
    try {
      this.renderer = new WebGLRenderer({
        canvas: this.canvas,
        context,
        alpha: true,
        antialias: window.innerWidth > 736,
        powerPreference: 'high-performance',
        premultipliedAlpha: true
      });
      this.renderer.outputColorSpace = SRGBColorSpace;
      this.renderer.toneMapping = ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.06;
      this.renderer.setClearColor(0x000000, 0);
      this.scene = new Scene();
      this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
      this.camera.position.z = 1000;
      const ids = slots
        .map((slot, index) => this.readVisual(slot, index).id)
        .filter(isArticleGlassCubeId);
      this.modelLease = await acquireArticleGlassCubeModels(ids);
      if (this.destroyed) {
        this.disposeGraphics();
        return false;
      }
      this.createEnvironment();
      this.createLights();
      this.attachLifecycle();
      this.mounted = true;
      this.syncSlots();
      this.resize();
      this.renderFrameContents(0);
      this.renderer.render(this.scene, this.camera);
      this.root.dataset.catalogCubeRenderer = 'webgl';
      this.canvas.dataset.catalogCubeSource = ARTICLE_GLASS_CUBE_SOURCE_URL;
      this.canvas.dataset.catalogCubeModels = this.modelLease.models
        .map((model) => model.modelUrl)
        .join(',');
      this.canvas.dataset.catalogCubeModelCount = String(this.modelLease.models.length);
      this.canvas.dataset.catalogCubeState = 'rendered';
      this.canvas.dataset.catalogCubeFrame = '0';
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[catalog-cubes] Impossibile caricare i cubi GLB.', error);
      }
      this.disposeGraphics();
      this.root.dataset.catalogCubeRenderer = 'fallback';
      return false;
    }
  }

  play(): void {
    this.playRequested = true;
    if (!this.mounted || this.destroyed) return;
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
    if (!this.renderer || !this.camera) return;
    const bounds = this.viewport.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    this.renderer.setPixelRatio(selectGlassPixelRatio(window.innerWidth));
    this.renderer.setSize(bounds.width, bounds.height, false);
    this.camera.left = -bounds.width / 2;
    this.camera.right = bounds.width / 2;
    this.camera.top = bounds.height / 2;
    this.camera.bottom = -bounds.height / 2;
    this.camera.updateProjectionMatrix();
    this.canvas.dataset.catalogCubeQuality =
      window.innerWidth <= 736 ? 'mobile' : window.innerWidth <= 1180 ? 'balanced' : 'high';
    this.syncSlots();
    this.renderOnce();
  }

  syncSlots(): void {
    if (!this.scene || !this.modelLease) return;
    const slots = this.readSlots();
    const unchanged =
      slots.length === this.visuals.length &&
      slots.every((slot, index) => this.visuals[index]?.slot === slot);
    if (unchanged) return;
    this.disposeVisuals();
    this.visuals = slots.map((slot, index) => this.createVisual(slot, index));
    this.renderOnce();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.pause();
    this.listenerController?.abort();
    this.intersectionObserver?.disconnect();
    this.resizeObserver?.disconnect();
    this.activeCard?.removeAttribute('data-cube-active');
    this.activeCard = undefined;
    this.disposeGraphics();
    this.root.dataset.catalogCubeRenderer = 'destroyed';
    this.canvas.removeAttribute('data-catalog-cube-state');
    this.canvas.removeAttribute('data-catalog-cube-quality');
    this.canvas.removeAttribute('data-catalog-cube-source');
    this.canvas.removeAttribute('data-catalog-cube-models');
    this.canvas.removeAttribute('data-catalog-cube-model-count');
    this.canvas.removeAttribute('data-catalog-cube-frame');
    this.mounted = false;
  }

  private readSlots(): HTMLElement[] {
    return [...this.root.querySelectorAll<HTMLElement>('[data-cube-slot]')].slice(0, 12);
  }

  private readVisual(slot: HTMLElement, index: number): ArticleGlassCubeVisual {
    const requestedId = slot.dataset.cubeId;
    if (requestedId && isArticleGlassCubeId(requestedId))
      return getArticleGlassCubeVisual(requestedId);
    const modelIndex = Number.parseInt(slot.dataset.cubeIndex ?? String(index), 10) || 0;
    return getArticleGlassCubeVisual(modelIndex);
  }

  private createEnvironment(): void {
    if (!this.renderer || !this.scene) return;
    const generator = new PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment();
    const target = generator.fromScene(environment, 0.03);
    this.environmentTexture = target.texture;
    this.scene.environment = target.texture;
    environment.dispose();
    generator.dispose();
  }

  private createLights(): void {
    if (!this.scene) return;
    this.scene.add(new AmbientLight(0xc9ddff, 1.35));
    const key = new DirectionalLight(0xffe5cc, 4.2);
    key.position.set(260, 360, 520);
    const rim = new DirectionalLight(0x6990ff, 4.8);
    rim.position.set(-320, 120, 420);
    this.scene.add(key, rim);
  }

  private createVisual(slot: HTMLElement, index: number): CubeVisual {
    const card = slot.closest<HTMLElement>('[data-cube-card]') ?? slot;
    const config = this.readVisual(slot, index);
    const model = this.modelLease?.models.find((candidate) => candidate.id === config.id);
    if (!model) throw new Error(`Modello GLB non disponibile per "${config.id}".`);
    slot.dataset.cubeModel = model.modelUrl;

    const group = new Group();
    const modelRoot = model.scene.clone(true);
    group.add(modelRoot);
    this.scene!.add(group);

    const animationLimit =
      slot.dataset.cubeAnimationDetail === 'full'
        ? Number.POSITIVE_INFINITY
        : window.innerWidth <= 736
          ? 10
          : 28;
    const clips = this.reducedMotion ? [] : animationClipsForRoot(model, modelRoot, animationLimit);
    const mixer = clips.length > 0 ? new AnimationMixer(modelRoot) : undefined;
    clips.forEach((clip) => mixer?.clipAction(clip).play());

    return {
      slot,
      card,
      group,
      modelRoot,
      ...(mixer ? { mixer } : {}),
      config,
      currentTiltX: 0,
      currentTiltY: 0,
      targetTiltX: 0,
      targetTiltY: 0,
      currentLift: 0,
      targetLift: 0,
      currentEnergy: 0,
      targetEnergy: 0,
      impulse: 0
    };
  }

  private attachLifecycle(): void {
    this.listenerController = new AbortController();
    const signal = this.listenerController.signal;
    if (!this.reducedMotion) {
      this.viewport.addEventListener('pointermove', this.handlePointerMove, {
        passive: true,
        signal
      });
      this.viewport.addEventListener('pointerleave', this.handlePointerLeave, {
        passive: true,
        signal
      });
      this.viewport.addEventListener('pointerdown', this.handlePointerDown, {
        passive: true,
        signal
      });
      this.viewport.addEventListener('focusin', this.handleFocusIn, { signal });
      this.viewport.addEventListener('focusout', this.handleFocusOut, { signal });
    }
    this.viewport.addEventListener('scroll', this.handleViewportScroll, { passive: true, signal });
    document.addEventListener('visibilitychange', this.handleVisibilityChange, { signal });
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, { signal });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.intersectionObserver = new IntersectionObserver(this.handleIntersection, {
      rootMargin: '18% 0px',
      threshold: 0.02
    });
    this.intersectionObserver.observe(this.root);
    const bounds = this.root.getBoundingClientRect();
    this.visible = bounds.bottom > 0 && bounds.top < window.innerHeight;
  }

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const target = event.target;
    const card =
      target instanceof Element ? target.closest<HTMLElement>('[data-cube-card]') : undefined;
    this.setActiveCard(card ?? undefined);
    if (!card) return;
    const visual = this.visuals.find((candidate) => candidate.card === card);
    if (!visual) return;
    const bounds = visual.slot.getBoundingClientRect();
    visual.targetTiltY = clamp(
      ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 0.68,
      -0.34,
      0.34
    );
    visual.targetTiltX = clamp(
      -((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 0.54,
      -0.27,
      0.27
    );
    visual.targetLift = 8;
    visual.targetEnergy = 1;
    this.scheduleFrame();
  };

  private readonly handlePointerLeave = (): void => {
    const focusedCard =
      document.activeElement instanceof Element
        ? document.activeElement.closest<HTMLElement>('[data-cube-card]')
        : undefined;
    this.setActiveCard(focusedCard ?? undefined);
    this.scheduleFrame();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const target = event.target;
    const card =
      target instanceof Element ? target.closest<HTMLElement>('[data-cube-card]') : undefined;
    const visual = this.visuals.find((candidate) => candidate.card === card);
    if (!visual) return;
    visual.impulse = 1;
    this.canvas.dataset.catalogCubePulse = 'active';
    this.scheduleFrame();
  };

  private readonly handleFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    const card =
      target instanceof Element ? target.closest<HTMLElement>('[data-cube-card]') : undefined;
    this.setActiveCard(card ?? undefined);
    this.scheduleFrame();
  };

  private readonly handleFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    const card =
      next instanceof Element ? next.closest<HTMLElement>('[data-cube-card]') : undefined;
    this.setActiveCard(card ?? undefined);
    this.scheduleFrame();
  };

  private readonly handleViewportScroll = (): void => {
    if (this.reducedMotion) this.renderOnce();
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
      if (this.reducedMotion) this.renderOnce();
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
    this.root.dataset.catalogCubeRenderer = 'fallback';
  };

  private setActiveCard(card?: HTMLElement): void {
    if (this.activeCard === card) return;
    this.activeCard?.removeAttribute('data-cube-active');
    this.activeCard = card;
    this.activeCard?.setAttribute('data-cube-active', '');
    for (const visual of this.visuals) {
      const active = visual.card === card;
      visual.targetEnergy = active ? 1 : 0;
      visual.targetLift = active ? 8 : 0;
      if (!active) {
        visual.targetTiltX = 0;
        visual.targetTiltY = 0;
      }
    }
  }

  private readonly renderFrame = (timestamp: number): void => {
    this.frameId = undefined;
    if (!this.renderer || !this.scene || !this.camera || !this.visible || !this.playRequested)
      return;
    const framesPerSecond =
      window.innerWidth <= 736 ? 28 : GLASS_VISUAL_CONFIG.catalogFramesPerSecond;
    const minimumFrameDuration = 1000 / framesPerSecond;
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
    this.renderFrameContents(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
    this.canvas.dataset.catalogCubeState = 'rendered';
    this.frameCount += 1;
    this.canvas.dataset.catalogCubeFrame = String(this.frameCount);
    this.scheduleFrame();
  };

  private renderFrameContents(deltaSeconds: number): void {
    if (!this.camera) return;
    const viewportBounds = this.viewport.getBoundingClientRect();
    const dampingSeconds = deltaSeconds || 1 / 60;
    for (const visual of this.visuals) {
      const bounds = visual.slot.getBoundingClientRect();
      const visible =
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.right > viewportBounds.left - 80 &&
        bounds.left < viewportBounds.right + 80 &&
        bounds.bottom > viewportBounds.top - 80 &&
        bounds.top < viewportBounds.bottom + 80;
      visual.group.visible = visible;
      if (!visible) continue;

      visual.currentTiltX = damp(
        visual.currentTiltX,
        visual.targetTiltX,
        GLASS_VISUAL_CONFIG.cubeHoverDamping,
        dampingSeconds
      );
      visual.currentTiltY = damp(
        visual.currentTiltY,
        visual.targetTiltY,
        GLASS_VISUAL_CONFIG.cubeHoverDamping,
        dampingSeconds
      );
      visual.currentLift = damp(
        visual.currentLift,
        visual.targetLift,
        GLASS_VISUAL_CONFIG.cubeHoverDamping,
        dampingSeconds
      );
      visual.currentEnergy = damp(
        visual.currentEnergy,
        visual.targetEnergy,
        GLASS_VISUAL_CONFIG.cubeHoverDamping,
        dampingSeconds
      );
      visual.impulse *= Math.exp(-5.8 * dampingSeconds);
      if (deltaSeconds > 0) visual.mixer?.update(deltaSeconds);

      const centerX = bounds.left + bounds.width / 2 - viewportBounds.left;
      const centerY = bounds.top + bounds.height / 2 - viewportBounds.top;
      const size = Math.min(bounds.width, bounds.height) * (window.innerWidth <= 736 ? 0.78 : 0.82);
      visual.group.position.set(
        centerX - viewportBounds.width / 2,
        viewportBounds.height / 2 - centerY + visual.currentLift,
        visual.currentLift * 1.8
      );
      const hoverScale = 1 + visual.currentEnergy * 0.045 - visual.impulse * 0.025;
      visual.group.scale.setScalar(size * hoverScale);

      const phase = this.elapsedTime * (0.62 + (visual.config.modelIndex % 3) * 0.05);
      visual.group.rotation.x = -0.17 + Math.sin(phase * 0.37) * 0.035 + visual.currentTiltX;
      visual.group.rotation.y =
        0.38 +
        phase * GLASS_VISUAL_CONFIG.cubeIdleRotationSpeed +
        visual.currentTiltY +
        visual.impulse * 0.1;
      visual.group.rotation.z = Math.sin(phase * 0.23) * 0.026;
    }
  }

  private renderOnce(): void {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;
    this.syncSlots();
    this.renderFrameContents(0);
    this.renderer.render(this.scene, this.camera);
    this.canvas.dataset.catalogCubeState = 'rendered';
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

  private disposeVisuals(): void {
    for (const visual of this.visuals) {
      visual.mixer?.stopAllAction();
      visual.mixer?.uncacheRoot(visual.modelRoot);
      this.scene?.remove(visual.group);
      visual.slot.removeAttribute('data-cube-model');
    }
    this.visuals = [];
  }

  private disposeGraphics(): void {
    this.disposeVisuals();
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
  }
}
