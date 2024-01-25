import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";

import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: 'https://mikemollick.com',
  integrations: [tailwind(), mdx(), sitemap({
    filter: (page) => page !== 'https://mikemollick.com/styleguide/',
  })]
});
