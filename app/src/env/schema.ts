import { z } from "zod";

export const serverScheme = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  AUTH_SECRET: z.string(),
  AUTH_TRUST_HOST: z.string().optional(),
  AUTH_URL: z.string().optional(),
  DATABASE_URL: z.string(),
  OPENAI_API_KEY: z.string().optional(),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  // Explicit public base URL for server-side absolute fetch construction
  PUBLIC_BASE_URL: z.string().url().optional(),
  // Back-compat alias
  PUBLIC_APP_URL: z.string().url().optional(),
});

export const clientScheme = z.object({
  MODE: z.enum(["development", "production", "test"]).default("development"),
  VITE_AUTH_PATH: z.string().optional(),
  // Optional explicit base URL for client-side absolute fetch
  VITE_PUBLIC_BASE_URL: z.string().optional(),
  // Back-compat alias
  VITE_APP_URL: z.string().optional(),
});
