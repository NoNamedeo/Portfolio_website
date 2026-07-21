import { EmailAddress } from './email-address';
import type { Cart } from '@core/domain/cart/cart';
import { DomainError } from '@core/domain/shared/domain-error';
import type { SerializedMoney } from '@core/domain/shared/money';
import { Money } from '@core/domain/shared/money';

export class CustomerInformation {
  readonly fullName: string;
  readonly email: EmailAddress;
  readonly company?: string;

  constructor(props: { fullName: string; email: string; company?: string }) {
    this.fullName = props.fullName.trim();
    if (this.fullName.length < 2 || this.fullName.length > 120) {
      throw new DomainError('Il nome completo deve contenere da 2 a 120 caratteri.');
    }
    this.email = EmailAddress.create(props.email);
    this.company = props.company?.trim() || undefined;
    if (this.company && this.company.length > 120) {
      throw new DomainError('Il nome dell’azienda non può superare 120 caratteri.');
    }
  }
}

export interface CheckoutDraftProps {
  readonly cart: Cart;
  readonly customer?: CustomerInformation;
  readonly company?: string;
  readonly message?: string;
  readonly budget?: SerializedMoney;
  readonly deadline?: string;
  readonly projectDetails?: string;
  readonly consent?: boolean;
}

export class CheckoutDraft {
  readonly cart: Cart;
  readonly customer?: CustomerInformation;
  readonly company?: string;
  readonly message: string;
  readonly budget?: Money;
  readonly deadline?: string;
  readonly projectDetails: string;
  readonly consent: boolean;

  constructor(props: CheckoutDraftProps) {
    this.cart = props.cart;
    this.customer = props.customer;
    this.company = props.company?.trim() || props.customer?.company;
    if (this.company && this.company.length > 120) {
      throw new DomainError('Il nome dell’azienda non può superare 120 caratteri.');
    }
    this.message = props.message?.trim() ?? '';
    if (this.message.length > 2000) {
      throw new DomainError('Il messaggio non può superare 2000 caratteri.');
    }
    this.budget = props.budget ? Money.fromJSON(props.budget) : undefined;
    if (props.deadline && !CheckoutDraft.isCalendarDate(props.deadline)) {
      throw new DomainError('La scadenza deve usare il formato YYYY-MM-DD.');
    }
    this.deadline = props.deadline;
    this.projectDetails = props.projectDetails?.trim() ?? '';
    if (this.projectDetails.length > 5000) {
      throw new DomainError('I dettagli del progetto non possono superare 5000 caratteri.');
    }
    this.consent = props.consent ?? false;
  }

  isReadyToSubmit(): boolean {
    return Boolean(
      this.customer && this.consent && this.cart.totalItems() > 0 && this.projectDetails.length > 0
    );
  }

  private static isCalendarDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month! - 1 &&
      date.getUTCDate() === day
    );
  }
}
