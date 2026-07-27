import { expect, test } from '@playwright/test';

test('mostra esattamente quattro cubi e mantiene il layout stabile', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/catalog/');
  const root = page.locator('[data-catalog-index]');
  await expect(root).toHaveAttribute('data-catalog-index-state', 'ready');
  await expect(page.getByRole('heading', { name: 'Esplora per categoria' })).toHaveCount(0);
  await expect(page.locator('[data-catalog-categories]')).toHaveCount(0);

  const ratios = await page.locator('.catalog-card__media').evaluateAll((media) =>
    media.map((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.width / bounds.height;
    })
  );
  expect(ratios).toHaveLength(4);
  ratios.forEach((ratio) => expect(ratio).toBeCloseTo(4 / 3, 1));
  const cubeGrid = page.locator('[data-catalog-cube-grid]').first();
  await expect(cubeGrid).toHaveAttribute('data-catalog-cube-renderer', 'webgl', {
    timeout: 20_000
  });
  await expect(cubeGrid.locator('[data-catalog-cube-canvas]')).toHaveAttribute(
    'data-catalog-cube-model-count',
    '4'
  );
  await expect(page.locator('[data-cube-slot]')).toHaveCount(4);
  await expect(page.locator('.catalog-card__media img')).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth === document.documentElement.clientWidth
    )
  ).toBe(true);
});

test('i tre controlli condividono ciclo, hover esclusivo, tastiera e filtri reali', async ({
  page
}) => {
  await page.goto('/catalog/');
  const controls = page.locator('[data-cycle-control]');
  await expect(controls).toHaveCount(3);

  const typeControl = controls.filter({ has: page.locator('label[for="catalog-type"]') });
  const typeTrigger = typeControl.getByRole('button', { name: /Apri Tipo/ });
  const visibleCycleValue = () =>
    typeControl.locator('[data-cycle-item]').evaluateAll((items) => {
      const visibleItems = items.filter((item) => !(item as HTMLElement).hidden);
      return visibleItems.length === 1 ? visibleItems[0]?.textContent : null;
    });
  const initialVisualValue = await visibleCycleValue();
  await expect
    .poll(
      async () => {
        const value = await visibleCycleValue();
        return value !== null && value !== initialVisualValue;
      },
      { timeout: 10_000 }
    )
    .toBe(true);

  const openingAnimationCount = await typeControl.evaluate((control) => {
    const trigger = control.querySelector<HTMLButtonElement>('[data-cycle-trigger]');
    const panel = control.querySelector<HTMLElement>('[data-cycle-panel]');
    trigger?.click();
    return panel?.getAnimations().length ?? 0;
  });
  expect(openingAnimationCount).toBe(1);
  await expect(typeControl).toHaveAttribute('data-cycle-state', 'open');
  await expect(typeTrigger).toHaveAttribute('aria-expanded', 'true');
  const centers = await typeControl.evaluate((control) => {
    const trigger = control.querySelector<HTMLElement>('[data-cycle-trigger]');
    const panel = control.querySelector<HTMLElement>('[data-cycle-panel]');
    if (!trigger || !panel) return undefined;
    const triggerBounds = trigger.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    return {
      triggerX: triggerBounds.left + triggerBounds.width / 2,
      triggerY: triggerBounds.top + triggerBounds.height / 2,
      panelX: panelBounds.left + panelBounds.width / 2,
      panelY: panelBounds.top + panelBounds.height / 2
    };
  });
  expect(centers).toBeDefined();
  expect(Math.abs((centers?.panelX ?? 0) - (centers?.triggerX ?? 0))).toBeLessThan(2);
  expect(Math.abs((centers?.panelY ?? 0) - (centers?.triggerY ?? 0))).toBeLessThan(2);
  await expect(page.getByRole('button', { name: 'Conferma e chiudi' })).toHaveCount(0);
  const typeOptions = typeControl.getByRole('option');
  await expect(typeOptions).toHaveCount(4);
  expect(
    await typeControl
      .locator('[data-cycle-viewport]')
      .evaluate((viewport) => viewport.getAnimations({ subtree: true }).length)
  ).toBe(0);

  const initialOption = typeControl.getByRole('option', { name: 'Tutti i tipi' });
  const serviceOption = typeControl.getByRole('option', { name: 'Servizi' });
  await expect(initialOption).toHaveAttribute('aria-selected', 'false');
  await expect(typeControl.locator('[role="option"][aria-selected="true"]')).toHaveCount(0);
  await serviceOption.hover();
  await expect(serviceOption).toHaveAttribute('data-cycle-preview', 'true');
  await expect
    .poll(() =>
      typeOptions.evaluateAll((options) =>
        options
          .filter((option) => getComputedStyle(option).backgroundColor !== 'rgba(0, 0, 0, 0)')
          .map((option) => option.textContent?.replace('↗', '').trim())
      )
    )
    .toEqual(['Servizi']);
  await expect(initialOption).toHaveAttribute('aria-selected', 'false');
  await serviceOption.click();
  await expect(typeControl).toHaveAttribute('data-cycle-state', 'closed');
  await expect(typeTrigger).toHaveAttribute('aria-label', /Selezione corrente: Servizi/);
  await expect(page.locator('[data-catalog-result-count]')).toHaveText('1');
  await expect(page.getByRole('heading', { name: 'Product Prototype Sprint' })).toBeVisible();

  const categoryControl = controls.filter({
    has: page.locator('label[for="catalog-category"]')
  });
  const categoryTrigger = categoryControl.getByRole('button', { name: /Apri Categoria/ });
  const visibleCategoryValue = async () => {
    const values = await categoryControl.locator('[data-cycle-item]').evaluateAll((items) => {
      const visibleItems = items.filter((item) => !(item as HTMLElement).hidden);
      return visibleItems.map((item) => item.textContent?.trim()).filter(Boolean);
    });

    return values.length === 1 ? values[0] : null;
  };

  await categoryTrigger.focus();
  await page.keyboard.press('ArrowDown');
  await expect(categoryControl).toHaveAttribute('data-cycle-state', 'open');
  await expect(categoryControl.locator('[role="option"][aria-selected="true"]')).toHaveCount(0);
  await expect(categoryControl.getByRole('option', { name: 'Tutte le categorie' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(categoryControl.getByRole('option', { name: 'Attività' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(categoryControl).toHaveAttribute('data-cycle-state', 'closed');
  await expect(categoryTrigger).toBeFocused();
  await expect(categoryControl.locator('[role="option"][aria-selected="true"]')).toHaveCount(0);

  await expect.poll(visibleCategoryValue, { timeout: 10_000 }).not.toBeNull();
  const categoryValueOnResume = await visibleCategoryValue();
  expect(categoryValueOnResume).not.toBeNull();
  await expect
    .poll(
      async () => {
        const value = await visibleCategoryValue();
        return value !== null && value !== categoryValueOnResume;
      },
      { timeout: 10_000 }
    )
    .toBe(true);

  const sortControl = controls.filter({ has: page.locator('label[for="catalog-sort"]') });
  const sortTrigger = sortControl.getByRole('button', { name: /Apri Ordina/ });
  await expect(sortTrigger).toBeVisible();
  await sortTrigger.click();
  const sortPanel = sortControl.locator('[data-cycle-panel]');
  await sortPanel.hover();
  const closingAnimationCount = await sortControl.evaluate((control) => {
    const panel = control.querySelector<HTMLElement>('[data-cycle-panel]');
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return panel?.getAnimations().length ?? 0;
  });
  expect(closingAnimationCount).toBe(1);
  await expect(sortControl).toHaveAttribute('data-cycle-state', 'closing');
  await expect(sortControl).toHaveAttribute('data-cycle-state', 'closed');
});

test('le quattro proposte mantengono una cadenza condivisa dopo una pausa locale', async ({
  page
}) => {
  await page.goto('/catalog/');

  const search = page.locator('[data-search-cycle]');
  const type = page
    .locator('[data-cycle-control]')
    .filter({ has: page.locator('label[for="catalog-type"]') });
  const category = page
    .locator('[data-cycle-control]')
    .filter({ has: page.locator('label[for="catalog-category"]') });
  const sort = page
    .locator('[data-cycle-control]')
    .filter({ has: page.locator('label[for="catalog-sort"]') });
  const surfaces = [search, type, category, sort];
  const cycleTicks = () =>
    Promise.all(
      surfaces.map((surface) =>
        surface.locator('[data-cycle-viewport]').getAttribute('data-cycle-tick')
      )
    );

  const typeTrigger = type.getByRole('button', { name: /Apri Tipo/ });
  await typeTrigger.focus();
  await typeTrigger.press('ArrowDown');
  await expect(type).toHaveAttribute('data-cycle-state', 'open');
  const pausedTypeTick = (await cycleTicks())[1];

  await expect
    .poll(
      async () => {
        const [searchTick, typeTick, categoryTick, sortTick] = await cycleTicks();
        return (
          searchTick !== null &&
          searchTick !== pausedTypeTick &&
          searchTick === categoryTick &&
          categoryTick === sortTick &&
          typeTick === pausedTypeTick
        );
      },
      { timeout: 10_000 }
    )
    .toBe(true);

  await page.keyboard.press('Escape');
  await expect(type).toHaveAttribute('data-cycle-state', 'closed');
  await expect
    .poll(
      async () => {
        const ticks = await cycleTicks();
        return ticks[0] !== null && ticks[0] !== pausedTypeTick && new Set(ticks).size === 1;
      },
      { timeout: 10_000 }
    )
    .toBe(true);

  await typeTrigger.focus();
  await typeTrigger.press('ArrowDown');
  await type.getByRole('option', { name: 'Servizi' }).press('Enter');
  await expect(type).toHaveAttribute('data-cycle-state', 'closed');
  const selectedTypeTick = (await cycleTicks())[1];

  await expect
    .poll(
      async () => {
        const [searchTick, typeTick, categoryTick, sortTick] = await cycleTicks();
        return (
          searchTick !== null &&
          searchTick !== selectedTypeTick &&
          searchTick === categoryTick &&
          categoryTick === sortTick &&
          typeTick === selectedTypeTick
        );
      },
      { timeout: 10_000 }
    )
    .toBe(true);
});

test('la ricerca alterna suggerimenti soltanto quando è vuota e inattiva', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/catalog/');
  const field = page.locator('[data-search-cycle]');
  const input = page.getByLabel('Cerca nel catalogo');
  await expect(field).toHaveAttribute('data-search-state', 'idle');
  await expect(input).toHaveValue('');
  await expect(input).toHaveAttribute('placeholder', '');
  const idleWidth = await field
    .locator('.catalog-search-field__surface')
    .evaluate((surface) => surface.getBoundingClientRect().width);
  const idleHeight = await input.evaluate((element) => element.getBoundingClientRect().height);
  const visibleSuggestion = () =>
    field.locator('[data-cycle-item]').evaluateAll((items) => {
      const visibleItems = items.filter((item) => !(item as HTMLElement).hidden);
      return visibleItems.length === 1 ? visibleItems[0]?.textContent : null;
    });
  const firstSuggestion = await visibleSuggestion();
  await expect
    .poll(
      async () => {
        const value = await visibleSuggestion();
        return value !== null && value !== firstSuggestion;
      },
      { timeout: 10_000 }
    )
    .toBe(true);
  await expect(input).toHaveValue('');

  await input.focus();
  await expect(field).toHaveAttribute('data-search-state', 'active');
  await expect
    .poll(
      () =>
        field
          .locator('.catalog-search-field__surface')
          .evaluate((surface) => surface.getBoundingClientRect().width),
      { timeout: 15_000 }
    )
    .toBeGreaterThan(idleWidth);
  await expect
    .poll(() => input.evaluate((element) => element.getBoundingClientRect().height), {
      timeout: 15_000
    })
    .toBeGreaterThan(idleHeight);
  expect(
    await field
      .locator('[data-cycle-viewport]')
      .evaluate((viewport) => viewport.getAnimations({ subtree: true }).length)
  ).toBe(0);

  await input.fill('Astro TypeScript');
  await expect(page.locator('[data-catalog-result-count]')).toHaveText('2');
  await input.blur();
  await expect(field).toHaveAttribute('data-search-state', 'filled');
  await input.fill('');
  await input.blur();
  await expect(field).toHaveAttribute('data-search-state', 'idle');
});

test('anima i titoli per lettera, inverte lo stato e ripulisce il lifecycle', async ({ page }) => {
  await page.goto('/catalog/');
  const root = page.locator('[data-catalog-index]');
  const link = page.locator('[data-catalog-title]').first();
  await expect(link).toHaveAttribute('data-title-enhanced', 'true');
  const title = await link.getAttribute('aria-label');
  const letterCount = await link.locator('.catalog-title-letter').count();
  expect(letterCount).toBeGreaterThan(5);
  await expect(link.locator('.catalog-title-letter__glyph')).toHaveCount(letterCount * 2);
  const cardHeight = await link
    .locator('xpath=ancestor::article')
    .evaluate((card) => card.getBoundingClientRect().height);

  await link.hover();
  await expect(link).toHaveAttribute('data-title-state', 'active');
  await page.mouse.move(2, 2);
  await expect(link).toHaveAttribute('data-title-state', 'idle');
  await link.dispatchEvent('pointerenter');
  await link.dispatchEvent('pointerleave');
  await link.dispatchEvent('pointerenter');
  await link.dispatchEvent('pointerleave');
  await expect
    .poll(() => link.evaluate((element) => element.getAnimations({ subtree: true }).length))
    .toBe(0);
  await expect(link.locator('.catalog-title-letter')).toHaveCount(letterCount);
  expect(
    await link
      .locator('xpath=ancestor::article')
      .evaluate((card) => card.getBoundingClientRect().height)
  ).toBeCloseTo(cardHeight, 0);

  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
  await expect(root).toHaveAttribute('data-catalog-index-state', 'destroyed');
  await expect(link).not.toHaveAttribute('data-title-enhanced', /.+/);
  await expect(link).toHaveText(title ?? '');

  await page.evaluate(() => {
    const event = new PageTransitionEvent('pageshow', { persisted: true });
    window.dispatchEvent(event);
    window.dispatchEvent(event);
  });
  await expect(root).toHaveAttribute('data-catalog-index-state', 'ready');
  await expect(link).toHaveAttribute('data-title-enhanced', 'true');
  await expect(link.locator('.catalog-title-letter')).toHaveCount(letterCount);
});

test('reduced motion mantiene controlli statici e titoli leggibili', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/catalog/');
  const root = page.locator('[data-catalog-index]');
  await expect(root).toHaveAttribute('data-catalog-index-state', 'ready');
  const typeControl = page.locator('[data-cycle-control]').first();
  expect(
    await typeControl
      .locator('[data-cycle-viewport]')
      .evaluate((viewport) => viewport.getAnimations({ subtree: true }).length)
  ).toBe(0);
  await expect(page.locator('[data-catalog-title]').first()).not.toHaveAttribute(
    'data-title-enhanced',
    /.+/
  );
  await typeControl.getByRole('button', { name: /Apri Tipo/ }).click();
  await typeControl.getByRole('option', { name: 'Servizi' }).click();
  await expect(page.locator('[data-catalog-result-count]')).toHaveText('1');
});

test('mobile touch e fallback senza JavaScript restano statici e utilizzabili', async ({
  browser
}) => {
  const touchContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4321',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  try {
    const page = await touchContext.newPage();
    await page.goto('/catalog/');
    await expect(page.locator('[data-catalog-title]').first()).not.toHaveAttribute(
      'data-title-enhanced',
      /.+/
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth === document.documentElement.clientWidth
      )
    ).toBe(true);
    const control = page.locator('[data-cycle-control]').first();
    await control.getByRole('button', { name: /Apri Tipo/ }).tap();
    const panelBounds = await control
      .locator('[data-cycle-panel]')
      .evaluate((panel) => panel.getBoundingClientRect());
    expect(panelBounds.left).toBeGreaterThanOrEqual(0);
    expect(panelBounds.right).toBeLessThanOrEqual(390);
    expect(panelBounds.top).toBeGreaterThanOrEqual(0);
    expect(panelBounds.bottom).toBeLessThanOrEqual(844);
  } finally {
    await touchContext.close();
  }

  const noScriptContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:4321',
    viewport: { width: 390, height: 844 },
    javaScriptEnabled: false
  });
  try {
    const page = await noScriptContext.newPage();
    await page.goto('/catalog/');
    await expect(page.locator('[data-catalog-index]')).not.toHaveAttribute(
      'data-catalog-index-enhanced',
      /.+/
    );
    await expect(page.locator('#catalog-type')).toBeVisible();
    await expect(page.locator('#catalog-category')).toBeVisible();
    await expect(page.locator('#catalog-sort')).toBeVisible();
    await expect(page.getByLabel('Cerca nel catalogo')).toHaveAttribute(
      'placeholder',
      'Titolo, tecnologia, categoria…'
    );
    await expect(page.locator('[data-cycle-trigger]').first()).toBeHidden();
    await expect(page.locator('[data-cycle-options-list]').first()).toBeHidden();
    await expect(page.locator('[data-catalog-title]').first()).not.toHaveAttribute(
      'data-title-enhanced',
      /.+/
    );
  } finally {
    await noScriptContext.close();
  }
});
