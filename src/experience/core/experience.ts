export interface ExperienceContext {
  readonly root: HTMLElement;
  readonly page: string;
  readonly reducedMotion: boolean;
}

export interface Experience {
  mount(context: ExperienceContext): void | Promise<void>;
  play(): void;
  pause(): void;
  resize(): void;
  destroy(): void;
}

export class ExperienceRegistry {
  private readonly loaders = new Map<string, () => Promise<Experience>>();

  register(key: string, loader: () => Promise<Experience>): void {
    this.loaders.set(key, loader);
  }

  async create(key: string): Promise<Experience | undefined> {
    return this.loaders.get(key)?.();
  }
}

export class MotionPreferences {
  isReduced(): boolean {
    return (
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
