import { expect, test } from '@playwright/test';

test.describe('sito sperimentale /prova/', () => {
  test('carica l’esperienza, apre il menu e naviga tra le pagine', async ({ page }) => {
    await page.goto('/prova/');

    await expect(page.locator('html')).toHaveAttribute('data-experimental-ready', 'ready');
    await expect(page.locator('[data-site-loader]')).toHaveCount(0);
    await expect(page.locator('[data-experimental-preloader]')).toHaveCount(0, {
      timeout: 5_000
    });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Idee');

    const menuButton = page.locator('[data-menu-toggle]');
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-menu]')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByRole('link', { name: /Esperienze/ }).first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');

    await page.goto('/prova/progetti/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Esperienze');
    await expect(page.locator('.exp-project-showcase')).toHaveCount(5);
    await page.getByRole('link', { name: 'L’esperienza' }).first().click();
    await expect(page).toHaveURL(/\/prova\/progetto\/laurea-fisica\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Laurea in Fisica');
  });

  test('espone tutte le route secondarie e i contenuti placeholder', async ({ page }) => {
    const routes = [
      '/prova/',
      '/prova/progetti/',
      '/prova/conosci/',
      '/prova/progetto/laurea-fisica/',
      '/prova/progetto/laurea-informatica/',
      '/prova/progetto/sef-framework/',
      '/prova/progetto/laboratorio-elettronico/',
      '/prova/progetto/matrice-rgb-10x10/',
      '/prova/contatti/',
      '/prova/privacy/',
      '/prova/cookie/',
      '/prova/note-legali/'
    ];

    for (const route of routes) {
      const response = await page.goto(route);
      expect(response?.status(), route).toBe(200);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('[data-site-loader]')).toHaveCount(0);
    }
  });

  test('trasforma lo scroll verticale in una sequenza orizzontale animata', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/prova/');
    await expect(page.locator('[data-experimental-preloader]')).toHaveCount(0, {
      timeout: 5_000
    });

    const geometry = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('[data-horizontal-shell]');
      const track = document.querySelector<HTMLElement>('[data-horizontal-track]');
      const manifesto = document.querySelector<HTMLElement>('.exp-hmanifesto');
      const values = document.querySelector<HTMLElement>('.exp-hvalues');

      if (!shell || !track || !manifesto || !values) {
        throw new Error('Sequenza orizzontale non disponibile');
      }

      return {
        shellHeight: shell.offsetHeight,
        trackWidth: track.scrollWidth,
        manifestoLeft: manifesto.offsetLeft,
        valuesLeft: values.offsetLeft
      };
    });

    expect(geometry.shellHeight).toBeGreaterThan(900 * 10);
    expect(geometry.trackWidth).toBeGreaterThan(1440 * 10);

    await page.evaluate((top) => window.scrollTo(0, top), geometry.manifestoLeft + 300);
    await page.waitForTimeout(1_100);
    await expect(page.locator('[data-experimental-header]')).toHaveAttribute('data-tone', 'dark');
    await expect(page.locator('[data-horizontal-track]')).not.toHaveCSS(
      'transform',
      'matrix(1, 0, 0, 1, 0, 0)'
    );
    const synchronizedMotion = await page.evaluate(() => ({
      photos: [...document.querySelectorAll<HTMLElement>('[data-horizontal-track] .exp-photo')].map(
        (photo) => photo.style.getPropertyValue('--motion-progress')
      ),
      cards: [...document.querySelectorAll<HTMLElement>('[data-horizontal-motion]')].map((card) =>
        card.style.getPropertyValue('--motion-progress')
      )
    }));
    expect(synchronizedMotion.photos.length).toBeGreaterThan(10);
    expect(synchronizedMotion.photos.every(Boolean)).toBe(true);
    expect(synchronizedMotion.cards).toHaveLength(5);
    expect(synchronizedMotion.cards.every(Boolean)).toBe(true);

    await page.evaluate((top) => window.scrollTo(0, top), geometry.valuesLeft + 300);
    await page.waitForTimeout(1_100);
    await expect(page.locator('[data-experimental-header]')).toHaveAttribute('data-tone', 'coral');

    await page.evaluate((top) => window.scrollTo(0, top), geometry.shellHeight - 900);
    await page.waitForTimeout(1_300);
    const finalGalleryProgress = await page
      .locator('[data-horizontal-gallery]')
      .evaluate((element) =>
        Number(getComputedStyle(element).getPropertyValue('--gallery-step-three'))
      );
    expect(finalGalleryProgress).toBeGreaterThan(0.8);
  });

  test('resta usabile su mobile e non genera overflow orizzontale', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/prova/');

    await expect(page.locator('[data-experimental-preloader]')).toHaveCount(0, {
      timeout: 2_000
    });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const horizontalOverflow = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      elements: [...document.querySelectorAll<HTMLElement>('body *')]
        .filter((element) => {
          if (element.closest('[data-project-rail], [data-horizontal-shell], .exp-photo')) {
            return false;
          }
          const bounds = element.getBoundingClientRect();
          return bounds.right > document.documentElement.clientWidth + 1 || bounds.left < -1;
        })
        .slice(0, 12)
        .map((element) => ({
          tag: element.tagName,
          class: element.className,
          left: Math.round(element.getBoundingClientRect().left),
          right: Math.round(element.getBoundingClientRect().right)
        }))
    }));
    expect(horizontalOverflow).toEqual({
      documentWidth: 390,
      viewportWidth: 390,
      elements: []
    });

    await page.getByRole('button', { name: 'Menu' }).click();
    await expect(page.locator('[data-menu]')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByRole('link', { name: /Conosci/ }).first()).toBeVisible();
  });

  test('gestisce la galleria e il modulo dimostrativo', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/prova/progetto/laurea-fisica/');
    await expect(page.locator('[data-experimental-preloader]')).toHaveCount(0, {
      timeout: 2_000
    });

    await page.locator('[data-gallery-item]').first().click();
    await expect(page.locator('[data-gallery-dialog]')).toHaveAttribute('open', '');
    await page.getByRole('button', { name: 'Chiudi' }).click();
    await expect(page.locator('[data-gallery-dialog]')).not.toHaveAttribute('open', '');

    await page.goto('/prova/contatti/');
    await page.getByLabel('Nome').fill('Ada');
    await page.getByLabel('Email').fill('ada@example.com');
    await page.getByLabel('Interesse').selectOption({ label: 'Laurea in Fisica' });
    await page.getByLabel('Messaggio').fill('Vorrei ricevere maggiori informazioni.');
    await page.getByLabel(/Accetto/).check();
    await page.getByRole('button', { name: 'Invia richiesta' }).click();
    await expect(page.locator('[data-form-status]')).toContainText('Messaggio demo ricevuto');
  });
});
