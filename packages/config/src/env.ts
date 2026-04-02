import { z } from 'zod';

/**
 * Common environment variables schema
 */
const commonEnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().url(),
});

/**
 * Web app environment schema
 */
export const webEnvSchema = commonEnvSchema.extend({
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    CLERK_SECRET_KEY: z.string().min(1),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
    API_BASE_URL: z.string().url(),
});

/**
 * Core API environment schema
 */
export const coreApiEnvSchema = commonEnvSchema.extend({
    PORT: z.string().default('3001'),
    CLERK_SECRET_KEY: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().min(1),
    STRIPE_WEBHOOK_SECRET: z.string().min(1),
    TIMETAP_API_KEY: z.string().optional(),
    TIMETAP_BASE_URL: z.string().url().optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().optional(),
    LLM_PROVIDER: z.enum(['auto', 'openai', 'azure']).optional(),
    AZURE_OPENAI_KEY: z.string().optional(),
    AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
    AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;
export type CoreApiEnv = z.infer<typeof coreApiEnvSchema>;

/**
 * Validates and returns environment variables
 */
export function validateEnv<T extends z.ZodSchema>(
    schema: T,
    env: NodeJS.ProcessEnv = process.env
): z.infer<T> {
    const result = schema.safeParse(env);

    if (!result.success) {
        console.error('❌ Invalid environment variables:');
        console.error(JSON.stringify(result.error.format(), null, 2));
        throw new Error('Invalid environment variables');
    }

    return result.data;
}
