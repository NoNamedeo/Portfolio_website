import type { CatalogItemCardModel } from '@application/models/page-models';
import type { CatalogItem, CatalogItemType } from '@core/domain/catalog/catalog-item';
import type { Pricing } from '@core/domain/catalog/pricing';

const typeLabels: Record<CatalogItemType, string> = {
  project: 'Progetto',
  knowledge: 'Conoscenza',
  activity: 'Attività',
  experience: 'Esperienza',
  skill: 'Competenza',
  service: 'Servizio',
  hobby: 'Hobby',
  other: 'Altro'
};

const acquisitionLabels = {
  showcase: 'Scopri il progetto',
  commission: 'Aggiungi la commissione',
  contact: 'Aggiungi alla richiesta',
  donation: 'Sostieni il progetto',
  download: 'Aggiungi il download',
  purchase: 'Aggiungi al carrello'
} as const;

export const formatPricingLabel = (pricing: Pricing): string => {
  if (pricing.kind === 'free') return 'Gratuito';
  if (pricing.kind === 'fixed') return pricing.money?.format() ?? '';
  if (pricing.kind === 'starting-at') return 'Da ' + (pricing.money?.format() ?? '');
  if (pricing.kind === 'quote') return 'Su preventivo';
  if (pricing.kind === 'donation') return 'Donazione libera';
  return 'Portfolio';
};

export const mapCatalogItemToCard = (item: CatalogItem): CatalogItemCardModel => ({
  id: item.id.value,
  slug: item.slug.value,
  type: item.type,
  typeLabel: typeLabels[item.type],
  title: item.title,
  shortDescription: item.shortDescription,
  year: item.year,
  featured: item.featured,
  order: item.order,
  categories: item.categories,
  tags: item.tags,
  technologies: item.technologies,
  media: item.media,
  pricingKind: item.pricing.kind,
  pricingLabel: formatPricingLabel(item.pricing),
  acquisitionMode: item.acquisitionMode,
  acquisitionLabel: acquisitionLabels[item.acquisitionMode],
  availabilityLabel:
    item.availability === 'available'
      ? 'Disponibile'
      : item.availability === 'limited'
        ? 'Disponibilità limitata'
        : 'Non disponibile',
  canAddToCart: item.canBeAddedToCart(),
  searchText: [
    item.title,
    item.shortDescription,
    item.type,
    ...item.categories,
    ...item.tags,
    ...item.technologies
  ]
    .join(' ')
    .toLocaleLowerCase('it'),
  themeKey: item.artDirection.themeKey,
  experienceKey: item.artDirection.experienceKey
});

export const mapCatalogItemToClient = (item: CatalogItem) => ({
  id: item.id.value,
  slug: item.slug.value,
  type: item.type,
  title: item.title,
  shortDescription: item.shortDescription,
  year: item.year,
  status: item.status,
  featured: item.featured,
  order: item.order,
  categories: item.categories,
  tags: item.tags,
  technologies: item.technologies,
  media: item.media,
  pricing: item.pricing.toJSON(),
  acquisitionMode: item.acquisitionMode,
  availability: item.availability,
  artDirection: {
    themeKey: item.artDirection.themeKey,
    experienceKey: item.artDirection.experienceKey,
    transitionKey: item.artDirection.transitionKey,
    layoutKey: item.artDirection.layoutKey
  },
  links: item.links,
  seo: item.seo
});
