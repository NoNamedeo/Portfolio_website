import type { Cart } from '@core/domain/cart/cart';
import type { CatalogItem } from '@core/domain/catalog/catalog-item';
import type { SiteIdentity } from '@core/domain/portfolio/site-identity';

export interface CatalogRepository {
  getAll(): Promise<readonly CatalogItem[]>;
}

export interface SiteIdentityRepository {
  getSiteIdentity(): Promise<SiteIdentity>;
}

export interface CartRepository {
  get(): Promise<Cart>;
  save(cart: Cart): Promise<void>;
}
