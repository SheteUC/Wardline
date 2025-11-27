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
- schedule_appointment: User wants to book, cancel, or change an appointment
- department_routing: User needs to reach a specific department (X-ray, MRI, Lab, etc.)
- prescription_refill: Request for prescription refills or medication questions
- insurance_verification: Questions about insurance acceptance, eligibility, or coverage
- marketing_event: Questions about seminars, classes, health fairs, or event registration
- billing_inquiry: Questions about bills or payments
- medical_records: Request for medical records or forms
- general_inquiry: General questions or other topics

Extract relevant fields like dates, times, names, department names, medication names, insurance carriers, or specific requests.
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
                                'department_routing',
                                'prescription_refill',
                                'insurance_verification',
                                'marketing_event',
                                'billing_inquiry',
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
                            properties: {
                                patientName: { type: 'string', description: 'Patient name if mentioned' },
                                phoneNumber: { type: 'string', description: 'Phone number if mentioned' },
                                dateOfBirth: { type: 'string', description: 'Date of birth if mentioned' },
                                departmentName: { type: 'string', description: 'Department name for routing' },
                                serviceType: { type: 'string', description: 'Service type (X-ray, MRI, etc.)' },
                                medicationName: { type: 'string', description: 'Medication name for refills' },
                                prescriberName: { type: 'string', description: 'Prescribing doctor name' },
                                insuranceCarrier: { type: 'string', description: 'Insurance carrier name' },
                                insurancePlan: { type: 'string', description: 'Insurance plan name' },
                                eventType: { type: 'string', description: 'Type of marketing event' },
                                preferredDate: { type: 'string', description: 'Preferred date/time' },
                            },
                            description: 'Extracted fields from the conversation',
                        },
                    },
                    required: ['intent', 'confidence'],
                },
            },
        ];
    }
}
