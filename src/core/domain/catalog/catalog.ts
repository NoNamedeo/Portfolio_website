import type { CatalogItem, CatalogItemType } from './catalog-item';
import { DomainError } from '@core/domain/shared/domain-error';

export type CatalogSort = 'manual' | 'featured' | 'newest' | 'oldest' | 'title';

export interface CatalogFilter {
  readonly type?: CatalogItemType;
  readonly category?: string;
  readonly tag?: string;
  readonly technology?: string;
}

export interface CatalogQuery extends CatalogFilter {
  readonly search?: string;
  readonly sort?: CatalogSort;
}

export class Catalog {
  private readonly items: readonly CatalogItem[];

  constructor(items: readonly CatalogItem[]) {
    const ids = new Set<string>();
    const slugs = new Set<string>();
    for (const item of items) {
      if (ids.has(item.id.value))
        throw new DomainError('Gli ID del catalogo devono essere univoci.');
      if (slugs.has(item.slug.value)) {
        throw new DomainError('Gli slug del catalogo devono essere univoci.');
      }
      ids.add(item.id.value);
      slugs.add(item.slug.value);
    }
    this.items = [...items];
  }

  all(): readonly CatalogItem[] {
    return [...this.items];
  }

  published(): readonly CatalogItem[] {
    return this.items.filter((item) => item.isPublished());
  }

  featured(): readonly CatalogItem[] {
    return this.sort(
      this.items.filter((item) => item.isFeatured()),
      'manual'
    );
  }

  findBySlug(slug: string): CatalogItem | undefined {
    return this.published().find((item) => item.slug.value === slug);
  }

  findById(id: string): CatalogItem | undefined {
    return this.items.find((item) => item.id.value === id);
  }

  search(query: string): readonly CatalogItem[] {
    return this.query({ search: query });
  }

  filter(criteria: CatalogFilter): readonly CatalogItem[] {
    return this.query(criteria);
  }

  query(criteria: CatalogQuery): readonly CatalogItem[] {
    const filtered = this.published().filter((item) => {
      if (criteria.search && !item.matchesSearch(criteria.search)) return false;
      if (criteria.type && item.type !== criteria.type) return false;
      if (criteria.category && !item.matchesCategory(criteria.category)) return false;
      if (criteria.tag && !item.matchesTag(criteria.tag)) return false;
      if (criteria.technology && !item.usesTechnology(criteria.technology)) return false;
      return true;
    });
    return this.sort(filtered, criteria.sort ?? 'manual');
  }

  sort(items: readonly CatalogItem[], sort: CatalogSort): readonly CatalogItem[] {
    return [...items].sort((first, second) => {
      if (sort === 'featured') {
        return Number(second.featured) - Number(first.featured) || first.order - second.order;
      }
      if (sort === 'newest') return second.year - first.year || first.order - second.order;
      if (sort === 'oldest') return first.year - second.year || first.order - second.order;
      if (sort === 'title') return first.title.localeCompare(second.title, 'it');
      return first.order - second.order || second.year - first.year;
    });
  }

  relatedTo(item: CatalogItem, limit = 3): readonly CatalogItem[] {
    return this.published()
      .filter((candidate) => !candidate.id.equals(item.id))
      .map((candidate) => ({ candidate, score: item.similarityWith(candidate) }))
      .filter(({ score }) => score > 0)
      .sort(
        (first, second) =>
          second.score - first.score || first.candidate.order - second.candidate.order
      )
      .slice(0, limit)
      .map(({ candidate }) => candidate);
  }

  adjacentTo(item: CatalogItem): {
    readonly previous?: CatalogItem;
    readonly next?: CatalogItem;
  } {
    const ordered = this.sort(this.published(), 'manual');
    const index = ordered.findIndex((candidate) => candidate.id.equals(item.id));
    if (index < 0) return {};
    return {
      ...(index > 0 ? { previous: ordered[index - 1] } : {}),
      ...(index < ordered.length - 1 ? { next: ordered[index + 1] } : {})
    };
  }
}
