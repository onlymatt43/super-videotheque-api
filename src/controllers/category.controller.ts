import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { categoryService } from '../services/category.service.js';
import { AppError } from '../utils/appError.js';

export const listCategories = async (_req: Request, res: Response) => {
  const categories = await categoryService.list();
  res.json({ data: categories });
};

export const createCategory = async (req: Request, res: Response) => {
  const { slug, label, order } = req.body;
  
  const existing = await categoryService.getBySlug(slug);
  if (existing) {
    throw new AppError('Cette catégorie existe déjà', StatusCodes.CONFLICT);
  }

  const category = await categoryService.create({ slug, label, order: order || 0 });
  res.status(StatusCodes.CREATED).json({ data: category });
};

export const updateCategory = async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { label, order, newSlug } = req.body;

  const category = await categoryService.update(slug, { 
    label, 
    order,
    ...(newSlug && { slug: newSlug })
  });
  
  if (!category) {
    throw new AppError('Catégorie non trouvée', StatusCodes.NOT_FOUND);
  }

  res.json({ data: category });
};

export const deleteCategory = async (req: Request, res: Response) => {
  const { slug } = req.params;
  
  const deleted = await categoryService.remove(slug);
  if (!deleted) {
    throw new AppError('Catégorie non trouvée', StatusCodes.NOT_FOUND);
  }

  res.status(StatusCodes.NO_CONTENT).send();
};
