import { expect, test } from '@playwright/test';

test('apre homepage e catalogo', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Competenze');
  await page.getByRole('link', { name: 'Catalogo' }).first().click();
  await expect(page).toHaveURL(/\/catalog\/$/);
  await expect(page.locator('[data-catalog-item]')).toHaveCount(6);
});

test('applica ricerca, filtro da URL e ordinamento con le regole del dominio', async ({ page }) => {
  await page.goto('/catalog/?category=servizi');
  await expect(page.locator('[data-catalog-result-count]')).toHaveText('1');
  await expect(page.locator('[data-catalog-entry]:visible')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Product Prototype Sprint' })).toBeVisible();

  await page.getByLabel('Categoria', { exact: true }).selectOption('');
  await page.getByLabel('Cerca nel catalogo').fill('Astro TypeScript');
  await expect(page.locator('[data-catalog-result-count]')).toHaveText('3');
  await page.getByLabel('Ordina').selectOption('title');
  await expect(page.locator('[data-catalog-entry]:visible h3')).toHaveText([
    'Frontend Architecture',
    'Product Prototype Sprint',
    'Signal Archive'
  ]);
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

  const routes = [
    '/',
    '/catalog/',
    '/catalog/signal-archive/',
    '/cart/',
    '/checkout/',
    '/about/',
    '/404/'
  ];
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBeLessThan(500);
  }
  expect(errors).toEqual([]);
});
