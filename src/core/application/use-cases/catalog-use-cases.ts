import {
  mapCatalogItemToCard,
  mapCatalogItemToClient
} from '@application/mappers/catalog-item-mapper';
import { createSeoModel } from '@application/mappers/seo-mapper';
import type {
  CatalogClientItemModel,
  CatalogItemPageModel,
  CatalogPageModel,
  HomePageModel,
  SiteShellModel
} from '@application/models/page-models';
import type { CatalogRepository, SiteIdentityRepository } from '@application/ports/repositories';
import { ApplicationError } from '@application/errors/application-error';
import { Catalog } from '@core/domain/catalog/catalog';
import type { CatalogQuery } from '@core/domain/catalog/catalog';
import type { CatalogItem } from '@core/domain/catalog/catalog-item';

const shell = async (
  identityRepository: SiteIdentityRepository,
  seo: Parameters<typeof createSeoModel>[1]
) => {
  const identity = await identityRepository.getSiteIdentity();
  return {
    name: identity.name,
    tagline: identity.tagline,
    locale: identity.locale,
    seo: createSeoModel(identity, seo)
  };
};

export class GetHomePage {
  constructor(
    private readonly catalogRepository: CatalogRepository,
    private readonly identityRepository: SiteIdentityRepository
  ) {}

  async execute(): Promise<HomePageModel> {
    const catalog = new Catalog(await this.catalogRepository.getAll());
    const identity = await this.identityRepository.getSiteIdentity();
    return {
      name: identity.name,
      tagline: identity.tagline,
      locale: identity.locale,
      seo: createSeoModel(identity, {
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: identity.name,
          description: identity.description,
          url: identity.canonicalUrl
        }
      }),
      introduction:
        'Quattro mondi digitali diventano articoli da esplorare, combinare e trasformare in una conversazione concreta.',
      featuredItems: catalog.featured().slice(0, 4).map(mapCatalogItemToCard)
    };
  }
}

export class GetCatalogPage {
  constructor(
    private readonly catalogRepository: CatalogRepository,
    private readonly identityRepository: SiteIdentityRepository
  ) {}

  async execute(): Promise<CatalogPageModel> {
    const catalog = new Catalog(await this.catalogRepository.getAll());
    const items = catalog.sort(catalog.published(), 'manual');
    const categoryCounts = new Map<string, number>();
    for (const item of items) {
      for (const category of item.categories) {
        categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      }
    }
    const categories = [...categoryCounts.keys()].sort((a, b) => a.localeCompare(b, 'it'));
    return {
      ...(await shell(this.identityRepository, {
        title: 'Catalogo',
        description: 'Esplora progetti, competenze, attività e servizi del portfolio.',
        path: '/catalog/'
      })),
      items: items.map(mapCatalogItemToCard),
      categories,
      categorySummaries: [...categoryCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort(
          (first, second) =>
            second.count - first.count || first.name.localeCompare(second.name, 'it')
        ),
      types: (
        [
          { value: 'project', label: 'Progetti' },
          { value: 'activity', label: 'Attività' },
          { value: 'service', label: 'Servizi' }
        ] as const
      ).filter((type) => items.some((item) => item.type === type.value)),
      resultCount: items.length
    };
  }
}

export class GetCatalogItemPage {
  constructor(
    private readonly catalogRepository: CatalogRepository,
    private readonly identityRepository: SiteIdentityRepository
  ) {}

  async execute(slug: string): Promise<CatalogItemPageModel> {
    const catalog = new Catalog(await this.catalogRepository.getAll());
    const item = catalog.findBySlug(slug);
    if (!item) {
      throw new ApplicationError('CATALOG_ITEM_NOT_FOUND', 'Articolo non trovato.');
    }
    const identity = await this.identityRepository.getSiteIdentity();
    const adjacent = catalog.adjacentTo(item);
    const card = mapCatalogItemToCard(item);
    return {
      name: identity.name,
      tagline: identity.tagline,
      locale: identity.locale,
      seo: createSeoModel(identity, {
        title: item.seo.title,
        description: item.seo.description,
        path: '/catalog/' + item.slug.value + '/',
        image: item.media.src,
        type: 'article',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: item.title,
          description: item.shortDescription,
          image: new URL(item.media.src, identity.canonicalUrl).toString(),
          dateCreated: String(item.year),
          url: new URL('/catalog/' + item.slug.value + '/', identity.canonicalUrl).toString()
        }
      }),
      contentId: item.slug.value,
      item: {
        ...card,
        links: item.links,
        transitionKey: item.artDirection.transitionKey,
        layoutKey: item.artDirection.layoutKey
      },
      relatedItems: catalog.relatedTo(item).map(mapCatalogItemToCard),
      ...(adjacent.previous ? { previous: mapCatalogItemToCard(adjacent.previous) } : {}),
      ...(adjacent.next ? { next: mapCatalogItemToCard(adjacent.next) } : {})
    };
  }
}

export class QueryCatalog {
  constructor(private readonly catalogRepository: CatalogRepository) {}
  async execute(query: CatalogQuery): Promise<readonly CatalogItem[]> {
    return new Catalog(await this.catalogRepository.getAll()).query(query);
  }
}

export class GetPublishedCatalogItemSlugs {
  constructor(private readonly catalogRepository: CatalogRepository) {}
  async execute(): Promise<readonly string[]> {
    return new Catalog(await this.catalogRepository.getAll())
      .published()
      .map((item) => item.slug.value);
  }
}

export class GetCatalogClientData {
  constructor(private readonly catalogRepository: CatalogRepository) {}
  async execute(): Promise<readonly CatalogClientItemModel[]> {
    const catalog = new Catalog(await this.catalogRepository.getAll());
    return catalog.published().map(mapCatalogItemToClient);
  }
}

export class GetStaticPage {
  constructor(private readonly identityRepository: SiteIdentityRepository) {}

  async execute(page: 'order-confirmation' | 'not-found'): Promise<SiteShellModel> {
    const identity = await this.identityRepository.getSiteIdentity();
    const confirmation = page === 'order-confirmation';
    return {
      name: identity.name,
      tagline: identity.tagline,
      locale: identity.locale,
      seo: createSeoModel(identity, {
        title: confirmation ? 'Richiesta inviata' : 'Pagina non trovata',
        description: confirmation
          ? 'La richiesta è stata inviata correttamente.'
          : 'La pagina richiesta non è disponibile.',
        path: confirmation ? '/order-confirmation/' : '/404/'
      })
    };
  }
}
