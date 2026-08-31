export {};

const page = document.querySelector<HTMLElement>('[data-canals-page]');
const shell = document.querySelector<HTMLElement>('[data-canals-shell]');
const viewport = document.querySelector<HTMLElement>('[data-canals-viewport]');
const track = document.querySelector<HTMLElement>('[data-canals-track]');
const scenes = [...document.querySelectorAll<HTMLElement>('[data-canals-scene]')];
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const horizontalMode = window.matchMedia(
  '(min-width: 58rem) and (prefers-reduced-motion: no-preference)'
);

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

let horizontalDistance = 0;
let shellTop = 0;
let currentX = 0;
let targetX = 0;
let animationFrame = 0;

const revealElements = [
  ...document.querySelectorAll<HTMLElement>('[data-reveal], [data-reveal-lines], [data-rule]')
];
const mediaElements = [...document.querySelectorAll<HTMLElement>('[data-canals-media]')];
const floatElements = [...document.querySelectorAll<HTMLElement>('[data-float]')];

const updateMeasurements = (): void => {
  if (!shell || !track) return;

  if (!horizontalMode.matches) {
    shell.style.removeProperty('--canals-scroll-height');
    track.style.removeProperty('transform');
    currentX = 0;
    targetX = 0;
    return;
  }

  const viewportWidth = viewport?.clientWidth ?? window.innerWidth;
  horizontalDistance = Math.max(0, track.scrollWidth - viewportWidth);
  shellTop = shell.getBoundingClientRect().top + window.scrollY;
  shell.style.setProperty('--canals-scroll-height', `${horizontalDistance + window.innerHeight}px`);
};

const sceneUnderRail = (): HTMLElement | undefined => {
  const sampleX = Math.max(72, window.innerWidth * 0.045);
  return scenes.find((scene) => {
    const rect = scene.getBoundingClientRect();
    return rect.left <= sampleX && rect.right > sampleX;
  });
};

const updateVisualState = (): void => {
  if (!horizontalMode.matches || !track) return;

  const delta = targetX - currentX;
  currentX += Math.abs(delta) < 0.08 ? delta : delta * 0.085;
  track.style.transform = `translate3d(${-currentX}px, 0, 0)`;

  const viewportBounds = viewport?.getBoundingClientRect();
  const viewportCenter = viewportBounds
    ? viewportBounds.left + viewportBounds.width * 0.5
    : window.innerWidth * 0.5;
  const progress = horizontalDistance > 0 ? currentX / horizontalDistance : 0;
  document.documentElement.style.setProperty('--canals-progress', String(progress));

  for (const element of revealElements) {
    const rect = element.getBoundingClientRect();
    const visible = rect.left < window.innerWidth * 0.9 && rect.right > window.innerWidth * 0.1;
    element.classList.toggle('is-visible', visible);
  }

  for (const element of mediaElements) {
    const rect = element.getBoundingClientRect();
    const distance = (rect.left + rect.width * 0.5 - viewportCenter) / window.innerWidth;
    const strength = Number(element.dataset.parallax ?? 1);
    element.style.setProperty('--media-shift', `${clamp(distance * -7 * strength, -9, 9)}%`);
    element.style.setProperty('--media-progress', String(clamp(0.5 - distance * 0.58)));
  }

  for (const element of floatElements) {
    const rect = element.getBoundingClientRect();
    const distance = (rect.left + rect.width * 0.5 - viewportCenter) / window.innerWidth;
    element.style.setProperty('--float-x', `${clamp(distance * -38, -44, 44)}px`);
    element.style.setProperty('--float-r', `${clamp(distance * -5, -6, 6)}deg`);
  }

  for (const scene of scenes) {
    const rect = scene.getBoundingClientRect();
    const rawProgress = (window.innerWidth - rect.left) / (window.innerWidth + rect.width);
    scene.style.setProperty('--scene-progress', String(clamp(rawProgress)));
    scene.classList.toggle('is-current', rect.left < viewportCenter && rect.right > viewportCenter);
  }

  const activeScene = sceneUnderRail();
  if (activeScene && page) page.dataset.canalsTone = activeScene.dataset.canalsTone ?? 'paper';

  if (Math.abs(targetX - currentX) > 0.08)
    animationFrame = requestAnimationFrame(updateVisualState);
  else animationFrame = 0;
};

const requestVisualUpdate = (): void => {
  if (!horizontalMode.matches || !shell) return;
  targetX = clamp(window.scrollY - shellTop, 0, horizontalDistance);
  if (!animationFrame) animationFrame = requestAnimationFrame(updateVisualState);
};

const revealVerticalElements = (): void => {
  if (horizontalMode.matches) return;
  for (const element of revealElements) {
    const rect = element.getBoundingClientRect();
    element.classList.toggle(
      'is-visible',
      rect.top < window.innerHeight * 0.9 && rect.bottom > window.innerHeight * 0.1
    );
  }
};

const scrollToScene = (target: HTMLElement, behavior: ScrollBehavior = 'smooth'): void => {
  if (!shell || !horizontalMode.matches) {
    target.scrollIntoView({ behavior, block: 'start' });
    return;
  }

  window.scrollTo({
    top: shellTop + clamp(target.offsetLeft, 0, horizontalDistance),
    behavior
  });
};

const initializeNavigation = (): void => {
  const menu = document.querySelector<HTMLElement>('[data-canals-menu]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-canals-menu-toggle]');
  const menuLabel = document.querySelector<HTMLElement>('[data-canals-menu-label]');

  const setMenu = (open: boolean): void => {
    if (!menu || !toggle || !page) return;
    toggle.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    page.classList.toggle('is-canals-menu-open', open);
    if (menuLabel) menuLabel.textContent = open ? 'Chiudi il menu' : 'Apri il menu';
    if (open) menu.querySelector<HTMLAnchorElement>('a')?.focus({ preventScroll: true });
  };

  toggle?.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenu(false);
  });

  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-canals-jump]')) {
    link.addEventListener('click', (event) => {
      const id = new URL(link.href).hash.slice(1);
      const target = document.getElementById(id);
      if (!target) return;
      event.preventDefault();
      setMenu(false);
      scrollToScene(target);
      history.replaceState(null, '', `#${id}`);
    });
  }

  document.querySelector<HTMLButtonElement>('[data-canals-next]')?.addEventListener('click', () => {
    const target = scenes[1];
    if (target) scrollToScene(target);
  });
};

const initializeDrag = (): void => {
  if (!viewport) return;
  let dragging = false;
  let startX = 0;
  let startScroll = 0;

  viewport.addEventListener('pointerdown', (event) => {
    if (!horizontalMode.matches || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest('a, button')) return;
    dragging = true;
    startX = event.clientX;
    startScroll = window.scrollY;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-dragging');
  });

  viewport.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    window.scrollTo({ top: startScroll + (startX - event.clientX) * 1.7 });
  });

  const finishDrag = (event: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    viewport.releasePointerCapture(event.pointerId);
    viewport.classList.remove('is-dragging');
  };

  viewport.addEventListener('pointerup', finishDrag);
  viewport.addEventListener('pointercancel', finishDrag);
};

const initializeLoader = (): void => {
  const loader = document.querySelector<HTMLElement>('[data-canals-loader]');
  const value = document.querySelector<HTMLElement>('[data-loader-value]');
  if (!loader || !page) return;

  const startedAt = performance.now();
  const duration = reducedMotion.matches ? 120 : 1_650;
  const update = (now: number): void => {
    const progress = clamp((now - startedAt) / duration);
    if (value) value.textContent = String(Math.round(progress * 100)).padStart(3, '0');

    if (progress < 1) {
      requestAnimationFrame(update);
      return;
    }

    page.classList.add('is-canals-loaded');
    page.classList.remove('is-canals-loading');
    window.setTimeout(
      () => {
        loader.remove();
        document.documentElement.dataset.canalsReady = 'true';
        updateMeasurements();
        requestVisualUpdate();
      },
      reducedMotion.matches ? 30 : 1_050
    );
  };

  requestAnimationFrame(update);
};

initializeNavigation();
initializeDrag();
initializeLoader();
updateMeasurements();
requestVisualUpdate();
revealVerticalElements();

window.addEventListener('scroll', () => {
  requestVisualUpdate();
  revealVerticalElements();
});
window.addEventListener('resize', () => {
  updateMeasurements();
  requestVisualUpdate();
  revealVerticalElements();
});
horizontalMode.addEventListener('change', () => {
  updateMeasurements();
  requestVisualUpdate();
  revealVerticalElements();
});

if ('ResizeObserver' in window && track) {
  new ResizeObserver(updateMeasurements).observe(track);
}
