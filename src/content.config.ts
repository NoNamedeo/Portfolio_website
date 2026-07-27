import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const moneySchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: z.enum(['EUR', 'USD', 'GBP']).default('EUR')
});

const nonEmptyString = z.string().trim().min(1);
const semanticKey = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const link = z
  .string()
  .refine(
    (value) =>
      (value.startsWith('/') && !value.startsWith('//')) || /^https?:\/\/[^\s]+$/i.test(value),
    {
      message: 'Usa un URL HTTP(S) oppure un percorso interno che inizi con "/".'
    }
  );
const uniqueStrings = (maximum: number) =>
  z
    .array(nonEmptyString)
    .max(maximum)
    .refine(
      (values) =>
        new Set(values.map((value) => value.toLocaleLowerCase('it'))).size === values.length,
      { message: 'I valori della lista devono essere univoci.' }
    );

const catalog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/catalog' }),
  schema: z.object({
    catalogItemId: z.string().regex(/^[a-z0-9][a-z0-9_-]{2,63}$/),
    slug: z.string().regex(/^(?=.{1,100}$)[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: nonEmptyString.max(120),
    shortDescription: nonEmptyString.max(240),
    type: z.enum([
      'project',
      'knowledge',
      'activity',
      'experience',
      'skill',
      'service',
      'hobby',
      'other'
    ]),
    year: z.number().int().min(1900).max(2200),
    status: z.enum(['draft', 'published', 'archived']).default('draft'),
    featured: z.boolean().default(false),
    order: z.number().int().nonnegative(),
    categories: uniqueStrings(8).refine((values) => values.length > 0, {
      message: 'Inserisci almeno una categoria.'
    }),
    tags: uniqueStrings(20).default([]),
    technologies: uniqueStrings(20).default([]),
    media: z.object({
      src: link,
      alt: nonEmptyString.max(200),
      width: z.number().int().positive(),
      height: z.number().int().positive()
    }),
    pricing: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('free') }),
      z.object({ kind: z.literal('fixed'), money: moneySchema }),
      z.object({ kind: z.literal('starting-at'), money: moneySchema }),
      z.object({ kind: z.literal('quote') }),
      z.object({ kind: z.literal('donation') }),
      z.object({ kind: z.literal('not-applicable') })
    ]),
    acquisitionMode: z.enum([
      'showcase',
      'commission',
      'contact',
      'donation',
      'download',
      'purchase'
    ]),
    availability: z.enum(['available', 'limited', 'unavailable']).default('available'),
    artDirection: z.object({
      themeKey: semanticKey,
      experienceKey: semanticKey,
      transitionKey: semanticKey,
      layoutKey: semanticKey
    }),
    links: z
      .array(
        z.object({
          label: nonEmptyString.max(80),
          href: link
        })
      )
      .default([]),
    seo: z.object({
      title: nonEmptyString.max(70),
      description: nonEmptyString.min(20).max(180)
    })
  })
});

export const collections = { catalog };
