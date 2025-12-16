import 'dotenv/config';
import axios from 'axios';
import mongoose from 'mongoose';
import type { AxiosResponse } from 'axios';
import { Movie } from '../src/models/movie.model.js';
import { settings } from '../src/config/env.js';

interface BunnyVideoItem {
  guid: string;
  videoLibraryId: number;
  title: string;
  description?: string;
  previewVideoUrl?: string;
  thumbnailFileName?: string;
  thumbnailUrl?: string;
  previewGifUrl?: string;
  length?: number;
  dateUploaded?: string;
  status?: string;
  tags?: string[];
  storage?: {
    originalFileName?: string;
  };
  playbackUrl?: string;
  playbackUrlHls?: string;
}

interface BunnyListResponse {
  items: BunnyVideoItem[];
  totalItems: number;
  currentPage: number;
  itemsPerPage: number;
}

const BUNNY_LIBRARY_ID = process.env.BUNNY_LIBRARY_ID ?? settings.bunnyLibraryId;
const BUNNY_API_KEY = process.env.BUNNY_API_KEY ?? settings.bunnyApiKey;
const DEFAULT_DURATION = settings.defaultRentalHours || 48;

if (!BUNNY_LIBRARY_ID || !BUNNY_API_KEY) {
  console.error('❌ Missing BUNNY_LIBRARY_ID or BUNNY_API_KEY – please add them to your .env');
  process.exit(1);
}

const bunnyClient = axios.create({
  baseURL: `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}`,
  headers: {
    AccessKey: BUNNY_API_KEY,
    Accept: 'application/json'
  },
  timeout: 15_000
});

const slugify = (input: string): string => {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};

const extractVideoPath = (video: BunnyVideoItem): string => {
  const candidate = video.playbackUrl || video.playbackUrlHls;
  if (candidate) {
    try {
      return new URL(candidate).pathname;
    } catch (error) {
      console.warn('⚠️ Unable to parse playback URL, falling back to guid', { candidate, error });
    }
  }

  return `/${BUNNY_LIBRARY_ID}/${video.guid}.mp4`;
};

const extractThumbnail = (video: BunnyVideoItem): string | undefined => {
  // Construire l'URL de la thumbnail directement depuis Bunny CDN
  // Format: https://{pull-zone}/{videoId}/thumbnail.jpg
  const pullZone = settings.bunnyPullZoneHost;
  if (pullZone && video.guid) {
    return `https://${pullZone}/${video.guid}/thumbnail.jpg`;
  }
  
  // Fallbacks
  if (video.thumbnailUrl) return video.thumbnailUrl;
  if (video.previewGifUrl) return video.previewGifUrl;
  if (video.previewVideoUrl) {
    try {
      const url = new URL(video.previewVideoUrl);
      return `${url.origin}${url.pathname}.jpg`;
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const extractPreviewUrl = (video: BunnyVideoItem): string | undefined => {
  // Construire l'URL du preview HLS directement depuis Bunny CDN
  // Format: https://{pull-zone}/{videoId}/playlist.m3u8
  const pullZone = settings.bunnyPullZoneHost;
  if (pullZone && video.guid) {
    return `https://${pullZone}/${video.guid}/playlist.m3u8`;
  }
  
  return video.previewVideoUrl;
};

const fetchAllVideos = async (): Promise<BunnyVideoItem[]> => {
  let page = 1;
  const itemsPerPage = 100;
  const videos: BunnyVideoItem[] = [];

  while (true) {
    const response: AxiosResponse<BunnyListResponse> = await bunnyClient.get('/videos', {
      params: { page, itemsPerPage }
    });

    videos.push(...response.data.items);

    const fetched = page * itemsPerPage;
    if (fetched >= response.data.totalItems || response.data.items.length === 0) {
      break;
    }

    page += 1;
  }

  return videos;
};

const upsertMovies = async (videos: BunnyVideoItem[]): Promise<void> => {
  let created = 0;
  let updated = 0;

  for (const video of videos) {
    const slug = slugify(video.title || video.guid);
    const thumbnailUrl = extractThumbnail(video);
    const previewUrl = extractPreviewUrl(video);

    const moviePayload = {
      title: video.title || 'Sans titre',
      slug,
      description: video.description,
      thumbnailUrl,
      bunnyLibraryId: String(video.videoLibraryId ?? BUNNY_LIBRARY_ID),
      bunnyVideoId: video.guid,
      videoPath: extractVideoPath(video),
      rentalDurationHours: DEFAULT_DURATION,
      previewUrl
    };

    const $set: Record<string, unknown> = { ...moviePayload };
    const $unset: Record<string, ''> = {};

    if (!thumbnailUrl) {
      delete $set.thumbnailUrl;
      $unset.thumbnailUrl = '';
    }

    if (!previewUrl) {
      delete $set.previewUrl;
      $unset.previewUrl = '';
    }

    const result = await Movie.findOneAndUpdate(
      { slug },
      {
        $set,
        ...(Object.keys($unset).length ? { $unset } : {})
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created += 1;
    } else {
      updated += 1;
    }
  }

  console.log(`✅ Movies synced. Created: ${created}, Updated: ${updated}`);
};

const main = async () => {
  console.log('🚀 Connecting to MongoDB...');
  await mongoose.connect(settings.mongoUri);
  console.log('📡 Fetching Bunny videos...');
  const videos = await fetchAllVideos();
  console.log(`🎬 Retrieved ${videos.length} videos from Bunny library ${BUNNY_LIBRARY_ID}`);
  await upsertMovies(videos);
  await mongoose.disconnect();
  console.log('🏁 Done.');
};

main().catch((error) => {
  console.error('❌ Failed to seed movies', error);
  mongoose.disconnect().finally(() => process.exit(1));
});
