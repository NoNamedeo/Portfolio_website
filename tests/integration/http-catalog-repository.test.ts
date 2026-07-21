import { describe, expect, it, vi } from 'vitest';
import { HttpCatalogRepository } from '@infrastructure/content/http-catalog-repository';
import { makeItemProps } from '../fixtures/catalog';

describe('HttpCatalogRepository', () => {
  it('valida il payload e mantiene una cache per istanza', async () => {
    const request = vi.fn(async () =>
      Promise.resolve(
        new Response(JSON.stringify([makeItemProps()]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    ) as unknown as typeof fetch;
    const repository = new HttpCatalogRepository('/catalog.json', request);
    expect((await repository.getAll())[0]?.slug.value).toBe('default-item');
    expect((await repository.getAll())[0]?.slug.value).toBe('default-item');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('espone un errore applicativo e consente un nuovo tentativo dopo un fallimento', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify([makeItemProps()]), { status: 200 })
      ) as unknown as typeof fetch;
    const repository = new HttpCatalogRepository('/catalog.json', request);
    await expect(repository.getAll()).rejects.toMatchObject({
      code: 'CATALOG_DATA_INVALID'
    });
    expect(await repository.getAll()).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
