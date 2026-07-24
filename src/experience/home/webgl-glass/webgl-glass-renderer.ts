import {
  Color,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector4,
  WebGLRenderTarget,
  WebGLRenderer,
  type Intersection,
  type Object3D
} from 'three';
import {
  GLASS_CONFIG,
  GLASS_PANE_LIMIT,
  selectGlassQuality,
  type GlassQuality
} from './glass-config';
import { GlassSceneTextures } from './glass-scene-textures';
import { glassFragmentShader, glassVertexShader } from './glass-shaders';

export type GlassRendererStatus = 'webgl' | 'fallback' | 'destroyed';

interface WebGLGlassRendererOptions {
  readonly stage: HTMLElement;
  readonly glass: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly panes: readonly HTMLElement[];
  readonly backText: HTMLElement;
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
  private readonly panes: readonly HTMLElement[];
  private readonly backText: HTMLElement;
  private readonly reducedMotion: boolean;
  private readonly onStatusChange: (status: GlassRendererStatus) => void;
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  private readonly glassScene = new Scene();
  private readonly backdropScene = new Scene();
  private readonly raycaster = new Raycaster();
  private readonly pointerNdc = new Vector2();
  private readonly targetPointer = new Vector2(0.5, 0.5);
  private readonly currentPointer = new Vector2(0.5, 0.5);
  private readonly intersections: Intersection<Object3D>[] = [];
  private readonly trail = Array.from(
    { length: GLASS_CONFIG.trailLength },
    () => new Vector4(0.5, 0.5, 0, 0)
  );
  private readonly ripple = new Vector4(0.5, 0.5, -100, 0);
  private readonly paneRects = Array.from(
    { length: GLASS_PANE_LIMIT },
    () => new Vector4(-10, -10, 0, 0)
  );
  private readonly paneRotations = Array.from({ length: GLASS_PANE_LIMIT }, () => 0);

  private renderer?: WebGLRenderer;
  private renderTarget?: WebGLRenderTarget;
  private textures?: GlassSceneTextures;
  private glassMaterial?: ShaderMaterial;
  private backdropMaterial?: MeshBasicMaterial;
  private glassMesh?: Mesh<PlaneGeometry, ShaderMaterial>;
  private backdropMesh?: Mesh<PlaneGeometry, MeshBasicMaterial>;
  private listenerController?: AbortController;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private quality?: GlassQuality;
  private frameId?: number;
  private lastFrameTime = 0;
  private elapsedTime = 0;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastPointerTime = 0;
  private targetHover = 0;
  private currentHover = 0;
  private targetVelocity = 0;
  private currentVelocity = 0;
  private playRequested = false;
  private visible = false;
  private initialized = false;
  private destroyed = false;
  private contextLost = false;

  constructor(options: WebGLGlassRendererOptions) {
    this.stage = options.stage;
    this.glass = options.glass;
    this.canvas = options.canvas;
    this.panes = options.panes.slice(0, GLASS_PANE_LIMIT);
    this.backText = options.backText;
    this.reducedMotion = options.reducedMotion;
    this.onStatusChange = options.onStatusChange;
    this.camera.position.z = 2;
  }

  mount(): boolean {
    if (this.initialized || this.destroyed) return this.initialized;
    this.quality = selectGlassQuality(window.innerWidth, this.reducedMotion);
    const context = this.canvas.getContext('webgl2', {
      alpha: true,
      antialias: this.quality.antialias,
      depth: true,
      failIfMajorPerformanceCaveat: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: true
    });
    if (!context) {
      this.onStatusChange('fallback');
      return false;
    }

    try {
      this.renderer = new WebGLRenderer({
        canvas: this.canvas,
        context,
        alpha: true,
        antialias: this.quality.antialias,
        powerPreference: 'high-performance',
        premultipliedAlpha: true
      });
      this.renderer.outputColorSpace = SRGBColorSpace;
      this.renderer.setClearColor(new Color(0x000000), 0);
      this.textures = new GlassSceneTextures();
      this.createScenes();
      this.attachLifecycle();
      this.initialized = true;
      this.resize();
      this.renderOnce();
      this.onStatusChange('webgl');
      return true;
    } catch {
      this.disposeGraphics();
      this.onStatusChange('fallback');
      return false;
    }
  }

  play(): void {
    if (!this.initialized || this.destroyed || this.contextLost) return;
    this.playRequested = true;
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
    if (
      !this.initialized ||
      !this.renderer ||
      !this.renderTarget ||
      !this.textures ||
      !this.glassMaterial ||
      !this.glassMesh
    ) {
      return;
    }

    const bounds = this.glass.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const nextQuality = selectGlassQuality(window.innerWidth, this.reducedMotion);
    if (this.quality?.name !== nextQuality.name) {
      this.replaceGlassGeometry(nextQuality);
    }
    this.quality = nextQuality;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, nextQuality.pixelRatioLimit);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(bounds.width, bounds.height, false);
    const targetWidth = Math.max(
      1,
      Math.round(bounds.width * pixelRatio * nextQuality.renderScale)
    );
    const targetHeight = Math.max(
      1,
      Math.round(bounds.height * pixelRatio * nextQuality.renderScale)
    );
    this.renderTarget.setSize(targetWidth, targetHeight);
    this.textures.update(this.stage, this.glass, this.backText, targetWidth, targetHeight);
    this.glassMaterial.uniforms.uResolution!.value.set(bounds.width, bounds.height);
    this.glassMaterial.uniforms.uWaveStrength!.value =
      nextQuality.name === 'mobile'
        ? GLASS_CONFIG.mobileWaveStrength
        : GLASS_CONFIG.idleWaveStrength;
    this.updatePaneUniforms();
    this.canvas.dataset.glassQuality = nextQuality.name;
    this.renderBackdropTarget();
    this.renderOnce();
  }

  setTextRefractionEnabled(enabled: boolean): void {
    if (!this.glassMaterial) return;
    this.glassMaterial.uniforms.uTextMix!.value = enabled ? 1 : 0;
    this.renderOnce();
  }

  syncLayout(): void {
    if (!this.initialized || this.destroyed || this.contextLost) return;
    this.updatePaneUniforms();
    if (this.reducedMotion) {
      this.renderOnce();
    } else {
      this.scheduleFrame();
    }
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
    this.canvas.removeAttribute('data-glass-quality');
    this.canvas.removeAttribute('data-glass-render-state');
    this.canvas.removeAttribute('data-glass-contact');
    this.canvas.removeAttribute('data-glass-ripple');
    this.onStatusChange('destroyed');
    this.initialized = false;
  }

  private createScenes(): void {
    if (!this.renderer || !this.textures || !this.quality) return;
    this.renderTarget = new WebGLRenderTarget(1, 1, {
      depthBuffer: false,
      stencilBuffer: false
    });
    this.renderTarget.texture.colorSpace = SRGBColorSpace;
    this.renderTarget.texture.generateMipmaps = false;

    const backdropGeometry = new PlaneGeometry(2, 2);
    this.backdropMaterial = new MeshBasicMaterial({ map: this.textures.backdropTexture });
    this.backdropMesh = new Mesh(backdropGeometry, this.backdropMaterial);
    this.backdropScene.add(this.backdropMesh);

    this.glassMaterial = new ShaderMaterial({
      vertexShader: glassVertexShader,
      fragmentShader: glassFragmentShader,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uBackdropTexture: { value: this.renderTarget.texture },
        uTextTexture: { value: this.textures.textTexture },
        uResolution: { value: new Vector2(1, 1) },
        uPointer: { value: this.currentPointer },
        uTime: { value: 0 },
        uVelocity: { value: 0 },
        uHover: { value: 0 },
        uTextMix: { value: 0 },
        uRefractionStrength: { value: GLASS_CONFIG.refractionStrength },
        uChromaticAberration: { value: GLASS_CONFIG.chromaticAberration },
        uHoverRadius: { value: GLASS_CONFIG.hoverRadius },
        uGlowIntensity: { value: GLASS_CONFIG.glowIntensity },
        uRippleStrength: { value: GLASS_CONFIG.rippleStrength },
        uRoughness: { value: GLASS_CONFIG.roughness },
        uThickness: { value: GLASS_CONFIG.thickness },
        uEdgeBrightness: { value: GLASS_CONFIG.edgeBrightness },
        uWaveStrength: { value: GLASS_CONFIG.idleWaveStrength },
        uCurvature: { value: 0.018 },
        uPaneRadius: { value: 0.018 },
        uPaneRects: { value: this.paneRects },
        uPaneRotations: { value: this.paneRotations },
        uRipple: { value: this.ripple },
        uTrail: { value: this.trail }
      }
    });
    this.glassMesh = new Mesh(
      new PlaneGeometry(2, 2, this.quality.widthSegments, this.quality.heightSegments),
      this.glassMaterial
    );
    this.glassScene.add(this.glassMesh);
  }

  private replaceGlassGeometry(quality: GlassQuality): void {
    if (!this.glassMesh) return;
    const previousGeometry = this.glassMesh.geometry;
    this.glassMesh.geometry = new PlaneGeometry(
      2,
      2,
      quality.widthSegments,
      quality.heightSegments
    );
    previousGeometry.dispose();
  }

  private attachLifecycle(): void {
    this.listenerController = new AbortController();
    const listenerOptions = {
      passive: true,
      signal: this.listenerController.signal
    } as const;
    if (!this.reducedMotion) {
      this.stage.addEventListener('pointerenter', this.handlePointerEnter, listenerOptions);
      this.stage.addEventListener('pointermove', this.handlePointerMove, listenerOptions);
      this.stage.addEventListener('pointerleave', this.handlePointerLeave, listenerOptions);
      this.stage.addEventListener('pointerdown', this.handlePointerDown, listenerOptions);
      this.stage.addEventListener('pointerup', this.handlePointerUp, listenerOptions);
      this.stage.addEventListener('pointercancel', this.handlePointerUp, listenerOptions);
    }
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost, {
      signal: this.listenerController.signal
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.glass);
    this.intersectionObserver = new IntersectionObserver(this.handleIntersection, {
      rootMargin: '18% 0px',
      threshold: 0.01
    });
    this.intersectionObserver.observe(this.stage);
    const bounds = this.stage.getBoundingClientRect();
    this.visible = bounds.bottom > 0 && bounds.top < window.innerHeight;
  }

  private readonly handleIntersection: IntersectionObserverCallback = (entries): void => {
    const entry = entries[0];
    this.visible = Boolean(entry?.isIntersecting);
    if (this.visible && this.playRequested) {
      this.scheduleFrame();
    } else {
      this.cancelFrame();
    }
  };

  private readonly handlePointerEnter = (event: PointerEvent): void => {
    const hit = this.resolvePointer(event);
    this.setContactState(hit);
    if (hit) this.targetHover = 1;
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const hit = this.resolvePointer(event);
    this.setContactState(hit);
    this.targetHover = hit ? 1 : 0;
    const elapsed = event.timeStamp - this.lastPointerTime;
    if (this.lastPointerTime > 0 && elapsed > 0) {
      const distance = Math.hypot(
        event.clientX - this.lastPointerX,
        event.clientY - this.lastPointerY
      );
      this.targetVelocity = clamp(distance / elapsed / GLASS_CONFIG.maximumPointerSpeed, 0, 1);
    }
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.lastPointerTime = event.timeStamp;
    if (hit && this.playRequested) this.scheduleFrame();
  };

  private readonly handlePointerLeave = (): void => {
    this.setContactState(false);
    this.targetHover = 0;
    this.targetVelocity = 0;
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!this.resolvePointer(event)) return;
    this.ripple.set(
      this.targetPointer.x,
      this.targetPointer.y,
      this.elapsedTime,
      event.pointerType === 'touch' ? 0.65 : 0.48
    );
    this.canvas.dataset.glassRipple = 'active';
    this.targetHover = 1;
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerType !== 'mouse') {
      this.setContactState(false);
      this.targetHover = 0;
      this.targetVelocity = 0;
    }
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    if (this.destroyed) return;
    this.contextLost = true;
    this.pause();
    this.onStatusChange('fallback');
  };

  private resolvePointer(event: PointerEvent): boolean {
    if (!this.glassMesh) return false;
    const bounds = this.glass.getBoundingClientRect();
    const paneHit = this.panes.some((pane) =>
      this.isPointInsidePane(pane, event.clientX, event.clientY)
    );
    if (!paneHit) {
      return false;
    }

    this.pointerNdc.set(
      ((event.clientX - bounds.left) / Math.max(bounds.width, 1)) * 2 - 1,
      -((event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    this.intersections.length = 0;
    this.raycaster.intersectObject(this.glassMesh, false, this.intersections);
    const uv = this.intersections[0]?.uv;
    if (!uv) return false;
    this.targetPointer.copy(uv);
    return true;
  }

  private isPointInsidePane(pane: HTMLElement, clientX: number, clientY: number): boolean {
    const style = getComputedStyle(pane);
    if (Number.parseFloat(style.opacity) <= 0.02) return false;
    const rect = pane.getBoundingClientRect();
    return (
      clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    );
  }

  private updatePaneUniforms(): void {
    if (!this.glassMaterial) return;
    const bounds = this.glass.getBoundingClientRect();
    const width = Math.max(bounds.width, 1);
    const height = Math.max(bounds.height, 1);
    for (let index = 0; index < GLASS_PANE_LIMIT; index += 1) {
      const pane = this.panes[index];
      const target = this.paneRects[index];
      if (!target) continue;
      if (!pane) {
        target.set(-10, -10, 0, 0);
        this.paneRotations[index] = 0;
        continue;
      }
      const rect = pane.getBoundingClientRect();
      const scale = Math.max(this.readPaneProperty(pane, '--pane-scale', 1), 0.01);
      target.set(
        (rect.left + rect.width / 2 - bounds.left) / width,
        1 - (rect.top + rect.height / 2 - bounds.top) / height,
        (pane.offsetWidth * scale) / width / 2,
        (pane.offsetHeight * scale) / height / 2
      );
      this.paneRotations[index] = 0;
    }
    this.glassMaterial.uniforms.uPaneRadius!.value = Math.min(18 / height, 0.032);
    this.glassMaterial.uniformsNeedUpdate = true;
  }

  private readPaneProperty(pane: HTMLElement, property: string, fallback = 0): number {
    const value = Number.parseFloat(getComputedStyle(pane).getPropertyValue(property));
    return Number.isFinite(value) ? value : fallback;
  }

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
    if (!this.renderer || !this.glassMaterial) return;
    const deltaSeconds = this.lastFrameTime
      ? clamp((timestamp - this.lastFrameTime) / 1000, 1 / 120, 0.05)
      : 1 / 60;
    this.lastFrameTime = timestamp;
    if (!this.reducedMotion) this.elapsedTime += deltaSeconds;
    const pointerBlend = 1 - Math.exp(-GLASS_CONFIG.pointerDamping * deltaSeconds);
    this.currentPointer.lerp(this.targetPointer, pointerBlend);
    this.currentHover = damp(
      this.currentHover,
      this.targetHover,
      GLASS_CONFIG.hoverDamping,
      deltaSeconds
    );
    this.targetVelocity *= Math.exp(-5.2 * deltaSeconds);
    this.currentVelocity = damp(
      this.currentVelocity,
      this.targetVelocity,
      GLASS_CONFIG.velocityDamping,
      deltaSeconds
    );

    const lead = this.trail[0];
    if (lead) {
      lead.x = damp(lead.x, this.currentPointer.x, GLASS_CONFIG.trailDamping, deltaSeconds);
      lead.y = damp(lead.y, this.currentPointer.y, GLASS_CONFIG.trailDamping, deltaSeconds);
      lead.z = damp(
        lead.z,
        this.currentHover * (0.2 + this.currentVelocity * 0.8),
        GLASS_CONFIG.trailDamping,
        deltaSeconds
      );
    }
    for (let index = 1; index < this.trail.length; index += 1) {
      const point = this.trail[index];
      const previous = this.trail[index - 1];
      if (!point || !previous) continue;
      const damping = GLASS_CONFIG.trailDamping / (1 + index * 0.42);
      point.x = damp(point.x, previous.x, damping, deltaSeconds);
      point.y = damp(point.y, previous.y, damping, deltaSeconds);
      point.z = damp(point.z, previous.z, damping, deltaSeconds);
    }

    this.glassMaterial.uniforms.uTime!.value = this.elapsedTime;
    this.glassMaterial.uniforms.uVelocity!.value = this.currentVelocity;
    this.glassMaterial.uniforms.uHover!.value = this.currentHover;
    this.renderer.setRenderTarget(null);
    this.renderer.clear();
    this.renderer.render(this.glassScene, this.camera);
    this.canvas.dataset.glassRenderState = 'rendered';
  }

  private setContactState(active: boolean): void {
    const nextState = active ? 'active' : 'idle';
    if (this.canvas.dataset.glassContact !== nextState) {
      this.canvas.dataset.glassContact = nextState;
    }
  }

  private renderBackdropTarget(): void {
    if (!this.renderer || !this.renderTarget) return;
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.setClearColor(new Color(0x000000), 1);
    this.renderer.clear();
    this.renderer.render(this.backdropScene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.setClearColor(new Color(0x000000), 0);
  }

  private renderOnce(): void {
    if (!this.initialized || this.destroyed || this.contextLost) return;
    const timestamp = performance.now();
    this.render(timestamp);
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
    if (this.frameId === undefined) return;
    window.cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
    this.lastFrameTime = 0;
  }

  private disposeGraphics(): void {
    this.glassMesh?.geometry.dispose();
    this.backdropMesh?.geometry.dispose();
    this.glassMaterial?.dispose();
    this.backdropMaterial?.dispose();
    this.renderTarget?.dispose();
    this.textures?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }
    this.glassScene.clear();
    this.backdropScene.clear();
    this.glassMesh = undefined;
    this.backdropMesh = undefined;
    this.glassMaterial = undefined;
    this.backdropMaterial = undefined;
    this.renderTarget = undefined;
    this.textures = undefined;
    this.renderer = undefined;
  }
}
