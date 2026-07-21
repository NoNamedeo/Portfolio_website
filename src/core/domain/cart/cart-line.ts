import { CatalogItemId } from '@core/domain/shared/catalog-item-id';
import { DomainError } from '@core/domain/shared/domain-error';
import type { SerializedMoney } from '@core/domain/shared/money';
import { Money } from '@core/domain/shared/money';

export interface CartLineProps {
  readonly catalogItemId: string;
  readonly quantity?: number;
  readonly selectedAmount?: SerializedMoney;
  readonly notes?: string;
}

export class CartLine {
  readonly catalogItemId: CatalogItemId;
  readonly quantity: number;
  readonly selectedAmount?: Money;
  readonly notes: string;

  constructor(props: CartLineProps) {
    this.catalogItemId = CatalogItemId.create(props.catalogItemId);
    this.quantity = CartLine.validateQuantity(props.quantity ?? 1);
    this.selectedAmount = props.selectedAmount ? Money.fromJSON(props.selectedAmount) : undefined;
    if (this.selectedAmount && this.selectedAmount.amountMinor < 100) {
      throw new DomainError('L’importo selezionato deve essere almeno 1,00.');
    }
    this.notes = (props.notes ?? '').trim().slice(0, 500);
  }

  withQuantity(quantity: number): CartLine {
    return new CartLine({ ...this.toJSON(), quantity });
  }

  withSelectedAmount(selectedAmount: Money): CartLine {
    return new CartLine({ ...this.toJSON(), selectedAmount: selectedAmount.toJSON() });
  }

  withNotes(notes: string): CartLine {
    return new CartLine({ ...this.toJSON(), notes });
  }

  toJSON(): Required<Pick<CartLineProps, 'catalogItemId' | 'quantity'>> &
    Pick<CartLineProps, 'selectedAmount' | 'notes'> {
    return {
      catalogItemId: this.catalogItemId.value,
      quantity: this.quantity,
      ...(this.selectedAmount ? { selectedAmount: this.selectedAmount.toJSON() } : {}),
      ...(this.notes ? { notes: this.notes } : {})
    };
  }

  private static validateQuantity(quantity: number): number {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new DomainError('La quantità deve essere compresa tra 1 e 99.');
    }
    return quantity;
  }
}
