import { DomainError } from './domain-error';

const VALID_ID = /^[a-z0-9][a-z0-9_-]{2,63}$/;

export class CatalogItemId {
  private constructor(readonly value: string) {}

  static create(value: string): CatalogItemId {
    const normalized = value.trim();
    if (!VALID_ID.test(normalized)) {
      throw new DomainError('L’identificativo articolo non è valido.');
    }
    return new CatalogItemId(normalized);
  }

  equals(other: CatalogItemId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
