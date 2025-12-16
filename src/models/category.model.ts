import { Schema, model, type HydratedDocument, type Model } from 'mongoose';

export interface CategoryAttrs {
  slug: string;
  label: string;
  order: number;
}

export type CategoryDoc = HydratedDocument<CategoryAttrs>;

const categorySchema = new Schema<CategoryDoc>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true },
    label: { type: String, required: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
);

categorySchema.index({ order: 1 });

export const Category: Model<CategoryDoc> = model<CategoryDoc>('Category', categorySchema);
