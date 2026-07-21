// @ts-check
import { defineConfig } from 'astro/config';

import mdx from '@astrojs/mdx';

import sitemap from '@astrojs/sitemap';
import siteConfig from './site.config.json' with { type: 'json' };

// https://astro.build/config
export default defineConfig({
  site: siteConfig.canonicalUrl,
  output: 'static',
  integrations: [mdx(), sitemap()],
  build: {
    format: 'directory'
  }
});
