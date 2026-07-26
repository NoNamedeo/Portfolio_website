import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });
test.setTimeout(90_000);

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
      currentTime: typeof animation?.currentTime === 'number' ? animation.currentTime : 0,
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
  await expect(showcase.locator('[data-catalog-cube-canvas]')).toHaveCount(1);
  await expect(showcase).toHaveAttribute('data-catalog-cube-renderer', 'webgl');
  await expect(showcase.locator('[data-catalog-cube-canvas]')).toHaveAttribute(
    'data-catalog-cube-state',
    'rendered'
  );
  await expect(showcase.locator('[data-product-marquee-original] img')).toHaveCount(0);
  expect(
    await showcase
      .locator('[data-product-marquee-original] [data-cube-slot]')
      .evaluateAll(
        (slots) => new Set(slots.map((slot) => slot.getAttribute('data-cube-accent'))).size
      )
  ).toBe(4);
  expect(
    await showcase
      .locator('[data-product-marquee-original] [data-marquee-item-link]')
      .first()
      .evaluate((link) => ({
        background: getComputedStyle(link).backgroundImage,
        border: getComputedStyle(link).borderTopWidth
      }))
  ).toEqual({ background: 'none', border: '0px' });
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

  await viewport.dispatchEvent('pointerenter', { pointerType: 'mouse' });
  await expect(root).toHaveAttribute('data-marquee-state', 'slow');
  await expect
    .poll(async () => (await animationSnapshot(page)).playbackRate, { timeout: 10_000 })
    .toBeLessThan(0.3);

  const firstCube = root
    .locator('[data-product-marquee-original] [data-marquee-item-link]')
    .first();
  const firstCubeBox = await firstCube.boundingBox();
  expect(firstCubeBox).not.toBeNull();
  if (!firstCubeBox) return;
  await page.mouse.move(
    firstCubeBox.x + firstCubeBox.width * 0.72,
    firstCubeBox.y + firstCubeBox.height * 0.32
  );
  await expect(firstCube).toHaveAttribute('data-cube-active', '');
  await firstCube.dispatchEvent('pointerdown', {
    button: 0,
    buttons: 1,
    pointerId: 27,
    pointerType: 'mouse'
  });
  await expect(root.locator('[data-catalog-cube-canvas]')).toHaveAttribute(
    'data-catalog-cube-pulse',
    'active'
  );
  await firstCube.dispatchEvent('pointerup', {
    button: 0,
    buttons: 0,
    pointerId: 27,
    pointerType: 'mouse'
  });

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
  await expect(root).toHaveAttribute('data-marquee-state', /^(slow|running)$/);
  expect((await animationSnapshot(page)).count).toBe(1);
  expect(await track.getAttribute('style')).toBeNull();
});

test('supporta grab con il mouse e scorrimento orizzontale da touchpad', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const root = page.locator('[data-home-catalog-showcase]');
  const viewport = root.locator('[data-product-marquee-viewport]');
  const firstLink = root
    .locator('[data-product-marquee-original] [data-marquee-item-link]')
    .first();
  await root.scrollIntoViewIfNeeded();
  await expect(root).toHaveAttribute('data-marquee-state', 'running');
  expect(await viewport.evaluate((element) => getComputedStyle(element).cursor)).toBe('grab');

  const linkBox = await firstLink.boundingBox();
  expect(linkBox).not.toBeNull();
  if (!linkBox) return;
  const dragStart = {
    x: linkBox.x + linkBox.width * 0.55,
    y: linkBox.y + linkBox.height * 0.5
  };
  const beforeDrag = await animationSnapshot(page);
  await page.mouse.move(dragStart.x, dragStart.y);
  await page.mouse.down();
  await expect(root).toHaveAttribute('data-marquee-state', 'dragging');
  await expect(viewport).toHaveAttribute('data-marquee-dragging', 'true');
  await page.mouse.move(dragStart.x + 170, dragStart.y + 8, { steps: 4 });
  const duringDrag = await animationSnapshot(page);
  expect(duringDrag.playState).toBe('paused');
  expect(Math.abs(duringDrag.currentTime - beforeDrag.currentTime)).toBeGreaterThan(500);
  expect(await viewport.evaluate((element) => getComputedStyle(element).cursor)).toBe('grabbing');
  await page.mouse.up();

  await expect(viewport).not.toHaveAttribute('data-marquee-dragging', /.+/);
  await expect(page).toHaveURL('http://127.0.0.1:4321/');
  await expect(root).toHaveAttribute('data-marquee-state', /^(slow|running)$/);

  const beforeWheel = await animationSnapshot(page);
  await viewport.dispatchEvent('wheel', {
    deltaMode: 0,
    deltaX: 180,
    deltaY: 0
  });
  await expect(root).toHaveAttribute('data-marquee-state', 'scrolling');
  const duringWheel = await animationSnapshot(page);
  expect(duringWheel.playState).toBe('paused');
  expect(Math.abs(duringWheel.currentTime - beforeWheel.currentTime)).toBeGreaterThan(500);
  await expect(root).toHaveAttribute('data-marquee-state', /^(slow|running)$/);
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
  const viewport = root.locator('[data-product-marquee-viewport]');
  await root.scrollIntoViewIfNeeded();
  const viewportBox = await viewport.boundingBox();
  expect(viewportBox).not.toBeNull();
  if (!viewportBox) return;
  expect(
    await viewport.evaluate((element) => element.scrollWidth - element.clientWidth)
  ).toBeGreaterThan(100);
  const pointerStart = {
    x: viewportBox.x + viewportBox.width * 0.7,
    y: viewportBox.y + viewportBox.height * 0.5
  };
  await viewport.dispatchEvent('pointerdown', {
    button: 0,
    buttons: 1,
    clientX: pointerStart.x,
    clientY: pointerStart.y,
    pointerId: 41,
    pointerType: 'mouse'
  });
  await viewport.dispatchEvent('pointermove', {
    button: 0,
    buttons: 1,
    clientX: viewportBox.x + viewportBox.width * 0.35,
    clientY: pointerStart.y,
    pointerId: 41,
    pointerType: 'mouse'
  });
  await expect(root).toHaveAttribute('data-marquee-state', 'dragging');
  await viewport.dispatchEvent('pointerup', {
    button: 0,
    buttons: 0,
    clientX: viewportBox.x + viewportBox.width * 0.35,
    clientY: pointerStart.y,
    pointerId: 41,
    pointerType: 'mouse'
  });
  await expect(root).toHaveAttribute('data-marquee-state', 'static');
  expect(await viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(50);
  await expect(root.getByRole('link', { name: /Vai al catalogo/ })).toBeVisible();
});

test('touch consente lo swipe, mantiene il loop lento e non intercetta il tap', async ({
  browser
}) => {
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

    const viewport = root.locator('[data-product-marquee-viewport]');
    const viewportBox = await viewport.boundingBox();
    expect(viewportBox).not.toBeNull();
    if (!viewportBox) return;
    const touchStart = {
      x: viewportBox.x + viewportBox.width * 0.72,
      y: viewportBox.y + viewportBox.height * 0.5
    };
    const beforeSwipe = await animationSnapshot(page);
    await viewport.dispatchEvent('pointerdown', {
      button: 0,
      buttons: 1,
      clientX: touchStart.x,
      clientY: touchStart.y,
      isPrimary: true,
      pointerId: 7,
      pointerType: 'touch'
    });
    await expect(root).toHaveAttribute('data-marquee-state', 'dragging');
    await viewport.dispatchEvent('pointermove', {
      button: 0,
      buttons: 1,
      clientX: touchStart.x - 120,
      clientY: touchStart.y + 4,
      isPrimary: true,
      pointerId: 7,
      pointerType: 'touch'
    });
    const duringSwipe = await animationSnapshot(page);
    expect(duringSwipe.playState).toBe('paused');
    expect(Math.abs(duringSwipe.currentTime - beforeSwipe.currentTime)).toBeGreaterThan(500);
    await viewport.dispatchEvent('pointerup', {
      button: 0,
      buttons: 0,
      clientX: touchStart.x - 120,
      clientY: touchStart.y + 4,
      isPrimary: true,
      pointerId: 7,
      pointerType: 'touch'
    });
    await expect(root).toHaveAttribute('data-marquee-state', 'running');
    await expect(page).toHaveURL('http://127.0.0.1:4321/');

    const tapTarget = await root.locator('[data-marquee-item-link]').evaluateAll((links) => {
      const visibleLink = links
        .map((link) => {
          const bounds = link.getBoundingClientRect();
          const visibleWidth = Math.min(bounds.right, window.innerWidth) - Math.max(bounds.left, 0);
          const visibleHeight =
            Math.min(bounds.bottom, window.innerHeight) - Math.max(bounds.top, 0);
          return { link, bounds, visibleArea: visibleWidth * visibleHeight };
        })
        .filter(
          (candidate) => candidate.link instanceof HTMLAnchorElement && candidate.visibleArea > 0
        )
        .sort((left, right) => right.visibleArea - left.visibleArea)[0];
      if (!visibleLink || !(visibleLink.link instanceof HTMLAnchorElement)) return null;
      const { bounds } = visibleLink;
      const x = (Math.max(bounds.left, 0) + Math.min(bounds.right, window.innerWidth)) / 2;
      const y = (Math.max(bounds.top, 0) + Math.min(bounds.bottom, window.innerHeight)) / 2;
      const hitLink = document.elementFromPoint(x, y)?.closest('a');
      return {
        x,
        y,
        hitPathname: hitLink instanceof HTMLAnchorElement ? new URL(hitLink.href).pathname : null,
        pathname: new URL(visibleLink.link.href).pathname
      };
    });
    expect(tapTarget).not.toBeNull();
    if (!tapTarget) return;
    expect(tapTarget.hitPathname).toBe(tapTarget.pathname);
    await page.touchscreen.tap(tapTarget.x, tapTarget.y);
    await expect.poll(() => new URL(page.url()).pathname).toBe(tapTarget.pathname);
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
