import type { Types } from 'mongoose';
import { Rental, type RentalDoc } from '../models/rental.model.js';

const findActiveRental = async (movieId: Types.ObjectId, email: string): Promise<RentalDoc | null> => {
  return Rental.findOne({
    movie: movieId,
    customerEmail: email.toLowerCase(),
    expiresAt: { $gt: new Date() }
  }).exec();
};

// Check if a payhip code was already used by a DIFFERENT email
const findRentalByPayhipCode = async (payhipCode: string): Promise<RentalDoc | null> => {
  return Rental.findOne({ payhipCode }).sort({ createdAt: -1 }).exec();
};

const createRental = async (payload: {
  movie: Types.ObjectId;
  customerEmail: string;
  payhipCode: string;
  expiresAt: Date;
}): Promise<RentalDoc> => {
  const rental = new Rental({
    movie: payload.movie,
    customerEmail: payload.customerEmail.toLowerCase(),
    payhipCode: payload.payhipCode,
    expiresAt: payload.expiresAt
  });
  return rental.save();
};

const findById = async (id: string | Types.ObjectId): Promise<RentalDoc | null> => {
  return Rental.findById(id).populate('movie').exec();
};

const saveSignedUrl = async (id: Types.ObjectId, url: string): Promise<void> => {
  await Rental.findByIdAndUpdate(id, { lastSignedUrl: url }).exec();
};

const expireIfNeeded = async (rental: RentalDoc): Promise<RentalDoc> => {
  if (rental.expiresAt.getTime() <= Date.now() && rental.status !== 'expired') {
    rental.status = 'expired';
    await rental.save();
  }
  return rental;
};

export const rentalService = {
  findActiveRental,
  findRentalByPayhipCode,
  createRental,
  findById,
  saveSignedUrl,
  expireIfNeeded
};
