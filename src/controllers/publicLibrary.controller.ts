import type { Request, Response } from 'express';
import { fetchPublicPreviews } from '../services/publicLibrary.service.js';

export const listPublicPreviews = async (_req: Request, res: Response) => {
  const previews = await fetchPublicPreviews();
  res.json({ data: previews });
};
