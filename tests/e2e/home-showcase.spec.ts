import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const rootSelector = '[data-showcase-root]';
const canvasSelector = '[data-showcase-glass-canvas]';

const waitForWebGLHero = async (page: Page) => {
  const root = page.locator(rootSelector);
  await expect(root).toHaveAttribute('data-showcase-glass-renderer', 'webgl', {
    timeout: 20_000
  });
  await expect(root).toHaveAttribute('data-showcase-state', /^(interactive|ambient|reduced)$/, {
    timeout: 20_000
  });
};

const readCustomProperty = async (page: Page, property: string) =>
  page.locator(rootSelector).evaluate((element, name) => {
    return Number.parseFloat(element.style.getPropertyValue(name)) || 0;
  }, property);

test('carica una sola volta il GLB e sostituisce davvero tutti i placeholder', async ({ page }) => {
  const runtimeErrors: string[] = [];
  const heroWarnings: string[] = [];
  const modelRequests = new Map<string, number>();

  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
    if (message.type() === 'warning' && message.text().includes('[Hero glass]')) {
      heroWarnings.push(message.text());
    }
  });
  page.on('request', (request) => {
    const modelPath = new URL(request.url()).pathname;
    if (modelPath.startsWith('/3D_models/') && modelPath.endsWith('.glb')) {
      modelRequests.set(modelPath, (modelRequests.get(modelPath) ?? 0) + 1);
    }
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await waitForWebGLHero(page);

  const root = page.locator(rootSelector);
  const canvas = page.locator(canvasSelector);

  expect(Object.fromEntries(modelRequests)).toEqual({
    '/3D_models/glass_plate_web.glb': 1,
    '/3D_models/competenze_in_vetrina.glb': 1,
    '/3D_models/idee_in_movimento.glb': 1,
    '/3D_models/glass_cubes_collection_1.glb': 1
  });
  await expect(canvas).toHaveAttribute('data-glass-model', '/3D_models/glass_plate_web.glb');
  await expect(canvas).toHaveAttribute(
    'data-back-slogan-model',
    '/3D_models/competenze_in_vetrina.glb'
  );
  await expect(canvas).toHaveAttribute(
    'data-front-slogan-model',
    '/3D_models/idee_in_movimento.glb'
  );
  await expect(canvas).toHaveAttribute('data-glass-source-mesh', 'GlassPlate_Main002');
  await expect(canvas).toHaveAttribute('data-glass-mesh-selection', 'fallback');
  await expect(canvas).toHaveAttribute('data-glass-material', 'mesh-physical-transmission');
  await expect(canvas).toHaveAttribute('data-glass-refraction-backdrop', 'procedural-scene');
  await expect(canvas).toHaveAttribute('data-glass-debug', 'off');
  await expect(canvas).toHaveAttribute('data-glass-thickness', '0.3');
  await expect(canvas).toHaveAttribute('data-glass-ior', '1.5');
  await expect(canvas).toHaveAttribute('data-glass-environment', 'room-environment-pmrem');
  await expect(canvas).toHaveAttribute('data-glass-physics', 'spring-damper');
  await expect(canvas).toHaveAttribute('data-glass-quality', 'high');
  await expect(canvas).toHaveAttribute('data-glass-plate-count', '12');
  await expect(canvas).toHaveAttribute('data-glass-render-state', 'rendered');
  await expect(canvas).toHaveAttribute('data-glass-back-slogan-mesh', 'TXT_COMPETENZE_IN_VETRINA');
  await expect(canvas).toHaveAttribute('data-glass-front-slogan-mesh', 'TXT_IDEE_IN_MOVIMENTO');
  await expect(canvas).toHaveAttribute('data-glass-back-slogan-layer', 'behind-glass');
  await expect(canvas).toHaveAttribute('data-glass-front-slogan-layer', 'foreground');
  await expect(canvas).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('[data-showcase-pane]')).toHaveCount(0);
  await expect(page.locator('.home-showcase__pane')).toHaveCount(0);
  await expect(page.locator('[data-showcase-back-text]')).toHaveCount(0);
  await expect(page.locator('[data-showcase-front-text]')).toHaveCount(0);
  await expect(page.locator(canvasSelector)).toHaveCount(1);

  const visualState = await root.evaluate((element) => {
    const canvasElement = element.querySelector<HTMLCanvasElement>('[data-showcase-glass-canvas]');
    const fallbackElement = element.querySelector<HTMLElement>('[data-showcase-glass-fallback]');
    return {
      canvasOpacity: canvasElement
        ? Number.parseFloat(getComputedStyle(canvasElement).opacity)
        : -1,
      canvasPointerEvents: canvasElement
        ? getComputedStyle(canvasElement).pointerEvents
        : 'missing',
      fallbackOpacity: fallbackElement
        ? Number.parseFloat(getComputedStyle(fallbackElement).opacity)
        : -1,
      overflows: document.documentElement.scrollWidth > document.documentElement.clientWidth
    };
  });
  expect(visualState).toEqual({
    canvasOpacity: 1,
    canvasPointerEvents: 'none',
    fallbackOpacity: 0,
    overflows: false
  });

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Competenze in vetrina');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Idee in movimento');
  await expect(page.getByRole('link', { name: /Esplora il catalogo/ })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
  expect(
    heroWarnings.every(
      (warning) => warning.includes('GlassPlate_Main') && warning.includes('GlassPlate_Main002')
    )
  ).toBe(true);
});

test('normalizza il puntatore e torna gradualmente allo stato neutro', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await waitForWebGLHero(page);

  const stage = page.locator('[data-showcase-stage]');
  const canvas = page.locator(canvasSelector);
  const bounds = await stage.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;

  await page.mouse.move(bounds.x + bounds.width * 0.76, bounds.y + bounds.height * 0.31);
  await expect(canvas).toHaveAttribute('data-glass-pointer', 'active');
  const normalized = await canvas.evaluate((element) => ({
    x: Number.parseFloat(element.dataset.glassPointerX ?? '0'),
    y: Number.parseFloat(element.dataset.glassPointerY ?? '0')
  }));
  expect(normalized.x).toBeGreaterThan(0.45);
  expect(normalized.x).toBeLessThanOrEqual(1);
  expect(normalized.y).toBeGreaterThan(0.25);
  expect(normalized.y).toBeLessThanOrEqual(1);

  await page.mouse.move(2, 2);
  await expect(canvas).toHaveAttribute('data-glass-pointer', 'neutral');
  await expect(canvas).toHaveAttribute('data-glass-pointer-x', '0');
  await expect(canvas).toHaveAttribute('data-glass-pointer-y', '0');
});

test('riusa lo scroll esistente per aprire la composizione senza scatti', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await waitForWebGLHero(page);

  const root = page.locator(rootSelector);
  const canvas = page.locator(canvasSelector);
  const sceneMetrics = await page.locator('[data-showcase-scroll-scene]').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      top: bounds.top + window.scrollY,
      travel: bounds.height - window.innerHeight
    };
  });

  await page.evaluate(({ top, travel }) => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, top + travel * 0.62);
  }, sceneMetrics);
  await expect
    .poll(async () =>
      Number.parseFloat((await root.getAttribute('data-showcase-scroll-progress')) ?? '0')
    )
    .toBeGreaterThan(0.56);
  await expect
    .poll(async () =>
      Number.parseFloat((await canvas.getAttribute('data-glass-scroll-progress')) ?? '0')
    )
    .toBeGreaterThan(0.56);
  await page.evaluate(({ top, travel }) => window.scrollTo(0, top + travel * 0.995), sceneMetrics);
  await expect
    .poll(async () =>
      Number.parseFloat((await root.getAttribute('data-showcase-scroll-progress')) ?? '0')
    )
    .toBeGreaterThan(0.98);
  await expect.poll(() => readCustomProperty(page, '--glass-exit-opacity')).toBeLessThan(0.08);

  const stickyTop = await page
    .locator('[data-showcase-stage]')
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(Math.abs(stickyTop)).toBeLessThan(2);
  await page.evaluate(() => window.scrollBy(0, Math.max(180, window.innerHeight * 0.25)));
  await expect
    .poll(() =>
      page
        .locator('[data-showcase-stage]')
        .evaluate((element) => element.getBoundingClientRect().top)
    )
    .toBeLessThan(-80);
});

test('ricalcola qualità e numero di lastre ai breakpoint senza overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await waitForWebGLHero(page);
  const canvas = page.locator(canvasSelector);

  await expect(canvas).toHaveAttribute('data-glass-quality', 'high');
  await expect(canvas).toHaveAttribute('data-glass-plate-count', '12');

  await page.setViewportSize({ width: 900, height: 800 });
  await expect(canvas).toHaveAttribute('data-glass-quality', 'balanced');
  await expect(canvas).toHaveAttribute('data-glass-plate-count', '9');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toHaveAttribute('data-glass-quality', 'mobile');
  await expect(canvas).toHaveAttribute('data-glass-plate-count', '7');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
    )
  ).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Competenze in vetrina');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Idee in movimento');
  await expect(page.getByRole('link', { name: /Esplora il catalogo/ })).toBeVisible();
});

test('reduced motion conserva il vetro ma blocca moto continuo, parallax e scroll', async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await waitForWebGLHero(page);

  const root = page.locator(rootSelector);
  const canvas = page.locator(canvasSelector);
  await expect(root).toHaveAttribute('data-showcase-state', 'reduced');
  await expect(root).toHaveAttribute('data-showcase-mode', 'reduced');
  await expect(canvas).toHaveAttribute('data-glass-motion', 'reduced');
  await expect(canvas).toHaveAttribute('data-glass-pointer', 'disabled');
  await expect(canvas).toHaveAttribute('data-glass-render-state', 'rendered');

  const sceneHeight = await page
    .locator('[data-showcase-scroll-scene]')
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(Math.abs(sceneHeight - 900)).toBeLessThanOrEqual(1);
  await page.evaluate(() => window.scrollTo(0, 700));
  expect(Number.parseFloat((await root.getAttribute('data-showcase-scroll-progress')) ?? '0')).toBe(
    0
  );
});

test('touch usa il moto ambientale alleggerito e non dipende dall’hover', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4321',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    await waitForWebGLHero(page);

    const root = page.locator(rootSelector);
    const canvas = page.locator(canvasSelector);
    await expect(root).toHaveAttribute('data-showcase-mode', 'ambient');
    await expect(root).toHaveAttribute('data-showcase-state', 'ambient');
    await expect(canvas).toHaveAttribute('data-glass-quality', 'mobile');
    await expect(canvas).toHaveAttribute('data-glass-plate-count', '7');
    await expect(canvas).toHaveAttribute('data-glass-pointer', 'ambient');

    const stage = page.locator('[data-showcase-stage]');
    const bounds = await stage.boundingBox();
    expect(bounds).not.toBeNull();
    if (!bounds) return;
    await stage.dispatchEvent('pointermove', {
      clientX: bounds.x + bounds.width * 0.8,
      clientY: bounds.y + bounds.height * 0.3,
      pointerType: 'touch'
    });
    await expect(canvas).toHaveAttribute('data-glass-pointer', 'ambient');

    const sceneMetrics = await page.locator('[data-showcase-scroll-scene]').evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top + window.scrollY, travel: rect.height - window.innerHeight };
    });
    await page.evaluate(({ top, travel }) => window.scrollTo(0, top + travel * 0.55), sceneMetrics);
    await expect
      .poll(async () =>
        Number.parseFloat((await root.getAttribute('data-showcase-scroll-progress')) ?? '0')
      )
      .toBeGreaterThan(0.48);
  } finally {
    await context.close();
  }
});

test('WebGL non disponibile mantiene testo, CTA e fallback statico', async ({ page }) => {
  await page.addInitScript(() => {
    const nativeGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(
      this: HTMLCanvasElement,
      contextId: string,
      ...options: unknown[]
    ) {
      if (contextId === 'webgl2') return null;
      return nativeGetContext.call(this, contextId, ...options);
    } as typeof nativeGetContext;
  });
  await page.goto('/');

  const root = page.locator(rootSelector);
  const canvas = page.locator(canvasSelector);
  await expect(root).toHaveAttribute('data-showcase-glass-renderer', 'fallback');
  await expect(root).toHaveAttribute('data-showcase-state', /^(interactive|ambient)$/);
  expect(
    await canvas.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity))
  ).toBe(0);
  expect(
    await page
      .locator('[data-showcase-glass-fallback]')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity))
  ).toBe(1);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Competenze in vetrina');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Idee in movimento');
  await expect(page.locator('.home-showcase__fallback-slogan--back')).toBeVisible();
  await expect(page.locator('.home-showcase__fallback-slogan--front')).toBeVisible();
  await expect(page.getByRole('link', { name: /Esplora il catalogo/ })).toBeVisible();
});

test('cleanup e ripristino non duplicano canvas durante la navigazione client-side', async ({
  page
}) => {
  await page.goto('/');
  await waitForWebGLHero(page);
  const root = page.locator(rootSelector);
  const canvas = page.locator(canvasSelector);

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(root).toHaveAttribute('data-showcase-state', 'destroyed');
  await expect(root).not.toHaveAttribute('data-showcase-glass-renderer', /.+/);
  await expect(canvas).not.toHaveAttribute('data-glass-material', /.+/);
  await expect(canvas).not.toHaveAttribute('data-glass-debug', /.+/);
  await expect(canvas).not.toHaveAttribute('data-glass-environment', /.+/);

  await page.evaluate(() => {
    const event = new PageTransitionEvent('pageshow', { persisted: true });
    window.dispatchEvent(event);
    window.dispatchEvent(event);
  });
  await waitForWebGLHero(page);
  await expect(page.locator(canvasSelector)).toHaveCount(1);
});

test('senza JavaScript conserva contenuto, fallback e layout responsive', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4321',
    javaScriptEnabled: false
  });
  try {
    const page = await context.newPage();
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 900, height: 800 },
      { width: 390, height: 844 }
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Competenze in vetrina');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Idee in movimento');
      await expect(page.locator(rootSelector)).not.toHaveAttribute('data-showcase-state', /.+/);
      await expect(page.locator('[data-showcase-glass-fallback]')).toBeVisible();
      await expect(page.locator('[data-showcase-pane]')).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= document.documentElement.clientWidth
        )
      ).toBe(true);
    }
  } finally {
    await context.close();
  }
});
