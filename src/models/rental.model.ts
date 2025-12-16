import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';

export type RentalStatus = 'active' | 'expired';

export interface RentalAttrs {
  movie: Types.ObjectId;
  customerEmail: string;
  payhipCode: string;
  status?: RentalStatus;
  expiresAt: Date;
  lastSignedUrl?: string;
}

export type RentalDoc = HydratedDocument<RentalAttrs>;

const rentalSchema = new Schema<RentalDoc>(
  {
    movie: { type: Schema.Types.ObjectId, ref: 'Movie', required: true },
    customerEmail: { type: String, required: true, lowercase: true, index: true },
    payhipCode: { type: String, required: true },
    status: { type: String, enum: ['active', 'expired'], default: 'active' },
    expiresAt: { type: Date, required: true },
    lastSignedUrl: { type: String }
  },
  { timestamps: true }
);

rentalSchema.index({ customerEmail: 1, movie: 1, status: 1 });
rentalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Rental: Model<RentalDoc> = model<RentalDoc>('Rental', rentalSchema);
