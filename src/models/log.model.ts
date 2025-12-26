import mongoose, { Schema, Document } from 'mongoose';

export interface ISecurityLog extends Document {
  type: 'admin_login_failed' | 'invalid_code' | 'suspicious_access' | 'rate_limit_hit';
  ip: string;
  userAgent?: string;
  details: any;
  createdAt: Date;
}

export interface IAnalyticsEvent extends Document {
  type: 'code_added' | 'code_expired' | 'movie_viewed' | 'error' | 'session_start';
  userId?: string; // code ou email hashé
  movieId?: string;
  category?: string;
  metadata?: any;
  createdAt: Date;
}

const securityLogSchema = new Schema<ISecurityLog>({
  type: {
    type: String,
    required: true,
    enum: ['admin_login_failed', 'invalid_code', 'suspicious_access', 'rate_limit_hit'],
  },
  ip: { type: String, required: true },
  userAgent: { type: String },
  details: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, expires: 2592000 }, // 30 jours
});

const analyticsEventSchema = new Schema<IAnalyticsEvent>({
  type: {
    type: String,
    required: true,
    enum: ['code_added', 'code_expired', 'movie_viewed', 'error', 'session_start'],
  },
  userId: { type: String },
  movieId: { type: String },
  category: { type: String },
  metadata: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now, expires: 7776000 }, // 90 jours
});

// Index pour les requêtes de reporting
securityLogSchema.index({ type: 1, createdAt: -1 });
securityLogSchema.index({ ip: 1, createdAt: -1 });
analyticsEventSchema.index({ type: 1, createdAt: -1 });
analyticsEventSchema.index({ movieId: 1, createdAt: -1 });

export const SecurityLog = mongoose.model<ISecurityLog>('SecurityLog', securityLogSchema);
export const AnalyticsEvent = mongoose.model<IAnalyticsEvent>(
  'AnalyticsEvent',
  analyticsEventSchema
);
