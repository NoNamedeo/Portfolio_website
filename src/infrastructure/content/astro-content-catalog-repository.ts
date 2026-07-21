import { getCollection } from 'astro:content';
import type { CatalogRepository } from '@application/ports/repositories';
import { ApplicationError } from '@application/errors/application-error';
import { CatalogItem } from '@core/domain/catalog/catalog-item';

export class AstroContentCatalogRepository implements CatalogRepository {
  async getAll(): Promise<readonly CatalogItem[]> {
    const entries = await getCollection('catalog');
    return entries.map((entry) => {
      const { data } = entry;
      try {
        return new CatalogItem({
          id: data.catalogItemId,
          slug: data.slug,
          type: data.type,
          title: data.title,
          shortDescription: data.shortDescription,
          year: data.year,
          status: data.status,
          featured: data.featured,
          order: data.order,
          categories: data.categories,
          tags: data.tags,
          technologies: data.technologies,
          media: data.media,
          pricing: data.pricing,
          acquisitionMode: data.acquisitionMode,
          availability: data.availability,
          artDirection: data.artDirection,
          links: data.links,
          seo: data.seo
        });
      } catch (error) {
        throw new ApplicationError(
          'CATALOG_DATA_INVALID',
          'Contenuto catalogo non valido: "' + entry.id + '".',
          { cause: error }
        );
      }
    });
  }
}
