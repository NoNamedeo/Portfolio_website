import { describe, expect, it } from 'vitest';
import { Cart } from '@core/domain/cart/cart';
import { CheckoutDraft, CustomerInformation } from '@core/domain/checkout/checkout-draft';
import { makeItem } from '../fixtures/catalog';

describe('CheckoutDraft', () => {
  const item = makeItem();
  const customer = new CustomerInformation({
    fullName: 'Ada Lovelace',
    email: 'ada@example.com'
  });

  it('è pronto solo con cliente, consenso, carrello e dettagli', () => {
    const ready = new CheckoutDraft({
      cart: Cart.empty().add(item),
      customer,
      consent: true,
      projectDetails: 'Obiettivi e vincoli del progetto.'
    });
    expect(ready.isReadyToSubmit()).toBe(true);
    expect(
      new CheckoutDraft({ cart: Cart.empty().add(item), customer, consent: true }).isReadyToSubmit()
    ).toBe(false);
  });

  it('valida nome, scadenza e limiti testuali', () => {
    expect(() => new CustomerInformation({ fullName: 'A', email: 'a@example.com' })).toThrow();
    expect(() => new CheckoutDraft({ cart: Cart.empty(), deadline: '21/07/2026' })).toThrow();
    expect(() => new CheckoutDraft({ cart: Cart.empty(), deadline: '2026-02-30' })).toThrow();
    expect(() => new CheckoutDraft({ cart: Cart.empty(), message: 'x'.repeat(2001) })).toThrow();
  });
});
