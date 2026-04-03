import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

export const webEnvSchema = z.object({
    NODE_ENV: nodeEnvSchema,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    CLERK_SECRET_KEY: z.string().min(1),
    NEXT_PUBLIC_WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
    NEXT_PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:3001'),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().default(''),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default('https://app.posthog.com'),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default(''),
});

export const coreApiEnvSchema = z.object({
    NODE_ENV: nodeEnvSchema,
    DATABASE_URL: z.string().min(1),
    PORT: z.string().default('3001'),
    WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
    CLERK_SECRET_KEY: z.string().min(1),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    TIMETAP_API_KEY: z.string().optional(),
    TIMETAP_BASE_URL: z.string().url().optional(),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().optional(),
    LLM_PROVIDER: z.enum(['auto', 'openai', 'azure']).optional(),
    AZURE_OPENAI_KEY: z.string().optional(),
    AZURE_OPENAI_ENDPOINT: z.string().url().optional(),
    AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
    CORE_API_BODY_LIMIT: z.string().optional(),
    CORE_API_ALLOWED_ORIGINS: z.string().optional(),
});

export type WebEnv = z.infer<typeof webEnvSchema>;
export type CoreApiEnv = z.infer<typeof coreApiEnvSchema>;

export function validateEnv<T extends z.ZodSchema>(
    schema: T,
    env: NodeJS.ProcessEnv = process.env
): z.infer<T> {
    const result = schema.safeParse(env);

    if (!result.success) {
        console.error('Invalid environment variables:');
        console.error(JSON.stringify(result.error.format(), null, 2));
        throw new Error('Invalid environment variables');
    }

    return result.data;
}
