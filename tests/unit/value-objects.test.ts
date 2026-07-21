import { describe, expect, it } from 'vitest';
import { EmailAddress } from '@core/domain/checkout/email-address';
import { DateRange } from '@core/domain/profile/profile';
import { Money } from '@core/domain/shared/money';
import { Slug } from '@core/domain/shared/slug';

describe('Slug', () => {
  it('accetta uno slug canonico', () => {
    expect(Slug.create('product-prototype-sprint').value).toBe('product-prototype-sprint');
  });

  it.each(['Uppercase', 'spazi non validi', '-inizio', 'fine-', 'due--trattini'])(
    'rifiuta il valore %s',
    (value) => {
      expect(() => Slug.create(value)).toThrow();
    }
  );
});

describe('Money', () => {
  it('usa unità minori intere e mantiene la valuta', () => {
    const value = Money.fromMinor(1299, 'EUR');
    expect(value.toJSON()).toEqual({ amountMinor: 1299, currency: 'EUR' });
    expect(value.multiply(3).amountMinor).toBe(3897);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rifiuta un importo non sicuro: %s', (value) => {
    expect(() => Money.fromMinor(value)).toThrow();
  });

  it('impedisce somme tra valute diverse', () => {
    expect(() => Money.fromMinor(100, 'EUR').add(Money.fromMinor(100, 'USD'))).toThrow();
  });

  it('valida la valuta anche quando arriva da JSON non tipizzato', () => {
    expect(() => Money.fromJSON({ amountMinor: 100, currency: 'BTC' })).toThrow(/valuta/i);
    expect(() => Money.fromJSON(null)).toThrow(/serializzato/i);
  });
});

describe('EmailAddress', () => {
  it('normalizza un indirizzo valido', () => {
    expect(EmailAddress.create(' Hello@Example.com ').value).toBe('hello@example.com');
  });

  it('rifiuta un indirizzo incompleto', () => {
    expect(() => EmailAddress.create('hello@invalid')).toThrow();
  });
});

describe('DateRange', () => {
  it('rifiuta mesi inesistenti e intervalli invertiti', () => {
    expect(() => new DateRange({ start: '2026-13' })).toThrow();
    expect(() => new DateRange({ start: '2026-02', end: '2026-01' })).toThrow();
  });
});
