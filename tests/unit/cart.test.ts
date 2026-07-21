import { describe, expect, it } from 'vitest';
import { Cart } from '@core/domain/cart/cart';
import { Money } from '@core/domain/shared/money';
import { makeItem } from '../fixtures/catalog';

const fixed = makeItem({
  id: 'item-fixed',
  slug: 'fixed',
  pricing: { kind: 'fixed', money: { amountMinor: 2500, currency: 'EUR' } }
});
const quote = makeItem({
  id: 'item-quote',
  slug: 'quote',
  pricing: { kind: 'quote' },
  acquisitionMode: 'commission'
});
const donation = makeItem({
  id: 'item-donation',
  slug: 'donation',
  pricing: { kind: 'donation' },
  acquisitionMode: 'donation'
});
const usd = makeItem({
  id: 'item-usd',
  slug: 'usd',
  pricing: { kind: 'fixed', money: { amountMinor: 1200, currency: 'USD' } }
});

describe('Cart', () => {
  it('aggiunge senza duplicare le righe e incrementa la quantità', () => {
    const cart = Cart.empty().add(fixed).add(fixed, 2);
    expect(cart.lines()).toHaveLength(1);
    expect(cart.lines()[0]?.quantity).toBe(3);
    expect(cart.totalItems()).toBe(3);
  });

  it('aggiorna la quantità e rimuove una riga', () => {
    const cart = Cart.empty().add(fixed).updateQuantity(fixed.id.value, 4);
    expect(cart.lines()[0]?.quantity).toBe(4);
    expect(cart.remove(fixed.id.value).totalItems()).toBe(0);
  });

  it('calcola il totale in unità minori', () => {
    const cart = Cart.empty().add(fixed, 3);
    expect(cart.total([fixed])?.amountMinor).toBe(7500);
  });

  it('segnala gli articoli su preventivo e rende il totale non definitivo', () => {
    const cart = Cart.empty().add(fixed).add(quote);
    expect(cart.hasQuote([fixed, quote])).toBe(true);
    expect(cart.total([fixed, quote])).toBeNull();
    expect(cart.knownTotal([fixed, quote])?.amountMinor).toBe(2500);
  });

  it('gestisce un importo di donazione selezionato', () => {
    const cart = Cart.empty()
      .add(donation)
      .setDonationAmount(donation, Money.fromMinor(1800), [donation]);
    expect(cart.hasDonation([donation])).toBe(true);
    expect(cart.total([donation])?.amountMinor).toBe(1800);
  });

  it('rifiuta donazioni inferiori a un euro', () => {
    const cart = Cart.empty().add(donation);
    expect(() => cart.setDonationAmount(donation, Money.fromMinor(99), [donation])).toThrow();
  });

  it('rifiuta un importo di donazione su un articolo non-donazione', () => {
    const cart = Cart.empty().add(fixed);
    expect(() => cart.setDonationAmount(fixed, Money.fromMinor(100), [fixed])).toThrow();
  });

  it('calcola totali in valute diverse da EUR senza conversioni implicite', () => {
    const cart = Cart.empty().add(usd, 2);
    expect(cart.total([usd])?.toJSON()).toEqual({ amountMinor: 2400, currency: 'USD' });
    expect(cart.knownTotal([usd])?.currency).toBe('USD');
  });

  it('riconosce e impedisce nuove combinazioni con valute incompatibili', () => {
    const mixed = Cart.empty().add(fixed).add(usd);
    expect(mixed.hasCurrencyConflict([fixed, usd])).toBe(true);
    expect(mixed.total([fixed, usd])).toBeNull();
    expect(mixed.knownTotal([fixed, usd])).toBeNull();
    expect(Cart.empty().add(fixed).canCombineWith(usd, [fixed, usd])).toBe(false);
  });

  it('riconcilia le righe stale o non più acquisibili', () => {
    const previouslyAvailable = makeItem({
      id: 'item-unavailable',
      slug: 'unavailable'
    });
    const unavailable = makeItem({
      id: 'item-unavailable',
      slug: 'unavailable',
      availability: 'unavailable'
    });
    const cart = Cart.empty().add(fixed).add(previouslyAvailable);
    expect(cart.reconcile([unavailable]).totalItems()).toBe(0);
  });

  it('salva note, serializza e ricostruisce il carrello', () => {
    const original = Cart.empty().add(fixed, 2).setNotes(fixed.id.value, 'Consegna progressiva');
    const restored = Cart.fromJSON(JSON.parse(JSON.stringify(original.toJSON())) as unknown);
    expect(restored.toJSON()).toEqual(original.toJSON());
    expect(restored.lines()[0]?.notes).toBe('Consegna progressiva');
  });

  it('ricostruisce un carrello vuoto da dati corrotti', () => {
    expect(Cart.fromJSON({ version: 99, lines: 'invalid' }).totalItems()).toBe(0);
  });

  it('migra lo schema legacy e distingue versioni future e dati invalidi', () => {
    const legacy = Cart.restore({
      version: 0,
      items: [{ id: fixed.id.value, quantity: 2, notes: 'Legacy' }]
    });
    expect(legacy.status).toBe('migrated');
    expect(legacy.cart.totalItems()).toBe(2);
    expect(Cart.restore({ version: 2, lines: [] }).status).toBe('unsupported');
    expect(Cart.restore({ version: 1, lines: 'invalid' }).status).toBe('invalid');
  });
});
