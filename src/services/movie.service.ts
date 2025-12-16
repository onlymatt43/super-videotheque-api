import type { Types } from 'mongoose';
import { Movie, type MovieAttrs, type MovieDoc } from '../models/movie.model.js';

const list = async (): Promise<MovieDoc[]> => {
  return Movie.find().sort({ createdAt: -1 }).exec();
};

const listFreePreviews = async (): Promise<MovieDoc[]> => {
  return Movie.find({ isFreePreview: true }).sort({ createdAt: -1 }).exec();
};

const getById = async (id: string | Types.ObjectId): Promise<MovieDoc | null> => {
  return Movie.findById(id).exec();
};

const create = async (payload: MovieAttrs): Promise<MovieDoc> => {
  const movie = new Movie(payload);
  return movie.save();
};

const update = async (id: string, payload: Partial<MovieAttrs>): Promise<MovieDoc | null> => {
  return Movie.findByIdAndUpdate(id, payload, { new: true }).exec();
};

export const movieService = {
  list,
  listFreePreviews,
  getById,
  create,
  update
};
