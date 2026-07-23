import { createClientCompositionRoot } from '@app/client-composition-root';
import type { CatalogSort } from '@core/domain/catalog/catalog';
import type { CatalogItemType } from '@core/domain/catalog/catalog-item';
import type { Experience, ExperienceContext } from '@experience/core/experience';

const CYCLE_HOLD_DURATION = 2_800;
const CYCLE_TRANSITION_DURATION = 420;

export const nextCycleIndex = (currentIndex: number, itemCount: number): number =>
  itemCount > 0 ? (currentIndex + 1) % itemCount : 0;

export const splitTitleGraphemes = (title: string): readonly string[] => {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('it', { granularity: 'grapheme' });
    return [...segmenter.segment(title)].map(({ segment }) => segment);
  }
  return Array.from(title);
};

class CyclicTextRotator {
  private readonly items: HTMLElement[];
  private currentIndex = 0;
  private animations: Animation[] = [];
  private generation = 0;
  private running = false;

  constructor(
    private readonly viewport: HTMLElement,
    private readonly reducedMotion: boolean
  ) {
    this.items = [...this.viewport.querySelectorAll<HTMLElement>('[data-cycle-item]')];
    this.normalize();
  }

  play(): void {
    if (this.reducedMotion || this.items.length < 2 || this.running) return;
    this.running = true;
  }

  pause(value?: string): void {
    this.running = false;
    this.generation += 1;
    this.cancelAnimations();
    if (value !== undefined) {
      const requestedIndex = this.items.findIndex((item) => item.dataset.cycleValue === value);
      if (requestedIndex >= 0) this.currentIndex = requestedIndex;
    }
    this.normalize();
  }

  destroy(): void {
    this.pause();
    this.items.forEach((item, index) => {
      item.hidden = index !== 0;
      item.removeAttribute('style');
    });
    this.currentIndex = 0;
    delete this.viewport.dataset.cycleTick;
  }

  async advance(tick: number): Promise<void> {
    if (!this.running) return;
    const current = this.items[this.currentIndex];
    const nextIndex = nextCycleIndex(this.currentIndex, this.items.length);
    const next = this.items[nextIndex];
    if (!current || !next) return;

    this.viewport.dataset.cycleTick = String(tick);
    const generation = ++this.generation;
    current.hidden = false;
    next.hidden = false;
    this.animations = [
      current.animate(
        [
          { transform: 'translate3d(0, 0, 0)', opacity: 1 },
          { transform: 'translate3d(0, 115%, 0)', opacity: 0 }
        ],
        {
          duration: CYCLE_TRANSITION_DURATION,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'forwards'
        }
      ),
      next.animate(
        [
          { transform: 'translate3d(0, -115%, 0)', opacity: 0 },
          { transform: 'translate3d(0, 0, 0)', opacity: 1 }
        ],
        {
          duration: CYCLE_TRANSITION_DURATION,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'forwards'
        }
      )
    ];

    await Promise.all(
      this.animations.map((animation) => animation.finished.catch(() => undefined))
    );
    if (!this.running || generation !== this.generation) return;
    this.currentIndex = nextIndex;
    this.cancelAnimations();
    this.normalize();
  }

  private normalize(): void {
    this.items.forEach((item, index) => {
      item.hidden = index !== this.currentIndex;
      item.removeAttribute('style');
    });
  }

  private cancelAnimations(): void {
    this.animations.forEach((animation) => animation.cancel());
    this.animations = [];
  }
}

interface CycleControlCallbacks {
  readonly onOpen: (control: CatalogCycleControl) => void;
}

class CatalogCycleControl {
  private readonly trigger: HTMLButtonElement;
  private readonly panel: HTMLElement;
  private readonly select: HTMLSelectElement;
  private readonly optionButtons: HTMLButtonElement[];
  private readonly rotator: CyclicTextRotator;
  private readonly label: string;
  private callbacks?: CycleControlCallbacks;
  private listenerController?: AbortController;
  private panelAnimation?: Animation;
  private transitionGeneration = 0;
  private pointerCapable = false;
  private pinned = false;
  private playing = false;
  private openState = false;

  constructor(
    private readonly root: HTMLElement,
    private readonly reducedMotion: boolean
  ) {
    const trigger = root.querySelector<HTMLButtonElement>('[data-cycle-trigger]');
    const panel = root.querySelector<HTMLElement>('[data-cycle-panel]');
    const select = root.querySelector<HTMLSelectElement>('[data-cycle-select]');
    const optionButtons = [...root.querySelectorAll<HTMLButtonElement>('[data-cycle-option]')];
    const viewport = root.querySelector<HTMLElement>('[data-cycle-viewport]');
    const label = root.querySelector<HTMLLabelElement>('label');
    if (
      !trigger ||
      !panel ||
      !select ||
      optionButtons.length !== select.options.length ||
      !viewport ||
      !label
    ) {
      throw new Error('Un controllo ciclico del catalogo è incompleto.');
    }
    this.trigger = trigger;
    this.panel = panel;
    this.select = select;
    this.optionButtons = optionButtons;
    this.label = label.textContent?.trim() ?? 'controllo';
    this.rotator = new CyclicTextRotator(viewport, reducedMotion);
  }

  mount(callbacks: CycleControlCallbacks): void {
    this.callbacks = callbacks;
    this.listenerController = new AbortController();
    const options = { signal: this.listenerController.signal } as const;
    this.pointerCapable =
      !this.reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    this.pinned =
      this.select.selectedIndex > 0 && this.select.value !== this.select.options[0]?.value;
    this.updateSelectedValue();

    this.trigger.addEventListener('click', this.handleTrigger, options);
    this.trigger.addEventListener('keydown', this.handleTriggerKeydown, options);
    this.select.addEventListener('change', this.handleChange, options);
    this.panel.addEventListener('click', this.handleOptionClick, options);
    this.panel.addEventListener('keydown', this.handleOptionKeydown, options);
    this.root.addEventListener('focusout', this.handleFocusOut, options);
    if (this.pointerCapable) {
      this.panel.addEventListener('pointerleave', this.handlePanelPointerLeave, options);
      this.panel.addEventListener('pointerover', this.handleOptionPointerOver, options);
    }
    document.addEventListener('pointerdown', this.handleDocumentPointerDown, options);
  }

  play(): void {
    this.playing = true;
    if (!this.openState && !this.pinned) this.rotator.play();
  }

  pause(): void {
    this.playing = false;
    this.rotator.pause(this.pinned ? this.select.value : undefined);
  }

  advance(tick: number): Promise<void> {
    return this.rotator.advance(tick);
  }

  close(restoreFocus = false, immediate = false): void {
    const alreadyClosing = this.root.dataset.cycleState === 'closing';
    if (!this.openState && !(alreadyClosing && immediate)) return;
    this.openState = false;
    this.clearOptionPreview();
    this.root.dataset.cycleState = immediate ? 'closed' : 'closing';
    this.trigger.ariaExpanded = 'false';
    this.updateSelectedValue();

    const finish = (): void => {
      this.root.dataset.cycleState = 'closed';
      if (this.pinned) {
        this.rotator.pause(this.select.value);
      } else if (this.playing) {
        this.rotator.play();
      } else {
        this.rotator.pause();
      }
      if (restoreFocus || this.panel.contains(document.activeElement)) {
        this.trigger.focus({ preventScroll: true });
      }
    };

    if (immediate || this.reducedMotion) {
      this.cancelPanelAnimation();
      finish();
      return;
    }
    this.animatePanel(false, finish);
  }

  destroy(): void {
    this.listenerController?.abort();
    this.listenerController = undefined;
    this.cancelPanelAnimation();
    this.clearOptionPreview();
    this.playing = false;
    this.openState = false;
    this.root.dataset.cycleState = 'closed';
    this.trigger.ariaExpanded = 'false';
    this.rotator.destroy();
  }

  private open(): void {
    if (this.openState) return;
    this.callbacks?.onOpen(this);
    this.openState = true;
    this.root.dataset.cycleState = 'open';
    this.trigger.ariaExpanded = 'true';
    this.rotator.pause(this.pinned ? this.select.value : undefined);
    this.selectedOptionButton()?.focus({ preventScroll: true });
    if (!this.reducedMotion) this.animatePanel(true);
  }

  private updateSelectedValue(): void {
    const selectedLabel = this.select.selectedOptions[0]?.textContent?.trim() ?? this.select.value;
    this.trigger.ariaLabel = `${this.openState ? 'Chiudi' : 'Apri'} ${this.label}. Selezione corrente: ${selectedLabel}`;
    this.optionButtons.forEach((optionButton) => {
      const active = optionButton.dataset.cycleValue === this.select.value;
      optionButton.ariaSelected = String(this.pinned && active);
      optionButton.tabIndex = active ? 0 : -1;
    });
    if (this.pinned) this.rotator.pause(this.select.value);
  }

  private readonly handleTrigger = (): void => {
    if (this.openState) {
      this.close();
      return;
    }
    this.open();
  };

  private readonly handleTriggerKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowDown') return;
    event.preventDefault();
    this.open();
  };

  private readonly handleChange = (): void => {
    this.pinned = true;
    this.updateSelectedValue();
    this.close(true);
  };

  private readonly handlePanelPointerLeave = (): void => {
    this.clearOptionPreview();
    this.close();
  };

  private readonly handleOptionPointerOver = (event: PointerEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const option = target.closest<HTMLButtonElement>('[data-cycle-option]');
    this.optionButtons.forEach((optionButton) => {
      if (optionButton === option) {
        optionButton.dataset.cyclePreview = 'true';
      } else {
        delete optionButton.dataset.cyclePreview;
      }
    });
    option?.focus({ preventScroll: true });
  };

  private readonly handleOptionClick = (event: MouseEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const option = target.closest<HTMLButtonElement>('[data-cycle-option]');
    if (!option || !this.panel.contains(option)) return;
    this.commitOption(option);
  };

  private readonly handleOptionKeydown = (event: KeyboardEvent): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const option = target.closest<HTMLButtonElement>('[data-cycle-option]');
    if (!option) return;
    const currentIndex = this.optionButtons.indexOf(option);
    if (currentIndex < 0) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close(true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.commitOption(option);
      return;
    }

    const requestedIndex =
      event.key === 'ArrowDown'
        ? Math.min(currentIndex + 1, this.optionButtons.length - 1)
        : event.key === 'ArrowUp'
          ? Math.max(currentIndex - 1, 0)
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? this.optionButtons.length - 1
              : undefined;
    if (requestedIndex === undefined) return;
    event.preventDefault();
    this.optionButtons[requestedIndex]?.focus({ preventScroll: true });
  };

  private readonly handleFocusOut = (): void => {
    window.setTimeout(() => {
      if (this.openState && !this.root.contains(document.activeElement)) this.close();
    });
  };

  private readonly handleDocumentPointerDown = (event: PointerEvent): void => {
    if (this.openState && event.target instanceof Node && !this.root.contains(event.target)) {
      this.close();
    }
  };

  private commitOption(option: HTMLButtonElement): void {
    const value = option.dataset.cycleValue;
    if (value === undefined) return;
    this.select.value = value;
    this.select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private selectedOptionButton(): HTMLButtonElement | undefined {
    return this.optionButtons.find(
      (optionButton) => optionButton.dataset.cycleValue === this.select.value
    );
  }

  private clearOptionPreview(): void {
    this.optionButtons.forEach((optionButton) => {
      delete optionButton.dataset.cyclePreview;
    });
  }

  private animatePanel(opening: boolean, onFinish?: () => void): void {
    const computedStyle = getComputedStyle(this.panel);
    const resumesTransition = this.panelAnimation !== undefined;
    const currentBounds = this.panel.getBoundingClientRect();
    const currentWidth = Number.parseFloat(computedStyle.width) || currentBounds.width;
    const currentHeight = Number.parseFloat(computedStyle.height) || currentBounds.height;
    const currentOpacity = Number.parseFloat(computedStyle.opacity) || 1;
    this.cancelPanelAnimation();

    const triggerBounds = this.trigger.getBoundingClientRect();
    const panelBounds = this.panel.getBoundingClientRect();
    const compactWidth = Math.min(triggerBounds.width, panelBounds.width);
    const compactHeight = Math.min(triggerBounds.height, panelBounds.height);
    const generation = ++this.transitionGeneration;
    this.panel.dataset.cycleAnimating = 'true';
    const animation = this.panel.animate(
      opening
        ? [
            {
              width: `${resumesTransition ? currentWidth : compactWidth}px`,
              height: `${resumesTransition ? currentHeight : compactHeight}px`,
              opacity: resumesTransition ? currentOpacity : 0.58,
              borderRadius: '0.55rem'
            },
            {
              width: `${panelBounds.width}px`,
              height: `${panelBounds.height}px`,
              opacity: 1,
              borderRadius: '1.15rem'
            }
          ]
        : [
            {
              width: `${currentWidth}px`,
              height: `${currentHeight}px`,
              opacity: currentOpacity,
              borderRadius: computedStyle.borderRadius
            },
            {
              width: `${compactWidth}px`,
              height: `${compactHeight}px`,
              opacity: 0.48,
              borderRadius: '0.55rem'
            }
          ],
      {
        duration: opening ? 420 : 340,
        easing: opening ? 'cubic-bezier(0.2, 0.82, 0.2, 1)' : 'cubic-bezier(0.4, 0, 0.3, 1)',
        fill: 'forwards'
      }
    );
    this.panelAnimation = animation;
    void animation.finished
      .then(() => {
        if (generation !== this.transitionGeneration) return;
        this.panelAnimation = undefined;
        animation.cancel();
        delete this.panel.dataset.cycleAnimating;
        onFinish?.();
      })
      .catch(() => undefined);
  }

  private cancelPanelAnimation(): void {
    this.transitionGeneration += 1;
    this.panelAnimation?.cancel();
    this.panelAnimation = undefined;
    delete this.panel.dataset.cycleAnimating;
  }
}

class CatalogSearchCycler {
  private readonly input: HTMLInputElement;
  private readonly rotator: CyclicTextRotator;
  private readonly initialPlaceholder: string;
  private listenerController?: AbortController;
  private playing = false;

  constructor(
    private readonly root: HTMLElement,
    reducedMotion: boolean
  ) {
    const input = root.querySelector<HTMLInputElement>('[data-catalog-search]');
    const viewport = root.querySelector<HTMLElement>('[data-cycle-viewport]');
    if (!input || !viewport) throw new Error('Il controllo di ricerca del catalogo è incompleto.');
    this.input = input;
    this.rotator = new CyclicTextRotator(viewport, reducedMotion);
    this.initialPlaceholder = input.placeholder;
  }

  mount(): void {
    this.listenerController = new AbortController();
    const options = { signal: this.listenerController.signal } as const;
    this.input.placeholder = '';
    this.syncState();
    this.input.addEventListener('focus', this.handleFocus, options);
    this.input.addEventListener('blur', this.handleBlur, options);
    this.input.addEventListener('input', this.handleInput, options);
  }

  play(): void {
    this.playing = true;
    if (this.root.dataset.searchState === 'idle') this.rotator.play();
  }

  pause(): void {
    this.playing = false;
    this.rotator.pause();
  }

  advance(tick: number): Promise<void> {
    return this.rotator.advance(tick);
  }

  destroy(): void {
    this.listenerController?.abort();
    this.listenerController = undefined;
    this.playing = false;
    this.input.placeholder = this.initialPlaceholder;
    this.root.dataset.searchState = 'idle';
    this.rotator.destroy();
  }

  private syncState(): void {
    const focused = document.activeElement === this.input;
    const state = focused ? 'active' : this.input.value ? 'filled' : 'idle';
    this.root.dataset.searchState = state;
    if (state === 'idle' && this.playing) {
      this.rotator.play();
    } else {
      this.rotator.pause();
    }
  }

  private readonly handleFocus = (): void => this.syncState();
  private readonly handleInput = (): void => this.syncState();
  private readonly handleBlur = (): void => {
    window.setTimeout(() => this.syncState());
  };
}

class CatalogTitleHover {
  private readonly title: string;
  private readonly previousAriaLabel: string | null;

  constructor(private readonly link: HTMLAnchorElement) {
    this.title = link.textContent?.trim() ?? '';
    this.previousAriaLabel = link.getAttribute('aria-label');
  }

  mount(signal: AbortSignal): void {
    if (!this.title) return;
    const fragment = document.createDocumentFragment();
    splitTitleGraphemes(this.title).forEach((grapheme, index) => {
      const letter = document.createElement('span');
      const visibleGrapheme = grapheme === ' ' ? '\u00a0' : grapheme;
      letter.className = 'catalog-title-letter';
      letter.ariaHidden = 'true';
      letter.style.setProperty('--title-letter-index', String(index));

      const base = document.createElement('span');
      base.className = 'catalog-title-letter__glyph catalog-title-letter__glyph--base';
      base.textContent = visibleGrapheme;
      const replacement = document.createElement('span');
      replacement.className =
        'catalog-title-letter__glyph catalog-title-letter__glyph--replacement';
      replacement.textContent = visibleGrapheme;
      letter.append(base, replacement);
      fragment.append(letter);
    });

    this.link.replaceChildren(fragment);
    this.link.ariaLabel = this.title;
    this.link.dataset.titleEnhanced = 'true';
    this.link.dataset.titleState = 'idle';
    this.link.addEventListener('pointerenter', this.handlePointerEnter, { signal });
    this.link.addEventListener('pointerleave', this.handlePointerLeave, { signal });
  }

  reset(): void {
    this.link.dataset.titleState = 'idle';
  }

  destroy(): void {
    this.link.replaceChildren(this.title);
    if (this.previousAriaLabel === null) {
      this.link.removeAttribute('aria-label');
    } else {
      this.link.setAttribute('aria-label', this.previousAriaLabel);
    }
    delete this.link.dataset.titleEnhanced;
    delete this.link.dataset.titleState;
  }

  private readonly handlePointerEnter = (): void => {
    this.link.dataset.titleState = 'active';
  };

  private readonly handlePointerLeave = (): void => {
    this.link.dataset.titleState = 'idle';
  };
}

export class CatalogIndexExperience implements Experience {
  private readonly client = createClientCompositionRoot();
  private root?: HTMLElement;
  private grid?: HTMLElement;
  private search?: HTMLInputElement;
  private type?: HTMLSelectElement;
  private category?: HTMLSelectElement;
  private sort?: HTMLSelectElement;
  private resultCount?: HTMLElement;
  private noResults?: HTMLElement;
  private entries = new Map<string, HTMLElement>();
  private cycleControls: CatalogCycleControl[] = [];
  private searchCycler?: CatalogSearchCycler;
  private titleHovers: CatalogTitleHover[] = [];
  private listenerController?: AbortController;
  private cycleTimerId?: number;
  private cycleClockGeneration = 0;
  private cycleTick = 0;
  private requestSequence = 0;
  private reducedMotion = false;
  private playing = false;
  private mounted = false;

  mount(context: ExperienceContext): void {
    if (this.mounted) return;
    const controls = context.root.querySelector<HTMLFormElement>('[data-catalog-controls]');
    const grid = context.root.querySelector<HTMLElement>('[data-catalog-grid]');
    const search = controls?.querySelector<HTMLInputElement>('[data-catalog-search]');
    const type = controls?.querySelector<HTMLSelectElement>('[data-catalog-type]');
    const category = controls?.querySelector<HTMLSelectElement>('[data-catalog-category]');
    const sort = controls?.querySelector<HTMLSelectElement>('[data-catalog-sort]');
    const resultCount = context.root.querySelector<HTMLElement>('[data-catalog-result-count]');
    const noResults = context.root.querySelector<HTMLElement>('[data-catalog-no-results]');
    if (!controls || !grid || !search || !type || !category || !sort) {
      throw new Error('La struttura interattiva del catalogo è incompleta.');
    }

    this.root = context.root;
    this.grid = grid;
    this.search = search;
    this.type = type;
    this.category = category;
    this.sort = sort;
    this.resultCount = resultCount ?? undefined;
    this.noResults = noResults ?? undefined;
    this.reducedMotion = context.reducedMotion;
    this.cycleTick = 0;
    this.entries = new Map(
      [...grid.querySelectorAll<HTMLElement>('[data-catalog-entry]')].flatMap((entry) =>
        entry.dataset.catalogEntry ? [[entry.dataset.catalogEntry, entry] as const] : []
      )
    );

    const parameters = new URLSearchParams(window.location.search);
    if (parameters.has('query')) search.value = parameters.get('query') ?? '';
    if (parameters.has('type')) type.value = parameters.get('type') ?? '';
    if (parameters.has('category')) category.value = parameters.get('category') ?? '';

    this.listenerController = new AbortController();
    const listenerOptions = { signal: this.listenerController.signal } as const;
    controls.addEventListener('submit', this.handleSubmit, listenerOptions);
    controls.addEventListener('input', this.handleQueryChange, listenerOptions);
    controls.addEventListener('change', this.handleQueryChange, listenerOptions);
    window.addEventListener('resize', this.handleResize, {
      passive: true,
      signal: this.listenerController.signal
    });
    document.addEventListener('visibilitychange', this.handleVisibilityChange, listenerOptions);

    this.cycleControls = [...controls.querySelectorAll<HTMLElement>('[data-cycle-control]')].map(
      (element) => new CatalogCycleControl(element, context.reducedMotion)
    );
    this.cycleControls.forEach((control) =>
      control.mount({
        onOpen: (openedControl) => {
          this.cycleControls.forEach((control) => {
            if (control !== openedControl) control.close();
          });
        }
      })
    );

    const searchRoot = controls.querySelector<HTMLElement>('[data-search-cycle]');
    if (!searchRoot) throw new Error('Il contenitore della ricerca del catalogo è assente.');
    this.searchCycler = new CatalogSearchCycler(searchRoot, context.reducedMotion);
    this.searchCycler.mount();

    const pointerCapable =
      !context.reducedMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (pointerCapable) {
      this.titleHovers = [...grid.querySelectorAll<HTMLAnchorElement>('[data-catalog-title]')].map(
        (link) => new CatalogTitleHover(link)
      );
      this.titleHovers.forEach((title) => title.mount(this.listenerController!.signal));
    }

    context.root.dataset.catalogIndexEnhanced = 'true';
    context.root.dataset.catalogIndexState = 'mounted';
    this.mounted = true;
    void this.update();
  }

  play(): void {
    if (!this.mounted || !this.root) return;
    this.playing = true;
    this.root.dataset.catalogIndexState = 'ready';
    this.syncCyclers();
  }

  pause(): void {
    if (!this.mounted || !this.root) return;
    this.playing = false;
    this.stopCycleClock();
    this.cycleControls.forEach((control) => control.pause());
    this.searchCycler?.pause();
    this.titleHovers.forEach((title) => title.reset());
    this.root.dataset.catalogIndexState = 'paused';
  }

  resize(): void {
    this.cycleControls.forEach((control) => control.close(false, true));
  }

  destroy(): void {
    if (!this.mounted) return;
    this.pause();
    this.requestSequence += 1;
    this.listenerController?.abort();
    this.listenerController = undefined;
    this.cycleControls.forEach((control) => control.destroy());
    this.searchCycler?.destroy();
    this.titleHovers.forEach((title) => title.destroy());
    this.cycleControls = [];
    this.searchCycler = undefined;
    this.titleHovers = [];
    if (this.root) {
      delete this.root.dataset.catalogIndexEnhanced;
      this.root.dataset.catalogIndexState = 'destroyed';
    }
    this.entries.clear();
    this.mounted = false;
    this.reducedMotion = false;
    this.cycleTick = 0;
    this.playing = false;
  }

  private async update(): Promise<void> {
    if (!this.search || !this.type || !this.category || !this.sort || !this.grid) return;
    const sequence = ++this.requestSequence;
    try {
      const result = await this.client.queryCatalog.execute({
        ...(this.search.value.trim() ? { search: this.search.value.trim() } : {}),
        ...(this.type.value ? { type: this.type.value as CatalogItemType } : {}),
        ...(this.category.value ? { category: this.category.value } : {}),
        sort: this.sort.value as CatalogSort
      });
      if (sequence !== this.requestSequence) return;
      const visibleIds = new Set(result.map((item) => item.id.value));
      for (const [id, entry] of this.entries) entry.hidden = !visibleIds.has(id);
      for (const item of result) {
        const entry = this.entries.get(item.id.value);
        if (entry) this.grid.append(entry);
      }
      if (this.resultCount) this.resultCount.textContent = String(result.length);
      if (this.noResults) this.noResults.hidden = result.length !== 0;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Si è verificato un errore. Riprova.';
      const announcer = document.querySelector<HTMLElement>('[data-app-announcer]');
      if (announcer) announcer.textContent = message;
    }
  }

  private syncCyclers(): void {
    this.stopCycleClock();
    if (!this.playing || document.hidden || this.reducedMotion) {
      this.cycleControls.forEach((control) => control.pause());
      this.searchCycler?.pause();
      return;
    }
    this.cycleControls.forEach((control) => control.play());
    this.searchCycler?.play();
    this.scheduleCycleTick(this.cycleClockGeneration);
  }

  private scheduleCycleTick(generation: number): void {
    this.cycleTimerId = window.setTimeout(() => {
      this.cycleTimerId = undefined;
      void this.advanceCyclers(generation);
    }, CYCLE_HOLD_DURATION);
  }

  private async advanceCyclers(generation: number): Promise<void> {
    if (
      generation !== this.cycleClockGeneration ||
      !this.playing ||
      document.hidden ||
      this.reducedMotion
    ) {
      return;
    }

    const tick = ++this.cycleTick;
    await Promise.all([
      ...this.cycleControls.map((control) => control.advance(tick)),
      this.searchCycler?.advance(tick) ?? Promise.resolve()
    ]);

    if (
      generation === this.cycleClockGeneration &&
      this.playing &&
      !document.hidden &&
      !this.reducedMotion
    ) {
      this.scheduleCycleTick(generation);
    }
  }

  private stopCycleClock(): void {
    this.cycleClockGeneration += 1;
    if (this.cycleTimerId === undefined) return;
    window.clearTimeout(this.cycleTimerId);
    this.cycleTimerId = undefined;
  }

  private readonly handleSubmit = (event: SubmitEvent): void => event.preventDefault();
  private readonly handleQueryChange = (): void => void this.update();
  private readonly handleResize = (): void => this.resize();
  private readonly handleVisibilityChange = (): void => this.syncCyclers();
}
