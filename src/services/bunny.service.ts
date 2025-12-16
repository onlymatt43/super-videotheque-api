import crypto from 'crypto';
import { settings } from '../config/env.js';

/**
 * Generates a signed CDN URL for Bunny Stream assets (thumbnails, previews, etc.)
 * Formula: base64url(SHA256(security_key + path + expires)) + &token_path=path
 * See: https://docs.bunny.net/docs/stream-security
 */
export const generateSignedCdnUrl = (cdnUrl: string, ttlSeconds: number): string => {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  
  // Parse the URL to get the path
  const url = new URL(cdnUrl);
  const path = url.pathname;
  
  // Bunny CDN token: base64url(SHA256(security_key + path + expires))
  const signaturePayload = `${settings.bunnySigningKey}${path}${expires}`;
  const hash = crypto
    .createHash('sha256')
    .update(signaturePayload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${cdnUrl}?token=${hash}&expires=${expires}`;
};

/**
 * Generates a signed embed URL for Bunny Stream
 * Formula: SHA256_HEX(token_security_key + video_id + expiration)
 * See: https://docs.bunny.net/docs/stream-embed-token-authentication
 */
export const generateSignedPlaybackUrl = (videoPath: string, ttlSeconds: number): string => {
  // Extract video ID from path like "/454374/1a31ba94-0843-44a8-9a6e-245878061b68.mp4"
  const pathParts = videoPath.split('/').filter(Boolean);
  const libraryId = pathParts[0];
  const videoIdWithExt = pathParts[1] || '';
  const videoId = videoIdWithExt.replace('.mp4', '');
  
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  
  // Bunny embed token: SHA256_HEX(token_security_key + video_id + expiration)
  const signaturePayload = `${settings.bunnySigningKey}${videoId}${expires}`;
  const token = crypto
    .createHash('sha256')
    .update(signaturePayload)
    .digest('hex');

  // Return embed URL format
  return `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}?token=${token}&expires=${expires}`;
};
