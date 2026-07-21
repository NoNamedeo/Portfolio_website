import { describe, expect, it } from 'vitest';
import { ApplicationError } from '@application/errors/application-error';
import { Cart } from '@core/domain/cart/cart';
import {
  CART_STORAGE_KEY,
  LocalStorageCartRepository,
  type CartStorage
} from '@infrastructure/persistence/local-storage-cart-repository';
import { makeItem } from '../fixtures/catalog';

class MemoryStorage implements CartStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('LocalStorageCartRepository', () => {
  it('salva e carica lo schema corrente', async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageCartRepository(storage);
    await repository.save(Cart.empty().add(makeItem(), 2));
    expect((await repository.get()).totalItems()).toBe(2);
  });

  it('migra lo schema legacy persistendo la versione corrente', async () => {
    const storage = new MemoryStorage();
    storage.values.set(
      CART_STORAGE_KEY,
      JSON.stringify({ version: 0, items: [{ id: 'item-default', quantity: 3 }] })
    );
    const repository = new LocalStorageCartRepository(storage);
    expect((await repository.get()).totalItems()).toBe(3);
    expect(JSON.parse(storage.values.get(CART_STORAGE_KEY) ?? '{}')).toMatchObject({ version: 1 });
  });

  it('rimuove valori corrotti ma conserva una versione futura', async () => {
    const storage = new MemoryStorage();
    const repository = new LocalStorageCartRepository(storage);
    storage.values.set(CART_STORAGE_KEY, '{not-json');
    expect((await repository.get()).totalItems()).toBe(0);
    expect(storage.values.has(CART_STORAGE_KEY)).toBe(false);

    const future = JSON.stringify({ version: 99, lines: [] });
    storage.values.set(CART_STORAGE_KEY, future);
    expect((await repository.get()).totalItems()).toBe(0);
    expect(storage.values.get(CART_STORAGE_KEY)).toBe(future);
  });

  it('traduce gli errori dello storage in un errore applicativo tipizzato', async () => {
    const denied: CartStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => undefined,
      removeItem: () => undefined
    };
    const operation = new LocalStorageCartRepository(denied).get();
    await expect(operation).rejects.toBeInstanceOf(ApplicationError);
    await expect(operation).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE' });
  });
});
