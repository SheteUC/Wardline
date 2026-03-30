const path = require('path');
const dotenv = require('dotenv');

const rootEnvPaths = [
  path.join(process.cwd(), '.env.local'),
  path.join(process.cwd(), '.env'),
];

for (const envPath of rootEnvPaths) {
  dotenv.config({ path: envPath, override: false, quiet: true });
}

function getConfiguredPublicUrl() {
  return (
    process.env.VOICE_RUNTIME_V2_PUBLIC_URL?.trim() ||
    process.env.WEBHOOK_BASE_URL?.trim() ||
    ''
  );
}

function buildMediaStreamUrl(publicUrl, mediaPath) {
  if (!publicUrl) {
    return '';
  }

  const normalizedBase = publicUrl.replace(/\/+$/, '');
  const normalizedPath = `/${(mediaPath || '/telephony/twilio/media').replace(/^\/+/, '')}`;
  return normalizedBase.replace(/^https:/, 'wss:') + normalizedPath;
}

function printChecklist() {
  const publicUrl = getConfiguredPublicUrl();
  const mediaPath = process.env.TWILIO_MEDIA_STREAM_PATH?.trim() || '/telephony/twilio/media';
  const bootstrapUrl = publicUrl ? `${publicUrl.replace(/\/+$/, '')}/telephony/twilio/bootstrap` : '';
  const mediaStreamUrl = buildMediaStreamUrl(publicUrl, mediaPath);
  const dashboardBaseUrl =
    process.env.NEXT_PUBLIC_WEB_BASE_URL?.trim() ||
    process.env.WEB_BASE_URL?.trim() ||
    'http://localhost:3000';

  console.log('Voice Runtime V2 first real-call proof');
  console.log('');

  if (!publicUrl) {
    console.log('1. Start a local HTTPS tunnel to port 3003. Example:');
    console.log('   ngrok http 3003');
    console.log('');
    console.log('2. Copy the public HTTPS URL into both env vars:');
    console.log('   VOICE_RUNTIME_V2_PUBLIC_URL="https://example.ngrok.app"');
    console.log('   WEBHOOK_BASE_URL="https://example.ngrok.app"');
    console.log('');
  } else {
    console.log(`Configured public callback URL: ${publicUrl}`);
    console.log(`Twilio bootstrap URL: ${bootstrapUrl}`);
    console.log(`Derived media websocket URL: ${mediaStreamUrl}`);
    console.log('');
  }

  console.log('Canonical proof sequence:');
  console.log('1. pnpm mock:integrations');
  console.log('2. pnpm db:seed:staging');
  console.log('3. npm run voice:v2:preflight');
  console.log('4. pnpm --filter @wardline/core-api dev');
  console.log('5. pnpm --filter @wardline/web dev');
  console.log('6. pnpm voice:v2:dev');
  console.log('7. Point the Twilio number voice webhook at the bootstrap URL above.');
  console.log('8. Place one inbound scheduling call to the configured Twilio number.');
  console.log('');
  console.log('Acceptance checklist:');
  console.log('- caller hears the greeting');
  console.log('- supervisor routes to scheduling');
  console.log('- caller confirms the appointment request');
  console.log('- mock scheduling action succeeds live');
  console.log(`- review the result in ${dashboardBaseUrl.replace(/\/+$/, '')}/dashboard/calls`);
}

printChecklist();
