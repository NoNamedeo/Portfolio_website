import { describe, expect, it } from 'vitest';
import type {
  CartRepository,
  CatalogRepository,
  SiteIdentityRepository
} from '@application/ports/repositories';
import {
  AddItemToCart,
  GetCartState,
  RemoveItemFromCart
} from '@application/use-cases/cart-use-cases';
import {
  GetCatalogPage,
  GetHomePage,
  QueryCatalog
} from '@application/use-cases/catalog-use-cases';
import { Cart } from '@core/domain/cart/cart';
import type { CatalogItem } from '@core/domain/catalog/catalog-item';
import { SiteIdentity } from '@core/domain/portfolio/site-identity';
import { makeItem } from '../fixtures/catalog';

class MemoryCatalogRepository implements CatalogRepository {
  constructor(private readonly items: readonly CatalogItem[]) {}
  async getAll(): Promise<readonly CatalogItem[]> {
    return this.items;
  }
}

class MemoryCartRepository implements CartRepository {
  cart = Cart.empty();
  async get(): Promise<Cart> {
    return this.cart;
  }
  async save(cart: Cart): Promise<void> {
    this.cart = cart;
  }
}

class IdentityRepository implements SiteIdentityRepository {
  async getSiteIdentity(): Promise<SiteIdentity> {
    return new SiteIdentity(
      'Test Store',
      'Tagline',
      'Description',
      'it-IT',
      'https://example.com',
      '/social-preview.svg'
    );
  }
}

const items = [
  makeItem({ id: 'item-one', slug: 'one', title: 'Astro project', featured: true, order: 2 }),
  makeItem({ id: 'item-two', slug: 'two', title: 'Research service', order: 1 })
];

describe('catalog use cases', () => {
  it('produce un page model ordinato e pronto per la presentation', async () => {
    const model = await new GetCatalogPage(
      new MemoryCatalogRepository(items),
      new IdentityRepository()
    ).execute();
    expect(model.items.map((item) => item.slug)).toEqual(['two', 'one']);
    expect(model.categorySummaries).toEqual([{ name: 'Software', count: 2 }]);
    expect(model.seo.canonical).toBe('https://example.com/catalog/');
  });

  it('seleziona gli articoli in evidenza per la home', async () => {
    const model = await new GetHomePage(
      new MemoryCatalogRepository(items),
      new IdentityRepository()
    ).execute();
    expect(model.featuredItems.map((item) => item.slug)).toEqual(['one']);
  });

  it('delega la ricerca alle regole del catalogo', async () => {
    const result = await new QueryCatalog(new MemoryCatalogRepository(items)).execute({
      search: 'research'
    });
    expect(result.map((item) => item.slug.value)).toEqual(['two']);
  });
});

describe('cart use cases', () => {
  it('aggiunge e rimuove persistendo attraverso la porta', async () => {
    const catalog = new MemoryCatalogRepository(items);
    const cart = new MemoryCartRepository();
    await new AddItemToCart(cart, catalog).execute('item-one', 2);
    expect((await cart.get()).totalItems()).toBe(2);
    await new RemoveItemFromCart(cart, catalog).execute('item-one');
    expect((await cart.get()).totalItems()).toBe(0);
  });

  it('rimuove e persiste le righe che non esistono più nel catalogo pubblicato', async () => {
    const cart = new MemoryCartRepository();
    cart.cart = Cart.empty().add(items[0]!);
    const state = await new GetCartState(cart, new MemoryCatalogRepository([])).execute();
    expect(state.removedItemIds).toEqual(['item-one']);
    expect((await cart.get()).totalItems()).toBe(0);
  });
});
