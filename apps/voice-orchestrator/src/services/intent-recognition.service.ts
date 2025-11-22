import { OpenAIClient, AzureKeyCredential } from '@azure/openai';
import { IntentDetectionResult } from '@wardline/types';
import { config } from '../config';

/**
 * Intent recognition using Azure OpenAI function calling
 */
export class IntentRecognitionService {
    private client: OpenAIClient;

    constructor() {
        this.client = new OpenAIClient(
            config.azureOpenAI.endpoint,
            new AzureKeyCredential(config.azureOpenAI.key)
        );
    }

    /**
     * Detect intent from user input
     */
    public async detectIntent(
        input: string,
        conversationHistory: Array<{ role: string; content: string }>
    ): Promise<IntentDetectionResult> {
        try {
            const messages: any[] = [
                {
                    role: 'system',
                    content: this.getIntentDetectionPrompt(),
                },
                ...conversationHistory.slice(-5), // Last 5 messages for context
                {
                    role: 'user',
                    content: input,
                },
            ];

            const response = await this.client.getChatCompletions(
                config.azureOpenAI.deployment,
                messages,
                {
                    functions: this.getIntentFunctions(),
                    functionCall: 'auto' as any,
                    temperature: 0.3,
                    maxTokens: 150,
                }
            );

            const choice = response.choices[0];

            if (choice.message?.functionCall) {
                const functionCall = choice.message.functionCall;
                const args = JSON.parse(functionCall.arguments || '{}');

                return {
                    intentKey: args.intent || 'general_inquiry',
                    confidence: args.confidence || 0.5,
                    subIntent: args.subIntent,
                    extractedFields: args.fields || {},
                };
            }

            // Fallback if no function call
            return {
                intentKey: 'general_inquiry',
                confidence: 0.3,
                extractedFields: {},
            };
        } catch (error) {
            console.error('Error detecting intent:', error);

            return {
                intentKey: 'general_inquiry',
                confidence: 0,
                extractedFields: {},
            };
        }
    }

    /**
     * Get intent detection system prompt
     */
    private getIntentDetectionPrompt(): string {
        return `You are an intent classifier for a hospital phone system.
Analyze the user's input and determine their intent.

Available intents:
- schedule_appointment: User wants to book or schedule an appointment
- billing_inquiry: Questions about bills, insurance, or payments
- prescription_refill: Request for prescription refills or prior authorization
- medical_records: Request for medical records or forms
- general_inquiry: General questions or other topics

Extract relevant fields like dates, times, names, or specific requests.
Return your analysis as a function call.`;
    }

    /**
     * Define intent detection functions for OpenAI
     */
    private getIntentFunctions(): any[] {
        return [
            {
                name: 'classify_intent',
                description: 'Classify the user intent and extract relevant fields',
                parameters: {
                    type: 'object',
                    properties: {
                        intent: {
                            type: 'string',
                            enum: [
                                'schedule_appointment',
                                'billing_inquiry',
                                'prescription_refill',
                                'medical_records',
                                'general_inquiry',
                            ],
                            description: 'The detected intent',
                        },
                        confidence: {
                            type: 'number',
                            description: 'Confidence score between 0 and 1',
                        },
                        subIntent: {
                            type: 'string',
                            description: 'More specific sub-intent if applicable',
                        },
                        fields: {
                            type: 'object',
                            description: 'Extracted fields like dates, names, or specific requests',
                        },
                    },
                    required: ['intent', 'confidence'],
                },
            },
        ];
    }
}
