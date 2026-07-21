import { mapCatalogItemToCard } from '@application/mappers/catalog-item-mapper';
import { createSeoModel } from '@application/mappers/seo-mapper';
import type { CartPageModel } from '@application/models/page-models';
import type {
  CartRepository,
  CatalogRepository,
  SiteIdentityRepository
} from '@application/ports/repositories';
import { ApplicationError } from '@application/errors/application-error';
import type { Cart } from '@core/domain/cart/cart';
import { Catalog } from '@core/domain/catalog/catalog';
import type { CatalogItem } from '@core/domain/catalog/catalog-item';
import { Money } from '@core/domain/shared/money';

export interface CartState {
  readonly cart: Cart;
  readonly items: readonly CatalogItem[];
  readonly removedItemIds: readonly string[];
}

export class GetCartItemCount {
  constructor(private readonly cartRepository: CartRepository) {}

  async execute(): Promise<number> {
    return (await this.cartRepository.get()).totalItems();
  }
}

export class GetCartState {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly catalogRepository: CatalogRepository
  ) {}

  async execute(): Promise<CartState> {
    const storedCart = await this.cartRepository.get();
    const items = new Catalog(await this.catalogRepository.getAll()).published();
    const cart = storedCart.reconcile(items);
    const currentIds = new Set(cart.lines().map((line) => line.catalogItemId.value));
    const removedItemIds = storedCart
      .lines()
      .map((line) => line.catalogItemId.value)
      .filter((id) => !currentIds.has(id));
    if (removedItemIds.length > 0) await this.cartRepository.save(cart);
    return { cart, items, removedItemIds };
  }
}

export class GetCart {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly catalogRepository: CatalogRepository,
    private readonly identityRepository: SiteIdentityRepository
  ) {}

  async execute(): Promise<CartPageModel> {
    const { cart, items } = await new GetCartState(
      this.cartRepository,
      this.catalogRepository
    ).execute();
    const identity = await this.identityRepository.getSiteIdentity();
    const total = cart.total(items);
    const knownTotal = cart.knownTotal(items);
    return {
      name: identity.name,
      tagline: identity.tagline,
      locale: identity.locale,
      seo: createSeoModel(identity, {
        title: 'Carrello',
        description: 'Riepilogo degli articoli e delle richieste selezionate.',
        path: '/cart/'
      }),
      lines: cart.lines().flatMap((line) => {
        const item = items.find((candidate) => candidate.id.value === line.catalogItemId.value);
        if (!item) return [];
        const card = mapCatalogItemToCard(item);
        return [
          {
            catalogItemId: item.id.value,
            title: item.title,
            slug: item.slug.value,
            quantity: line.quantity,
            pricingLabel: card.pricingLabel,
            ...(line.selectedAmount ? { selectedAmount: line.selectedAmount.format() } : {}),
            ...(line.notes ? { notes: line.notes } : {})
          }
        ];
      }),
      itemCount: cart.totalItems(),
      totalLabel: total?.format() ?? null,
      knownTotalLabel:
        knownTotal?.format() ?? (cart.hasCurrencyConflict(items) ? 'Valute incompatibili' : '—'),
      hasQuote: cart.hasQuote(items),
      hasDonation: cart.hasDonation(items),
      hasCurrencyConflict: cart.hasCurrencyConflict(items)
    };
  }
}

abstract class CartMutation {
  constructor(
    protected readonly cartRepository: CartRepository,
    protected readonly catalogRepository: CatalogRepository
  ) {}

  protected async getState(): Promise<CartState> {
    return new GetCartState(this.cartRepository, this.catalogRepository).execute();
  }
}

export class AddItemToCart extends CartMutation {
  async execute(catalogItemId: string, quantity = 1) {
    const { cart: currentCart, items } = await this.getState();
    const item = items.find((candidate) => candidate.id.value === catalogItemId);
    if (!item) {
      throw new ApplicationError('CATALOG_ITEM_NOT_FOUND', 'Articolo non trovato.');
    }
    if (!currentCart.canCombineWith(item, items)) {
      throw new ApplicationError(
        'CATALOG_DATA_INVALID',
        'Il carrello non può combinare articoli in valute diverse.'
      );
    }
    const cart = currentCart.add(item, quantity);
    await this.cartRepository.save(cart);
    return cart;
  }
}

export class RemoveItemFromCart extends CartMutation {
  async execute(catalogItemId: string) {
    const { cart: currentCart } = await this.getState();
    const cart = currentCart.remove(catalogItemId);
    await this.cartRepository.save(cart);
    return cart;
  }
}

export class UpdateCartItemQuantity extends CartMutation {
  async execute(catalogItemId: string, quantity: number) {
    const { cart: currentCart } = await this.getState();
    const cart = currentCart.updateQuantity(catalogItemId, quantity);
    await this.cartRepository.save(cart);
    return cart;
  }
}

export class SetDonationAmount extends CartMutation {
  async execute(catalogItemId: string, amountMinor: number, currency?: 'EUR' | 'USD' | 'GBP') {
    const { cart: currentCart, items } = await this.getState();
    const item = items.find((candidate) => candidate.id.value === catalogItemId);
    if (!item) {
      throw new ApplicationError('CATALOG_ITEM_NOT_FOUND', 'Articolo non trovato.');
    }
    const cart = currentCart.setDonationAmount(
      item,
      Money.fromMinor(amountMinor, currency ?? currentCart.currency(items) ?? 'EUR'),
      items
    );
    await this.cartRepository.save(cart);
    return cart;
  }
}

export class UpdateCartItemNotes extends CartMutation {
  async execute(catalogItemId: string, notes: string) {
    const { cart: currentCart } = await this.getState();
    const cart = currentCart.setNotes(catalogItemId, notes);
    await this.cartRepository.save(cart);
    return cart;
  }
}

export class ClearCart {
  constructor(private readonly cartRepository: CartRepository) {}

  async execute() {
    const cart = (await this.cartRepository.get()).clear();
    await this.cartRepository.save(cart);
    return cart;
  }
}
