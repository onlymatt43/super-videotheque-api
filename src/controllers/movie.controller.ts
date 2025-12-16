import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { movieService } from '../services/movie.service.js';
import { generateSignedCdnUrl } from '../services/bunny.service.js';
import { AppError } from '../utils/appError.js';

// Sign thumbnail and preview URLs for private library videos
const signMovieUrls = (movie: any) => {
  const movieObj = movie.toObject ? movie.toObject() : movie;
  const TTL_SECONDS = 3600; // 1 hour
  
  // Only sign if URLs are from the private pull zone
  if (movieObj.thumbnailUrl && movieObj.thumbnailUrl.includes('vz-a6e64a9e-b20')) {
    movieObj.thumbnailUrl = generateSignedCdnUrl(movieObj.thumbnailUrl, TTL_SECONDS);
  }
  if (movieObj.previewUrl && movieObj.previewUrl.includes('vz-a6e64a9e-b20')) {
    movieObj.previewUrl = generateSignedCdnUrl(movieObj.previewUrl, TTL_SECONDS);
  }
  
  return movieObj;
};

export const listMovies = async (_req: Request, res: Response) => {
  const movies = await movieService.list();
  const signedMovies = movies.map(signMovieUrls);
  res.json({ data: signedMovies });
};

export const listFreePreviews = async (_req: Request, res: Response) => {
  const movies = await movieService.listFreePreviews();
  res.json({ data: movies });
};

export const getMovieById = async (req: Request, res: Response) => {
  const movie = await movieService.getById(req.params.id);
  if (!movie) {
    throw new AppError('Movie not found', StatusCodes.NOT_FOUND);
  }
  const signedMovie = signMovieUrls(movie);
  res.json({ data: signedMovie });
};

export const createMovie = async (req: Request, res: Response) => {
  const movie = await movieService.create(req.body);
  res.status(StatusCodes.CREATED).json({ data: movie });
};

export const updateMovie = async (req: Request, res: Response) => {
  const movie = await movieService.update(req.params.id, req.body);
  if (!movie) {
    throw new AppError('Movie not found', StatusCodes.NOT_FOUND);
  }
  res.json({ data: movie });
};
