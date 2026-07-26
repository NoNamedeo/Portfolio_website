import type { Experience, ExperienceContext } from '@experience/core/experience';
import { WebGLGlassRenderer, type GlassRendererStatus } from './webgl-glass/webgl-glass-renderer';

interface StageSize {
  width: number;
  height: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const damp = (current: number, target: number, lambda: number, deltaSeconds: number): number =>
  target + (current - target) * Math.exp(-lambda * deltaSeconds);

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
  private glass?: HTMLElement;
  private glassRenderer?: WebGLGlassRenderer;
  private listenerController?: AbortController;
  private introAnimations: Animation[] = [];
  private animationGeneration = 0;
  private frameId?: number;
  private size: StageSize = { width: 1, height: 1 };
  private targetScrollProgress = 0;
  private currentScrollProgress = 0;
  private lastFrameTime = 0;
  private mounted = false;
  private paused = false;
  private introComplete = false;
  private pointerCapable = false;
  private reducedMotion = false;
  private needsMeasure = false;
  private scrollInitialized = false;

  async mount(context: ExperienceContext): Promise<void> {
    if (this.mounted) return;

    const stage = context.root.querySelector<HTMLElement>('[data-showcase-stage]');
    const scrollScene = context.root.querySelector<HTMLElement>('[data-showcase-scroll-scene]');
    const glass = context.root.querySelector<HTMLElement>('[data-showcase-glass]');
    const glassCanvas = context.root.querySelector<HTMLCanvasElement>(
      '[data-showcase-glass-canvas]'
    );
    if (!stage || !scrollScene || !glass || !glassCanvas) {
      throw new Error('La struttura della hero homepage è incompleta.');
    }

    this.root = context.root;
    this.stage = stage;
    this.scrollScene = scrollScene;
    this.glass = glass;
    this.reducedMotion = context.reducedMotion;
    this.pointerCapable =
      !context.reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    this.mounted = true;
    this.paused = false;
    this.listenerController = new AbortController();
    const listenerOptions = { passive: true, signal: this.listenerController.signal } as const;

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
        : 'ambient';

    const renderer = new WebGLGlassRenderer({
      stage,
      glass,
      canvas: glassCanvas,
      reducedMotion: context.reducedMotion,
      onStatusChange: this.handleGlassStatusChange
    });
    this.glassRenderer = renderer;
    if (!(await renderer.mount())) this.glassRenderer = undefined;
    if (!this.mounted) {
      renderer.destroy();
      return;
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
      return;
    }
    if (this.reducedMotion) {
      this.introComplete = true;
      this.root.dataset.showcaseState = 'reduced';
      return;
    }
    this.startEntrance();
  }

  pause(): void {
    if (!this.mounted || !this.root) return;
    this.paused = true;
    this.introAnimations.forEach((animation) => animation.pause());
    this.cancelFrame();
    this.glassRenderer?.pause();
    this.root.dataset.showcaseState = 'paused';
  }

  resize(): void {
    if (!this.mounted || !this.stage) return;
    const stageRect = this.stage.getBoundingClientRect();
    this.size = {
      width: Math.max(stageRect.width, 1),
      height: Math.max(stageRect.height, 1)
    };
    this.targetScrollProgress = this.readScrollProgress();
    if (!this.scrollInitialized) {
      this.currentScrollProgress = this.targetScrollProgress;
      this.scrollInitialized = true;
    }
    this.writeScrollStyles();
    this.needsMeasure = false;
    this.glassRenderer?.resize();
  }

  destroy(): void {
    if (!this.mounted) return;
    this.animationGeneration += 1;
    this.listenerController?.abort();
    this.listenerController = undefined;
    this.cancelFrame();
    this.cancelIntroAnimations();
    this.glassRenderer?.destroy();
    this.glassRenderer = undefined;
    this.resetScrollStyles();
    if (this.root) {
      this.root.dataset.showcaseState = 'destroyed';
      delete this.root.dataset.showcaseMode;
      delete this.root.dataset.showcaseGlassRenderer;
      delete this.root.dataset.showcaseScrollProgress;
    }
    this.mounted = false;
    this.paused = false;
    this.scrollInitialized = false;
  }

  private readonly handleScroll = (): void => {
    this.targetScrollProgress = this.readScrollProgress();
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
    if (this.reducedMotion) return;

    this.targetScrollProgress = this.readScrollProgress();
    this.currentScrollProgress = damp(
      this.currentScrollProgress,
      this.targetScrollProgress,
      11,
      deltaSeconds
    );
    if (Math.abs(this.currentScrollProgress - this.targetScrollProgress) < 0.0004) {
      this.currentScrollProgress = this.targetScrollProgress;
    }
    this.writeScrollStyles();
    if (Math.abs(this.currentScrollProgress - this.targetScrollProgress) >= 0.0004) {
      this.scheduleFrame();
    } else {
      this.lastFrameTime = 0;
    }
  };

  private startEntrance(): void {
    if (!this.root || !this.glass) return;
    const generation = ++this.animationGeneration;
    this.root.dataset.showcaseState = 'entering';
    this.introAnimations = [
      this.glass.animate(
        [
          { opacity: 0, transform: 'scale(0.985)' },
          { opacity: 1, transform: 'scale(1)' }
        ],
        {
          duration: 920,
          easing: 'cubic-bezier(0.2, 0.75, 0.2, 1)',
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
    this.root.dataset.showcaseState = this.pointerCapable ? 'interactive' : 'ambient';
    this.scheduleFrame();
  }

  private readonly handleGlassStatusChange = (status: GlassRendererStatus): void => {
    if (!this.root) return;
    if (status === 'destroyed') {
      delete this.root.dataset.showcaseGlassRenderer;
      return;
    }
    this.root.dataset.showcaseGlassRenderer = status;
  };

  private readScrollProgress(): number {
    if (this.reducedMotion || !this.scrollScene) return 0;
    const rect = this.scrollScene.getBoundingClientRect();
    return calculateShowcaseScrollProgress(rect.top, rect.height, window.innerHeight);
  }

  private writeScrollStyles(): void {
    if (!this.root) return;
    const progress = this.reducedMotion ? 0 : clamp(this.currentScrollProgress, 0, 1);
    const glassFade = 1 - clamp((progress - 0.82) / 0.18, 0, 1);
    this.root.style.setProperty('--scroll-progress', progress.toFixed(4));
    this.root.style.setProperty(
      '--ambience-scroll-y',
      (-this.size.height * 0.035 * progress).toFixed(2) + 'px'
    );
    this.root.style.setProperty('--glass-exit-opacity', glassFade.toFixed(3));
    this.root.dataset.showcaseScrollProgress = progress.toFixed(3);
    this.glassRenderer?.setScrollProgress(progress);
  }

  private resetScrollStyles(): void {
    if (!this.root) return;
    for (const property of ['--scroll-progress', '--ambience-scroll-y', '--glass-exit-opacity']) {
      this.root.style.removeProperty(property);
    }
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
