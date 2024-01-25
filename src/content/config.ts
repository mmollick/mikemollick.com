import { z, defineCollection } from 'astro:content';

const blogCollection = defineCollection({
  type: 'content', // v2.5.0 and later
  schema: z.object({
    title: z.string(),
    date: z.date(),
    isPublished: z.boolean(),
  }),
});

export const collections = {
  'blog': blogCollection,
};
