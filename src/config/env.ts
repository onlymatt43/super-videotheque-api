import { config } from 'dotenv';
import { z } from 'zod';

config({ override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('4000'),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  PAYHIP_API_BASE_URL: z.string().url('PAYHIP_API_BASE_URL must be a valid URL'),
  PAYHIP_API_KEY: z.string().min(1, 'PAYHIP_API_KEY is required'),
  PAYHIP_PRODUCT_ID: z.string().min(1, 'PAYHIP_PRODUCT_ID is required'),
  BUNNY_PULL_ZONE_HOST: z.string().min(1, 'BUNNY_PULL_ZONE_HOST is required'),
  BUNNY_SIGNING_KEY: z.string().min(1, 'BUNNY_SIGNING_KEY is required'),
  BUNNY_LIBRARY_ID: z.string().optional(),
  BUNNY_API_KEY: z.string().optional(),
  BUNNY_PUBLIC_LIBRARY_ID: z.string().optional(),
  BUNNY_PUBLIC_PULL_ZONE_HOST: z.string().optional(),
  BUNNY_PUBLIC_API_KEY: z.string().optional(),
  DEFAULT_RENTAL_HOURS: z.string().default('48'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD must be at least 8 characters'),
  OPENAI_API_KEY: z.string().optional(),
  
  // Email (SMTP)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  ALERT_EMAIL: z.string().optional(),

  // Render/Vercel
  RENDER_SERVICE_ID: z.string().optional(),
  RENDER_TOKEN: z.string().optional(),
  VERCEL_PROJECT_ID: z.string().optional(),
  VERCEL_TOKEN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Environment validation failed. Check your .env file.');
}

const env = parsed.data;

export const settings = {
  nodeEnv: env.NODE_ENV,
  port: Number(env.PORT),
  mongoUri: env.MONGO_URI,
  payhipApiBaseUrl: env.PAYHIP_API_BASE_URL,
  payhipApiKey: env.PAYHIP_API_KEY,
  payhipProductId: env.PAYHIP_PRODUCT_ID,
  bunnyPullZoneHost: env.BUNNY_PULL_ZONE_HOST.replace(/^https?:\/\//, ''),
  bunnySigningKey: env.BUNNY_SIGNING_KEY,
  bunnyLibraryId: env.BUNNY_LIBRARY_ID,
  bunnyApiKey: env.BUNNY_API_KEY,
  bunnyPublicLibraryId: env.BUNNY_PUBLIC_LIBRARY_ID,
  bunnyPublicPullZoneHost: env.BUNNY_PUBLIC_PULL_ZONE_HOST?.replace(/^https?:\/\//, ''),
  bunnyPublicApiKey: env.BUNNY_PUBLIC_API_KEY,
  defaultRentalHours: Number(env.DEFAULT_RENTAL_HOURS),
  adminPassword: env.ADMIN_PASSWORD,
  openAIApiKey: env.OPENAI_API_KEY,
  
  // Email
  smtpHost: env.SMTP_HOST,
  smtpPort: env.SMTP_PORT,
  smtpUser: env.SMTP_USER,
  smtpPass: env.SMTP_PASS,
  alertEmail: env.ALERT_EMAIL,
  
  // Render/Vercel
  renderServiceId: env.RENDER_SERVICE_ID,
  renderToken: env.RENDER_TOKEN,
  vercelProjectId: env.VERCEL_PROJECT_ID,
  vercelToken: env.VERCEL_TOKEN,
};

export { env };
export type AppSettings = typeof settings;
