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

test('compone la lastra WebGL tra testo retrostante e slogan frontale', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const root = page.locator('[data-showcase-root]');
  const stage = page.locator('[data-showcase-stage]');
  const glass = page.locator('[data-showcase-glass]');
  const canvas = page.locator('[data-showcase-glass-canvas]');
  const backText = page.locator('[data-showcase-back-text]');
  const frontText = page.locator('[data-showcase-front-text]');
  await expect(root).toHaveAttribute('data-showcase-glass-renderer', 'webgl');
  await expect(root).toHaveAttribute('data-showcase-glass-text', 'webgl', { timeout: 15_000 });
  const initialBackTextPosition = await backText.boundingBox();
  await expect(root).toHaveAttribute('data-showcase-state', 'interactive', { timeout: 15_000 });
  const settledBackTextPosition = await backText.boundingBox();
  expect(initialBackTextPosition).not.toBeNull();
  expect(settledBackTextPosition).not.toBeNull();
  if (initialBackTextPosition && settledBackTextPosition) {
    expect(Math.abs(initialBackTextPosition.x - settledBackTextPosition.x)).toBeLessThan(1);
    expect(Math.abs(initialBackTextPosition.y - settledBackTextPosition.y)).toBeLessThan(1);
  }
  await expect(canvas).toHaveAttribute('data-glass-quality', 'high');
  await expect(canvas).toHaveAttribute('data-glass-render-state', 'rendered');

  const composition = await root.evaluate((element) => {
    const back = element.querySelector<HTMLElement>('[data-showcase-back-text]');
    const glassElement = element.querySelector<HTMLElement>('[data-showcase-glass]');
    const canvasElement = element.querySelector<HTMLCanvasElement>('[data-showcase-glass-canvas]');
    const front = element.querySelector<HTMLElement>('[data-showcase-front-text]');
    return {
      backOpacity: back ? Number.parseFloat(getComputedStyle(back).opacity) : -1,
      canvasOpacity: canvasElement
        ? Number.parseFloat(getComputedStyle(canvasElement).opacity)
        : -1,
      canvasWidth: canvasElement?.width ?? 0,
      canvasClientWidth: canvasElement?.clientWidth ?? 0,
      glassLayer: glassElement ? Number.parseInt(getComputedStyle(glassElement).zIndex, 10) : -1,
      frontLayer: front ? Number.parseInt(getComputedStyle(front).zIndex, 10) : -1
    };
  });
  expect(composition.backOpacity).toBe(0);
  expect(composition.canvasOpacity).toBe(1);
  expect(composition.canvasClientWidth).toBeGreaterThan(0);
  expect(composition.canvasWidth / composition.canvasClientWidth).toBeGreaterThan(0.75);
  expect(composition.frontLayer).toBeGreaterThan(composition.glassLayer);
  await expect(backText).toContainText('Competenze in vetrina');
  await expect(frontText).toContainText('Idee in movimento');

  const glassBox = await glass.boundingBox();
  expect(glassBox).not.toBeNull();
  if (!glassBox) return;
  await page.mouse.move(glassBox.x + glassBox.width * 0.32, glassBox.y + glassBox.height * 0.24);
  await expect(canvas).toHaveAttribute('data-glass-contact', 'active');
  await page.mouse.down();
  await page.mouse.up();
  await expect(canvas).toHaveAttribute('data-glass-ripple', 'active');

  const stageBox = await stage.boundingBox();
  expect(stageBox).not.toBeNull();
  if (!stageBox) return;
  await page.mouse.move(stageBox.x + 2, stageBox.y + 2);
  await expect(canvas).toHaveAttribute('data-glass-contact', 'idle');
  expect(runtimeErrors).toEqual([]);
});

test('stratifica sette finestre e le disperde in direzioni diverse con lo scroll', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');

  const root = page.locator('[data-showcase-root]');
  const panes = page.locator('[data-showcase-pane]');
  await expect(root).toHaveAttribute('data-showcase-state', 'interactive', { timeout: 15_000 });
  await expect(panes).toHaveCount(7);
  await expect(page.locator('.home-showcase__pane-chrome')).toHaveCount(0);
  await expect(page.locator('.home-showcase__scroll-cue')).toHaveCount(0);

  const initialTransforms = await panes.evaluateAll((elements) =>
    elements.map((element) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
      return { skewY: matrix.b, skewX: matrix.c };
    })
  );
  expect(
    initialTransforms.every(
      (transform) => Math.abs(transform.skewX) < 0.0001 && Math.abs(transform.skewY) < 0.0001
    )
  ).toBe(true);

  const initialBoxes = await panes.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2
      };
    })
  );
  const overlappingPairs = initialBoxes.flatMap((box, index) =>
    initialBoxes
      .slice(index + 1)
      .filter(
        (candidate) =>
          Math.min(box.right, candidate.right) > Math.max(box.left, candidate.left) &&
          Math.min(box.bottom, candidate.bottom) > Math.max(box.top, candidate.top)
      )
  );
  expect(overlappingPairs.length).toBeGreaterThan(2);

  const initialBackTextBox = await page.locator('[data-showcase-back-text]').boundingBox();
  const containingPane = initialBoxes[0];
  expect(initialBackTextBox).not.toBeNull();
  expect(containingPane).toBeDefined();
  if (initialBackTextBox && containingPane) {
    const textCenterX = initialBackTextBox.x + initialBackTextBox.width / 2;
    const textCenterY = initialBackTextBox.y + initialBackTextBox.height / 2;
    expect(Math.abs(textCenterX - containingPane.centerX)).toBeLessThan(45);
    expect(Math.abs(textCenterY - containingPane.centerY)).toBeLessThan(45);
  }

  const scene = page.locator('[data-showcase-scroll-scene]');
  const sceneMetrics = await scene.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      travel: rect.height - window.innerHeight
    };
  });
  await page.evaluate(({ top, travel }) => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, top + travel * 0.58);
  }, sceneMetrics);

  await expect
    .poll(async () =>
      Number.parseFloat((await root.getAttribute('data-showcase-scroll-progress')) ?? '0')
    )
    .toBeGreaterThan(0.52);
  const middleBoxes = await panes.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2
      };
    })
  );
  const deltas = middleBoxes.map((box, index) => ({
    x: box.centerX - (initialBoxes[index]?.centerX ?? box.centerX),
    y: box.centerY - (initialBoxes[index]?.centerY ?? box.centerY)
  }));
  expect(deltas.some((delta) => delta.x < -120)).toBe(true);
  expect(deltas.some((delta) => delta.x > 120)).toBe(true);
  expect(deltas.some((delta) => delta.y < -120)).toBe(true);
  expect(deltas.some((delta) => delta.y > 120)).toBe(true);
  const titleShift = await readNumber('[data-showcase-root]', '--title-scroll-y', page);
  expect(titleShift).toBeLessThan(-10);
  expect(titleShift).toBeGreaterThan(-30);
  await expect(root).toHaveAttribute('data-showcase-glass-text', 'webgl');
  await expect(root).not.toHaveAttribute('data-showcase-back-text-source', /.+/);
  expect(
    await page
      .locator('[data-showcase-back-text]')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity))
  ).toBe(0);

  const backTextBox = await page.locator('[data-showcase-back-text]').boundingBox();
  const siteHeaderBox = await page.locator('.site-header').boundingBox();
  expect(backTextBox).not.toBeNull();
  expect(siteHeaderBox).not.toBeNull();
  if (backTextBox && siteHeaderBox) {
    expect(backTextBox.y).toBeGreaterThan(siteHeaderBox.y + siteHeaderBox.height + 12);
  }

  await page.evaluate(({ top, travel }) => {
    window.scrollTo(0, top + travel * 0.995);
  }, sceneMetrics);
  await expect
    .poll(async () =>
      Number.parseFloat((await root.getAttribute('data-showcase-scroll-progress')) ?? '0')
    )
    .toBeGreaterThan(0.985);
  const paneOpacities = await panes.evaluateAll((elements) =>
    elements.map((element) => Number.parseFloat(getComputedStyle(element).opacity))
  );
  expect(paneOpacities.every((opacity) => opacity < 0.12)).toBe(true);
  expect(await readNumber('[data-showcase-root]', '--front-text-opacity', page)).toBeLessThan(0.05);
  expect(
    await page
      .locator('[data-showcase-front-text]')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity))
  ).toBeLessThan(0.05);

  const stickyStageTop = await page
    .locator('[data-showcase-stage]')
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(Math.abs(stickyStageTop)).toBeLessThan(2);
  await page.evaluate(() => window.scrollBy(0, Math.max(180, window.innerHeight * 0.25)));
  await waitForTwoFrames(page);
  const releasedStageTop = await page
    .locator('[data-showcase-stage]')
    .evaluate((element) => element.getBoundingClientRect().top);
  expect(releasedStageTop).toBeLessThan(-80);
});

test('ripiega sulla lastra CSS quando WebGL2 non è disponibile', async ({ page }) => {
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

  const root = page.locator('[data-showcase-root]');
  const canvas = page.locator('[data-showcase-glass-canvas]');
  await expect(root).toHaveAttribute('data-showcase-glass-renderer', 'fallback');
  await expect(root).toHaveAttribute('data-showcase-state', 'interactive', { timeout: 15_000 });
  await expect(root).not.toHaveAttribute('data-showcase-glass-text', /.+/);
  expect(
    await canvas.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity))
  ).toBe(0);
  expect(
    await page
      .locator('[data-showcase-back-text]')
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity))
  ).toBe(1);
});

test('attiva il tracking se il puntatore è già sulla vetrina durante l’ingresso', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.mouse.move(720, 450);
  await page.goto('/');

  const root = page.locator('[data-showcase-root]');
  const stage = page.locator('[data-showcase-stage]');
  await expect(root).toHaveAttribute('data-showcase-state', /^(entering|interactive)$/);

  const stageBox = await stage.boundingBox();
  expect(stageBox).not.toBeNull();
  if (!stageBox) return;
  const initialPoint = {
    x: stageBox.x + stageBox.width * 0.5,
    y: stageBox.y + stageBox.height * 0.42
  };
  await stage.dispatchEvent('pointerenter', {
    pointerType: 'mouse',
    clientX: initialPoint.x,
    clientY: initialPoint.y
  });

  await expect(root).toHaveAttribute('data-showcase-state', 'interactive', { timeout: 15_000 });
  await stage.dispatchEvent('pointermove', {
    pointerType: 'mouse',
    clientX: initialPoint.x + 90,
    clientY: initialPoint.y + 45
  });

  await expect
    .poll(() => readNumber('[data-showcase-root]', '--light-opacity', page))
    .toBeGreaterThan(0.1);
  await expect
    .poll(async () => {
      const x = await readNumber('[data-showcase-root]', '--attract-x', page);
      const y = await readNumber('[data-showcase-root]', '--attract-y', page);
      return Math.hypot(x, y);
    })
    .toBeGreaterThan(0.1);
  await expect
    .poll(async () => {
      const x = await readNumber('[data-showcase-root]', '--glass-rotate-x', page);
      const y = await readNumber('[data-showcase-root]', '--glass-rotate-y', page);
      return Math.hypot(x, y);
    })
    .toBeGreaterThan(0.05);
});

test('illumina il vetro, limita l’attrazione e completa il cleanup', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const root = page.locator('[data-showcase-root]');
  const stage = page.locator('[data-showcase-stage]');
  const frontText = page.locator('[data-showcase-front-text]');

  await expect(root).toHaveAttribute('data-showcase-state', 'interactive', { timeout: 15_000 });
  const stageSize = await stage.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight
  }));
  expect(Math.abs(stageSize.width - stageSize.viewportWidth)).toBeLessThanOrEqual(1);
  expect(stageSize.height).toBeGreaterThanOrEqual(stageSize.viewportHeight);
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
  expect(attraction).toBeLessThanOrEqual(16.1);

  const stageBox = await stage.boundingBox();
  expect(stageBox).not.toBeNull();
  if (!stageBox) return;
  await page.mouse.move(stageBox.x + 100, stageBox.y + 120);
  await expect
    .poll(async () => {
      const x = await readNumber('[data-showcase-root]', '--attract-x', page);
      const y = await readNumber('[data-showcase-root]', '--attract-y', page);
      return Math.hypot(x, y);
    })
    .toBeGreaterThan(0.1);
  await expect
    .poll(async () => {
      const x = await readNumber('[data-showcase-root]', '--attract-x', page);
      const y = await readNumber('[data-showcase-root]', '--attract-y', page);
      return Math.hypot(x, y);
    })
    .toBeLessThan(2);

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
  await expect(root).not.toHaveAttribute('data-showcase-glass-renderer', /.+/);
  expect(await readNumber('[data-showcase-root]', '--light-opacity', page)).toBe(0);
  await page.mouse.move(textBox.x + textBox.width / 2, textBox.y + textBox.height / 2);
  await waitForTwoFrames(page);
  expect(await readNumber('[data-showcase-root]', '--light-opacity', page)).toBe(0);

  await page.evaluate(() => {
    const event = new PageTransitionEvent('pageshow', { persisted: true });
    window.dispatchEvent(event);
    window.dispatchEvent(event);
  });
  await expect(root).toHaveAttribute('data-showcase-state', 'interactive', { timeout: 15_000 });
});

test('ricalcola la scena al resize e resta navigabile da tastiera e cronologia', async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const root = page.locator('[data-showcase-root]');
  await expect(root).toHaveAttribute('data-showcase-state', 'interactive', { timeout: 15_000 });

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
  ).toBeLessThanOrEqual(10.1);

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
  await expect(root).toHaveAttribute('data-showcase-state', 'interactive', { timeout: 15_000 });
});

test('reduced motion mostra subito lo stato finale e disabilita il tracking', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const root = page.locator('[data-showcase-root]');
  await expect(root).toHaveAttribute('data-showcase-state', 'reduced');
  await expect(root).toHaveAttribute('data-showcase-glass-renderer', 'webgl');
  await expect(page.locator('[data-showcase-glass-canvas]')).toHaveAttribute(
    'data-glass-render-state',
    'rendered'
  );
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

test('touch mantiene lo slogan statico e usa la qualità WebGL mobile', async ({ browser }) => {
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
    await expect(root).toHaveAttribute('data-showcase-glass-renderer', 'webgl');
    const canvas = page.locator('[data-showcase-glass-canvas]');
    await expect(canvas).toHaveAttribute('data-glass-quality', 'mobile');
    await expect(canvas).toHaveAttribute('data-glass-render-state', 'rendered');
    expect(
      await page
        .locator('[data-showcase-pointer-light]')
        .evaluate((element) => getComputedStyle(element).display)
    ).toBe('none');
    expect(await readNumber('[data-showcase-root]', '--attract-x', page)).toBe(0);

    const glassBox = await page.locator('[data-showcase-glass]').boundingBox();
    expect(glassBox).not.toBeNull();
    if (!glassBox) return;
    await page.locator('[data-showcase-stage]').dispatchEvent('pointermove', {
      clientX: glassBox.x + glassBox.width * 0.5,
      clientY: glassBox.y + glassBox.height * 0.45,
      isPrimary: true,
      pointerId: 4,
      pointerType: 'touch'
    });
    await expect(canvas).toHaveAttribute('data-glass-contact', 'active');
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
      const stageSize = await page.locator('[data-showcase-stage]').evaluate((element) => ({
        width: element.getBoundingClientRect().width,
        height: element.getBoundingClientRect().height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      }));
      expect(Math.abs(stageSize.width - stageSize.viewportWidth)).toBeLessThanOrEqual(1);
      expect(stageSize.height).toBeGreaterThanOrEqual(stageSize.viewportHeight);
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
