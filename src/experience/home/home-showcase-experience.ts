import type { Experience, ExperienceContext } from '@experience/core/experience';

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

const initialBounds: StageBounds = { pageLeft: 0, pageTop: 0, width: 1, height: 1 };

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const damp = (current: number, target: number, lambda: number, deltaSeconds: number): number =>
  target + (current - target) * Math.exp(-lambda * deltaSeconds);

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
  radius: number,
  maximumOffset: number
): Point => {
  const deltaX = pointer.x - textCenter.x;
  const deltaY = pointer.y - textCenter.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance === 0 || distance >= radius || radius <= 0 || maximumOffset <= 0) {
    return { x: 0, y: 0 };
  }
  const proximity = 1 - distance / radius;
  const easedProximity = proximity * proximity * (3 - 2 * proximity);
  const offset = maximumOffset * easedProximity;
  return {
    x: (deltaX / distance) * offset,
    y: (deltaY / distance) * offset
  };
};

export class HomeShowcaseExperience implements Experience {
  private root?: HTMLElement;
  private stage?: HTMLElement;
  private backText?: HTMLElement;
  private frontText?: HTMLElement;
  private glass?: HTMLElement;
  private sheen?: HTMLElement;
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

  mount(context: ExperienceContext): void {
    if (this.mounted) return;

    const stage = context.root.querySelector<HTMLElement>('[data-showcase-stage]');
    const backText = context.root.querySelector<HTMLElement>('[data-showcase-back-text]');
    const frontText = context.root.querySelector<HTMLElement>('[data-showcase-front-text]');
    const glass = context.root.querySelector<HTMLElement>('[data-showcase-glass]');
    const sheen = context.root.querySelector<HTMLElement>('[data-showcase-sheen]');
    const pointerLight = context.root.querySelector<HTMLElement>('[data-showcase-pointer-light]');
    if (!stage || !backText || !frontText || !glass || !sheen || !pointerLight) {
      throw new Error('La struttura della vetrina homepage è incompleta.');
    }

    this.root = context.root;
    this.stage = stage;
    this.backText = backText;
    this.frontText = frontText;
    this.glass = glass;
    this.sheen = sheen;
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
    this.resize();
  }

  play(): void {
    if (!this.mounted || !this.root) return;
    this.paused = false;

    if (this.introAnimations.length > 0) {
      this.introAnimations.forEach((animation) => animation.play());
      this.root.dataset.showcaseState = 'entering';
      return;
    }
    if (this.introComplete) {
      this.enableFinalState();
      return;
    }
    if (this.reducedMotion) {
      this.introComplete = true;
      this.interactionEnabled = false;
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
    this.introAnimations.forEach((animation) => animation.pause());
    this.cancelFrame();
    this.resetDynamicStyles();
    this.root.dataset.showcaseState = 'paused';
  }

  resize(): void {
    if (!this.mounted || !this.stage || !this.frontText) return;
    const stageRect = this.stage.getBoundingClientRect();
    const textRect = this.frontText.getBoundingClientRect();
    this.bounds = {
      pageLeft: stageRect.left + window.scrollX,
      pageTop: stageRect.top + window.scrollY,
      width: Math.max(stageRect.width, 1),
      height: Math.max(stageRect.height, 1)
    };
    this.textCenter = {
      x: textRect.left + window.scrollX + textRect.width / 2,
      y: textRect.top + window.scrollY + textRect.height / 2
    };
    if (!this.pointerInside) {
      this.targetPointer = { x: this.bounds.width / 2, y: this.bounds.height / 2 };
      this.currentPointer = { ...this.targetPointer };
    }
    this.needsMeasure = false;
  }

  destroy(): void {
    if (!this.mounted) return;
    this.animationGeneration += 1;
    this.listenerController?.abort();
    this.listenerController = undefined;
    this.cancelFrame();
    this.cancelIntroAnimations();
    this.resetDynamicStyles();
    if (this.root) {
      this.root.dataset.showcaseState = 'destroyed';
      delete this.root.dataset.showcaseMode;
    }
    this.mounted = false;
    this.paused = false;
    this.pointerInside = false;
    this.interactionEnabled = false;
  }

  private readonly handlePointerEnter = (event: PointerEvent): void => {
    if (!this.interactionEnabled) return;
    this.pointerInside = true;
    this.updatePointerTarget(event);
    this.lastPointer = { x: event.pageX, y: event.pageY };
    this.lastPointerTime = event.timeStamp;
    this.scheduleFrame();
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (!this.interactionEnabled || !this.pointerInside) return;
    this.updatePointerTarget(event);
    const elapsed = event.timeStamp - this.lastPointerTime;
    const distance = Math.hypot(event.pageX - this.lastPointer.x, event.pageY - this.lastPointer.y);
    this.targetSpeed = normalizePointerSpeed(distance, elapsed);
    this.lastPointer = { x: event.pageX, y: event.pageY };
    this.lastPointerTime = event.timeStamp;
    this.scheduleFrame();
  };

  private readonly handlePointerLeave = (): void => {
    if (!this.interactionEnabled) return;
    this.pointerInside = false;
    this.targetSpeed = 0;
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
    if (!this.interactionEnabled || !this.root) return;

    const deltaSeconds = this.lastFrameTime
      ? clamp((timestamp - this.lastFrameTime) / 1000, 1 / 120, 0.05)
      : 1 / 60;
    this.lastFrameTime = timestamp;
    this.targetSpeed *= Math.exp(-5.5 * deltaSeconds);
    this.currentSpeed = damp(this.currentSpeed, this.targetSpeed, 9, deltaSeconds);
    this.currentPointer.x = damp(this.currentPointer.x, this.targetPointer.x, 15, deltaSeconds);
    this.currentPointer.y = damp(this.currentPointer.y, this.targetPointer.y, 15, deltaSeconds);

    const targetLightOpacity = this.pointerInside ? 0.18 + this.currentSpeed * 0.42 : 0;
    this.currentLightOpacity = damp(this.currentLightOpacity, targetLightOpacity, 10, deltaSeconds);

    const compact = this.bounds.width <= 1024;
    const pointerPage = {
      x: this.bounds.pageLeft + this.currentPointer.x,
      y: this.bounds.pageTop + this.currentPointer.y
    };
    const targetAttraction = this.pointerInside
      ? calculatePointerAttraction(
          this.textCenter,
          pointerPage,
          compact ? 250 : 300,
          compact ? 14 : 24
        )
      : { x: 0, y: 0 };
    this.currentAttraction.x = damp(this.currentAttraction.x, targetAttraction.x, 11, deltaSeconds);
    this.currentAttraction.y = damp(this.currentAttraction.y, targetAttraction.y, 11, deltaSeconds);

    const normalizedX = (this.currentPointer.x / this.bounds.width - 0.5) * 2;
    const normalizedY = (this.currentPointer.y / this.bounds.height - 0.5) * 2;
    const targetRotation = this.pointerInside
      ? { x: -normalizedY * (compact ? 0.35 : 0.8), y: normalizedX * (compact ? 0.5 : 1.2) }
      : { x: 0, y: 0 };
    this.currentRotation.x = damp(this.currentRotation.x, targetRotation.x, 8, deltaSeconds);
    this.currentRotation.y = damp(this.currentRotation.y, targetRotation.y, 8, deltaSeconds);

    this.writeDynamicStyles();
    if (!this.isSettled(targetLightOpacity, targetAttraction, targetRotation)) {
      this.scheduleFrame();
    } else if (!this.pointerInside) {
      this.resetDynamicStyles();
    }
  };

  private startEntrance(): void {
    if (!this.root || !this.glass || !this.backText || !this.frontText || !this.sheen) return;
    const generation = ++this.animationGeneration;
    this.root.dataset.showcaseState = 'entering';
    this.interactionEnabled = false;

    this.introAnimations = [
      this.glass.animate(
        [
          { opacity: 0, transform: 'translate3d(0, 14px, 0) scale(0.994)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
        ],
        { duration: 900, easing: 'cubic-bezier(0.2, 0.75, 0.2, 1)', fill: 'both' }
      ),
      this.backText.animate(
        [
          { opacity: 0, transform: 'translate3d(0, 16px, 0)', filter: 'blur(5px)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)', filter: 'blur(0.35px)' }
        ],
        {
          duration: 850,
          delay: 180,
          easing: 'cubic-bezier(0.2, 0.75, 0.2, 1)',
          fill: 'both'
        }
      ),
      this.sheen.animate(
        [
          { opacity: 0, transform: 'translate3d(-30%, 0, 0) skewX(-14deg)' },
          { opacity: 0.75, offset: 0.3 },
          { opacity: 0, transform: 'translate3d(540%, 0, 0) skewX(-14deg)' }
        ],
        { duration: 900, delay: 360, easing: 'ease-in-out', fill: 'both' }
      ),
      this.frontText.animate(
        [
          { opacity: 0, transform: 'translate3d(0, 22px, 0)' },
          { opacity: 1, transform: 'translate3d(0, 0, 0)' }
        ],
        {
          duration: 720,
          delay: 700,
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
    this.root.dataset.showcaseState = this.pointerCapable ? 'interactive' : 'static';
  }

  private updatePointerTarget(event: PointerEvent): void {
    this.targetPointer = {
      x: clamp(event.pageX - this.bounds.pageLeft, 0, this.bounds.width),
      y: clamp(event.pageY - this.bounds.pageTop, 0, this.bounds.height)
    };
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
