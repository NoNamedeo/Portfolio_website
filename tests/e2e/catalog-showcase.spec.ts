import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const waitForTwoFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

const animationSnapshot = (page: Page) =>
  page.locator('[data-product-marquee-track]').evaluate((track) => {
    const animation = track.getAnimations()[0];
    const duration = animation?.effect?.getTiming().duration;
    return {
      count: track.getAnimations().length,
      duration: typeof duration === 'number' ? duration : 0,
      playbackRate: animation?.playbackRate ?? 0,
      playState: animation?.playState ?? 'missing'
    };
  });

test('usa gli articoli reali e copie decorative senza contaminare la pagina catalogo', async ({
  page
}) => {
  await page.goto('/');
  const showcase = page.locator('[data-home-catalog-showcase]');
  await expect(showcase).toHaveCount(1);
  await expect(
    showcase.locator('[data-product-marquee-original] [data-marquee-item-link]')
  ).toHaveCount(4);
  const originalLinks = await showcase
    .locator('[data-product-marquee-original] [data-marquee-item-link]')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  expect(originalLinks).toEqual([
    '/catalog/signal-archive/',
    '/catalog/civic-loop/',
    '/catalog/open-lab/',
    '/catalog/product-prototype-sprint/'
  ]);

  const copy = showcase.locator('[data-product-marquee-copy]');
  await expect(copy).toHaveAttribute('aria-hidden', 'true');
  await expect(copy.locator('[data-marquee-item-link]')).toHaveCount(4);
  expect(
    await copy
      .locator('[data-marquee-item-link]')
      .evaluateAll((links) => links.every((link) => link.getAttribute('tabindex') === '-1'))
  ).toBe(true);
  await expect(showcase.getByRole('link', { name: /Vai al catalogo/ })).toHaveAttribute(
    'href',
    '/catalog/'
  );
  await expect(page.getByRole('heading', { name: 'Esplora per categoria' })).toHaveCount(0);

  await page.goto('/catalog/');
  await expect(page.getByRole('heading', { name: 'Esplora per categoria' })).toHaveCount(0);
  await expect(page.locator('[data-catalog-categories]')).toHaveCount(0);
  await expect(page.locator('[data-catalog-item]')).toHaveCount(6);
});

test('esegue un loop continuo e gestisce hover, focus, resize e cleanup', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const root = page.locator('[data-home-catalog-showcase]');
  const viewport = root.locator('[data-product-marquee-viewport]');
  const track = root.locator('[data-product-marquee-track]');
  await root.scrollIntoViewIfNeeded();
  await expect(root).toHaveAttribute('data-marquee-state', 'running');

  const initial = await animationSnapshot(page);
  expect(initial.count).toBe(1);
  expect(initial.duration).toBeGreaterThanOrEqual(25_000);
  expect(initial.duration).toBeLessThanOrEqual(50_000);
  expect(initial.playState).toBe('running');
  const groupWidths = await root.evaluate((element) => {
    const original = element.querySelector<HTMLElement>('[data-product-marquee-original]');
    const copy = element.querySelector<HTMLElement>('[data-product-marquee-copy]');
    const marqueeViewport = element.querySelector<HTMLElement>('[data-product-marquee-viewport]');
    return {
      original: original?.getBoundingClientRect().width ?? 0,
      copy: copy?.getBoundingClientRect().width ?? 0,
      viewport: marqueeViewport?.clientWidth ?? 0
    };
  });
  expect(groupWidths.original).toBeCloseTo(groupWidths.copy, 1);
  expect(groupWidths.original).toBeGreaterThanOrEqual(groupWidths.viewport);

  await viewport.hover();
  await expect(root).toHaveAttribute('data-marquee-state', 'slow');
  await expect
    .poll(async () => (await animationSnapshot(page)).playbackRate, { timeout: 10_000 })
    .toBeLessThan(0.3);

  const firstLink = root
    .locator('[data-product-marquee-original] [data-marquee-item-link]')
    .first();
  await firstLink.focus();
  await expect(root).toHaveAttribute('data-marquee-state', 'focused');
  expect((await animationSnapshot(page)).playState).toBe('paused');

  await page.mouse.move(2, 2);
  await firstLink.blur();
  await expect(root).toHaveAttribute('data-marquee-state', 'running');
  await expect
    .poll(async () => (await animationSnapshot(page)).playbackRate, { timeout: 10_000 })
    .toBeGreaterThan(0.9);

  const initialDistance = await root.evaluate((element) =>
    element.style.getPropertyValue('--marquee-distance')
  );
  await page.setViewportSize({ width: 1920, height: 1080 });
  await waitForTwoFrames(page);
  await expect(root.locator('[data-product-marquee-generated]')).toHaveCount(1);

  await page.setViewportSize({ width: 768, height: 1024 });
  await waitForTwoFrames(page);
  await expect(root.locator('[data-product-marquee-generated]')).toHaveCount(0);
  await expect
    .poll(() => root.evaluate((element) => element.style.getPropertyValue('--marquee-distance')))
    .not.toBe(initialDistance);

  const toggle = root.locator('[data-marquee-toggle]');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(root).toHaveAttribute('data-marquee-state', 'paused');
  expect((await animationSnapshot(page)).playState).toBe('paused');
  await toggle.click();
  await expect(root).toHaveAttribute('data-marquee-state', 'running');

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(root).toHaveAttribute('data-marquee-state', 'destroyed');
  expect((await animationSnapshot(page)).count).toBe(0);
  expect(
    await root
      .locator('[data-product-marquee-copy]')
      .evaluate((element) => getComputedStyle(element).display)
  ).toBe('none');

  await page.evaluate(() => {
    const event = new PageTransitionEvent('pageshow', { persisted: true });
    window.dispatchEvent(event);
    window.dispatchEvent(event);
  });
  await root.scrollIntoViewIfNeeded();
  await expect(root).toHaveAttribute('data-marquee-state', 'running');
  expect((await animationSnapshot(page)).count).toBe(1);
  expect(await track.getAttribute('style')).toBeNull();
});

test('reduced motion usa una fascia statica completa', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const root = page.locator('[data-home-catalog-showcase]');
  await expect(root).toHaveAttribute('data-marquee-mode', 'reduced');
  await expect(root).toHaveAttribute('data-marquee-state', 'static');
  expect((await animationSnapshot(page)).count).toBe(0);
  expect(
    await root
      .locator('[data-product-marquee-copy]')
      .evaluate((element) => getComputedStyle(element).display)
  ).toBe('none');
  expect(
    await root
      .locator('[data-product-marquee-viewport]')
      .evaluate((element) => getComputedStyle(element).overflowX)
  ).toBe('auto');
  await expect(root.getByRole('link', { name: /Vai al catalogo/ })).toBeVisible();
});

test('touch mantiene il loop lento senza intercettare il tap', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4321',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const root = page.locator('[data-home-catalog-showcase]');
    await root.scrollIntoViewIfNeeded();
    await expect(root).toHaveAttribute('data-marquee-state', 'running');
    const initialRate = (await animationSnapshot(page)).playbackRate;
    await root.locator('[data-product-marquee-viewport]').dispatchEvent('pointerenter');
    await waitForTwoFrames(page);
    expect((await animationSnapshot(page)).playbackRate).toBe(initialRate);
    expect((await animationSnapshot(page)).duration).toBeGreaterThanOrEqual(25_000);

    const firstLink = root
      .locator('[data-product-marquee-original] [data-marquee-item-link]')
      .first();
    const linkBox = await firstLink.boundingBox();
    expect(linkBox).not.toBeNull();
    if (!linkBox) return;
    await page.touchscreen.tap(linkBox.x + linkBox.width / 2, linkBox.y + linkBox.height / 2);
    await expect(page).toHaveURL(/\/catalog\/signal-archive\/$/);
  } finally {
    await context.close();
  }
});

test('senza JavaScript mantiene card, link e CTA utilizzabili', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4321',
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 }
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const root = page.locator('[data-home-catalog-showcase]');
    await expect(root).not.toHaveAttribute('data-marquee-mode', /.+/);
    await expect(
      root.locator('[data-product-marquee-original] [data-marquee-item-link]')
    ).toHaveCount(4);
    expect(
      await root
        .locator('[data-product-marquee-copy]')
        .evaluate((element) => getComputedStyle(element).display)
    ).toBe('none');
    await expect(root.getByRole('link', { name: /Vai al catalogo/ })).toHaveAttribute(
      'href',
      '/catalog/'
    );
    await expect(page.getByRole('heading', { name: 'Esplora per categoria' })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
