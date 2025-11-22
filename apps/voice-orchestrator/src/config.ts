import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const configSchema = z.object({
    port: z.coerce.number().default(3002),
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),

    // Twilio
    twilio: z.object({
        accountSid: z.string().min(1, 'TWILIO_ACCOUNT_SID is required'),
        authToken: z.string().min(1, 'TWILIO_AUTH_TOKEN is required'),
    }),

    // Azure Speech
    azureSpeech: z.object({
        key: z.string().min(1, 'AZURE_SPEECH_KEY is required'),
        region: z.string().min(1, 'AZURE_SPEECH_REGION is required'),
    }),

    // Azure OpenAI
    azureOpenAI: z.object({
        key: z.string().min(1, 'AZURE_OPENAI_KEY is required'),
        endpoint: z.string().url('AZURE_OPENAI_ENDPOINT must be a valid URL'),
        deployment: z.string().min(1, 'AZURE_OPENAI_DEPLOYMENT is required'),
    }),

    // Core API
    coreApi: z.object({
        baseUrl: z.string().url('CORE_API_BASE_URL must be a valid URL'),
    }),
});

export type Config = z.infer<typeof configSchema>;

export const config: Config = configSchema.parse({
    port: process.env.PORT,
    nodeEnv: process.env.NODE_ENV,

    twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
    },

    azureSpeech: {
        key: process.env.AZURE_SPEECH_KEY,
        region: process.env.AZURE_SPEECH_REGION,
    },

    azureOpenAI: {
        key: process.env.AZURE_OPENAI_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT,
    },

    coreApi: {
        baseUrl: process.env.CORE_API_BASE_URL,
    },
});
