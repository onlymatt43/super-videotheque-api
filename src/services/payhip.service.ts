import axios from 'axios';
import { AppError } from '../utils/appError.js';
import { settings } from '../config/env.js';
import type { PayhipValidationResponse } from '../types/payhip.js';

const payhipClient = axios.create({
  baseURL: settings.payhipApiBaseUrl,
  headers: {
    'product-secret-key': settings.payhipApiKey,
    Accept: 'application/json'
  },
  timeout: 10_000
});

type PayhipLicenseData = {
  enabled?: boolean;
  product_link?: string;
  license_key?: string;
  buyer_email?: string;
  uses?: number;
  date?: string;
};

type PayhipLicenseResponse = {
  data?: PayhipLicenseData;
  success?: boolean;
  code?: string;
  message?: string;
};

export const validatePayhipCode = async (code: string): Promise<PayhipValidationResponse> => {
  try {
    const response = await payhipClient.get<PayhipLicenseResponse>(
      `/license/verify`,
      { params: { license_key: code } }
    );
    const payload = response.data;

    // Empty response or no data means invalid key
    if (!payload.data || !payload.data.license_key) {
      throw new AppError('Licence Payhip introuvable ou invalide', 404);
    }

    // Check if license is disabled
    if (payload.data.enabled === false) {
      throw new AppError('Cette licence a été désactivée', 403);
    }

    // Check if code is older than 60 minutes
    if (payload.data.date) {
      const purchaseDate = new Date(payload.data.date);
      const now = new Date();
      const ageInMinutes = (now.getTime() - purchaseDate.getTime()) / (1000 * 60);
      
      if (ageInMinutes > 60) {
        throw new AppError('Ce code a expiré (valide 60 minutes après l\'achat)', 403);
      }
    }

    return {
      success: true,
      licenseKey: payload.data.license_key,
      status: payload.data.enabled ? 'active' : 'disabled',
      email: payload.data.buyer_email,
      productId: payload.data.product_link ?? settings.payhipProductId,
      purchasedAt: payload.data.date,
      metadata: payload.data as Record<string, unknown>
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response) {
      const status = error.response.status || 400;
      const respData = error.response.data as { message?: string; code?: string };
      const message = respData?.message ?? (status === 404 ? 'Licence Payhip introuvable' : 'Payhip validation failed');
      throw new AppError(message, status);
    }

    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError('Unable to reach Payhip at the moment', 502);
  }
};
