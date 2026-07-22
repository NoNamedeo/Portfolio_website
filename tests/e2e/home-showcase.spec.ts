import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const readNumber = async (selector: string, property: string, page: Page) =>
  page.locator(selector).evaluate((element, customProperty) => {
    const value = element.style.getPropertyValue(customProperty);
    return Number.parseFloat(value) || 0;
  }, property);

const waitForTwoFrames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );

test('illumina il vetro, limita l’attrazione e completa il cleanup', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const root = page.locator('[data-showcase-root]');
  const stage = page.locator('[data-showcase-stage]');
  const frontText = page.locator('[data-showcase-front-text]');

  await expect(root).toHaveAttribute('data-showcase-state', 'interactive');
  expect(await stage.evaluate((element) => getComputedStyle(element).cursor)).not.toBe('none');
  await expect(page.locator('[data-showcase-pointer-light]')).toHaveAttribute(
    'aria-hidden',
    'true'
  );
  expect(
    await page
      .locator('[data-showcase-pointer-light]')
      .evaluate((element) => getComputedStyle(element).pointerEvents)
  ).toBe('none');

  const textBox = await frontText.boundingBox();
  expect(textBox).not.toBeNull();
  if (!textBox) return;
  await page.mouse.move(textBox.x + textBox.width / 2 - 100, textBox.y + textBox.height / 2 - 40);

  await expect
    .poll(() => readNumber('[data-showcase-root]', '--light-opacity', page))
    .toBeGreaterThan(0.1);
  await expect
    .poll(async () => {
      const x = await readNumber('[data-showcase-root]', '--attract-x', page);
      const y = await readNumber('[data-showcase-root]', '--attract-y', page);
      return Math.hypot(x, y);
    })
    .toBeGreaterThan(1);
  const attraction = Math.hypot(
    await readNumber('[data-showcase-root]', '--attract-x', page),
    await readNumber('[data-showcase-root]', '--attract-y', page)
  );
  expect(attraction).toBeLessThanOrEqual(24.1);

  await page.mouse.move(2, 2);
  await expect
    .poll(() => readNumber('[data-showcase-root]', '--light-opacity', page))
    .toBeLessThan(0.02);
  await expect
    .poll(async () => {
      const x = await readNumber('[data-showcase-root]', '--attract-x', page);
      const y = await readNumber('[data-showcase-root]', '--attract-y', page);
      return Math.hypot(x, y);
    })
    .toBeLessThan(0.3);

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(root).toHaveAttribute('data-showcase-state', 'destroyed');
  expect(await readNumber('[data-showcase-root]', '--light-opacity', page)).toBe(0);
  await page.mouse.move(textBox.x + textBox.width / 2, textBox.y + textBox.height / 2);
  await waitForTwoFrames(page);
  expect(await readNumber('[data-showcase-root]', '--light-opacity', page)).toBe(0);

  await page.evaluate(() => {
    const event = new PageTransitionEvent('pageshow', { persisted: true });
    window.dispatchEvent(event);
    window.dispatchEvent(event);
  });
  await expect(root).toHaveAttribute('data-showcase-state', 'interactive');
});

test('ricalcola la scena al resize e resta navigabile da tastiera e cronologia', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const root = page.locator('[data-showcase-root]');
  await expect(root).toHaveAttribute('data-showcase-state', 'interactive');

  await page.setViewportSize({ width: 900, height: 800 });
  await waitForTwoFrames(page);
  const textBox = await page.locator('[data-showcase-front-text]').boundingBox();
  expect(textBox).not.toBeNull();
  if (!textBox) return;
  await page.mouse.move(textBox.x + textBox.width / 2 - 70, textBox.y + textBox.height / 2);
  await expect
    .poll(async () => {
      const x = await readNumber('[data-showcase-root]', '--attract-x', page);
      const y = await readNumber('[data-showcase-root]', '--attract-y', page);
      return Math.hypot(x, y);
    })
    .toBeGreaterThan(1);
  expect(
    Math.hypot(
      await readNumber('[data-showcase-root]', '--attract-x', page),
      await readNumber('[data-showcase-root]', '--attract-y', page)
    )
  ).toBeLessThanOrEqual(14.1);

  const catalogLink = page.getByRole('link', { name: /Esplora il catalogo/ });
  for (
    let index = 0;
    index < 10 && !(await catalogLink.evaluate((link) => link === document.activeElement));
    index += 1
  ) {
    await page.keyboard.press('Tab');
  }
  await expect(catalogLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/catalog\/$/);
  await page.goBack();
  await expect(root).toHaveAttribute('data-showcase-state', 'interactive');
});

test('reduced motion mostra subito lo stato finale e disabilita il tracking', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const root = page.locator('[data-showcase-root]');
  await expect(root).toHaveAttribute('data-showcase-state', 'reduced');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Competenze in vetrina');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Idee in movimento');
  expect(
    await page
      .locator('[data-showcase-pointer-light]')
      .evaluate((element) => getComputedStyle(element).display)
  ).toBe('none');

  const stageBox = await page.locator('[data-showcase-stage]').boundingBox();
  expect(stageBox).not.toBeNull();
  if (!stageBox) return;
  await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
  await waitForTwoFrames(page);
  expect(await readNumber('[data-showcase-root]', '--light-opacity', page)).toBe(0);
  expect(await readNumber('[data-showcase-root]', '--attract-x', page)).toBe(0);
});

test('touch usa la composizione statica senza seguire il dito', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4321',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  try {
    const page = await context.newPage();
    await page.goto('/');
    const root = page.locator('[data-showcase-root]');
    await expect(root).toHaveAttribute('data-showcase-mode', 'static');
    await expect(root).toHaveAttribute('data-showcase-state', 'static');
    expect(
      await page
        .locator('[data-showcase-pointer-light]')
        .evaluate((element) => getComputedStyle(element).display)
    ).toBe('none');
    expect(await readNumber('[data-showcase-root]', '--attract-x', page)).toBe(0);
  } finally {
    await context.close();
  }
});

test('senza JavaScript conserva testi e layout ai breakpoint richiesti', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4321',
    javaScriptEnabled: false
  });
  try {
    const page = await context.newPage();
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 }
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Competenze in vetrina');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Idee in movimento');
      await expect(page.locator('[data-showcase-root]')).not.toHaveAttribute(
        'data-showcase-state',
        /.+/
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
      ).toBe(true);
      expect(
        await page
          .locator('[data-showcase-front-text]')
          .evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
      ).toBe(true);
    }
  } finally {
    await context.close();
  }
});
