import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

test('colloca il concetto subito prima del carosello e conserva contenuti e azioni', async ({
  page
}) => {
  await page.goto('/');
  const concept = page.locator('[data-glass-human-root]');
  const catalog = page.locator('[data-home-catalog-showcase]');

  await expect(concept.getByRole('heading', { level: 2 })).toHaveText(
    'Un acquisto che apre una conversazione'
  );
  await expect(concept).toContainText(
    'Qui il linguaggio dell’e-commerce rende esplorabile un percorso professionale.'
  );
  await expect(concept.getByRole('link', { name: 'Sfoglia tutto' })).toHaveAttribute(
    'href',
    '/catalog/'
  );
  await expect(concept.getByRole('link', { name: 'Conosci il profilo' })).toHaveAttribute(
    'href',
    '/about/'
  );
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

test('renderizza la figura cubica in un canvas decorativo con qualità adattiva', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const concept = page.locator('[data-glass-human-root]');
  const canvas = concept.locator('[data-glass-human-canvas]');
  const stage = concept.locator('[data-glass-human-stage]');

  await concept.evaluate((element) => element.scrollIntoView());
  await expect(concept).toHaveAttribute('data-glass-human-renderer', 'webgl');
  await expect(canvas).toHaveAttribute('data-glass-human-state', 'rendered');
  await expect(canvas).toHaveAttribute('data-glass-human-quality', 'high');
  await expect(stage).toHaveAttribute('aria-hidden', 'true');
  await expect(concept.locator('.glass-human-fallback')).toHaveCSS('opacity', '0');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(canvas).toHaveAttribute('data-glass-human-quality', 'mobile');
});

test('usa una posa statica con reduced motion e un fallback senza WebGL2', async ({ browser }) => {
  const reducedContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4321',
    reducedMotion: 'reduce'
  });
  try {
    const reducedPage = await reducedContext.newPage();
    await reducedPage.goto('/');
    const concept = reducedPage.locator('[data-glass-human-root]');
    await expect(concept).toHaveAttribute('data-glass-human-renderer', 'webgl');
    await expect(concept.locator('[data-glass-human-canvas]')).toHaveAttribute(
      'data-glass-human-state',
      'rendered'
    );
    await expect(concept.locator('[data-glass-human-canvas]')).toHaveAttribute(
      'data-glass-human-gesture',
      'offering'
    );
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
    const concept = fallbackPage.locator('[data-glass-human-root]');
    await expect(concept).toHaveAttribute('data-glass-human-renderer', 'fallback');
    await expect(concept.locator('.glass-human-fallback')).toHaveCSS('opacity', '1');
    await expect(concept.getByRole('link', { name: 'Sfoglia tutto' })).toBeVisible();
  } finally {
    await fallbackContext.close();
  }
});
