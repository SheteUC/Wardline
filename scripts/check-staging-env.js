const path = require('path');
const dotenv = require('dotenv');

const rootEnvPaths = [
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), '.env'),
];

for (const envPath of rootEnvPaths) {
  dotenv.config({ path: envPath, override: false, quiet: true });
}

const required = [
  { label: 'DATABASE_URL', keys: ['DATABASE_URL'] },
  { label: 'REDIS_URL', keys: ['REDIS_URL'] },
  { label: 'NEXT_PUBLIC_API_BASE_URL', keys: ['NEXT_PUBLIC_API_BASE_URL'] },
  { label: 'NEXT_PUBLIC_CORE_API_URL', keys: ['NEXT_PUBLIC_CORE_API_URL', 'CORE_API_BASE_URL'] },
  { label: 'NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL', keys: ['NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL'] },
  { label: 'NEXT_PUBLIC_WEB_BASE_URL or WEB_BASE_URL', keys: ['NEXT_PUBLIC_WEB_BASE_URL', 'WEB_BASE_URL'] },
  { label: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', keys: ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'] },
  { label: 'CLERK_SECRET_KEY', keys: ['CLERK_SECRET_KEY'] },
  { label: 'TWILIO_ACCOUNT_SID', keys: ['TWILIO_ACCOUNT_SID'] },
  { label: 'TWILIO_AUTH_TOKEN', keys: ['TWILIO_AUTH_TOKEN'] },
  { label: 'TWILIO_PHONE_NUMBER', keys: ['TWILIO_PHONE_NUMBER'] },
  { label: 'AZURE_SPEECH_KEY', keys: ['AZURE_SPEECH_KEY'] },
  { label: 'AZURE_SPEECH_REGION', keys: ['AZURE_SPEECH_REGION'] },
  { label: 'AZURE_OPENAI_KEY', keys: ['AZURE_OPENAI_KEY'] },
  { label: 'AZURE_OPENAI_ENDPOINT', keys: ['AZURE_OPENAI_ENDPOINT'] },
];

const recommended = [
  { label: 'WEBHOOK_BASE_URL', keys: ['WEBHOOK_BASE_URL'] },
  { label: 'ATHENAHEALTH_SCHEDULING_TOKEN', keys: ['ATHENAHEALTH_SCHEDULING_TOKEN'] },
  { label: 'ATHENAHEALTH_REFILL_TOKEN', keys: ['ATHENAHEALTH_REFILL_TOKEN'] },
  { label: 'ATHENAHEALTH_INSURANCE_TOKEN', keys: ['ATHENAHEALTH_INSURANCE_TOKEN'] },
  { label: 'ATHENAHEALTH_BILLING_TOKEN', keys: ['ATHENAHEALTH_BILLING_TOKEN'] },
  { label: 'STAGING_BUSINESS_NAME', keys: ['STAGING_BUSINESS_NAME'] },
  { label: 'STAGING_BUSINESS_SLUG', keys: ['STAGING_BUSINESS_SLUG'] },
  { label: 'STAGING_PHONE_NUMBER', keys: ['STAGING_PHONE_NUMBER'] },
];

function hasValue(keys) {
  return keys.some((key) => process.env[key]?.trim());
}

const missingRequired = required.filter(({ keys }) => !hasValue(keys));
const missingRecommended = recommended.filter(({ keys }) => !hasValue(keys));

if (missingRequired.length > 0) {
  console.error('Missing required staging environment variables:');
  for (const entry of missingRequired) {
    console.error(`- ${entry.label}`);
  }
  process.exit(1);
}

console.log('Required staging environment variables are present.');

if (missingRecommended.length > 0) {
  console.warn('Recommended staging environment variables not set:');
  for (const entry of missingRecommended) {
    console.warn(`- ${entry.label}`);
  }
}
