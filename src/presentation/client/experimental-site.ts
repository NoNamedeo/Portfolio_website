const documentRoot = document.documentElement;
const pageBody = document.body;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const pointerIsFine = window.matchMedia('(pointer: fine)');
const horizontalLayoutIsAvailable = window.matchMedia(
  '(min-width: 75rem) and (prefers-reduced-motion: no-preference)'
);

const clamp = (value: number, minimum = 0, maximum = 1): number =>
  Math.min(maximum, Math.max(minimum, value));

const initializePreloader = (): void => {
  const preloader = document.querySelector<HTMLElement>('[data-experimental-preloader]');
  const progress = preloader?.querySelector<HTMLElement>('[data-preloader-progress]');
  if (!preloader || !progress) return;

  pageBody.classList.add('is-experimental-loading');
  const duration = prefersReducedMotion.matches ? 80 : 1_050;
  const startedAt = performance.now();

  const update = (now: number): void => {
    const elapsed = now - startedAt;
    const rawProgress = Math.min(1, elapsed / duration);
    const easedProgress = 1 - Math.pow(1 - rawProgress, 3);
    progress.textContent = `${Math.round(easedProgress * 100)}%`;

    if (rawProgress < 1) {
      requestAnimationFrame(update);
      return;
    }

    preloader.classList.add('is-complete');
    pageBody.classList.remove('is-experimental-loading');
    window.setTimeout(
      () => {
        preloader.remove();
        window.dispatchEvent(new CustomEvent('experimental:ready'));
      },
      prefersReducedMotion.matches ? 20 : 760
    );
  };

  requestAnimationFrame(update);
};

const initializeMenu = (): void => {
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const label = toggle?.querySelector<HTMLElement>('[data-menu-label]');
  if (!menu || !toggle || !label) return;

  const setMenuState = (isOpen: boolean): void => {
    toggle.setAttribute('aria-expanded', String(isOpen));
    menu.setAttribute('aria-hidden', String(!isOpen));
    label.textContent = isOpen ? 'Chiudi' : 'Menu';
    pageBody.classList.toggle('is-experimental-menu-open', isOpen);
    if (isOpen) {
      menu.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
    } else {
      toggle.focus({ preventScroll: true });
    }
  };

  toggle.addEventListener('click', () => {
    setMenuState(toggle.getAttribute('aria-expanded') !== 'true');
  });
  menu.addEventListener('click', (event) => {
    if (event.target === menu) setMenuState(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setMenuState(false);
    }
  });

  const previewName = menu.querySelector<HTMLElement>('[data-menu-preview-name]');
  const projects = [...menu.querySelectorAll<HTMLElement>('[data-menu-project]')];
  const previewImages = [...menu.querySelectorAll<HTMLElement>('[data-menu-preview-image]')];
  for (const project of projects) {
    project.addEventListener('pointerenter', () => {
      if (previewName) previewName.textContent = project.dataset.menuProject ?? '';
      const activeIndex = projects.indexOf(project);
      menu.style.setProperty('--menu-preview-index', String(activeIndex));
      previewImages.forEach((image, index) => {
        image.classList.toggle('is-active', index === activeIndex);
      });
    });
  }
};

const initializePageTransitions = (): void => {
  const transition = document.querySelector<HTMLElement>('[data-page-transition]');
  if (!transition) return;

  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-transition-link]')) {
    link.addEventListener('click', (event) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        link.target === '_blank' ||
        !link.href.startsWith(window.location.origin) ||
        link.pathname === window.location.pathname
      ) {
        return;
      }

      event.preventDefault();
      pageBody.classList.add('is-experimental-leaving');
      transition.removeAttribute('aria-hidden');
      window.setTimeout(
        () => {
          window.location.href = link.href;
        },
        prefersReducedMotion.matches ? 20 : 620
      );
    });
  }
};

const initializeRevealAnimations = (): void => {
  const elements = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
  if (prefersReducedMotion.matches) {
    elements.forEach((element) => element.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
  );
  elements.forEach((element) => observer.observe(element));
};

const initializeHeaderTone = (): void => {
  const header = document.querySelector<HTMLElement>('[data-experimental-header]');
  const sections = [...document.querySelectorAll<HTMLElement>('[data-header-tone]')];
  if (!header || sections.length === 0) return;

  let ticking = false;
  const update = (): void => {
    const probeY = Math.min(72, window.innerHeight * 0.1);
    const horizontalShell = document.querySelector<HTMLElement>('[data-horizontal-shell]');
    const horizontalBounds = horizontalShell?.getBoundingClientRect();

    if (
      horizontalLayoutIsAvailable.matches &&
      horizontalBounds &&
      horizontalBounds.top <= probeY &&
      horizontalBounds.bottom > probeY
    ) {
      ticking = false;
      return;
    }

    const active =
      sections.find((section) => {
        const bounds = section.getBoundingClientRect();
        return bounds.top <= probeY && bounds.bottom > probeY;
      }) ?? sections[0];
    delete header.dataset.markTone;
    header.dataset.tone = active?.dataset.headerTone ?? 'light';
    ticking = false;
  };

  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    },
    { passive: true }
  );
  update();
};

const initializeHorizontalHome = (): void => {
  const shell = document.querySelector<HTMLElement>('[data-horizontal-shell]');
  const track = shell?.querySelector<HTMLElement>('[data-horizontal-track]');
  const header = document.querySelector<HTMLElement>('[data-experimental-header]');
  if (!shell || !track || !header) return;

  const scenes = [...track.querySelectorAll<HTMLElement>('[data-horizontal-scene]')];
  const toneSections = [...track.querySelectorAll<HTMLElement>('[data-horizontal-tone]')];
  const scrollImages = [...track.querySelectorAll<HTMLElement>('.exp-photo')];
  const motionElements = [...track.querySelectorAll<HTMLElement>('[data-horizontal-motion]')];
  const gallery = track.querySelector<HTMLElement>('[data-horizontal-gallery]');
  const wordReveal = track.querySelector<HTMLElement>('[data-word-reveal]');
  const revealWords = wordReveal
    ? [...wordReveal.querySelectorAll<HTMLElement>('[data-progress-word]')]
    : [];

  let travel = 0;
  let targetPosition = 0;
  let renderedPosition = 0;
  let animationFrame = 0;

  const updateSceneEffects = (): void => {
    const viewportWidth = window.innerWidth;
    const viewportProgress = (bounds: DOMRect): number =>
      clamp((viewportWidth - bounds.left) / Math.max(1, viewportWidth + bounds.width));

    for (const scene of scenes) {
      const bounds = scene.getBoundingClientRect();
      const progress = clamp(-bounds.left / Math.max(bounds.width, viewportWidth));
      scene.style.setProperty('--scene-progress', progress.toFixed(4));
      scene.style.setProperty('--scene-flow', viewportProgress(bounds).toFixed(4));
    }

    for (const image of scrollImages) {
      const bounds = image.getBoundingClientRect();
      const progress = viewportProgress(bounds);
      image.style.setProperty('--motion-progress', progress.toFixed(4));
    }

    for (const element of motionElements) {
      const progress = viewportProgress(element.getBoundingClientRect());
      element.style.setProperty('--motion-progress', progress.toFixed(4));
    }

    if (wordReveal && revealWords.length > 0) {
      const bounds = wordReveal.getBoundingClientRect();
      const revealProgress = clamp(
        (viewportWidth * 0.72 - bounds.left) / Math.max(viewportWidth * 0.84, bounds.width * 0.8)
      );
      const revealHead = revealProgress * (revealWords.length + 7);

      revealWords.forEach((word, index) => {
        const opacity = clamp((revealHead - index) / 5, 0.16, 1);
        word.style.setProperty('--word-opacity', opacity.toFixed(3));
      });
    }

    if (gallery) {
      const bounds = gallery.getBoundingClientRect();
      const progress = clamp((viewportWidth - bounds.left) / Math.max(1, viewportWidth));
      const stepTwo = clamp((progress - 0.26) / 0.27);
      const stepThree = clamp((progress - 0.61) / 0.25);
      gallery.style.setProperty('--gallery-progress', progress.toFixed(4));
      gallery.style.setProperty('--gallery-step-two', stepTwo.toFixed(4));
      gallery.style.setProperty('--gallery-step-three', stepThree.toFixed(4));
    }

    const toneAt = (probeX: number): HTMLElement | undefined =>
      toneSections.find((section) => {
        const bounds = section.getBoundingClientRect();
        return bounds.left <= probeX && bounds.right > probeX;
      }) ?? toneSections[0];

    const brandTone = toneAt(Math.min(80, viewportWidth * 0.08));
    const markTone = toneAt(viewportWidth - Math.min(80, viewportWidth * 0.08));

    const shellBounds = shell.getBoundingClientRect();
    if (shellBounds.top <= 72 && shellBounds.bottom > 72 && brandTone) {
      header.dataset.tone = brandTone.dataset.horizontalTone ?? 'light';
      header.dataset.markTone =
        markTone?.dataset.horizontalTone ?? brandTone.dataset.horizontalTone ?? 'light';
    }
  };

  const render = (): void => {
    animationFrame = 0;
    renderedPosition += (targetPosition - renderedPosition) * 0.105;

    if (Math.abs(targetPosition - renderedPosition) < 0.08) {
      renderedPosition = targetPosition;
    }

    track.style.transform = `translate3d(${-renderedPosition.toFixed(2)}px, 0, 0)`;
    shell.style.setProperty(
      '--horizontal-progress',
      travel > 0 ? (renderedPosition / travel).toFixed(5) : '0'
    );
    updateSceneEffects();

    if (renderedPosition !== targetPosition) {
      animationFrame = requestAnimationFrame(render);
    }
  };

  const requestRender = (): void => {
    if (animationFrame !== 0) return;
    animationFrame = requestAnimationFrame(render);
  };

  const updateTarget = (immediate = false): void => {
    if (!horizontalLayoutIsAvailable.matches) return;
    targetPosition = clamp(-shell.getBoundingClientRect().top, 0, travel);

    if (immediate) {
      renderedPosition = targetPosition;
    }

    requestRender();
  };

  const measure = (): void => {
    if (!horizontalLayoutIsAvailable.matches) {
      shell.style.removeProperty('height');
      shell.style.removeProperty('--horizontal-progress');
      track.style.removeProperty('transform');
      return;
    }

    travel = Math.max(0, track.scrollWidth - window.innerWidth);
    shell.style.height = `${Math.ceil(travel + window.innerHeight)}px`;
    updateTarget(true);
  };

  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(track);

  window.addEventListener('scroll', () => updateTarget(), { passive: true });
  window.addEventListener('resize', measure);
  horizontalLayoutIsAvailable.addEventListener('change', measure);

  document.fonts.ready.then(measure).catch(measure);
  measure();
};

const initializeVerticalScrollEffects = (): void => {
  const sections = [...document.querySelectorAll<HTMLElement>('[data-reveal-section]')];
  if (sections.length === 0 || prefersReducedMotion.matches) return;

  let animationFrame = 0;
  const update = (): void => {
    animationFrame = 0;

    for (const section of sections) {
      const bounds = section.getBoundingClientRect();
      const progress = clamp(
        (window.innerHeight - bounds.top) / Math.max(1, window.innerHeight + bounds.height)
      );
      section.style.setProperty('--vertical-progress', progress.toFixed(4));
    }
  };

  const requestUpdate = (): void => {
    if (animationFrame !== 0) return;
    animationFrame = requestAnimationFrame(update);
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  update();
};

const initializeParallax = (): void => {
  if (prefersReducedMotion.matches) return;
  const elements = [...document.querySelectorAll<HTMLElement>('[data-parallax]')];
  if (elements.length === 0) return;

  let ticking = false;
  const update = (): void => {
    for (const element of elements) {
      const bounds = element.getBoundingClientRect();
      const speed = Number(element.dataset.parallax ?? 0.08);
      const offset = (bounds.top + bounds.height / 2 - window.innerHeight / 2) * speed;
      element.style.setProperty('--parallax-y', `${offset.toFixed(2)}px`);
    }
    ticking = false;
  };
  const requestUpdate = (): void => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  update();
};

const initializeCursor = (): void => {
  const cursor = document.querySelector<HTMLElement>('[data-experimental-cursor]');
  const label = cursor?.querySelector<HTMLElement>('[data-cursor-label]');
  if (!cursor || !label || !pointerIsFine.matches || prefersReducedMotion.matches) return;

  let pointerX = -100;
  let pointerY = -100;
  let cursorX = -100;
  let cursorY = -100;

  window.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    cursor.classList.add('is-active');
  });
  document.addEventListener('pointerover', (event) => {
    const target = (event.target as Element).closest<HTMLElement>('[data-cursor]');
    const text = target?.dataset.cursor ?? '';
    cursor.classList.toggle('is-expanded', Boolean(text));
    label.textContent = text;
  });

  const render = (): void => {
    cursorX += (pointerX - cursorX) * 0.18;
    cursorY += (pointerY - cursorY) * 0.18;
    cursor.style.translate = `${cursorX}px ${cursorY}px`;
    requestAnimationFrame(render);
  };
  render();
};

const initializeProjectRail = (): void => {
  const rail = document.querySelector<HTMLElement>('[data-project-rail]');
  if (!rail) return;

  const scrollByCard = (direction: number): void => {
    rail.scrollBy({
      left: direction * Math.min(window.innerWidth * 0.78, 780),
      behavior: prefersReducedMotion.matches ? 'auto' : 'smooth'
    });
  };
  document
    .querySelector<HTMLElement>('[data-project-prev]')
    ?.addEventListener('click', () => scrollByCard(-1));
  document
    .querySelector<HTMLElement>('[data-project-next]')
    ?.addEventListener('click', () => scrollByCard(1));
};

const initializeGallery = (): void => {
  const dialog = document.querySelector<HTMLDialogElement>('[data-gallery-dialog]');
  const dialogMedia = dialog?.querySelector<HTMLElement>('[data-gallery-dialog-media]');
  if (!dialog || !dialogMedia) return;

  for (const trigger of document.querySelectorAll<HTMLElement>('[data-gallery-item]')) {
    trigger.addEventListener('click', () => {
      dialogMedia.className = 'experimental-dialog__media';
      dialogMedia.replaceChildren();
      const image = trigger.querySelector<HTMLImageElement>('img');
      if (image) {
        const dialogImage = image.cloneNode(true) as HTMLImageElement;
        dialogImage.removeAttribute('loading');
        dialogMedia.append(dialogImage);
      } else {
        dialogMedia.className = trigger.className.replace('gallery-grid__item', '');
        dialogMedia.classList.add('experimental-dialog__media');
      }
      dialogMedia.setAttribute(
        'aria-label',
        trigger.getAttribute('aria-label') ?? 'Dettaglio del progetto'
      );
      dialog.showModal();
      pageBody.classList.add('is-gallery-open');
    });
  }
  const close = (): void => {
    dialog.close();
    pageBody.classList.remove('is-gallery-open');
  };
  dialog.querySelector<HTMLElement>('[data-gallery-close]')?.addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
};

const initializeContactForm = (): void => {
  const form = document.querySelector<HTMLFormElement>('[data-experimental-contact-form]');
  const status = form?.querySelector<HTMLElement>('[data-form-status]');
  if (!form || !status) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    status.textContent = 'Messaggio demo ricevuto. Nessun dato è stato inviato.';
    form.reset();
  });
};

const initializeExperimentalSite = (): void => {
  documentRoot.dataset.experimentalReady = 'initializing';
  initializePreloader();
  initializeMenu();
  initializePageTransitions();
  initializeRevealAnimations();
  initializeHorizontalHome();
  initializeHeaderTone();
  initializeVerticalScrollEffects();
  initializeParallax();
  initializeCursor();
  initializeProjectRail();
  initializeGallery();
  initializeContactForm();
  documentRoot.dataset.experimentalReady = 'ready';
};

initializeExperimentalSite();
