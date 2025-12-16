import { z } from 'zod';

export const payhipValidationSchema = {
  body: z.object({
    code: z.string().min(4)
  })
};
