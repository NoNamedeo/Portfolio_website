import { DomainError } from '@core/domain/shared/domain-error';
import type { SerializedMoney } from '@core/domain/shared/money';
import { Money } from '@core/domain/shared/money';

export type PricingKind =
  'free' | 'fixed' | 'starting-at' | 'quote' | 'donation' | 'not-applicable';

const pricingKinds: readonly PricingKind[] = [
  'free',
  'fixed',
  'starting-at',
  'quote',
  'donation',
  'not-applicable'
];

export interface PricingData {
  readonly kind: PricingKind;
  readonly money?: SerializedMoney;
}

export class Pricing {
  private constructor(
    readonly kind: PricingKind,
    readonly money?: Money
  ) {}

  static create(data: PricingData): Pricing {
    if (!pricingKinds.includes(data.kind)) {
      throw new DomainError('La modalità di prezzo non è valida.');
    }
    const needsMoney = data.kind === 'fixed' || data.kind === 'starting-at';
    if (needsMoney && !data.money) {
      throw new DomainError('Questa modalità di prezzo richiede un importo.');
    }
    if (!needsMoney && data.money) {
      throw new DomainError('Questa modalità di prezzo non accetta un importo predefinito.');
    }
    return new Pricing(data.kind, data.money ? Money.fromJSON(data.money) : undefined);
  }

  isMonetary(): boolean {
    return ['fixed', 'starting-at', 'donation'].includes(this.kind);
  }

  requiresQuote(): boolean {
    return this.kind === 'quote';
  }

  toJSON(): PricingData {
    return {
      kind: this.kind,
      ...(this.money ? { money: this.money.toJSON() } : {})
    };
  }
}
