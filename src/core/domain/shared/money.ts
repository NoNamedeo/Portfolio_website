import { DomainError } from './domain-error';

export type Currency = 'EUR' | 'USD' | 'GBP';

export interface SerializedMoney {
  readonly amountMinor: number;
  readonly currency: Currency;
}

export class Money {
  private constructor(
    readonly amountMinor: number,
    readonly currency: Currency
  ) {}

  static fromMinor(amountMinor: number, currency: Currency = 'EUR'): Money {
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
      throw new DomainError('L’importo deve essere un intero non negativo in unità minori.');
    }
    if (!Money.isCurrency(currency)) {
      throw new DomainError('La valuta non è supportata.');
    }
    return new Money(amountMinor, currency);
  }

  static zero(currency: Currency = 'EUR'): Money {
    return new Money(0, currency);
  }

  static fromJSON(value: unknown): Money {
    if (!value || typeof value !== 'object') {
      throw new DomainError('L’importo serializzato non è valido.');
    }
    const candidate = value as Partial<SerializedMoney>;
    return Money.fromMinor(candidate.amountMinor ?? Number.NaN, candidate.currency as Currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinor(this.amountMinor + other.amountMinor, this.currency);
  }

  multiply(quantity: number): Money {
    if (!Number.isSafeInteger(quantity) || quantity < 0) {
      throw new DomainError('La quantità deve essere un intero non negativo.');
    }
    return Money.fromMinor(this.amountMinor * quantity, this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  format(locale = 'it-IT'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency
    }).format(this.amountMinor / 100);
  }

  toJSON(): SerializedMoney {
    return { amountMinor: this.amountMinor, currency: this.currency };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new DomainError('Non è possibile sommare importi con valute diverse.');
    }
  }

  private static isCurrency(value: unknown): value is Currency {
    return value === 'EUR' || value === 'USD' || value === 'GBP';
  }
}
