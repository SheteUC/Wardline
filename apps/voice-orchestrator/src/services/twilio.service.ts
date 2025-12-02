import twilio from 'twilio';
import { config } from '../config';

const VoiceResponse = twilio.twiml.VoiceResponse;

export class TwilioService {
    constructor() {
        // Twilio client initialized per-request if needed
    }

    /**
     * Generate TwiML for greeting with speech gather
     */
    public generateGreetingWithWebSocket(_callSid: string): twilio.twiml.VoiceResponse {
        const twiml = new VoiceResponse();

        // Gather speech input from caller - greeting is inside gather
        const gather = twiml.gather({
            input: ['speech'],
            action: '/voice/process',
            method: 'POST',
            speechTimeout: 'auto',
            speechModel: 'phone_call',
            enhanced: true,
            language: 'en-US',
        });
        
        // Initial greeting - only this is spoken
        gather.say({
            voice: 'Polly.Joanna',
        }, 'Hello, welcome to Wardline Medical Center. How can I help you today?');

        // If gather times out with no input
        twiml.say({
            voice: 'Polly.Joanna',
        }, 'I didn\'t catch that. How can I help you?');
        
        twiml.redirect('/voice/incoming');

        return twiml;
    }
    
    /**
     * Generate TwiML response with AI message and continue gathering
     */
    public generateAIResponse(aiMessage: string): twilio.twiml.VoiceResponse {
        const twiml = new VoiceResponse();

        // Say the AI response inside gather so it starts listening immediately after
        const gather = twiml.gather({
            input: ['speech'],
            action: '/voice/process',
            method: 'POST',
            speechTimeout: 'auto',
            speechModel: 'phone_call',
            enhanced: true,
            language: 'en-US',
        });
        
        // AI response is the only thing spoken - no extra prompts
        gather.say({
            voice: 'Polly.Joanna',
        }, aiMessage);

        // If no input after AI speaks, prompt once
        twiml.say({
            voice: 'Polly.Joanna',
        }, 'Are you still there?');
        
        twiml.redirect('/voice/incoming');

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
