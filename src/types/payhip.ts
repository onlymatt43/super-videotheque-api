export interface PayhipValidationResponse {
  success: boolean;
  licenseKey: string;
  productId: string;
  status?: string;
  email?: string;
  orderId?: string;
  purchasedAt?: string;
  metadata?: Record<string, unknown>;
}
