import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

test('mantiene un solo cubo semplice senza selettori di forma o articolo', async ({ page }) => {
  await page.goto('/portfolio/');
  const concept = page.locator('[data-glass-cube-concept-root]');
  const catalog = page.locator('[data-home-catalog-showcase]');

  await expect(concept.getByRole('heading', { level: 2 })).toHaveText(
    'Un acquisto che apre una conversazione'
  );
  await expect(concept.getByRole('link', { name: 'Sfoglia i quattro articoli' })).toHaveAttribute(
    'href',
    '/catalog/'
  );
  await expect(concept.getByRole('link', { name: 'Conosci il profilo' })).toHaveCount(0);
  await expect(concept.locator('[role="tab"], [data-glass-cube-variant]')).toHaveCount(0);
  await expect(concept.locator('button')).toHaveCount(0);
  await expect(concept.locator('[data-glass-cube-canvas]')).toHaveCount(1);
  expect(
    await concept.evaluate(
      (element, nextSection) =>
        element.compareDocumentPosition(document.querySelector(nextSection)!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
      '[data-home-catalog-showcase]'
    )
  ).toBeTruthy();
  await expect(catalog).toHaveCount(1);
});

test('usa sempre il cubo XL del GLB semplice con qualità adattiva', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/portfolio/');
  const concept = page.locator('[data-glass-cube-concept-root]');
  const canvas = concept.locator('[data-glass-cube-canvas]');
  const stage = concept.locator('[data-glass-cube-stage]');

  await concept.scrollIntoViewIfNeeded();
  await expect(concept).toHaveAttribute('data-glass-cube-renderer', 'webgl', {
    timeout: 20_000
  });
  await expect(concept).toHaveAttribute(
    'data-glass-cube-model',
    '/3D_models/glass_cubes_collection_1.glb'
  );
  await expect(concept).toHaveAttribute('data-glass-cube-source-mesh', 'GlassCube_01_XL');
  await expect(concept).not.toHaveAttribute('data-glass-cube-variant-count', /.+/);
  await expect(concept).not.toHaveAttribute('data-glass-cube-active-variant', /.+/);
  await expect(canvas).toHaveAttribute('data-glass-cube-state', 'rendered');
  await expect(canvas).toHaveAttribute('data-glass-cube-quality', 'high');
  await expect(stage).toHaveAttribute('aria-hidden', 'true');
  await expect(concept.locator('.glass-cube-fallback')).toHaveCSS('opacity', '0');

  await page.setViewportSize({ width: 900, height: 900 });
  await expect(canvas).toHaveAttribute('data-glass-cube-quality', 'balanced');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toHaveAttribute('data-glass-cube-quality', 'mobile');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
    )
  ).toBe(true);
});

test('consente rotazione leggera e drag senza cambiare geometria', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/portfolio/');
  const concept = page.locator('[data-glass-cube-concept-root]');
  const canvas = concept.locator('[data-glass-cube-canvas]');
  const stage = concept.locator('[data-glass-cube-stage]');
  await concept.scrollIntoViewIfNeeded();
  await expect(concept).toHaveAttribute('data-glass-cube-renderer', 'webgl', {
    timeout: 20_000
  });

  const bounds = await stage.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) return;
  const start = {
    x: bounds.x + bounds.width * 0.5,
    y: bounds.y + bounds.height * 0.5
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await expect(canvas).toHaveAttribute('data-glass-cube-interaction', 'dragging');
  await expect(concept).toHaveAttribute('data-glass-cube-dragging', '');
  await page.mouse.move(start.x + 130, start.y - 40, { steps: 4 });
  await page.mouse.up();
  await expect(concept).not.toHaveAttribute('data-glass-cube-dragging', /.+/);
  await expect(canvas).toHaveAttribute('data-glass-cube-interaction', 'idle');
  await expect(concept).toHaveAttribute('data-glass-cube-source-mesh', 'GlassCube_01_XL');
});

test('usa una posa statica con reduced motion e un fallback senza WebGL2', async ({ browser }) => {
  const reducedContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4321',
    reducedMotion: 'reduce'
  });
  try {
    const reducedPage = await reducedContext.newPage();
    await reducedPage.goto('/');
    const concept = reducedPage.locator('[data-glass-cube-concept-root]');
    await expect(concept).toHaveAttribute('data-glass-cube-renderer', 'webgl', {
      timeout: 20_000
    });
    await expect(concept.locator('[data-glass-cube-canvas]')).toHaveAttribute(
      'data-glass-cube-animation',
      'static'
    );
    await expect(concept.locator('[data-glass-cube-canvas]')).toHaveAttribute(
      'data-glass-cube-interaction',
      'reduced'
    );
    await expect(concept.locator('[role="tab"]')).toHaveCount(0);
  } finally {
    await reducedContext.close();
  }

  const fallbackContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4321' });
  await fallbackContext.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      options?: CanvasRenderingContext2DSettings
    ) {
      if (contextId === 'webgl2') return null;
      return originalGetContext.call(this, contextId, options);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  try {
    const fallbackPage = await fallbackContext.newPage();
    await fallbackPage.goto('/');
    const concept = fallbackPage.locator('[data-glass-cube-concept-root]');
    await expect(concept).toHaveAttribute('data-glass-cube-renderer', 'fallback');
    await expect(concept.locator('.glass-cube-fallback')).toHaveCSS('opacity', '1');
    await expect(concept.getByRole('link', { name: 'Sfoglia i quattro articoli' })).toBeVisible();
  } finally {
    await fallbackContext.close();
  }
});
