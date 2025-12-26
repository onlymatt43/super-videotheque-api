export type AccessType = 'time' | 'film' | 'category';

export interface PayhipValidationResponse {
  success: boolean;
  licenseKey: string;
  productId: string;
  status?: string;
  email?: string;
  orderId?: string;
  purchasedAt?: string;
  metadata?: Record<string, unknown>;
  accessType?: AccessType;
  accessValue?: string;
  duration?: number; // en secondes pour les codes temporels
}
