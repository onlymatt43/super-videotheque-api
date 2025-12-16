import { z } from 'zod';

export const createRentalSchema = {
  body: z.object({
    movieId: z.string().min(1),
    customerEmail: z.string().email(),
    payhipCode: z.string().min(4)
  })
};

export const getRentalSchema = {
  params: z.object({
    id: z.string().min(1)
  })
};
