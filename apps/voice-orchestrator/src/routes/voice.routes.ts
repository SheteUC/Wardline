import { Router, Request, Response } from 'express';
import { TwilioService } from '../services/twilio.service';
import { CallStateMachine } from '../state-machine/call-state-machine';
import { CallContextManager } from '../state-machine/call-context';

const router = Router();
const twilioService = new TwilioService();
const callContextManager = new CallContextManager();

/**
 * POST /voice/incoming
 * Initial webhook when a call comes in
 */
router.post('/incoming', async (req: Request, res: Response) => {
    try {
        const { CallSid, From, To } = req.body;

        console.log(`📞 Incoming call: ${CallSid} from ${From} to ${To}`);

        // Create call context
        const callContext = callContextManager.createContext(CallSid, {
            from: From,
            to: To,
            hospitalId: '', // Will be determined by phone number lookup
        });

        // Initialize state machine
        const stateMachine = new CallStateMachine(callContext);
        await stateMachine.transition('START');

        // Generate TwiML response with greeting and WebSocket connection
        const twiml = twilioService.generateGreetingWithWebSocket(CallSid);

        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error in /voice/incoming:', error);

        // Return error TwiML
        const errorTwiml = twilioService.generateErrorResponse();
        res.type('text/xml');
        res.send(errorTwiml.toString());
    }
});

/**
 * POST /voice/gather
 * Callback for gathering DTMF or speech input
 */
router.post('/gather', async (req: Request, res: Response) => {
    try {
        const { CallSid, SpeechResult, Digits } = req.body;

        console.log(`🎤 Gather result for ${CallSid}:`, { SpeechResult, Digits });

        const input = SpeechResult || Digits;

        if (!input) {
            const twiml = twilioService.generateNoInputResponse();
            res.type('text/xml');
            res.send(twiml.toString());
            return;
        }

        // Process input through state machine
        const context = callContextManager.getContext(CallSid);
        if (!context) {
            throw new Error('Call context not found');
        }

        const stateMachine = new CallStateMachine(context);
        await stateMachine.handleInput(input);

        // Generate response based on current state
        const twiml = twilioService.generateContinueResponse();
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error in /voice/gather:', error);

        const errorTwiml = twilioService.generateErrorResponse();
        res.type('text/xml');
        res.send(errorTwiml.toString());
    }
});

/**
 * POST /voice/status
 * Call status callbacks
 */
router.post('/status', async (req: Request, res: Response) => {
    try {
        const { CallSid, CallStatus, CallDuration } = req.body;

        console.log(`📊 Call status update: ${CallSid} - ${CallStatus} (${CallDuration}s)`);

        if (CallStatus === 'completed' || CallStatus === 'failed') {
            // Cleanup call context
            callContextManager.removeContext(CallSid);
            console.log(`🗑️ Cleaned up context for call ${CallSid}`);
        }

        res.sendStatus(200);
    } catch (error) {
        console.error('Error in /voice/status:', error);
        res.sendStatus(500);
    }
});

export const voiceRoutes: Router = router;
