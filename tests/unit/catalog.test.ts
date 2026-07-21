import { describe, expect, it } from 'vitest';
import { Catalog } from '@core/domain/catalog/catalog';
import { makeItem } from '../fixtures/catalog';

const fixtures = () => [
  makeItem({
    id: 'item-alpha',
    slug: 'alpha',
    title: 'Alpha civic platform',
    type: 'project',
    featured: true,
    order: 2,
    categories: ['Ricerca'],
    tags: ['civic-tech'],
    technologies: ['Astro']
  }),
  makeItem({
    id: 'item-beta',
    slug: 'beta',
    title: 'Beta service',
    type: 'service',
    year: 2024,
    order: 1,
    categories: ['Servizi'],
    tags: ['prototype'],
    technologies: ['TypeScript']
  }),
  makeItem({
    id: 'item-draft',
    slug: 'draft-item',
    title: 'Hidden draft',
    status: 'draft',
    categories: ['Ricerca']
  })
];

describe('Catalog', () => {
  it('impone slug univoci', () => {
    expect(
      () =>
        new Catalog([
          makeItem({ id: 'item-one', slug: 'same' }),
          makeItem({ id: 'item-two', slug: 'same' })
        ])
    ).toThrow(/slug/i);
  });

  it('impone identificativi univoci', () => {
    expect(
      () =>
        new Catalog([
          makeItem({ id: 'item-same', slug: 'one' }),
          makeItem({ id: 'item-same', slug: 'two' })
        ])
    ).toThrow(/ID/i);
  });

  it('espone soltanto gli articoli pubblicati', () => {
    expect(new Catalog(fixtures()).published().map((item) => item.slug.value)).toEqual([
      'alpha',
      'beta'
    ]);
  });

  it('cerca su titolo, tag e tecnologie con termini multipli', () => {
    const result = new Catalog(fixtures()).search('civic Astro');
    expect(result.map((item) => item.slug.value)).toEqual(['alpha']);
  });

  it('filtra per tipo e categoria senza distinguere maiuscole', () => {
    const catalog = new Catalog(fixtures());
    expect(catalog.filter({ type: 'service', category: 'servizi' })[0]?.slug.value).toBe('beta');
  });

  it('combina ricerca, filtri e ordinamento escludendo sempre le bozze', () => {
    const result = new Catalog(fixtures()).query({
      search: 'service TypeScript',
      type: 'service',
      category: 'SERVIZI',
      sort: 'title'
    });
    expect(result.map((item) => item.slug.value)).toEqual(['beta']);
    expect(result.some((item) => item.status === 'draft')).toBe(false);
  });

  it('valida coerenza delle donazioni, media e metadati SEO', () => {
    expect(() => makeItem({ pricing: { kind: 'donation' }, acquisitionMode: 'purchase' })).toThrow(
      /coerenti/i
    );
    expect(() =>
      makeItem({ media: { src: 'javascript:alert(1)', alt: 'x', width: 1, height: 1 } })
    ).toThrow(/media/i);
    expect(() => makeItem({ seo: { title: '', description: 'Descrizione' } })).toThrow(/SEO/i);
  });

  it('valida a runtime discriminanti, liste e link provenienti da JSON', () => {
    expect(() => makeItem({ type: 'invalid' as never })).toThrow(/tipo/i);
    expect(() => makeItem({ pricing: { kind: 'invalid' as never } })).toThrow(/prezzo/i);
    expect(() => makeItem({ featured: 'yes' as never })).toThrow(/booleano/i);
    expect(() => makeItem({ categories: [] })).toThrow(/categoria/i);
    expect(() =>
      makeItem({ links: [{ label: 'Protocol-relative', href: '//example.com' }] })
    ).toThrow(/link/i);
  });

  it('ordina e individua precedente e successivo', () => {
    const catalog = new Catalog(fixtures());
    const alpha = catalog.findBySlug('alpha');
    expect(alpha).toBeDefined();
    if (!alpha) return;
    const adjacent = catalog.adjacentTo(alpha);
    expect(adjacent.previous?.slug.value).toBe('beta');
    expect(adjacent.next).toBeUndefined();
  });

  it('calcola articoli correlati usando categorie, tag e tecnologia', () => {
    const alpha = makeItem({
      id: 'item-alpha',
      slug: 'alpha',
      categories: ['Ricerca'],
      tags: ['civic']
    });
    const close = makeItem({
      id: 'item-close',
      slug: 'close',
      categories: ['Ricerca'],
      tags: ['civic']
    });
    const distant = makeItem({
      id: 'item-distant',
      slug: 'distant',
      type: 'hobby',
      categories: ['Tempo libero'],
      tags: []
    });
    expect(new Catalog([alpha, distant, close]).relatedTo(alpha)[0]?.slug.value).toBe('close');
  });
});
