import type { Experience, ExperienceContext } from '@experience/core/experience';
import type { CatalogCubeRenderer } from '@experience/home/glass-ideas/catalog-cube-renderer';

export class CatalogCubesExperience implements Experience {
  private root?: HTMLElement;
  private viewport?: HTMLElement;
  private canvas?: HTMLCanvasElement;
  private renderer?: CatalogCubeRenderer;
  private lazyObserver?: IntersectionObserver;
  private loadTimerId?: number;
  private reducedMotion = false;
  private loadDelay = 450;
  private playRequested = false;
  private loading = false;
  private mounted = false;
  private destroyed = false;

  mount(context: ExperienceContext): void {
    if (this.mounted || this.destroyed) return;
    const viewport = context.root.querySelector<HTMLElement>('[data-catalog-cube-viewport]');
    const canvas = context.root.querySelector<HTMLCanvasElement>('[data-catalog-cube-canvas]');
    if (!viewport || !canvas) throw new Error('La griglia dei cubi del catalogo è incompleta.');
    this.root = context.root;
    this.viewport = viewport;
    this.canvas = canvas;
    this.reducedMotion = context.reducedMotion;
    this.loadDelay = context.root.querySelectorAll('[data-cube-slot]').length > 1 ? 3400 : 180;
    this.mounted = true;
    context.root.dataset.catalogCubeRenderer = 'idle';

    if (context.root.dataset.loaderCritical === 'true') {
      void this.mountRenderer();
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      void this.mountRenderer();
      return;
    }
    this.lazyObserver = new IntersectionObserver(this.handleLazyIntersection, {
      rootMargin: '65% 0px',
      threshold: 0
    });
    this.lazyObserver.observe(context.root);
  }

  play(): void {
    this.playRequested = true;
    this.renderer?.play();
  }

  pause(): void {
    this.playRequested = false;
    this.renderer?.pause();
  }

  resize(): void {
    this.renderer?.resize();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.playRequested = false;
    this.lazyObserver?.disconnect();
    if (this.loadTimerId !== undefined) window.clearTimeout(this.loadTimerId);
    this.loadTimerId = undefined;
    this.renderer?.destroy();
    this.renderer = undefined;
    if (this.root) this.root.dataset.catalogCubeRenderer = 'destroyed';
    this.mounted = false;
  }

  private readonly handleLazyIntersection: IntersectionObserverCallback = (entries): void => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    this.lazyObserver?.disconnect();
    this.lazyObserver = undefined;
    this.loadTimerId = window.setTimeout(() => {
      this.loadTimerId = undefined;
      void this.mountRenderer();
    }, this.loadDelay);
  };

  private async mountRenderer(): Promise<void> {
    if (
      this.loading ||
      this.destroyed ||
      !this.mounted ||
      !this.root ||
      !this.viewport ||
      !this.canvas
    ) {
      return;
    }
    this.loading = true;
    const root = this.root;
    try {
      const { CatalogCubeRenderer } =
        await import('@experience/home/glass-ideas/catalog-cube-renderer');
      if (this.destroyed || this.root !== root) return;
      const renderer = new CatalogCubeRenderer({
        root,
        viewport: this.viewport,
        canvas: this.canvas,
        reducedMotion: this.reducedMotion
      });
      if (!(await renderer.mount())) return;
      if (this.destroyed || this.root !== root) {
        renderer.destroy();
        return;
      }
      this.renderer = renderer;
      if (this.playRequested) renderer.play();
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[catalog-cubes] Rendering non disponibile.', error);
      root.dataset.catalogCubeRenderer = 'fallback';
    } finally {
      this.loading = false;
    }
  }
}
