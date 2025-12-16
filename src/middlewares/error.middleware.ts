import type { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/appError.js';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const isOperational = err instanceof AppError && err.isOperational;
  const status = err instanceof AppError ? err.statusCode : StatusCodes.INTERNAL_SERVER_ERROR;
  const payload = {
    message: err.message || 'Unexpected error'
  };

  if (!isOperational) {
    logger.error({ err }, 'Unhandled error occurred');
  } else {
    logger.warn({ err }, 'Operational error');
  }

  res.status(status).json(payload);
};
