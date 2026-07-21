import { ApplicationError } from '@application/errors/application-error';
import type { CatalogRepository } from '@application/ports/repositories';
import { CatalogItem, type CatalogItemProps } from '@core/domain/catalog/catalog-item';

type Fetch = typeof globalThis.fetch;

export class HttpCatalogRepository implements CatalogRepository {
  private cachedItems?: Promise<readonly CatalogItem[]>;

  constructor(
    private readonly endpoint = '/catalog-data.json',
    private readonly request: Fetch = (...args) => globalThis.fetch(...args)
  ) {}

  getAll(): Promise<readonly CatalogItem[]> {
    this.cachedItems ??= this.load();
    return this.cachedItems;
  }

  private async load(): Promise<readonly CatalogItem[]> {
    try {
      const response = await this.request(this.endpoint, {
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = (await response.json()) as unknown;
      if (!Array.isArray(data)) throw new Error('Payload non-array');
      return data.map((item) => new CatalogItem(item as CatalogItemProps));
    } catch (error) {
      this.cachedItems = undefined;
      throw new ApplicationError(
        'CATALOG_DATA_INVALID',
        'Il catalogo non è disponibile. Ricarica la pagina e riprova.',
        { cause: error }
      );
    }
  }
}
