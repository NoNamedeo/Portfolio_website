import type { Experience, ExperienceContext } from '@experience/core/experience';

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const damp = (current: number, target: number, lambda: number, deltaSeconds: number): number =>
  target + (current - target) * Math.exp(-lambda * deltaSeconds);

const DRAG_THRESHOLD = 6;
const WHEEL_RELEASE_DELAY = 160;

export const calculateMarqueeDuration = (distance: number, viewportWidth: number): number => {
  if (distance <= 0) return 0;
  const pixelsPerSecond = viewportWidth <= 736 ? 24 : viewportWidth <= 1024 ? 28 : 34;
  return clamp((distance / pixelsPerSecond) * 1000, 25_000, 50_000);
};

export class CatalogShowcaseExperience implements Experience {
  private root?: HTMLElement;
  private viewport?: HTMLElement;
  private track?: HTMLElement;
  private originalGroup?: HTMLElement;
  private copyGroup?: HTMLElement;
  private toggle?: HTMLButtonElement;
  private toggleLabel?: HTMLElement;
  private listenerController?: AbortController;
  private intersectionObserver?: IntersectionObserver;
  private loopAnimation?: Animation;
  private frameId?: number;
  private wheelReleaseTimerId?: number;
  private clickResetTimerId?: number;
  private dragPointerId?: number;
  private lastFrameTime = 0;
  private marqueeDistance = 0;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragOriginTime = 0;
  private dragOriginScrollLeft = 0;
  private currentRate = 1;
  private targetRate = 1;
  private mounted = false;
  private paused = false;
  private visible = false;
  private pointerOver = false;
  private focusWithin = false;
  private userPaused = false;
  private reducedMotion = false;
  private pointerCapable = false;
  private needsResize = false;
  private dragMoved = false;
  private wheelActive = false;
  private suppressClick = false;

  mount(context: ExperienceContext): void {
    if (this.mounted) return;

    const viewport = context.root.querySelector<HTMLElement>('[data-product-marquee-viewport]');
    const track = context.root.querySelector<HTMLElement>('[data-product-marquee-track]');
    const originalGroup = context.root.querySelector<HTMLElement>(
      '[data-product-marquee-original]'
    );
    const copyGroup = context.root.querySelector<HTMLElement>('[data-product-marquee-copy]');
    const toggle = context.root.querySelector<HTMLButtonElement>('[data-marquee-toggle]');
    const toggleLabel = context.root.querySelector<HTMLElement>('[data-marquee-toggle-label]');
    if (!viewport || !track || !originalGroup || !copyGroup || !toggle || !toggleLabel) {
      throw new Error('La struttura del catalogo in movimento è incompleta.');
    }

    this.root = context.root;
    this.viewport = viewport;
    this.track = track;
    this.originalGroup = originalGroup;
    this.copyGroup = copyGroup;
    this.toggle = toggle;
    this.toggleLabel = toggleLabel;
    this.reducedMotion = context.reducedMotion;
    this.pointerCapable =
      !context.reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    this.mounted = true;
    this.listenerController = new AbortController();
    const listenerOptions = { signal: this.listenerController.signal } as const;

    context.root.dataset.marqueeMode = context.reducedMotion ? 'reduced' : 'interactive';
    context.root.dataset.marqueeState = context.reducedMotion ? 'static' : 'mounted';
    this.updateToggle();

    viewport.addEventListener('pointerdown', this.handlePointerDown, listenerOptions);
    viewport.addEventListener('pointermove', this.handlePointerMove, listenerOptions);
    viewport.addEventListener('pointerup', this.handlePointerUp, listenerOptions);
    viewport.addEventListener('pointercancel', this.handlePointerCancel, listenerOptions);
    viewport.addEventListener('dragstart', this.handleNativeDragStart, listenerOptions);
    viewport.addEventListener('click', this.handleClickCapture, {
      capture: true,
      signal: this.listenerController.signal
    });
    viewport.addEventListener('wheel', this.handleWheel, {
      passive: false,
      signal: this.listenerController.signal
    });

    if (context.reducedMotion) return;

    toggle.addEventListener('click', this.handleToggle, listenerOptions);
    viewport.addEventListener('focusin', this.handleFocusIn, listenerOptions);
    viewport.addEventListener('focusout', this.handleFocusOut, listenerOptions);
    if (this.pointerCapable) {
      viewport.addEventListener('pointerenter', this.handlePointerEnter, listenerOptions);
      viewport.addEventListener('pointerleave', this.handlePointerLeave, listenerOptions);
    }
    window.addEventListener('resize', this.handleResize, {
      passive: true,
      signal: this.listenerController.signal
    });
    document.addEventListener('visibilitychange', this.handleVisibilityChange, listenerOptions);

    this.intersectionObserver = new IntersectionObserver(this.handleIntersection, {
      rootMargin: '12% 0px',
      threshold: 0.05
    });
    this.intersectionObserver.observe(context.root);
    this.resize();
  }

  play(): void {
    if (!this.mounted || !this.root) return;
    this.paused = false;
    if (this.reducedMotion) {
      this.root.dataset.marqueeState = 'static';
      return;
    }
    this.syncMotionState();
  }

  pause(): void {
    if (!this.mounted || !this.root) return;
    this.paused = true;
    this.cancelManipulation();
    this.cancelFrame();
    this.loopAnimation?.pause();
    this.root.dataset.marqueeState = 'paused';
  }

  resize(): void {
    if (
      !this.mounted ||
      this.reducedMotion ||
      !this.root ||
      !this.viewport ||
      !this.track ||
      !this.originalGroup
    ) {
      return;
    }

    const groupWidth = this.originalGroup.getBoundingClientRect().width;
    const trackStyle = getComputedStyle(this.track);
    const gap = Number.parseFloat(trackStyle.columnGap || trackStyle.gap) || 0;
    const distance = groupWidth + gap;
    const duration = calculateMarqueeDuration(distance, this.viewport.clientWidth);
    const previousDuration = this.animationDuration();
    const previousTime = this.animationTime();
    const progress =
      previousDuration > 0 ? (previousTime % previousDuration) / previousDuration : 0;

    this.loopAnimation?.cancel();
    this.ensureCopies(distance);
    this.marqueeDistance = distance;
    this.root.style.setProperty('--marquee-distance', distance.toFixed(2) + 'px');
    this.root.style.setProperty('--marquee-duration', duration.toFixed(0) + 'ms');
    this.loopAnimation = this.track.animate(
      [{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(${-distance}px, 0, 0)` }],
      { duration, iterations: Number.POSITIVE_INFINITY, easing: 'linear' }
    );
    this.loopAnimation.pause();
    this.loopAnimation.currentTime = progress * duration;
    this.loopAnimation.updatePlaybackRate(this.currentRate);
    this.needsResize = false;
    this.syncMotionState();
  }

  destroy(): void {
    if (!this.mounted) return;
    this.listenerController?.abort();
    this.listenerController = undefined;
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = undefined;
    this.cancelFrame();
    this.cancelManipulation();
    this.loopAnimation?.cancel();
    this.loopAnimation = undefined;
    this.removeGeneratedCopies();
    if (this.root) {
      this.root.style.removeProperty('--marquee-distance');
      this.root.style.removeProperty('--marquee-duration');
      delete this.root.dataset.marqueeMode;
      delete this.root.dataset.marqueeEntered;
      this.root.dataset.marqueeState = 'destroyed';
    }
    this.userPaused = false;
    this.updateToggle();
    this.mounted = false;
    this.paused = false;
    this.visible = false;
    this.pointerOver = false;
    this.focusWithin = false;
    this.marqueeDistance = 0;
  }

  private readonly handleIntersection: IntersectionObserverCallback = (entries): void => {
    const entry = entries[0];
    if (!entry || !this.root) return;
    this.visible = entry.isIntersecting && entry.intersectionRatio > 0;
    if (this.visible) this.root.dataset.marqueeEntered = 'true';
    this.syncMotionState();
  };

  private readonly handlePointerEnter = (): void => {
    this.pointerOver = true;
    this.targetRate = 0.18;
    this.syncMotionState();
    this.scheduleFrame();
  };

  private readonly handlePointerLeave = (): void => {
    this.pointerOver = false;
    this.targetRate = 1;
    this.syncMotionState();
    this.scheduleFrame();
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (
      !this.mounted ||
      !this.root ||
      !this.viewport ||
      this.dragPointerId !== undefined ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) {
      return;
    }

    this.finishWheelInteraction();
    this.dragPointerId = event.pointerId;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragOriginTime = this.animationTime();
    this.dragOriginScrollLeft = this.viewport.scrollLeft;
    this.dragMoved = false;
    this.cancelFrame();
    this.loopAnimation?.pause();
    this.root.dataset.marqueeState = 'dragging';
    this.viewport.dataset.marqueeDragging = 'true';

    try {
      this.viewport.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events and older browsers may not expose an active pointer to capture.
    }
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (
      event.pointerId !== this.dragPointerId ||
      !this.viewport ||
      (!this.reducedMotion && (!this.loopAnimation || this.marqueeDistance <= 0))
    ) {
      return;
    }

    const deltaX = event.clientX - this.dragStartX;
    const deltaY = event.clientY - this.dragStartY;
    if (!this.dragMoved) {
      if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }
      this.dragMoved = true;
      this.suppressClick = true;
      if (
        document.activeElement instanceof HTMLElement &&
        this.viewport.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }
    }

    event.preventDefault();
    if (this.reducedMotion) {
      this.viewport.scrollLeft = this.dragOriginScrollLeft - deltaX;
    } else {
      this.setAnimationTimeFromDrag(deltaX);
    }
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.finishPointerInteraction(event);
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.finishPointerInteraction(event);
  };

  private readonly handleNativeDragStart = (event: DragEvent): void => {
    event.preventDefault();
  };

  private readonly handleClickCapture = (event: MouseEvent): void => {
    if (!this.suppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    this.clearClickSuppression();
  };

  private readonly handleWheel = (event: WheelEvent): void => {
    if (
      this.reducedMotion ||
      !this.mounted ||
      !this.root ||
      !this.loopAnimation ||
      this.marqueeDistance <= 0 ||
      this.dragPointerId !== undefined
    ) {
      return;
    }

    const horizontalDelta = event.shiftKey && event.deltaX === 0 ? event.deltaY : event.deltaX;
    if (Math.abs(horizontalDelta) <= Math.abs(event.deltaY) && !event.shiftKey) return;

    event.preventDefault();
    this.beginWheelInteraction();
    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? this.viewport?.clientWidth || 1
          : 1;
    this.shiftAnimationByPixels(-horizontalDelta * unit);
    this.scheduleWheelRelease();
  };

  private readonly handleFocusIn = (): void => {
    this.focusWithin = true;
    this.syncMotionState();
  };

  private readonly handleFocusOut = (event: FocusEvent): void => {
    if (event.relatedTarget instanceof Node && this.viewport?.contains(event.relatedTarget)) return;
    this.focusWithin = false;
    this.syncMotionState();
  };

  private readonly handleToggle = (): void => {
    this.userPaused = !this.userPaused;
    this.updateToggle();
    this.syncMotionState();
  };

  private readonly handleResize = (): void => {
    this.needsResize = true;
    this.scheduleFrame();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) this.cancelManipulation();
    this.syncMotionState();
  };

  private readonly renderFrame = (timestamp: number): void => {
    this.frameId = undefined;
    if (!this.mounted || this.paused) return;
    if (this.dragPointerId !== undefined || this.wheelActive) return;
    if (this.needsResize) this.resize();
    if (!this.loopAnimation || this.focusWithin || this.userPaused) {
      return;
    }

    const deltaSeconds = this.lastFrameTime
      ? clamp((timestamp - this.lastFrameTime) / 1000, 1 / 120, 0.05)
      : 1 / 60;
    this.lastFrameTime = timestamp;
    this.currentRate = damp(this.currentRate, this.targetRate, 7, deltaSeconds);
    if (Math.abs(this.currentRate - this.targetRate) < 0.005) {
      this.currentRate = this.targetRate;
    }
    this.loopAnimation.updatePlaybackRate(this.currentRate);
    if (this.currentRate !== this.targetRate) this.scheduleFrame();
  };

  private syncMotionState(): void {
    if (!this.mounted || !this.root || this.reducedMotion || !this.loopAnimation) return;
    if (this.dragPointerId !== undefined || this.wheelActive) {
      this.loopAnimation.pause();
      this.root.dataset.marqueeState = this.dragPointerId !== undefined ? 'dragging' : 'scrolling';
      return;
    }
    const documentVisible = !document.hidden;
    const canPlay =
      !this.paused && this.visible && documentVisible && !this.userPaused && !this.focusWithin;
    if (canPlay) {
      this.loopAnimation.play();
      this.root.dataset.marqueeState = this.pointerOver ? 'slow' : 'running';
      this.scheduleFrame();
      return;
    }
    this.loopAnimation.pause();
    this.root.dataset.marqueeState = this.userPaused
      ? 'paused'
      : this.focusWithin
        ? 'focused'
        : this.paused
          ? 'paused'
          : 'offscreen';
  }

  private updateToggle(): void {
    if (!this.toggle || !this.toggleLabel) return;
    this.toggle.ariaPressed = String(this.userPaused);
    this.toggle.ariaLabel = this.userPaused
      ? 'Riprendi il movimento'
      : 'Metti in pausa il movimento';
    this.toggleLabel.textContent = this.userPaused ? 'Riprendi movimento' : 'Pausa movimento';
  }

  private animationDuration(): number {
    const duration = this.loopAnimation?.effect?.getTiming().duration;
    return typeof duration === 'number' ? duration : 0;
  }

  private ensureCopies(segmentWidth: number): void {
    if (!this.track || !this.copyGroup || !this.viewport || segmentWidth <= 0) return;
    this.removeGeneratedCopies();
    const requiredCopies = Math.max(1, Math.ceil(this.viewport.clientWidth / segmentWidth));
    for (let index = 1; index < requiredCopies; index += 1) {
      const copy = this.copyGroup.cloneNode(true) as HTMLElement;
      copy.dataset.productMarqueeGenerated = 'true';
      this.track.append(copy);
    }
  }

  private removeGeneratedCopies(): void {
    this.track
      ?.querySelectorAll<HTMLElement>('[data-product-marquee-generated]')
      .forEach((copy) => copy.remove());
  }

  private animationTime(): number {
    const currentTime = this.loopAnimation?.currentTime;
    return typeof currentTime === 'number' ? currentTime : 0;
  }

  private setAnimationTimeFromDrag(deltaX: number): void {
    const duration = this.animationDuration();
    if (!this.loopAnimation || duration <= 0 || this.marqueeDistance <= 0) return;
    const requestedTime = this.dragOriginTime - (deltaX / this.marqueeDistance) * duration;
    this.loopAnimation.currentTime = this.wrapAnimationTime(requestedTime, duration);
  }

  private shiftAnimationByPixels(contentDeltaX: number): void {
    const duration = this.animationDuration();
    if (!this.loopAnimation || duration <= 0 || this.marqueeDistance <= 0) return;
    const requestedTime = this.animationTime() - (contentDeltaX / this.marqueeDistance) * duration;
    this.loopAnimation.currentTime = this.wrapAnimationTime(requestedTime, duration);
  }

  private wrapAnimationTime(time: number, duration: number): number {
    return ((time % duration) + duration) % duration;
  }

  private finishPointerInteraction(event: PointerEvent): void {
    if (event.pointerId !== this.dragPointerId || !this.viewport || !this.root) return;
    try {
      if (this.viewport.hasPointerCapture(event.pointerId)) {
        this.viewport.releasePointerCapture(event.pointerId);
      }
    } catch {
      // The browser may already have released capture after a cancelled gesture.
    }

    const moved = this.dragMoved;
    this.dragPointerId = undefined;
    this.dragMoved = false;
    delete this.viewport.dataset.marqueeDragging;
    if (moved) this.scheduleClickSuppressionReset();

    if (this.reducedMotion) {
      this.root.dataset.marqueeState = 'static';
      return;
    }
    if (this.needsResize) {
      this.resize();
    } else {
      this.syncMotionState();
    }
  }

  private beginWheelInteraction(): void {
    if (!this.root) return;
    this.wheelActive = true;
    this.cancelFrame();
    this.loopAnimation?.pause();
    this.root.dataset.marqueeState = 'scrolling';
  }

  private scheduleWheelRelease(): void {
    if (this.wheelReleaseTimerId !== undefined) {
      window.clearTimeout(this.wheelReleaseTimerId);
    }
    this.wheelReleaseTimerId = window.setTimeout(() => {
      this.wheelReleaseTimerId = undefined;
      this.wheelActive = false;
      if (this.needsResize) {
        this.resize();
      } else {
        this.syncMotionState();
      }
    }, WHEEL_RELEASE_DELAY);
  }

  private finishWheelInteraction(): void {
    if (this.wheelReleaseTimerId !== undefined) {
      window.clearTimeout(this.wheelReleaseTimerId);
      this.wheelReleaseTimerId = undefined;
    }
    this.wheelActive = false;
  }

  private scheduleClickSuppressionReset(): void {
    if (this.clickResetTimerId !== undefined) window.clearTimeout(this.clickResetTimerId);
    this.clickResetTimerId = window.setTimeout(() => {
      this.clickResetTimerId = undefined;
      this.suppressClick = false;
    });
  }

  private clearClickSuppression(): void {
    if (this.clickResetTimerId !== undefined) {
      window.clearTimeout(this.clickResetTimerId);
      this.clickResetTimerId = undefined;
    }
    this.suppressClick = false;
  }

  private cancelManipulation(): void {
    this.finishWheelInteraction();
    this.clearClickSuppression();
    if (this.dragPointerId !== undefined && this.viewport) {
      try {
        if (this.viewport.hasPointerCapture(this.dragPointerId)) {
          this.viewport.releasePointerCapture(this.dragPointerId);
        }
      } catch {
        // Pointer capture can disappear when the page loses visibility.
      }
    }
    this.dragPointerId = undefined;
    this.dragMoved = false;
    if (this.viewport) delete this.viewport.dataset.marqueeDragging;
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
}
