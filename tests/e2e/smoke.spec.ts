import { expect, test } from '@playwright/test';

test('mostra il caricamento iniziale e lascia pronta la pagina', async ({ page }) => {
  test.setTimeout(120_000);
  const documentResponse = await page.request.get('/');
  const documentHtml = await documentResponse.text();
  expect(documentHtml).toContain('site-loader__indicator');
  expect(documentHtml).not.toContain('site-loader__pane');
  expect(documentHtml).not.toContain('site-loader__copy');
  expect(documentHtml).not.toContain('Mettiamo tutto');

  let releaseModelRequest: () => void = () => undefined;
  let signalModelRequest: () => void = () => undefined;
  const modelRequestGate = new Promise<void>((resolve) => {
    releaseModelRequest = resolve;
  });
  const modelRequested = new Promise<void>((resolve) => {
    signalModelRequest = resolve;
  });
  await page.route('**/3D_models/glass_plate_web.glb', async (route) => {
    signalModelRequest();
    await modelRequestGate;
    await route.continue();
  });
  const navigation = page.goto('/');

  const loader = page.locator('[data-site-loader]');
  await modelRequested;
  await expect(loader).toBeVisible();
  await page.waitForTimeout(250);
  await expect(loader).toBeVisible();
  expect(await page.locator('html').getAttribute('data-portfolio-app')).not.toBe('ready');
  releaseModelRequest();
  await navigation;
  await expect(page.locator('html')).toHaveAttribute('data-portfolio-app', 'ready', {
    timeout: 30_000
  });
  await expect(page.locator('[data-showcase-root]')).toHaveAttribute(
    'data-showcase-glass-renderer',
    /^(webgl|fallback)$/
  );
  await expect(loader).toHaveCount(0, { timeout: 10_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Competenze');

  await page.reload();
  const reloadedLoader = page.locator('[data-site-loader]');
  await expect(page.locator('[data-showcase-root]')).toHaveAttribute(
    'data-showcase-glass-renderer',
    /^(webgl|fallback)$/,
    { timeout: 45_000 }
  );
  await expect(reloadedLoader).toHaveCount(0, { timeout: 5_000 });

  const removedProfile = await page.goto('/about/');
  expect(removedProfile?.status()).toBe(404);
  await expect(page.locator('[data-site-loader]')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('fuori catalogo');
});

test('apre homepage e catalogo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Competenze');
  await page.getByRole('link', { name: 'Catalogo' }).first().click();
  await expect(page).toHaveURL(/\/catalog\/$/);
  await expect(page.locator('[data-catalog-item]')).toHaveCount(4);
});

test('attende gli oggetti critici anche nelle navigazioni successive', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/cart/');
  await expect(page.locator('[data-site-loader]')).toHaveCount(0, { timeout: 10_000 });

  let releaseModelRequest: () => void = () => undefined;
  let signalModelRequest: () => void = () => undefined;
  const modelRequestGate = new Promise<void>((resolve) => {
    releaseModelRequest = resolve;
  });
  const modelRequested = new Promise<void>((resolve) => {
    signalModelRequest = resolve;
  });
  await page.route('**/3D_models/glass_cubes_design_plasma.glb', async (route) => {
    signalModelRequest();
    await modelRequestGate;
    await route.continue();
  });

  const navigation = page.getByRole('link', { name: 'Catalogo' }).first().click();
  await modelRequested;
  const loader = page.locator('[data-site-loader]');
  await expect(loader).toBeVisible();
  expect(await page.locator('html').getAttribute('data-portfolio-app')).not.toBe('ready');
  releaseModelRequest();
  await navigation;
  await expect(page.locator('[data-catalog-cube-grid]')).toHaveAttribute(
    'data-catalog-cube-renderer',
    /^(webgl|fallback)$/,
    { timeout: 30_000 }
  );
  await expect(loader).toHaveCount(0, { timeout: 5_000 });
});

test('applica ricerca, filtro da URL e ordinamento con le regole del dominio', async ({ page }) => {
  await page.goto('/catalog/?category=servizi');
  await expect(page.locator('[data-catalog-result-count]')).toHaveText('1');
  await expect(page.locator('[data-catalog-entry]:visible')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Product Prototype Sprint' })).toBeVisible();

  const categoryControl = page
    .locator('[data-cycle-control]')
    .filter({ has: page.locator('label[for="catalog-category"]') });
  const categoryTrigger = categoryControl.getByRole('button', { name: /Apri Categoria/ });
  await categoryTrigger.focus();
  await categoryTrigger.press('ArrowDown');
  await expect(categoryControl).toHaveAttribute('data-cycle-state', 'open');
  await categoryControl.getByRole('option', { name: 'Tutte le categorie' }).press('Enter');
  await expect(categoryTrigger).toHaveAttribute(
    'aria-label',
    /Selezione corrente: Tutte le categorie/
  );
  await page.getByLabel('Cerca nel catalogo').fill('Astro TypeScript');
  await expect(page.locator('[data-catalog-result-count]')).toHaveText('2');
  const sortControl = page
    .locator('[data-cycle-control]')
    .filter({ has: page.locator('label[for="catalog-sort"]') });
  const sortTrigger = sortControl.getByRole('button', { name: /Apri Ordina/ });
  await sortTrigger.focus();
  await sortTrigger.press('ArrowDown');
  await expect(sortControl).toHaveAttribute('data-cycle-state', 'open');
  await sortControl.getByRole('option', { name: 'Titolo A–Z' }).press('Enter');
  await expect(sortTrigger).toHaveAttribute('aria-label', /Selezione corrente: Titolo A–Z/);
  await expect
    .poll(() =>
      page
        .locator('[data-catalog-entry]:visible [data-catalog-title]')
        .evaluateAll((links) => links.map((link) => link.getAttribute('aria-label')))
    )
    .toEqual(['Product Prototype Sprint', 'Signal Archive']);
});

test('apre una scheda articolo e usa il carrello locale', async ({ page }) => {
  await page.goto('/catalog/product-prototype-sprint/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Product Prototype Sprint');
  await page.getByRole('button', { name: /Aggiungi la commissione/ }).click();
  await expect(page.locator('[data-cart-count]')).toHaveText('1');
  await page.getByRole('link', { name: 'Apri il carrello' }).click();
  await expect(page).toHaveURL(/\/cart\/$/);
  await expect(page.getByRole('heading', { name: 'Product Prototype Sprint' })).toBeVisible();
});

test('le quattro schede espandono il motivo e il modello del proprio cubo', async ({ page }) => {
  test.setTimeout(90_000);
  const articles = [
    {
      slug: 'signal-archive',
      motif: 'binary',
      model: '/3D_models/glass_cubes_design_zeros_and_ones.glb'
    },
    {
      slug: 'civic-loop',
      motif: 'circuit',
      model: '/3D_models/glass_cubes_design_circuit.glb'
    },
    {
      slug: 'open-lab',
      motif: 'plasma',
      model: '/3D_models/glass_cubes_design_plasma.glb'
    },
    {
      slug: 'product-prototype-sprint',
      motif: 'network',
      model: '/3D_models/glass_cubes_design_S.glb'
    }
  ] as const;

  for (const article of articles) {
    await page.goto(`/catalog/${article.slug}/`);
    const detail = page.locator('[data-article-slug]');
    const cube = detail.locator('[data-catalog-cube-grid]').first();
    await expect(detail).toHaveAttribute('data-article-slug', article.slug);
    await expect(detail).toHaveAttribute('data-article-motif', article.motif);
    await expect(cube).toHaveAttribute('data-catalog-cube-renderer', 'webgl', {
      timeout: 20_000
    });
    await expect(cube.locator('[data-cube-slot]')).toHaveAttribute(
      'data-cube-model',
      article.model
    );
    await expect(detail.locator('.article-detail__project-media img')).toHaveCount(1);
  }
});

test('naviga dal carrello al checkout', async ({ page }) => {
  await page.goto('/catalog/product-prototype-sprint/');
  await page.getByRole('button', { name: /Aggiungi la commissione/ }).click();
  await expect(page.locator('[data-cart-count]')).toHaveText('1');
  await page.goto('/cart/');
  await page.getByRole('link', { name: 'Vai al checkout' }).click();
  await expect(page).toHaveURL(/\/checkout\/$/);
  await expect(page.getByLabel('Nome e cognome')).toBeVisible();
  await expect(page.getByText(/Nessun dato di pagamento/)).toBeVisible();
  await expect(page.locator('[data-checkout-summary]')).toContainText('Product Prototype Sprint');
  await expect(page.locator('[data-checkout-cart]')).toHaveValue(/item-prototype-sprint/);
  await expect(page.locator('.checkout-form')).toHaveCSS('border-top-style', 'solid');
  await expect(page.locator('.summary-card')).toHaveCSS('border-top-style', 'solid');
  await expect(page.locator('input[name*="card" i], input[autocomplete="cc-number"]')).toHaveCount(
    0
  );

  await page.getByLabel('Nome e cognome').fill('Ada Lovelace');
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByLabel('Dettagli della richiesta').fill('Obiettivi e vincoli del progetto.');
  await page.getByLabel(/Acconsento/).check();
  expect(
    await page
      .locator('[data-checkout-form]')
      .evaluate((form) => (form as HTMLFormElement).checkValidity())
  ).toBe(true);
});

test('blocca il checkout quando il carrello è vuoto', async ({ page }) => {
  await page.goto('/cart/');
  const checkout = page.getByRole('link', { name: 'Vai al checkout' });
  await expect(checkout).toHaveAttribute('aria-disabled', 'true');
  await checkout.click({ force: true });
  await expect(page).toHaveURL(/\/cart\/$/);
});

test('restituisce una vera 404 per una scheda inesistente', async ({ page }) => {
  const response = await page.goto('/catalog/articolo-inesistente/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('fuori catalogo');
});

test('la pagina Profilo è stata eliminata', async ({ page }) => {
  const response = await page.goto('/about/');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('link', { name: 'Profilo' })).toHaveCount(0);
  await expect(page.locator('link[rel="canonical"]')).not.toHaveAttribute('href', /\/about\/$/);
});

test('mantiene struttura accessibile e metadata SEO nella build', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/catalog/signal-archive/');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('img:not([alt])')).toHaveCount(0);
  await page.getByRole('link', { name: 'Vai al contenuto' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://alejandro-innocenzi.netlify.app/catalog/signal-archive/'
  );
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
    'content',
    'Studio Prisma'
  );
  expect(
    await page.locator('script[type="application/ld+json"]').evaluate((script) => {
      JSON.parse(script.textContent ?? '');
      return true;
    })
  ).toBe(true);

  await page.goto('/checkout/');
  expect(
    await page
      .locator('input:not([type="hidden"]), select, textarea')
      .evaluateAll((controls) =>
        controls.every((control) => (control as HTMLInputElement).labels?.length)
      )
  ).toBe(true);
});

test('le route principali non generano errori client critici', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  const routes = ['/', '/catalog/', '/catalog/signal-archive/', '/cart/', '/checkout/', '/404/'];
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBeLessThan(500);
  }
  expect(errors).toEqual([]);
});
