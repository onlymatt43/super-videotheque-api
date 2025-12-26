import axios from 'axios';
import { AppError } from '../utils/appError.js';
import { settings } from '../config/env.js';
import type { PayhipValidationResponse, AccessType } from '../types/payhip.js';

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
  product_name?: string;
};

type PayhipLicenseResponse = {
  data?: PayhipLicenseData;
  success?: boolean;
  code?: string;
  message?: string;
};

interface AccessInfo {
  accessType: AccessType;
  accessValue: string;
  duration?: number;
}

/**
 * Parse le type d'accès depuis le nom du produit Payhip
 * Conventions:
 * - TIME_1H, TIME_* : accès temporel complet
 * - FILM_<movieId> : accès permanent à un film spécifique
 * - CAT_<categorySlug> : accès permanent à une catégorie
 */
function parseAccessFromProduct(productName: string = '', productLink: string = ''): AccessInfo {
  // Utiliser le product_name ou product_link pour déterminer le type
  const name = (productName || productLink).toUpperCase();
  
  // Codes temporels (accès complet pour une durée limitée)
  if (name.includes('TIME_') || name.includes('1H') || name.includes('HOUR')) {
    // Extraire la durée si spécifiée dans le nom
    let duration = 3600; // 1 heure par défaut
    
    const hourMatch = name.match(/(\d+)H/);
    if (hourMatch) {
      duration = parseInt(hourMatch[1]) * 3600;
    }
    
    return {
      accessType: 'time',
      accessValue: 'all',
      duration
    };
  }
  
  // Accès à un film spécifique
  if (name.includes('FILM_')) {
    const filmId = name.split('FILM_')[1]?.split(/[\s_-]/)[0];
    return {
      accessType: 'film',
      accessValue: filmId || '',
      duration: undefined // Permanent
    };
  }
  
  // Accès à une catégorie
  if (name.includes('CAT_')) {
    const categorySlug = name.split('CAT_')[1]?.split(/[\s_-]/)[0]?.toLowerCase();
    return {
      accessType: 'category',
      accessValue: categorySlug || '',
      duration: undefined // Permanent
    };
  }
  
  // Par défaut : accès temporel 1h (rétrocompatibilité)
  return {
    accessType: 'time',
    accessValue: 'all',
    duration: 3600
  };
}

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

    // Parse access information from product name/link
    const accessInfo = parseAccessFromProduct(
      payload.data.product_name,
      payload.data.product_link
    );

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
      metadata: payload.data as Record<string, unknown>,
      accessType: accessInfo.accessType,
      accessValue: accessInfo.accessValue,
      duration: accessInfo.duration
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
