import { ArtDirection, type ArtDirectionProps } from './art-direction';
import { Pricing, type PricingData } from './pricing';
import { CatalogItemId } from '@core/domain/shared/catalog-item-id';
import { DomainError } from '@core/domain/shared/domain-error';
import { Slug } from '@core/domain/shared/slug';

export type CatalogItemType =
  'project' | 'knowledge' | 'activity' | 'experience' | 'skill' | 'service' | 'hobby' | 'other';

export type CatalogItemStatus = 'draft' | 'published' | 'archived';
export type AcquisitionMode =
  'showcase' | 'commission' | 'contact' | 'donation' | 'download' | 'purchase';
export type Availability = 'available' | 'limited' | 'unavailable';

const itemTypes: readonly CatalogItemType[] = [
  'project',
  'knowledge',
  'activity',
  'experience',
  'skill',
  'service',
  'hobby',
  'other'
];
const itemStatuses: readonly CatalogItemStatus[] = ['draft', 'published', 'archived'];
const acquisitionModes: readonly AcquisitionMode[] = [
  'showcase',
  'commission',
  'contact',
  'donation',
  'download',
  'purchase'
];
const availabilities: readonly Availability[] = ['available', 'limited', 'unavailable'];

export interface CatalogMedia {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

export interface CatalogLink {
  readonly label: string;
  readonly href: string;
}

export interface CatalogSeo {
  readonly title: string;
  readonly description: string;
}

export interface CatalogItemProps {
  readonly id: string;
  readonly slug: string;
  readonly type: CatalogItemType;
  readonly title: string;
  readonly shortDescription: string;
  readonly year: number;
  readonly status: CatalogItemStatus;
  readonly featured: boolean;
  readonly order: number;
  readonly categories: readonly string[];
  readonly tags: readonly string[];
  readonly technologies: readonly string[];
  readonly media: CatalogMedia;
  readonly pricing: PricingData;
  readonly acquisitionMode: AcquisitionMode;
  readonly availability: Availability;
  readonly artDirection: ArtDirectionProps;
  readonly links: readonly CatalogLink[];
  readonly seo: CatalogSeo;
}

const normalize = (value: string): string => value.trim().toLocaleLowerCase('it');

const cleanList = (values: readonly string[], name: string): readonly string[] => {
  if (!Array.isArray(values)) {
    throw new DomainError('La lista "' + name + '" non è valida.');
  }
  const cleaned = values.map((value) => value.trim());
  if (cleaned.some((value) => value.length === 0)) {
    throw new DomainError('La lista "' + name + '" contiene un valore vuoto.');
  }
  return [...new Map(cleaned.map((value) => [normalize(value), value])).values()];
};

const isLink = (value: string): boolean =>
  (value.startsWith('/') && !value.startsWith('//')) || /^https?:\/\/[^\s]+$/i.test(value);

export class CatalogItem {
  readonly id: CatalogItemId;
  readonly slug: Slug;
  readonly type: CatalogItemType;
  readonly title: string;
  readonly shortDescription: string;
  readonly year: number;
  readonly status: CatalogItemStatus;
  readonly featured: boolean;
  readonly order: number;
  readonly categories: readonly string[];
  readonly tags: readonly string[];
  readonly technologies: readonly string[];
  readonly media: CatalogMedia;
  readonly pricing: Pricing;
  readonly acquisitionMode: AcquisitionMode;
  readonly availability: Availability;
  readonly artDirection: ArtDirection;
  readonly links: readonly CatalogLink[];
  readonly seo: CatalogSeo;

  constructor(props: CatalogItemProps) {
    this.id = CatalogItemId.create(props.id);
    this.slug = Slug.create(props.slug);
    if (!itemTypes.includes(props.type)) throw new DomainError('Il tipo articolo non è valido.');
    this.type = props.type;
    this.title = props.title.trim();
    this.shortDescription = props.shortDescription.trim();
    if (
      !this.title ||
      this.title.length > 120 ||
      !this.shortDescription ||
      this.shortDescription.length > 240
    ) {
      throw new DomainError('Titolo e descrizione breve sono obbligatori.');
    }
    if (!Number.isInteger(props.year) || props.year < 1900 || props.year > 2200) {
      throw new DomainError('L’anno dell’articolo non è valido.');
    }
    if (!Number.isSafeInteger(props.order) || props.order < 0) {
      throw new DomainError('L’ordine dell’articolo non è valido.');
    }
    this.year = props.year;
    if (!itemStatuses.includes(props.status))
      throw new DomainError('Lo stato articolo non è valido.');
    if (typeof props.featured !== 'boolean') {
      throw new DomainError('Il valore featured deve essere booleano.');
    }
    this.status = props.status;
    this.featured = props.featured;
    this.order = props.order;
    this.categories = cleanList(props.categories, 'categories');
    this.tags = cleanList(props.tags, 'tags');
    this.technologies = cleanList(props.technologies, 'technologies');
    if (this.categories.length === 0) {
      throw new DomainError('È richiesta almeno una categoria.');
    }
    if (
      !isLink(props.media.src) ||
      !props.media.alt.trim() ||
      !Number.isSafeInteger(props.media.width) ||
      props.media.width <= 0 ||
      !Number.isSafeInteger(props.media.height) ||
      props.media.height <= 0
    ) {
      throw new DomainError('Il media principale dell’articolo non è valido.');
    }
    this.media = { ...props.media, alt: props.media.alt.trim() };
    this.pricing = Pricing.create(props.pricing);
    if (!acquisitionModes.includes(props.acquisitionMode)) {
      throw new DomainError('La modalità di acquisizione non è valida.');
    }
    this.acquisitionMode = props.acquisitionMode;
    if ((this.pricing.kind === 'donation') !== (this.acquisitionMode === 'donation')) {
      throw new DomainError('Prezzo e modalità di acquisizione della donazione non sono coerenti.');
    }
    if (!availabilities.includes(props.availability)) {
      throw new DomainError('La disponibilità non è valida.');
    }
    this.availability = props.availability;
    this.artDirection = new ArtDirection(props.artDirection);
    this.links = props.links.map((link) => {
      const label = link.label.trim();
      if (!label || !isLink(link.href)) {
        throw new DomainError('Un link dell’articolo non è valido.');
      }
      return { label, href: link.href };
    });
    this.seo = {
      title: props.seo.title.trim(),
      description: props.seo.description.trim()
    };
    if (
      !this.seo.title ||
      this.seo.title.length > 70 ||
      this.seo.description.length < 20 ||
      this.seo.description.length > 180
    ) {
      throw new DomainError('I metadati SEO dell’articolo sono obbligatori.');
    }
  }

  isPublished(): boolean {
    return this.status === 'published';
  }

  isFeatured(): boolean {
    return this.isPublished() && this.featured;
  }

  matchesCategory(category: string): boolean {
    const candidate = normalize(category);
    return this.categories.some((value) => normalize(value) === candidate);
  }

  matchesTag(tag: string): boolean {
    const candidate = normalize(tag);
    return this.tags.some((value) => normalize(value) === candidate);
  }

  usesTechnology(technology: string): boolean {
    const candidate = normalize(technology);
    return this.technologies.some((value) => normalize(value) === candidate);
  }

  matchesSearch(query: string): boolean {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return true;
    const haystack = normalize(
      [
        this.title,
        this.shortDescription,
        this.type,
        ...this.categories,
        ...this.tags,
        ...this.technologies
      ].join(' ')
    );
    return terms.every((term) => haystack.includes(term));
  }

  canBeAddedToCart(): boolean {
    return (
      this.isPublished() &&
      this.availability !== 'unavailable' &&
      this.acquisitionMode !== 'showcase' &&
      this.pricing.kind !== 'not-applicable'
    );
  }

  similarityWith(other: CatalogItem): number {
    if (this.id.equals(other.id)) return 0;
    let score = this.type === other.type ? 2 : 0;
    score += this.categories.filter((category) => other.matchesCategory(category)).length * 3;
    score += this.tags.filter((tag) => other.matchesTag(tag)).length * 2;
    score += this.technologies.filter((technology) => other.usesTechnology(technology)).length;
    return score;
  }
}
