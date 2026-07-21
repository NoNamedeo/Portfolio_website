import { DomainError } from './domain-error';

const VALID_SLUG = /^(?=.{1,100}$)[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class Slug {
  private constructor(readonly value: string) {}

  static create(value: string): Slug {
    const normalized = value.trim();
    if (!VALID_SLUG.test(normalized)) {
      throw new DomainError(
        'Lo slug deve contenere solo lettere minuscole, numeri e trattini singoli.'
      );
    }
    return new Slug(normalized);
  }

  equals(other: Slug): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
