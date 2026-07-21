import { CartLine, type CartLineProps } from './cart-line';
import type { CatalogItem } from '@core/domain/catalog/catalog-item';
import { DomainError } from '@core/domain/shared/domain-error';
import type { Currency } from '@core/domain/shared/money';
import { Money } from '@core/domain/shared/money';

export const CART_SCHEMA_VERSION = 1 as const;

export interface SerializedCart {
  readonly version: typeof CART_SCHEMA_VERSION;
  readonly lines: readonly CartLineProps[];
}

interface LegacySerializedCart {
  readonly version: 0;
  readonly items: readonly {
    readonly id: string;
    readonly quantity?: number;
    readonly donationAmountMinor?: number;
    readonly currency?: Currency;
    readonly notes?: string;
  }[];
}

export type CartRestoreStatus = 'current' | 'migrated' | 'invalid' | 'unsupported';

export interface CartRestoreResult {
  readonly cart: Cart;
  readonly status: CartRestoreStatus;
}

export class Cart {
  private readonly lineMap = new Map<string, CartLine>();

  constructor(lines: readonly CartLine[] = []) {
    for (const line of lines) {
      if (this.lineMap.has(line.catalogItemId.value)) {
        throw new DomainError('Il carrello non può contenere righe duplicate.');
      }
      this.lineMap.set(line.catalogItemId.value, line);
    }
  }

  static empty(): Cart {
    return new Cart();
  }

  static fromJSON(value: unknown): Cart {
    return Cart.restore(value).cart;
  }

  static restore(value: unknown): CartRestoreResult {
    if (!value || typeof value !== 'object') {
      return { cart: Cart.empty(), status: 'invalid' };
    }
    const candidate = value as {
      readonly version?: unknown;
      readonly lines?: unknown;
      readonly items?: unknown;
    };
    if (candidate.version === 0) return Cart.restoreLegacy(candidate as LegacySerializedCart);
    if (candidate.version !== CART_SCHEMA_VERSION) {
      return {
        cart: Cart.empty(),
        status: typeof candidate.version === 'number' ? 'unsupported' : 'invalid'
      };
    }
    if (!Array.isArray(candidate.lines)) return { cart: Cart.empty(), status: 'invalid' };
    try {
      return {
        cart: new Cart(candidate.lines.map((line) => new CartLine(line as CartLineProps))),
        status: 'current'
      };
    } catch {
      return { cart: Cart.empty(), status: 'invalid' };
    }
  }

  lines(): readonly CartLine[] {
    return [...this.lineMap.values()];
  }

  add(item: CatalogItem, quantity = 1): Cart {
    if (!item.canBeAddedToCart()) {
      throw new DomainError('Questo articolo non può essere aggiunto al carrello.');
    }
    const current = this.lineMap.get(item.id.value);
    const nextQuantity = (current?.quantity ?? 0) + quantity;
    const nextLine = current
      ? current.withQuantity(nextQuantity)
      : new CartLine({ catalogItemId: item.id.value, quantity });
    return this.replace(nextLine);
  }

  reconcile(items: readonly CatalogItem[]): Cart {
    const availableIds = new Set(
      items.filter((item) => item.canBeAddedToCart()).map((item) => item.id.value)
    );
    return new Cart(this.lines().filter((line) => availableIds.has(line.catalogItemId.value)));
  }

  remove(catalogItemId: string): Cart {
    const lines = this.lines().filter((line) => line.catalogItemId.value !== catalogItemId);
    return new Cart(lines);
  }

  updateQuantity(catalogItemId: string, quantity: number): Cart {
    const line = this.getRequiredLine(catalogItemId);
    return this.replace(line.withQuantity(quantity));
  }

  setDonationAmount(item: CatalogItem, amount: Money, items: readonly CatalogItem[]): Cart {
    if (item.pricing.kind !== 'donation' || item.acquisitionMode !== 'donation') {
      throw new DomainError('Questo articolo non accetta un importo di donazione.');
    }
    if (amount.amountMinor < 100) {
      throw new DomainError('L’importo minimo della donazione è 1,00.');
    }
    const otherCurrencies = this.currencies(items, item.id.value);
    if (otherCurrencies.size > 0 && !otherCurrencies.has(amount.currency)) {
      throw new DomainError('Il carrello non può contenere importi in valute diverse.');
    }
    const line = this.getRequiredLine(item.id.value);
    return this.replace(line.withSelectedAmount(amount));
  }

  setNotes(catalogItemId: string, notes: string): Cart {
    const line = this.getRequiredLine(catalogItemId);
    return this.replace(line.withNotes(notes));
  }

  clear(): Cart {
    return Cart.empty();
  }

  totalItems(): number {
    return this.lines().reduce((total, line) => total + line.quantity, 0);
  }

  hasQuote(items: readonly CatalogItem[]): boolean {
    return this.lines().some((line) =>
      items.find((item) => item.id.value === line.catalogItemId.value)?.pricing.requiresQuote()
    );
  }

  hasDonation(items: readonly CatalogItem[]): boolean {
    return this.lines().some(
      (line) =>
        items.find((item) => item.id.value === line.catalogItemId.value)?.pricing.kind ===
        'donation'
    );
  }

  hasCurrencyConflict(items: readonly CatalogItem[]): boolean {
    return this.currencies(items).size > 1;
  }

  currency(items: readonly CatalogItem[]): Currency | undefined {
    const currencies = this.currencies(items);
    return currencies.size === 1 ? [...currencies][0] : undefined;
  }

  canCombineWith(item: CatalogItem, items: readonly CatalogItem[]): boolean {
    const itemCurrency = item.pricing.money?.currency;
    if (!itemCurrency) return true;
    const currencies = this.currencies(items);
    return currencies.size === 0 || (currencies.size === 1 && currencies.has(itemCurrency));
  }

  total(items: readonly CatalogItem[]): Money | null {
    let total: Money | undefined;
    for (const line of this.lines()) {
      const item = items.find((candidate) => candidate.id.value === line.catalogItemId.value);
      if (!item) return null;
      let lineAmount: Money | undefined;
      if (item.pricing.kind === 'fixed' || item.pricing.kind === 'starting-at') {
        lineAmount = item.pricing.money;
      }
      if (item.pricing.kind === 'donation') lineAmount = line.selectedAmount;
      if (item.pricing.kind === 'free') continue;
      if (!lineAmount) return null;
      const subtotal = lineAmount.multiply(line.quantity);
      if (total && total.currency !== subtotal.currency) return null;
      total = total ? total.add(subtotal) : subtotal;
    }
    return total ?? Money.zero(this.currency(items) ?? 'EUR');
  }

  knownTotal(items: readonly CatalogItem[]): Money | null {
    let total: Money | undefined;
    for (const line of this.lines()) {
      const item = items.find((candidate) => candidate.id.value === line.catalogItemId.value);
      if (!item) continue;
      const amount =
        item.pricing.kind === 'fixed' || item.pricing.kind === 'starting-at'
          ? item.pricing.money
          : item.pricing.kind === 'donation'
            ? line.selectedAmount
            : undefined;
      if (!amount) continue;
      const subtotal = amount.multiply(line.quantity);
      if (total && total.currency !== subtotal.currency) return null;
      total = total ? total.add(subtotal) : subtotal;
    }
    return total ?? null;
  }

  toJSON(): SerializedCart {
    return { version: CART_SCHEMA_VERSION, lines: this.lines().map((line) => line.toJSON()) };
  }

  private replace(line: CartLine): Cart {
    return new Cart([
      ...this.lines().filter((current) => current.catalogItemId.value !== line.catalogItemId.value),
      line
    ]);
  }

  private getRequiredLine(catalogItemId: string): CartLine {
    const line = this.lineMap.get(catalogItemId);
    if (!line) throw new DomainError('La riga richiesta non esiste nel carrello.');
    return line;
  }

  private currencies(items: readonly CatalogItem[], excludedItemId?: string): Set<Currency> {
    const result = new Set<Currency>();
    for (const line of this.lines()) {
      if (line.catalogItemId.value === excludedItemId) continue;
      const item = items.find((candidate) => candidate.id.value === line.catalogItemId.value);
      const currency = line.selectedAmount?.currency ?? item?.pricing.money?.currency;
      if (currency) result.add(currency);
    }
    return result;
  }

  private static restoreLegacy(candidate: LegacySerializedCart): CartRestoreResult {
    if (!Array.isArray(candidate.items)) return { cart: Cart.empty(), status: 'invalid' };
    try {
      const lines = candidate.items.map(
        (item) =>
          new CartLine({
            catalogItemId: item.id,
            quantity: item.quantity,
            ...(item.donationAmountMinor !== undefined
              ? {
                  selectedAmount: {
                    amountMinor: item.donationAmountMinor,
                    currency: item.currency ?? 'EUR'
                  }
                }
              : {}),
            notes: item.notes
          })
      );
      return { cart: new Cart(lines), status: 'migrated' };
    } catch {
      return { cart: Cart.empty(), status: 'invalid' };
    }
  }
}
