import type { CartRepository } from '@application/ports/repositories';
import { ApplicationError } from '@application/errors/application-error';
import { Cart } from '@core/domain/cart/cart';

const STORAGE_KEY = 'portfolio-store:cart:v1';

export interface CartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageCartRepository implements CartRepository {
  constructor(private readonly injectedStorage?: CartStorage) {}

  async get(): Promise<Cart> {
    const storage = this.resolveStorage();
    if (!storage) return Cart.empty();
    let stored: string | null;
    try {
      stored = storage.getItem(STORAGE_KEY);
    } catch (error) {
      throw this.storageError(error);
    }
    if (!stored) return Cart.empty();
    let parsed: unknown;
    try {
      parsed = JSON.parse(stored) as unknown;
    } catch {
      this.removeCorruptedValue(storage);
      return Cart.empty();
    }
    const restored = Cart.restore(parsed);
    if (restored.status === 'invalid') this.removeCorruptedValue(storage);
    if (restored.status === 'migrated') await this.save(restored.cart);
    return restored.cart;
  }

  async save(cart: Cart): Promise<void> {
    const storage = this.resolveStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(cart.toJSON()));
    } catch (error) {
      throw this.storageError(error);
    }
  }

  private resolveStorage(): CartStorage | undefined {
    if (this.injectedStorage) return this.injectedStorage;
    if (typeof window === 'undefined') return undefined;
    try {
      return window.localStorage;
    } catch (error) {
      throw this.storageError(error);
    }
  }

  private removeCorruptedValue(storage: CartStorage): void {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch (error) {
      throw this.storageError(error);
    }
  }

  private storageError(cause: unknown): ApplicationError {
    return new ApplicationError(
      'STORAGE_UNAVAILABLE',
      'Il carrello locale non è disponibile in questo browser.',
      { cause }
    );
  }
}

export const CART_STORAGE_KEY = STORAGE_KEY;
