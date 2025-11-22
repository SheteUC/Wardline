// Setup test environment variables
process.env.PORT = '3000';
process.env.NODE_ENV = 'test';

// Twilio
process.env.TWILIO_ACCOUNT_SID = 'test-account-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-auth-token';

// Azure Speech
process.env.AZURE_SPEECH_KEY = 'test-speech-key';
process.env.AZURE_SPEECH_REGION = 'test-region';

// Azure OpenAI
process.env.AZURE_OPENAI_KEY = 'test-openai-key';
process.env.AZURE_OPENAI_ENDPOINT = 'https://test.openai.azure.com';
process.env.AZURE_OPENAI_DEPLOYMENT = 'test-deployment';

// Core API
process.env.CORE_API_BASE_URL = 'http://localhost:4000';
