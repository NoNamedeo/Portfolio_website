import { CatalogItem, type CatalogItemProps } from '@core/domain/catalog/catalog-item';

export const makeItemProps = (overrides: Partial<CatalogItemProps> = {}): CatalogItemProps => ({
  id: 'item-default',
  slug: 'default-item',
  type: 'project',
  title: 'Default item',
  shortDescription: 'Descrizione dimostrativa',
  year: 2026,
  status: 'published',
  featured: false,
  order: 1,
  categories: ['Software'],
  tags: ['architecture'],
  technologies: ['TypeScript'],
  media: {
    src: '/media/signal-archive.svg',
    alt: 'Placeholder',
    width: 1200,
    height: 800
  },
  pricing: {
    kind: 'fixed',
    money: { amountMinor: 1500, currency: 'EUR' }
  },
  acquisitionMode: 'purchase',
  availability: 'available',
  artDirection: {
    themeKey: 'default',
    experienceKey: 'none',
    transitionKey: 'none',
    layoutKey: 'default'
  },
  links: [],
  seo: {
    title: 'Default item',
    description: 'Descrizione dimostrativa per i motori di ricerca.'
  },
  ...overrides
});

export const makeItem = (overrides: Partial<CatalogItemProps> = {}): CatalogItem =>
  new CatalogItem(makeItemProps(overrides));
