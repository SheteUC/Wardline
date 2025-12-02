import { Router, Request, Response } from 'express';
import { TwilioService } from '../services/twilio.service';
import { CallStateMachine } from '../state-machine/call-state-machine';
import { CallContextManager } from '../state-machine/call-context';
import { ConversationManagerService } from '../services/conversation-manager.service';

const router = Router();
const twilioService = new TwilioService();
const callContextManager = new CallContextManager();
const conversationManager = new ConversationManagerService();

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
 * POST /voice/process
 * Process speech input and generate AI response
 */
router.post('/process', async (req: Request, res: Response) => {
    try {
        const { CallSid, SpeechResult, Confidence } = req.body;

        console.log(`🎤 Speech received for ${CallSid}: "${SpeechResult}" (confidence: ${Confidence})`);

        if (!SpeechResult) {
            const twiml = twilioService.generateNoInputResponse();
            res.type('text/xml');
            res.send(twiml.toString());
            return;
        }

        // Get or create call context
        let context = callContextManager.getContext(CallSid);
        if (!context) {
            context = callContextManager.createContext(CallSid, {
                from: req.body.From || '',
                to: req.body.To || '',
                hospitalId: '',
            });
        }

        // Add user message to conversation history
        context.conversationHistory.push({
            role: 'user',
            content: SpeechResult,
        });

        // Generate AI response using conversation manager
        const systemPrompt = `You are a friendly and professional hospital receptionist AI for Wardline Medical Center.
Help callers with:
- Scheduling appointments
- Prescription refills
- Billing questions
- General inquiries
- Connecting to the right department

Keep responses brief and conversational (2-3 sentences max).
If someone has a medical emergency, tell them to hang up and call 911.

Current conversation context:
${context.conversationHistory.slice(-4).map(m => `${m.role}: ${m.content}`).join('\n')}`;

        const messages = context.conversationHistory.slice(-5);
        
        // Call LLM for response
        const aiResponse = await generateAIResponseText(systemPrompt, messages);
        
        console.log(`🤖 AI Response: ${aiResponse}`);

        // Add AI response to history
        context.conversationHistory.push({
            role: 'assistant',
            content: aiResponse,
        });

        // Generate TwiML with AI response
        const twiml = twilioService.generateAIResponse(aiResponse);
        res.type('text/xml');
        res.send(twiml.toString());
    } catch (error) {
        console.error('Error in /voice/process:', error);

        const errorTwiml = twilioService.generateErrorResponse();
        res.type('text/xml');
        res.send(errorTwiml.toString());
    }
});

/**
 * Helper function to generate AI response
 */
async function generateAIResponseText(
    systemPrompt: string,
    conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
    try {
        // Use Azure OpenAI directly
        const { OpenAIClient, AzureKeyCredential } = await import('@azure/openai');
        const { config } = await import('../config');
        
        const client = new OpenAIClient(
            config.azureOpenAI.endpoint,
            new AzureKeyCredential(config.azureOpenAI.key),
            { apiVersion: '2024-12-01-preview' }
        );

        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-5),
        ];

        const response = await client.getChatCompletions(
            config.azureOpenAI.deployment,
            messages,
            {
                maxCompletionTokens: 150,
            } as any
        );

        return response.choices[0]?.message?.content || 'I apologize, could you please repeat that?';
    } catch (error) {
        console.error('Error generating AI response:', error);
        return 'I\'m sorry, I\'m having trouble understanding. Let me connect you with a staff member.';
    }
}

/**
 * POST /voice/gather
 * Callback for gathering DTMF or speech input (legacy)
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
