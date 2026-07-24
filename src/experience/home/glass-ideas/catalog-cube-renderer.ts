import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  WebGLRenderer
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createPremiumGlassMaterial,
  GLASS_IDEA_PALETTE,
  GLASS_VISUAL_CONFIG,
  selectGlassPixelRatio
} from './glass-visual-config';

interface CubeVisual {
  readonly slot: HTMLElement;
  readonly card: HTMLElement;
  readonly group: Group;
  readonly glass: Mesh<BoxGeometry, ReturnType<typeof createPremiumGlassMaterial>>;
  readonly wire: Mesh<BoxGeometry, MeshBasicMaterial>;
  readonly core: Mesh<IcosahedronGeometry, MeshBasicMaterial>;
  readonly halo: Mesh<SphereGeometry, MeshBasicMaterial>;
  readonly orbit: Mesh<TorusGeometry, MeshBasicMaterial>;
  readonly variant: number;
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

export class CatalogCubeRenderer {
  private readonly root: HTMLElement;
  private readonly viewport: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly reducedMotion: boolean;
  private renderer?: WebGLRenderer;
  private scene?: Scene;
  private camera?: OrthographicCamera;
  private environmentTexture?: ReturnType<PMREMGenerator['fromScene']>['texture'];
  private cubeGeometry?: BoxGeometry;
  private coreGeometry?: IcosahedronGeometry;
  private haloGeometry?: SphereGeometry;
  private orbitGeometry?: TorusGeometry;
  private visuals: CubeVisual[] = [];
  private listenerController?: AbortController;
  private intersectionObserver?: IntersectionObserver;
  private resizeObserver?: ResizeObserver;
  private frameId?: number;
  private lastFrameTime = 0;
  private lastRenderedTime = 0;
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

  mount(): boolean {
    if (this.mounted || this.destroyed) return this.mounted;
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
      this.renderer.toneMappingExposure = 1.12;
      this.renderer.setClearColor(0x000000, 0);
      this.scene = new Scene();
      this.camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
      this.camera.position.z = 1000;
      this.createEnvironment();
      this.createSharedGeometry();
      this.createLights();
      this.attachLifecycle();
      this.mounted = true;
      this.syncSlots();
      this.resize();
      this.renderFrameContents(0);
      this.renderer.render(this.scene, this.camera);
      this.root.dataset.catalogCubeRenderer = 'webgl';
      this.canvas.dataset.catalogCubeState = 'rendered';
      return true;
    } catch {
      this.disposeGraphics();
      this.root.dataset.catalogCubeRenderer = 'fallback';
      return false;
    }
  }

  play(): void {
    this.playRequested = true;
    if (!this.mounted || this.destroyed) return;
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
    if (!this.scene || !this.cubeGeometry || !this.coreGeometry || !this.haloGeometry) return;
    const slots = [...this.root.querySelectorAll<HTMLElement>('[data-cube-slot]')].slice(0, 28);
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
    this.mounted = false;
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

  private createSharedGeometry(): void {
    this.cubeGeometry = new BoxGeometry(1, 1, 1, 4, 4, 4);
    this.coreGeometry = new IcosahedronGeometry(0.23, 1);
    this.haloGeometry = new SphereGeometry(0.42, 18, 12);
    this.orbitGeometry = new TorusGeometry(0.35, 0.012, 8, 42);
  }

  private createLights(): void {
    if (!this.scene) return;
    this.scene.add(new AmbientLight(0xc9ddff, 1.7));
    const key = new DirectionalLight(0xffe5cc, 5.2);
    key.position.set(260, 360, 520);
    const rim = new DirectionalLight(0x6990ff, 5.8);
    rim.position.set(-320, 120, 420);
    this.scene.add(key, rim);
  }

  private createVisual(slot: HTMLElement, index: number): CubeVisual {
    const card = slot.closest<HTMLElement>('[data-cube-card]') ?? slot;
    const variant = Number.parseInt(slot.dataset.cubeVariant ?? String(index), 10) || 0;
    const accent =
      slot.dataset.cubeAccent ??
      GLASS_IDEA_PALETTE[variant % GLASS_IDEA_PALETTE.length] ??
      GLASS_IDEA_PALETTE[0];
    const glassMaterial = createPremiumGlassMaterial(accent, 0.78);
    const wireMaterial = new MeshBasicMaterial({
      color: new Color(accent).lerp(new Color(0xffffff), 0.55),
      wireframe: true,
      transparent: true,
      opacity: 0.1,
      depthWrite: false
    });
    const coreMaterial = new MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.78,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const haloMaterial = new MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.1,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const orbitMaterial = new MeshBasicMaterial({
      color: new Color(accent).lerp(new Color(0xffffff), 0.35),
      transparent: true,
      opacity: 0.32,
      blending: AdditiveBlending,
      depthWrite: false
    });
    const group = new Group();
    const glass = new Mesh(this.cubeGeometry!, glassMaterial);
    const wire = new Mesh(this.cubeGeometry!, wireMaterial);
    wire.scale.setScalar(1.012);
    const core = new Mesh(this.coreGeometry!, coreMaterial);
    const halo = new Mesh(this.haloGeometry!, haloMaterial);
    const orbit = new Mesh(this.orbitGeometry!, orbitMaterial);
    orbit.rotation.x = Math.PI / 2;
    group.add(halo, orbit, core, glass, wire);
    this.scene!.add(group);
    return {
      slot,
      card,
      group,
      glass,
      wire,
      core,
      halo,
      orbit,
      variant,
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
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, { signal });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.intersectionObserver = new IntersectionObserver(this.handleIntersection, {
      rootMargin: '15% 0px',
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
      ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 0.72,
      -0.36,
      0.36
    );
    visual.targetTiltX = clamp(
      -((event.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 0.58,
      -0.29,
      0.29
    );
    visual.targetLift = 10;
    visual.targetEnergy = 1;
  };

  private readonly handlePointerLeave = (): void => {
    const focusedCard =
      document.activeElement instanceof Element
        ? document.activeElement.closest<HTMLElement>('[data-cube-card]')
        : undefined;
    this.setActiveCard(focusedCard ?? undefined);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    const target = event.target;
    const card =
      target instanceof Element ? target.closest<HTMLElement>('[data-cube-card]') : undefined;
    const visual = this.visuals.find((candidate) => candidate.card === card);
    if (!visual) return;
    visual.impulse = 1;
    this.canvas.dataset.catalogCubePulse = 'active';
  };

  private readonly handleFocusIn = (event: FocusEvent): void => {
    const target = event.target;
    const card =
      target instanceof Element ? target.closest<HTMLElement>('[data-cube-card]') : undefined;
    this.setActiveCard(card ?? undefined);
  };

  private readonly handleFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget;
    const card =
      next instanceof Element ? next.closest<HTMLElement>('[data-cube-card]') : undefined;
    this.setActiveCard(card ?? undefined);
  };

  private readonly handleViewportScroll = (): void => {
    if (this.reducedMotion) this.renderOnce();
  };

  private readonly handleIntersection: IntersectionObserverCallback = (entries): void => {
    this.visible = Boolean(entries[0]?.isIntersecting);
    if (this.visible && this.playRequested) {
      if (this.reducedMotion) this.renderOnce();
      else this.scheduleFrame();
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
      visual.targetLift = active ? 10 : 0;
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
    const minimumFrameDuration = 1000 / GLASS_VISUAL_CONFIG.catalogFramesPerSecond;
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
    this.scheduleFrame();
  };

  private renderFrameContents(deltaSeconds: number): void {
    if (!this.camera) return;
    const viewportBounds = this.viewport.getBoundingClientRect();
    const dampingSeconds = deltaSeconds || 1 / 60;
    for (const visual of this.visuals) {
      const bounds = visual.slot.getBoundingClientRect();
      const visible =
        bounds.right > viewportBounds.left - 80 &&
        bounds.left < viewportBounds.right + 80 &&
        bounds.bottom > viewportBounds.top &&
        bounds.top < viewportBounds.bottom;
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

      const centerX = bounds.left + bounds.width / 2 - viewportBounds.left;
      const centerY = bounds.top + bounds.height / 2 - viewportBounds.top;
      const size = Math.min(bounds.width, bounds.height) * (window.innerWidth <= 736 ? 0.48 : 0.52);
      visual.group.position.set(
        centerX - viewportBounds.width / 2,
        viewportBounds.height / 2 - centerY + visual.currentLift,
        visual.currentLift * 1.8
      );
      const hoverScale = 1 + visual.currentEnergy * 0.055 - visual.impulse * 0.035;
      visual.group.scale.setScalar(size * hoverScale);

      const phase = this.elapsedTime * (0.72 + (visual.variant % 3) * 0.07) + visual.variant * 1.7;
      visual.group.rotation.x = -0.32 + Math.sin(phase * 0.37) * 0.07 + visual.currentTiltX;
      visual.group.rotation.y =
        0.58 +
        phase * GLASS_VISUAL_CONFIG.cubeIdleRotationSpeed +
        visual.currentTiltY +
        visual.impulse * 0.16;
      visual.group.rotation.z = Math.sin(phase * 0.23) * 0.045;

      const pulse =
        0.78 +
        Math.sin(phase * (1.25 + (visual.variant % 4) * 0.16)) * 0.12 +
        visual.currentEnergy * 0.17 +
        visual.impulse * 0.3;
      const variantX = visual.variant % 2 === 0 ? 1 + Math.sin(phase) * 0.18 : 0.88;
      const variantY = visual.variant % 3 === 0 ? 0.82 : 1 + Math.cos(phase * 0.83) * 0.13;
      visual.core.scale.set(pulse * variantX, pulse * variantY, pulse);
      visual.core.rotation.x = -phase * 0.31;
      visual.core.rotation.y = phase * 0.46;
      visual.halo.scale.setScalar(1 + pulse * 0.22);
      visual.orbit.rotation.x = phase * 0.29;
      visual.orbit.rotation.y = Math.PI / 2 + phase * 0.2;
      visual.orbit.rotation.z = phase * 0.17;
      visual.core.material.opacity = 0.62 + visual.currentEnergy * 0.28;
      visual.halo.material.opacity = 0.075 + visual.currentEnergy * 0.13 + visual.impulse * 0.12;
      visual.orbit.material.opacity = 0.18 + visual.currentEnergy * 0.28;
      visual.wire.material.opacity = 0.075 + visual.currentEnergy * 0.09;
      visual.glass.material.emissiveIntensity = 0.38 + visual.currentEnergy * 0.75;
    }
  }

  private renderOnce(): void {
    if (!this.renderer || !this.scene || !this.camera || this.destroyed) return;
    this.syncSlots();
    this.renderFrameContents(1 / 60);
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
    if (this.frameId === undefined) return;
    window.cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
    this.lastFrameTime = 0;
    this.lastRenderedTime = 0;
  }

  private disposeVisuals(): void {
    for (const visual of this.visuals) {
      this.scene?.remove(visual.group);
      visual.glass.material.dispose();
      visual.wire.material.dispose();
      visual.core.material.dispose();
      visual.halo.material.dispose();
      visual.orbit.material.dispose();
    }
    this.visuals = [];
  }

  private disposeGraphics(): void {
    this.disposeVisuals();
    this.cubeGeometry?.dispose();
    this.coreGeometry?.dispose();
    this.haloGeometry?.dispose();
    this.orbitGeometry?.dispose();
    this.environmentTexture?.dispose();
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
