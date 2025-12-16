import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { validatePayhipCode } from '../services/payhip.service.js';
import { rentalService } from '../services/rental.service.js';
import { AppError } from '../utils/appError.js';

export const validateCode = async (req: Request, res: Response) => {
  const { code, email } = req.body as { code: string; email?: string };
  const result = await validatePayhipCode(code);

  // If email provided, check if code was used by different email
  if (email) {
    const existingRental = await rentalService.findRentalByPayhipCode(code);
    if (existingRental && existingRental.customerEmail !== email.toLowerCase()) {
      throw new AppError('Ce code a déjà été utilisé avec un autre email', StatusCodes.FORBIDDEN);
    }

    // Check if email matches Payhip buyer email
    if (result.email && result.email.toLowerCase() !== email.toLowerCase()) {
      throw new AppError('L\'email ne correspond pas à l\'achat Payhip', StatusCodes.FORBIDDEN);
    }
  }

  res.json({ data: result });
};
