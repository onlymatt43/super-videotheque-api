import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { movieService } from '../services/movie.service.js';
import { rentalService } from '../services/rental.service.js';
import { validatePayhipCode } from '../services/payhip.service.js';
import { generateSignedPlaybackUrl } from '../services/bunny.service.js';
import { hoursFromNow, secondsUntil } from '../utils/date.js';
import { AppError } from '../utils/appError.js';
import { settings } from '../config/env.js';
import type { MovieDoc } from '../models/movie.model.js';
import type { Types } from 'mongoose';

const SIGNED_URL_MAX_TTL = 60 * 60; // 1 hour

const isMovieDoc = (movie: MovieDoc | Types.ObjectId | undefined): movie is MovieDoc => {
  return Boolean(movie && typeof (movie as MovieDoc).videoPath === 'string');
};

export const createRental = async (req: Request, res: Response) => {
  const { movieId, customerEmail, payhipCode } = req.body as {
    movieId: string;
    customerEmail: string;
    payhipCode: string;
  };

  const movie = await movieService.getById(movieId);
  if (!movie) {
    throw new AppError('Movie not found', StatusCodes.NOT_FOUND);
  }

  // Validate the Payhip code with their API
  const payhipValidation = await validatePayhipCode(payhipCode);

  // Check if this code was already used by a DIFFERENT email
  const existingRentalWithCode = await rentalService.findRentalByPayhipCode(payhipCode);
  if (existingRentalWithCode && existingRentalWithCode.customerEmail !== customerEmail.toLowerCase()) {
    throw new AppError('Ce code a déjà été utilisé avec un autre email', StatusCodes.FORBIDDEN);
  }

  // Optional: Check if the email matches the Payhip buyer email
  if (payhipValidation.email && payhipValidation.email.toLowerCase() !== customerEmail.toLowerCase()) {
    throw new AppError('L\'email ne correspond pas à l\'achat Payhip', StatusCodes.FORBIDDEN);
  }

  const activeRental = await rentalService.findActiveRental(movie._id, customerEmail);
  if (activeRental) {
    const ttlSeconds = Math.min(secondsUntil(activeRental.expiresAt), SIGNED_URL_MAX_TTL);
    if (ttlSeconds <= 0) {
      activeRental.status = 'expired';
      await activeRental.save();
    } else {
      const signedUrl = generateSignedPlaybackUrl(movie.videoPath, ttlSeconds);
      await rentalService.saveSignedUrl(activeRental._id, signedUrl);
      await activeRental.populate('movie');
      return res.status(StatusCodes.OK).json({ data: { rental: activeRental, signedUrl } });
    }
  }

  const expiresAt = hoursFromNow(movie.rentalDurationHours || settings.defaultRentalHours);
  const rental = await rentalService.createRental({
    movie: movie._id,
    customerEmail,
    payhipCode,
    expiresAt
  });
  await rental.populate('movie');

  const ttlSeconds = Math.min(secondsUntil(expiresAt), SIGNED_URL_MAX_TTL);
  const signedUrl = generateSignedPlaybackUrl(movie.videoPath, ttlSeconds);
  await rentalService.saveSignedUrl(rental._id, signedUrl);

  res.status(StatusCodes.CREATED).json({ data: { rental, signedUrl } });
};

export const getRentalById = async (req: Request, res: Response) => {
  const rental = await rentalService.findById(req.params.id);
  if (!rental) {
    throw new AppError('Rental not found', StatusCodes.NOT_FOUND);
  }

  await rentalService.expireIfNeeded(rental);

  let signedUrl: string | undefined;
  if (rental.status === 'active') {
    const ttlSeconds = Math.min(secondsUntil(rental.expiresAt), SIGNED_URL_MAX_TTL);
    if (ttlSeconds <= 0) {
      rental.status = 'expired';
      await rental.save();
    } else {
      if (!isMovieDoc(rental.movie)) {
        throw new AppError('Movie metadata missing for rental', StatusCodes.INTERNAL_SERVER_ERROR);
      }
      const movieDoc = rental.movie;
      signedUrl = generateSignedPlaybackUrl(movieDoc.videoPath, ttlSeconds);
      await rentalService.saveSignedUrl(rental._id, signedUrl);
    }
  }

  res.json({ data: { rental, signedUrl } });
};
