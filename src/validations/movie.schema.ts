import { z } from 'zod';

export const createMovieSchema = {
  body: z.object({
    title: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be URL friendly'),
    description: z.string().optional(),
    thumbnailUrl: z.string().url().optional(),
    bunnyLibraryId: z.string().min(1),
    bunnyVideoId: z.string().min(1),
    videoPath: z.string().min(1),
    rentalDurationHours: z.number().int().positive().default(48),
    isFreePreview: z.boolean().default(false),
    category: z.string().default('uncategorized'),
    tags: z.array(z.string()).default([])
  })
};

export const getMovieSchema = {
  params: z.object({
    id: z.string().min(1)
  })
};

export const updateMovieSchema = {
  params: z.object({
    id: z.string().min(1)
  }),
  body: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    isFreePreview: z.boolean().optional(),
    rentalDurationHours: z.number().int().positive().optional(),
    tags: z.array(z.string()).optional()
  })
};
