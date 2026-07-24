import type { Experience, ExperienceContext } from '@experience/core/experience';
import { WebGLGlassRenderer, type GlassRendererStatus } from './webgl-glass/webgl-glass-renderer';

interface Point {
  readonly x: number;
  readonly y: number;
}

interface MutablePoint {
  x: number;
  y: number;
}

interface StageBounds {
  pageLeft: number;
  pageTop: number;
  width: number;
  height: number;
}

interface PaneMotion {
  readonly element: HTMLElement;
  readonly driftX: number;
  readonly driftY: number;
  readonly scrollStart: number;
}

const initialBounds: StageBounds = { pageLeft: 0, pageTop: 0, width: 1, height: 1 };

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const damp = (current: number, target: number, lambda: number, deltaSeconds: number): number =>
  target + (current - target) * Math.exp(-lambda * deltaSeconds);

const smoothstep = (value: number): number => value * value * (3 - 2 * value);

const readNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizePointerSpeed = (
  distancePixels: number,
  elapsedMilliseconds: number,
  referenceSpeed = 1.5
): number => {
  if (elapsedMilliseconds <= 0 || referenceSpeed <= 0) return 0;
  return clamp(distancePixels / elapsedMilliseconds / referenceSpeed, 0, 1);
};

export const calculatePointerAttraction = (
  textCenter: Point,
  pointer: Point,
  falloffDistance: number,
  maximumOffset: number
): Point => {
  const deltaX = pointer.x - textCenter.x;
  const deltaY = pointer.y - textCenter.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (falloffDistance <= 0 || maximumOffset <= 0) {
    return { x: 0, y: 0 };
  }
  const normalizedDistance = distance / falloffDistance;
  const falloff = 1 / (1 + 2.5 * normalizedDistance * normalizedDistance);
  const softeningDistance = Math.max(12, falloffDistance * 0.06);
  const directionScale = 1 / Math.hypot(distance, softeningDistance);
  const offsetScale = maximumOffset * falloff * directionScale;
  return {
    x: deltaX * offsetScale,
    y: deltaY * offsetScale
  };
};

export const calculateShowcaseScrollProgress = (
  sceneTop: number,
  sceneHeight: number,
  viewportHeight: number
): number => {
  const travel = sceneHeight - viewportHeight;
  if (travel <= 0) return 0;
  return clamp(-sceneTop / travel, 0, 1);
};

export class HomeShowcaseExperience implements Experience {
  private root?: HTMLElement;
  private stage?: HTMLElement;
  private scrollScene?: HTMLElement;
  private frontText?: HTMLElement;
  private glass?: HTMLElement;
  private sheens: HTMLElement[] = [];
  private panes: PaneMotion[] = [];
  private activePane?: HTMLElement;
  private glassRenderer?: WebGLGlassRenderer;
  private listenerController?: AbortController;
  private introAnimations: Animation[] = [];
  private animationGeneration = 0;
  private frameId?: number;
  private bounds: StageBounds = initialBounds;
  private textCenter: Point = { x: 0, y: 0 };
  private targetPointer: MutablePoint = { x: 0, y: 0 };
  private currentPointer: MutablePoint = { x: 0, y: 0 };
  private currentAttraction: MutablePoint = { x: 0, y: 0 };
  private currentRotation: MutablePoint = { x: 0, y: 0 };
  private targetSpeed = 0;
  private currentSpeed = 0;
  private currentLightOpacity = 0;
  private targetScrollProgress = 0;
  private currentScrollProgress = 0;
  private lastPointer: Point = { x: 0, y: 0 };
  private lastPointerTime = 0;
  private lastFrameTime = 0;
  private mounted = false;
  private paused = false;
  private pointerInside = false;
  private interactionEnabled = false;
  private introComplete = false;
  private pointerCapable = false;
  private reducedMotion = false;
  private needsMeasure = false;
  private scrollInitialized = false;

  mount(context: ExperienceContext): void {
    if (this.mounted) return;

    const stage = context.root.querySelector<HTMLElement>('[data-showcase-stage]');
    const scrollScene = context.root.querySelector<HTMLElement>('[data-showcase-scroll-scene]');
    const backText = context.root.querySelector<HTMLElement>('[data-showcase-back-text]');
    const frontText = context.root.querySelector<HTMLElement>('[data-showcase-front-text]');
    const glass = context.root.querySelector<HTMLElement>('[data-showcase-glass]');
    const glassCanvas = context.root.querySelector<HTMLCanvasElement>(
      '[data-showcase-glass-canvas]'
    );
    const pointerLight = context.root.querySelector<HTMLElement>('[data-showcase-pointer-light]');
    const paneElements = [...context.root.querySelectorAll<HTMLElement>('[data-showcase-pane]')];
    const sheens = [...context.root.querySelectorAll<HTMLElement>('[data-showcase-sheen]')];
    if (
      !stage ||
      !scrollScene ||
      !backText ||
      !frontText ||
      !glass ||
      !glassCanvas ||
      !pointerLight ||
      paneElements.length === 0 ||
      sheens.length === 0
    ) {
      throw new Error('La struttura della vetrina homepage è incompleta.');
    }

    this.root = context.root;
    this.stage = stage;
    this.scrollScene = scrollScene;
    this.frontText = frontText;
    this.glass = glass;
    this.sheens = sheens;
    this.panes = paneElements.map((element) => ({
      element,
      driftX: readNumber(element.dataset.paneDriftX, 0),
      driftY: readNumber(element.dataset.paneDriftY, -1),
      scrollStart: clamp(readNumber(element.dataset.paneScrollStart, 0), 0, 0.7)
    }));
    this.reducedMotion = context.reducedMotion;
    this.pointerCapable =
      !context.reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    this.mounted = true;
    this.paused = false;
    this.listenerController = new AbortController();
    const listenerOptions = { passive: true, signal: this.listenerController.signal } as const;

    if (this.pointerCapable) {
      stage.addEventListener('pointerenter', this.handlePointerEnter, listenerOptions);
      stage.addEventListener('pointermove', this.handlePointerMove, listenerOptions);
      stage.addEventListener('pointerleave', this.handlePointerLeave, listenerOptions);
    }
    if (!this.reducedMotion) {
      window.addEventListener('scroll', this.handleScroll, listenerOptions);
    }
    window.addEventListener('resize', this.handleResize, listenerOptions);
    document.addEventListener('visibilitychange', this.handleVisibilityChange, {
      signal: this.listenerController.signal
    });

    context.root.dataset.showcaseState = 'mounted';
    context.root.dataset.showcaseMode = context.reducedMotion
      ? 'reduced'
      : this.pointerCapable
        ? 'interactive'
        : 'static';

    const glassRenderer = new WebGLGlassRenderer({
      stage,
      glass,
      canvas: glassCanvas,
      panes: paneElements,
      backText,
      reducedMotion: context.reducedMotion,
      onStatusChange: this.handleGlassStatusChange
    });
    this.glassRenderer = glassRenderer.mount() ? glassRenderer : undefined;
    if (this.glassRenderer && context.root.dataset.showcaseGlassRenderer === 'webgl') {
      this.glassRenderer.setTextRefractionEnabled(true);
      context.root.dataset.showcaseGlassText = 'webgl';
    }
    this.resize();
  }

  play(): void {
    if (!this.mounted || !this.root) return;
    this.paused = false;
    this.glassRenderer?.play();

    if (this.introAnimations.length > 0) {
      this.introAnimations.forEach((animation) => animation.play());
      this.root.dataset.showcaseState = 'entering';
      return;
    }
    if (this.introComplete) {
      this.enableFinalState();
      this.scheduleFrame();
      return;
    }
    if (this.reducedMotion) {
      this.introComplete = true;
      this.interactionEnabled = false;
      this.activateRefractedText();
      this.root.dataset.showcaseState = 'reduced';
      return;
    }

    this.startEntrance();
  }

  pause(): void {
    if (!this.mounted || !this.root) return;
    this.paused = true;
    this.interactionEnabled = false;
    this.pointerInside = false;
    this.targetSpeed = 0;
    this.clearActivePane();
    this.introAnimations.forEach((animation) => animation.pause());
    this.cancelFrame();
    this.glassRenderer?.pause();
    this.resetDynamicStyles();
    this.root.dataset.showcaseState = 'paused';
  }

  resize(): void {
    if (!this.mounted || !this.stage || !this.frontText) return;
    const stageRect = this.stage.getBoundingClientRect();
    this.bounds = {
      pageLeft: stageRect.left,
      pageTop: stageRect.top,
      width: Math.max(stageRect.width, 1),
      height: Math.max(stageRect.height, 1)
    };
    this.measureTextCenter();
    if (!this.pointerInside) {
      this.targetPointer = { x: this.bounds.width / 2, y: this.bounds.height / 2 };
      this.currentPointer = { ...this.targetPointer };
    }
    this.targetScrollProgress = this.readScrollProgress();
    if (!this.scrollInitialized) {
      this.currentScrollProgress = this.targetScrollProgress;
      this.scrollInitialized = true;
    }
    this.writeScrollStyles();
    this.needsMeasure = false;
    this.glassRenderer?.resize();
    this.glassRenderer?.syncLayout();
  }

  destroy(): void {
    if (!this.mounted) return;
    this.animationGeneration += 1;
    this.listenerController?.abort();
    this.listenerController = undefined;
    this.cancelFrame();
    this.cancelIntroAnimations();
    this.clearActivePane();
    this.glassRenderer?.destroy();
    this.glassRenderer = undefined;
    this.resetDynamicStyles();
    this.resetScrollStyles();
    if (this.root) {
      this.root.dataset.showcaseState = 'destroyed';
      delete this.root.dataset.showcaseMode;
      delete this.root.dataset.showcaseGlassRenderer;
      delete this.root.dataset.showcaseGlassText;
      delete this.root.dataset.showcaseScrollProgress;
    }
    this.mounted = false;
    this.paused = false;
    this.pointerInside = false;
    this.interactionEnabled = false;
    this.scrollInitialized = false;
  }

  private readonly handlePointerEnter = (event: PointerEvent): void => {
    this.pointerInside = true;
    this.updatePointerTarget(event);
    this.updateActivePane(event);
    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.lastPointerTime = event.timeStamp;
    if (this.interactionEnabled) this.scheduleFrame();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const wasInside = this.pointerInside;
    this.pointerInside = true;
    this.updatePointerTarget(event);
    this.updateActivePane(event);

    if (this.interactionEnabled && wasInside && this.lastPointerTime > 0) {
      const elapsed = event.timeStamp - this.lastPointerTime;
      const distance = Math.hypot(
        event.clientX - this.lastPointer.x,
        event.clientY - this.lastPointer.y
      );
      this.targetSpeed = normalizePointerSpeed(distance, elapsed);
    } else {
      this.targetSpeed = 0;
    }

    this.lastPointer = { x: event.clientX, y: event.clientY };
    this.lastPointerTime = event.timeStamp;
    if (this.interactionEnabled) this.scheduleFrame();
  };

  private readonly handlePointerLeave = (): void => {
    this.pointerInside = false;
    this.targetSpeed = 0;
    this.clearActivePane();
    if (this.interactionEnabled) this.scheduleFrame();
  };

  private readonly handleScroll = (): void => {
    this.targetScrollProgress = this.readScrollProgress();
    this.clearActivePane();
    this.scheduleFrame();
  };

  private readonly handleResize = (): void => {
    this.needsMeasure = true;
    this.scheduleFrame();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) this.pause();
    else this.play();
  };

  private readonly renderFrame = (timestamp: number): void => {
    this.frameId = undefined;
    if (!this.mounted || this.paused) return;
    if (this.needsMeasure) this.resize();

    const deltaSeconds = this.lastFrameTime
      ? clamp((timestamp - this.lastFrameTime) / 1000, 1 / 120, 0.05)
      : 1 / 60;
    this.lastFrameTime = timestamp;

    let scrollPending = false;
    if (!this.reducedMotion) {
      this.targetScrollProgress = this.readScrollProgress();
      const previousProgress = this.currentScrollProgress;
      this.currentScrollProgress = damp(
        this.currentScrollProgress,
        this.targetScrollProgress,
        12,
        deltaSeconds
      );
      if (Math.abs(this.currentScrollProgress - this.targetScrollProgress) < 0.0004) {
        this.currentScrollProgress = this.targetScrollProgress;
      }
      const scrollChanged = Math.abs(previousProgress - this.currentScrollProgress) > 0.00001;
      if (scrollChanged) {
        this.writeScrollStyles();
        this.measureTextCenter();
        this.glassRenderer?.syncLayout();
      }
      scrollPending = Math.abs(this.currentScrollProgress - this.targetScrollProgress) >= 0.0004;
    }

    let pointerPending = false;
    if (this.interactionEnabled && this.root) {
      this.targetSpeed *= Math.exp(-5.5 * deltaSeconds);
      this.currentSpeed = damp(this.currentSpeed, this.targetSpeed, 9, deltaSeconds);
      this.currentPointer.x = damp(this.currentPointer.x, this.targetPointer.x, 15, deltaSeconds);
      this.currentPointer.y = damp(this.currentPointer.y, this.targetPointer.y, 15, deltaSeconds);

      const targetLightOpacity = this.pointerInside ? 0.18 + this.currentSpeed * 0.42 : 0;
      this.currentLightOpacity = damp(
        this.currentLightOpacity,
        targetLightOpacity,
        10,
        deltaSeconds
      );

      const compact = this.bounds.width <= 1024;
      const pointerViewport = {
        x: this.bounds.pageLeft + this.currentPointer.x,
        y: this.bounds.pageTop + this.currentPointer.y
      };
      const targetAttraction = this.pointerInside
        ? calculatePointerAttraction(
            this.textCenter,
            pointerViewport,
            compact ? 320 : 420,
            compact ? 10 : 16
          )
        : { x: 0, y: 0 };
      this.currentAttraction.x = damp(
        this.currentAttraction.x,
        targetAttraction.x,
        9,
        deltaSeconds
      );
      this.currentAttraction.y = damp(
        this.currentAttraction.y,
        targetAttraction.y,
        9,
        deltaSeconds
      );

      const normalizedX = (this.currentPointer.x / this.bounds.width - 0.5) * 2;
      const normalizedY = (this.currentPointer.y / this.bounds.height - 0.5) * 2;
      const targetRotation = this.pointerInside
        ? {
            x: -normalizedY * (compact ? 0.35 : 0.8),
            y: normalizedX * (compact ? 0.5 : 1.2)
          }
        : { x: 0, y: 0 };
      this.currentRotation.x = damp(this.currentRotation.x, targetRotation.x, 8, deltaSeconds);
      this.currentRotation.y = damp(this.currentRotation.y, targetRotation.y, 8, deltaSeconds);

      this.writeDynamicStyles();
      pointerPending = !this.isSettled(targetLightOpacity, targetAttraction, targetRotation);
      if (!pointerPending && !this.pointerInside) this.resetDynamicStyles();
    }

    if (scrollPending || pointerPending) {
      this.scheduleFrame();
    } else {
      this.lastFrameTime = 0;
    }
  };

  private startEntrance(): void {
    if (!this.root || !this.glass || !this.frontText || this.sheens.length === 0) {
      return;
    }
    const generation = ++this.animationGeneration;
    this.root.dataset.showcaseState = 'entering';
    this.interactionEnabled = false;

    this.introAnimations = [
      this.glass.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 720,
        easing: 'cubic-bezier(0.2, 0.75, 0.2, 1)',
        fill: 'both'
      }),
      ...this.sheens.map((sheen, index) =>
        sheen.animate(
          [
            { opacity: 0, transform: 'translate3d(-30%, 0, 0) skewX(-14deg)' },
            { opacity: 0.68, offset: 0.32 },
            { opacity: 0, transform: 'translate3d(540%, 0, 0) skewX(-14deg)' }
          ],
          {
            duration: 880,
            delay: 260 + index * 65,
            easing: 'ease-in-out',
            fill: 'both'
          }
        )
      ),
      this.frontText.animate(
        [
          { opacity: 0, transform: 'translate3d(0, 26px, 0)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ],
        {
          duration: 760,
          delay: 720,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'both'
        }
      )
    ];

    void Promise.all(this.introAnimations.map((animation) => animation.finished.catch(() => null)))
      .then(() => {
        if (!this.mounted || generation !== this.animationGeneration) return;
        this.cancelIntroAnimations();
        this.introComplete = true;
        if (!this.paused) this.enableFinalState();
      })
      .catch(() => undefined);
  }

  private enableFinalState(): void {
    if (!this.root) return;
    this.interactionEnabled = this.pointerCapable;
    this.activateRefractedText();
    this.root.dataset.showcaseState = this.pointerCapable ? 'interactive' : 'static';
    this.scheduleFrame();
  }

  private activateRefractedText(): void {
    if (!this.root || !this.glassRenderer || this.root.dataset.showcaseGlassRenderer !== 'webgl') {
      return;
    }
    this.glassRenderer.setTextRefractionEnabled(true);
    this.root.dataset.showcaseGlassText = 'webgl';
  }

  private readonly handleGlassStatusChange = (status: GlassRendererStatus): void => {
    if (!this.root) return;
    if (status === 'destroyed') {
      delete this.root.dataset.showcaseGlassRenderer;
      delete this.root.dataset.showcaseGlassText;
      return;
    }
    this.root.dataset.showcaseGlassRenderer = status;
    if (status === 'fallback') {
      delete this.root.dataset.showcaseGlassText;
    } else if (this.introComplete) {
      this.activateRefractedText();
    }
  };

  private readScrollProgress(): number {
    if (this.reducedMotion || !this.scrollScene) return 0;
    const rect = this.scrollScene.getBoundingClientRect();
    return calculateShowcaseScrollProgress(rect.top, rect.height, window.innerHeight);
  }

  private writeScrollStyles(): void {
    if (!this.root) return;
    const progress = this.reducedMotion ? 0 : clamp(this.currentScrollProgress, 0, 1);
    for (const pane of this.panes) {
      const localProgress = clamp(
        (progress - pane.scrollStart) / Math.max(1 - pane.scrollStart, 0.01),
        0,
        1
      );
      const easedProgress = smoothstep(localProgress);
      const fade = 1 - clamp((localProgress - 0.82) / 0.18, 0, 1);
      pane.element.style.setProperty(
        '--pane-translate-x',
        (pane.driftX * this.bounds.width * easedProgress).toFixed(2) + 'px'
      );
      pane.element.style.setProperty(
        '--pane-translate-y',
        (pane.driftY * this.bounds.height * easedProgress).toFixed(2) + 'px'
      );
      pane.element.style.setProperty('--pane-scale', (1 - easedProgress * 0.06).toFixed(4));
      pane.element.style.setProperty('--pane-opacity', fade.toFixed(4));
    }

    const frontExitProgress = smoothstep(clamp((progress - 0.08) / 0.82, 0, 1));
    this.root.style.setProperty('--scroll-progress', progress.toFixed(4));
    this.root.style.setProperty(
      '--title-scroll-x',
      (this.bounds.width * 0.78 * frontExitProgress).toFixed(2) + 'px'
    );
    this.root.style.setProperty(
      '--title-scroll-y',
      (-this.bounds.height * 0.02 * frontExitProgress).toFixed(2) + 'px'
    );
    this.root.style.setProperty(
      '--title-scroll-rotate',
      (-0.5 * frontExitProgress).toFixed(3) + 'deg'
    );
    this.root.style.setProperty(
      '--front-text-opacity',
      (1 - clamp((progress - 0.78) / 0.22, 0, 1)).toFixed(3)
    );
    this.root.style.setProperty(
      '--ambience-scroll-y',
      (-this.bounds.height * 0.035 * progress).toFixed(2) + 'px'
    );
    this.root.dataset.showcaseScrollProgress = progress.toFixed(3);
  }

  private resetScrollStyles(): void {
    for (const pane of this.panes) {
      for (const property of [
        '--pane-translate-x',
        '--pane-translate-y',
        '--pane-scale',
        '--pane-opacity',
        '--pane-pointer-x',
        '--pane-pointer-y'
      ]) {
        pane.element.style.removeProperty(property);
      }
    }
    if (!this.root) return;
    for (const property of [
      '--scroll-progress',
      '--title-scroll-x',
      '--title-scroll-y',
      '--title-scroll-rotate',
      '--front-text-opacity',
      '--ambience-scroll-y'
    ]) {
      this.root.style.removeProperty(property);
    }
  }

  private measureTextCenter(): void {
    if (!this.frontText) return;
    const textRect = this.frontText.getBoundingClientRect();
    this.textCenter = {
      x: textRect.left + textRect.width / 2,
      y: textRect.top + textRect.height / 2
    };
  }

  private updatePointerTarget(event: PointerEvent): void {
    const stageRect = this.stage?.getBoundingClientRect();
    if (stageRect) {
      this.bounds = {
        pageLeft: stageRect.left,
        pageTop: stageRect.top,
        width: Math.max(stageRect.width, 1),
        height: Math.max(stageRect.height, 1)
      };
    }
    this.targetPointer = {
      x: clamp(event.clientX - this.bounds.pageLeft, 0, this.bounds.width),
      y: clamp(event.clientY - this.bounds.pageTop, 0, this.bounds.height)
    };
  }

  private updateActivePane(event: PointerEvent): void {
    const active = [...this.panes]
      .reverse()
      .map((pane) => pane.element)
      .find((element) => {
        const rect = element.getBoundingClientRect();
        return (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        );
      });

    if (active !== this.activePane) {
      this.activePane?.removeAttribute('data-pane-active');
      this.activePane = active;
      this.activePane?.setAttribute('data-pane-active', '');
    }
    if (!active) return;
    const rect = active.getBoundingClientRect();
    const localX = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1) * 100;
    const localY = clamp((event.clientY - rect.top) / Math.max(rect.height, 1), 0, 1) * 100;
    active.style.setProperty('--pane-pointer-x', localX.toFixed(2) + '%');
    active.style.setProperty('--pane-pointer-y', localY.toFixed(2) + '%');
  }

  private clearActivePane(): void {
    this.activePane?.removeAttribute('data-pane-active');
    this.activePane = undefined;
  }

  private writeDynamicStyles(): void {
    if (!this.root) return;
    const pointerXPercent = (this.currentPointer.x / this.bounds.width) * 100;
    const pointerYPercent = (this.currentPointer.y / this.bounds.height) * 100;
    this.root.style.setProperty('--pointer-x', pointerXPercent.toFixed(2) + '%');
    this.root.style.setProperty('--pointer-y', pointerYPercent.toFixed(2) + '%');
    this.root.style.setProperty('--pointer-speed', this.currentSpeed.toFixed(3));
    this.root.style.setProperty('--light-opacity', this.currentLightOpacity.toFixed(3));
    this.root.style.setProperty('--light-x', this.currentPointer.x.toFixed(2) + 'px');
    this.root.style.setProperty('--light-y', this.currentPointer.y.toFixed(2) + 'px');
    this.root.style.setProperty('--attract-x', this.currentAttraction.x.toFixed(2) + 'px');
    this.root.style.setProperty('--attract-y', this.currentAttraction.y.toFixed(2) + 'px');
    this.root.style.setProperty('--glass-rotate-x', this.currentRotation.x.toFixed(3) + 'deg');
    this.root.style.setProperty('--glass-rotate-y', this.currentRotation.y.toFixed(3) + 'deg');
  }

  private resetDynamicStyles(): void {
    if (!this.root) return;
    this.currentSpeed = 0;
    this.targetSpeed = 0;
    this.currentLightOpacity = 0;
    this.currentAttraction = { x: 0, y: 0 };
    this.currentRotation = { x: 0, y: 0 };
    for (const property of [
      '--pointer-x',
      '--pointer-y',
      '--pointer-speed',
      '--light-opacity',
      '--light-x',
      '--light-y',
      '--attract-x',
      '--attract-y',
      '--glass-rotate-x',
      '--glass-rotate-y'
    ]) {
      this.root.style.removeProperty(property);
    }
  }

  private isSettled(
    targetLightOpacity: number,
    targetAttraction: Point,
    targetRotation: Point
  ): boolean {
    return (
      Math.abs(this.currentPointer.x - this.targetPointer.x) < 0.08 &&
      Math.abs(this.currentPointer.y - this.targetPointer.y) < 0.08 &&
      Math.abs(this.currentLightOpacity - targetLightOpacity) < 0.003 &&
      Math.abs(this.currentSpeed - this.targetSpeed) < 0.003 &&
      Math.abs(this.currentAttraction.x - targetAttraction.x) < 0.05 &&
      Math.abs(this.currentAttraction.y - targetAttraction.y) < 0.05 &&
      Math.abs(this.currentRotation.x - targetRotation.x) < 0.006 &&
      Math.abs(this.currentRotation.y - targetRotation.y) < 0.006
    );
  }

  private scheduleFrame(): void {
    if (this.frameId !== undefined || !this.mounted || this.paused) return;
    this.frameId = window.requestAnimationFrame(this.renderFrame);
  }

  private cancelFrame(): void {
    if (this.frameId === undefined) return;
    window.cancelAnimationFrame(this.frameId);
    this.frameId = undefined;
    this.lastFrameTime = 0;
  }

  private cancelIntroAnimations(): void {
    this.introAnimations.forEach((animation) => animation.cancel());
    this.introAnimations = [];
  }
}
