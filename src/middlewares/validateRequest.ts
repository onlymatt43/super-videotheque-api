import type { NextFunction, Request, Response } from 'express';
import { ZodError, type AnyZodObject } from 'zod';
import { AppError } from '../utils/appError.js';

interface RequestSchema {
  body?: AnyZodObject;
  params?: AnyZodObject;
  query?: AnyZodObject;
}

export const validateRequest = (schema: RequestSchema) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schema.body) {
        req.body = schema.body.parse(req.body);
      }
      if (schema.params) {
        req.params = schema.params.parse(req.params);
      }
      if (schema.query) {
        req.query = schema.query.parse(req.query);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new AppError(error.issues.map((issue) => issue.message).join(', '), 400));
        return;
      }
      if (error instanceof Error) {
        next(new AppError(error.message, 400));
        return;
      }
      next(new AppError('Invalid request payload', 400));
    }
  };
