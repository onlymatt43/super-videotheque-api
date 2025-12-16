import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export type MovieCategory = string;

export interface MovieAttrs {
  title: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  bunnyLibraryId: string;
  bunnyVideoId: string;
  videoPath: string;
  rentalDurationHours: number;
  isFreePreview: boolean;
  category: MovieCategory;
  tags: string[];
}

export type MovieDoc = HydratedDocument<MovieAttrs>;

const movieSchema = new Schema<MovieDoc>(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String },
    thumbnailUrl: { type: String },
    previewUrl: { type: String },
    bunnyLibraryId: { type: String, required: true },
    bunnyVideoId: { type: String, required: true },
    videoPath: { type: String, required: true },
    rentalDurationHours: { type: Number, default: 48 },
    isFreePreview: { type: Boolean, default: false },
    category: { type: String, default: 'uncategorized' },
    tags: { type: [String], default: [] }
  },
  { timestamps: true }
);

movieSchema.index({ bunnyVideoId: 1 }, { unique: true });

export const Movie: Model<MovieDoc> = model<MovieDoc>('Movie', movieSchema);
