import { DomainError } from '@core/domain/shared/domain-error';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class EmailAddress {
  private constructor(readonly value: string) {}

  static create(value: string): EmailAddress {
    const normalized = value.trim().toLocaleLowerCase('it');
    if (normalized.length > 254 || !EMAIL.test(normalized)) {
      throw new DomainError('L’indirizzo email non è valido.');
    }
    return new EmailAddress(normalized);
  }

  toString(): string {
    return this.value;
  }
}
