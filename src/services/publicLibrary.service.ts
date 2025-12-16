import axios from 'axios';
import { settings } from '../config/env.js';

interface BunnyVideoItem {
  guid: string;
  videoLibraryId: number;
  title: string;
  dateUploaded?: string;
  status?: number;
  length?: number;
  thumbnailFileName?: string;
}

interface BunnyListResponse {
  items: BunnyVideoItem[];
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
}

export interface PublicPreview {
  id: string;
  title: string;
  thumbnailUrl: string;
  previewUrl: string;
  embedUrl: string;
  duration?: number;
}

const BUNNY_PUBLIC_LIBRARY_ID = settings.bunnyPublicLibraryId;
const BUNNY_PUBLIC_PULL_ZONE = settings.bunnyPublicPullZoneHost;
const BUNNY_PUBLIC_API_KEY = settings.bunnyPublicApiKey;

/**
 * Fetches videos from the PUBLIC Bunny library (free previews)
 * These are directly accessible without signed URLs
 */
export const fetchPublicPreviews = async (): Promise<PublicPreview[]> => {
  if (!BUNNY_PUBLIC_LIBRARY_ID || !BUNNY_PUBLIC_API_KEY) {
    console.warn('⚠️ Public library not configured');
    return [];
  }

  try {
    const response = await axios.get<BunnyListResponse>(
      `https://video.bunnycdn.com/library/${BUNNY_PUBLIC_LIBRARY_ID}/videos`,
      {
        headers: {
          AccessKey: BUNNY_PUBLIC_API_KEY,
          Accept: 'application/json'
        },
        params: {
          page: 1,
          itemsPerPage: 50,
          orderBy: 'date'
        },
        timeout: 10_000
      }
    );

    const videos = response.data.items || [];
    
    // Filter only ready videos (status 4 = ready)
    const readyVideos = videos.filter(v => v.status === 4);

    return readyVideos.map((video) => ({
      id: video.guid,
      title: cleanTitle(video.title),
      thumbnailUrl: `https://${BUNNY_PUBLIC_PULL_ZONE}/${video.guid}/${video.thumbnailFileName || 'thumbnail.jpg'}`,
      previewUrl: `https://${BUNNY_PUBLIC_PULL_ZONE}/${video.guid}/playlist.m3u8`,
      embedUrl: `https://iframe.mediadelivery.net/embed/${BUNNY_PUBLIC_LIBRARY_ID}/${video.guid}?autoplay=true&muted=true&loop=true`,
      duration: video.length
    }));
  } catch (error) {
    console.error('Failed to fetch public previews:', error);
    return [];
  }
};

/**
 * Clean up video title (remove extension, etc.)
 */
const cleanTitle = (title: string): string => {
  return title
    .replace(/\.(mp4|mov|avi|mkv|webm)$/i, '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .trim();
};
