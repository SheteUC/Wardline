import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { CallContext } from '../state-machine/call-context';
import { config } from '../config';

/**
 * Conversation manager using Azure OpenAI
 */
export class ConversationManagerService {
    private client: OpenAIClient;

    constructor() {
        this.client = new OpenAIClient(
            config.azureOpenAI.endpoint,
            new AzureKeyCredential(config.azureOpenAI.key)
        );
    }

    /**
     * Generate initial greeting
     */
    public async generateGreeting(_context: CallContext): Promise<string> {
        const systemPrompt = `You are a friendly and professional hospital receptionist AI.
Greet the caller warmly and ask how you can help them today.
Keep it brief (1-2 sentences).`;

        const response = await this.generateResponse(systemPrompt, []);
        return response;
    }

    /**
     * Generate emergency screening question
     */
    public async generateEmergencyScreening(context: CallContext): Promise<string> {
        const systemPrompt = `You are a hospital triage AI conducting emergency screening.
Ask if the caller or someone with them is experiencing any life-threatening symptoms.
Be direct but compassionate. Keep it brief (1-2 sentences).`;

        const response = await this.generateResponse(systemPrompt, context.conversationHistory);
        return response;
    }

    /**
     * Process booking input and generate next question
     */
    public async processBookingInput(context: CallContext, input: string): Promise<string> {
        const systemPrompt = `You are helping a caller schedule a medical appointment.
Review what information you have and ask for missing details:
- Preferred date and time
- Reason for visit
- Patient name
- Callback phone number

Current extracted fields: ${JSON.stringify(context.extractedFields)}

Ask for the next missing piece of information. Be conversational and helpful.`;

        const messages = [
            ...context.conversationHistory,
            { role: 'user', content: input },
        ];

        const response = await this.generateResponse(systemPrompt, messages);
        return response;
    }

    /**
     * Generate response using Azure OpenAI
     */
    private async generateResponse(
        systemPrompt: string,
        conversationHistory: Array<{ role: string; content: string }>
    ): Promise<string> {
        try {
            const messages: any[] = [
                { role: 'system', content: systemPrompt },
                ...conversationHistory.slice(-5), // Keep last 5 messages for context
            ];

            const response = await this.client.getChatCompletions(
                config.azureOpenAI.deployment,
                messages,
                {
                    temperature: 0.7,
                    maxTokens: 150,
                }
            );

            const content = response.choices[0]?.message?.content || 'I apologize, could you please repeat that?';

            console.log(`🤖 LLM response: ${content}`);

            return content;
        } catch (error) {
            console.error('Error generating response:', error);
            return 'I apologize, but I\'m having trouble processing that right now. Let me connect you with a staff member.';
        }
    }

    /**
     * Generate response with streaming (for real-time TTS)
     */
    public async *streamResponse(
        systemPrompt: string,
        conversationHistory: Array<{ role: string; content: string }>
    ): AsyncGenerator<string> {
        try {
            const messages: any[] = [
                { role: 'system', content: systemPrompt },
                ...conversationHistory.slice(-5),
            ];

            const stream = await this.client.streamChatCompletions(
                config.azureOpenAI.deployment,
                messages,
                {
                    temperature: 0.7,
                    maxTokens: 150,
                }
            );

            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content;
                if (delta) {
                    yield delta;
                }
            }
        } catch (error) {
            console.error('Error streaming response:', error);
            yield 'I apologize, but I\'m having trouble right now.';
        }
    }
}
