import twilio from 'twilio';
import { config } from '../config';

const VoiceResponse = twilio.twiml.VoiceResponse;

export class TwilioService {
    constructor() {
        // Twilio client initialized per-request if needed
    }

    /**
     * Generate TwiML for greeting with WebSocket connection
     */
    public generateGreetingWithWebSocket(callSid: string): twilio.twiml.VoiceResponse {
        const twiml = new VoiceResponse();

        // Initial greeting
        twiml.say({
            voice: 'Polly.Joanna',
        }, 'Hello, you have reached the hospital automated system. Please hold while we connect you.');

        // Connect to WebSocket for real-time streaming
        const connect = twiml.connect();
        connect.stream({
            url: `wss://${this.getWebSocketUrl()}/media/${callSid}`,
        });

        return twiml;
    }

    /**
     * Generate TwiML for continuing conversation
     */
    public generateContinueResponse(): twilio.twiml.VoiceResponse {
        const twiml = new VoiceResponse();

        // Pause to allow WebSocket to handle streaming
        twiml.pause({ length: 60 });

        return twiml;
    }

    /**
     * Generate TwiML for no input received
     */
    public generateNoInputResponse(): twilio.twiml.VoiceResponse {
        const twiml = new VoiceResponse();

        twiml.say({
            voice: 'Polly.Joanna',
        }, 'I did not receive any input. Please try again.');

        twiml.redirect('/voice/incoming');

        return twiml;
    }

    /**
     * Generate TwiML for error handling
     */
    public generateErrorResponse(): twilio.twiml.VoiceResponse {
        const twiml = new VoiceResponse();

        twiml.say({
            voice: 'Polly.Joanna',
        }, 'I apologize, but we are experiencing technical difficulties. Please call back later or dial 911 for emergencies.');

        twiml.hangup();

        return twiml;
    }

    /**
     * Generate TwiML for emergency escalation
     */
    public generateEmergencyEscalation(phoneNumber: string): twilio.twiml.VoiceResponse {
        const twiml = new VoiceResponse();

        twiml.say({
            voice: 'Polly.Joanna',
        }, 'I have detected this may be an emergency. Transferring you to emergency services immediately.');

        twiml.dial(phoneNumber);

        return twiml;
    }

    /**
     * Get WebSocket URL based on environment
     */
    private getWebSocketUrl(): string {
        // In production, this would be your public WebSocket URL
        // For now, using localhost (requires ngrok for Twilio testing)
        return process.env.WEBSOCKET_URL || `localhost:${config.port}`;
    }

    /**
     * Validate Twilio webhook signature
     */
    public validateRequest(authToken: string, signature: string, url: string, params: any): boolean {
        return twilio.validateRequest(authToken, signature, url, params);
    }
}
