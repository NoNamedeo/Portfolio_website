import { expect, test } from '@playwright/test';

test.describe('racconto orizzontale /canals/', () => {
  test('carica il viaggio, sincronizza lo scroll e anima tutti i media', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/canals/');

    await expect(page.locator('[data-canals-loader]')).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator('html')).toHaveAttribute('data-canals-ready', 'true');
    await expect(page.locator('[data-canals-scene]')).toHaveCount(14);
    for (const image of [
      '/media/canals/canal-hero-v1.webp',
      '/media/canals/canal-engraving-v1.webp',
      '/media/canals/canal-construction-v1.webp',
      '/media/canals/canal-map-v1.webp'
    ]) {
      expect((await page.request.get(image)).ok(), image).toBe(true);
    }

    const geometry = await page.evaluate(() => {
      const shell = document.querySelector<HTMLElement>('[data-canals-shell]');
      const track = document.querySelector<HTMLElement>('[data-canals-track]');
      const functions = document.querySelector<HTMLElement>('#functions');
      if (!shell || !track || !functions) throw new Error('Racconto orizzontale non disponibile');

      return {
        shellHeight: shell.offsetHeight,
        trackWidth: track.scrollWidth,
        functionsLeft: functions.offsetLeft
      };
    });

    expect(geometry.shellHeight).toBeGreaterThan(900 * 15);
    expect(geometry.trackWidth).toBeGreaterThan(1440 * 15);

    await page.evaluate((top) => window.scrollTo(0, top), geometry.functionsLeft + 300);
    await page.waitForTimeout(1_400);

    await expect(page.locator('[data-canals-track]')).not.toHaveCSS(
      'transform',
      'matrix(1, 0, 0, 1, 0, 0)'
    );
    const motion = await page.evaluate(() => ({
      media: [...document.querySelectorAll<HTMLElement>('[data-canals-media]')].map((element) =>
        element.style.getPropertyValue('--media-shift')
      ),
      visibleReveals: document.querySelectorAll('.is-visible').length,
      tone: document.body.dataset.canalsTone
    }));
    expect(motion.media).toHaveLength(8);
    expect(motion.media.every(Boolean)).toBe(true);
    expect(motion.visibleReveals).toBeGreaterThan(0);
    expect(['paper', 'red']).toContain(motion.tone);
  });

  test('apre il menu editoriale e raggiunge i capitoli', async ({ page }) => {
    await page.goto('/canals/');
    await expect(page.locator('[data-canals-loader]')).toHaveCount(0, { timeout: 5_000 });

    const menuButton = page.locator('[data-canals-menu-toggle]');
    await menuButton.click();
    await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-canals-menu]')).toHaveAttribute('aria-hidden', 'false');
    await expect(page.getByRole('link', { name: /Origins/ })).toBeVisible();

    await page.getByRole('link', { name: /Expansion/ }).click();
    await expect(page).toHaveURL(/#expansion$/);
    await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
  });

  test('diventa verticale su mobile senza overflow orizzontale', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/canals/');

    await expect(page.locator('[data-canals-loader]')).toHaveCount(0, { timeout: 2_000 });
    await expect(page.getByRole('heading', { name: 'Canals', exact: true })).toBeVisible();

    const mobileState = await page.evaluate(() => {
      const track = document.querySelector<HTMLElement>('[data-canals-track]');
      if (!track) throw new Error('Track mobile non disponibile');

      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        trackDisplay: getComputedStyle(track).display,
        trackTransform: getComputedStyle(track).transform
      };
    });
    expect(mobileState).toEqual({
      documentWidth: 390,
      viewportWidth: 390,
      trackDisplay: 'block',
      trackTransform: 'none'
    });
  });
});
