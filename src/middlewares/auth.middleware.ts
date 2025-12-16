import type { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { AppError } from '../utils/appError.js';
import { env } from '../config/env.js';

/**
 * Simple password-based authentication middleware for admin routes
 * Expects Authorization header: "Bearer YOUR_ADMIN_PASSWORD"
 */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentification requise', StatusCodes.UNAUTHORIZED);
  }

  const token = authHeader.substring(7); // Remove "Bearer "
  
  if (!env.ADMIN_PASSWORD) {
    throw new AppError('Configuration serveur invalide', StatusCodes.INTERNAL_SERVER_ERROR);
  }

  if (token !== env.ADMIN_PASSWORD) {
    throw new AppError('Accès non autorisé', StatusCodes.FORBIDDEN);
  }

  next();
};
